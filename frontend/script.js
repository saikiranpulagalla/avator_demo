// script.js
// Front-end LiveAvatar client (token -> start -> LiveKit flow)
// NOTE: add LiveKit client script to your HTML:
// <script src="https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js"></script>

let config = null;

function initializeConfig() {
  const APP_CONFIG = window.APP_CONFIG || {};
  console.log('[config] window.APP_CONFIG:', APP_CONFIG);

  config = {
    sessionId: APP_CONFIG.sessionId || new URLSearchParams(window.location.search).get('sessionId') || 'session-' + Date.now(),
    liveKitUrl: APP_CONFIG.liveKitUrl || new URLSearchParams(window.location.search).get('url') || '',
    liveKitToken: APP_CONFIG.liveKitToken || new URLSearchParams(window.location.search).get('livekit_token') || '',
    webhookUrl: APP_CONFIG.webhookUrl || new URLSearchParams(window.location.search).get('webhook') || 'http://localhost:5679/webhook/avatar-transcript',
    avatarId: APP_CONFIG.avatarId || '',
    voiceId: APP_CONFIG.voiceId || '', // optional: LiveAvatar may accept persona UUIDs
    contextId: APP_CONFIG.contextId || '', // optional LiveAvatar persona context id
    proxyApiUrl: APP_CONFIG.proxyApiUrl || 'http://localhost:8083',
    mockMode: !!APP_CONFIG.mockMode
  };

  console.log('[config] Final config:', config);
}

initializeConfig();

// Try to fetch proxy config and override avatar/voice if available
async function fetchProxyConfig() {
  try {
    const resp = await fetch(`${config.proxyApiUrl}/config`);
    if (resp.ok) {
      const data = await resp.json();
      console.log('[config] fetched from proxy:', data);
      if (data.avatarId) config.avatarId = data.avatarId;
      if (data.voiceId) config.voiceId = data.voiceId;
      if (data.contextId) config.contextId = data.contextId;
    }
  } catch (e) {
    console.warn('[config] could not fetch proxy config:', e && e.message);
  }
}
fetchProxyConfig();

// DOM elements
const statusBar = document.getElementById('statusBar');
const statusText = document.getElementById('statusText');
const startBtn = document.getElementById('startBtn');
const endBtn = document.getElementById('endBtn');
const remoteVideo = document.getElementById('remoteVideo');
const videoOverlay = document.getElementById('videoOverlay');
const sessionIdDisplay = document.getElementById('sessionIdDisplay');

let room = null;
let conversationTranscript = [];
let sessionStartTime = null;
let isConnected = false;
// Session prefill key (created by the separate create page)
const SESSION_PREFILL_KEY = 'AVATAR_CREATION_RESPONSE';

document.addEventListener('DOMContentLoaded', () => {
  if (sessionIdDisplay) sessionIdDisplay.textContent = config.sessionId;
  // If a prefill is present (from the separate create page), use it and auto-start
  try {
    const raw = sessionStorage.getItem(SESSION_PREFILL_KEY);
    if (raw) {
      console.log('[startup] Found prefill session data');
      const data = JSON.parse(raw);
      // Apply returned avatar/session info
      if (data.avatar_id) config.avatarId = data.avatar_id;
      if (data.voice_id) config.voiceId = data.voice_id;
      if (data.language) config.language = data.language;
      // If livekit creds present, connect directly
      const lkUrl = data.livekit_url || data.data?.livekit_url;
      const lkToken = data.livekit_token || data.livekit_client_token || data.data?.livekit_client_token || data.data?.livekit_token;
      const sessionToken = data.session_token || data.data?.session_token;
      if (lkUrl && lkToken) {
        console.log('[startup] Auto-connecting to LiveKit from prefill');
        // remove prefill to avoid duplicate attempts
        sessionStorage.removeItem(SESSION_PREFILL_KEY);
        connectToLiveKit(lkUrl, lkToken).catch((e) => console.error('[startup] livekit connect failed', e));
        return;
      }
      if (sessionToken) {
        console.log('[startup] Auto-starting session via proxy using session_token');
        sessionStorage.removeItem(SESSION_PREFILL_KEY);
        // call proxy /v1/sessions/start using the session token
        (async () => {
          try {
            updateStatus('Starting session...', 'connecting');
            const startResp = await fetch(`${config.proxyApiUrl}/v1/sessions/start`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${sessionToken}`,
                'Accept': 'application/json'
              },
              body: JSON.stringify({})
            });
            if (!startResp.ok) {
              const txt = await startResp.text().catch(() => 'no body');
              throw new Error(`Session start failed: ${startResp.status} ${txt}`);
            }
            const startDataRaw = await startResp.json();
            const startData = (startDataRaw && startDataRaw.data) ? startDataRaw.data : startDataRaw;
            const lkUrl2 = startData.livekit_url || startData.url || startData.room_url;
            const lkToken2 = startData.livekit_client_token || startData.token || startData.room_token;
            if (!lkUrl2 || !lkToken2) throw new Error('start response missing liveKit data');
            await connectToLiveKit(lkUrl2, lkToken2);
          } catch (err) {
            console.error('[startup] auto start failed', err);
            updateStatus('Auto-start failed: ' + (err.message || err), 'error');
          }
        })();
      }
    }
  } catch (e) {
    console.warn('[startup] prefill parse error', e && e.message);
  }
});

function updateStatus(msg, type = 'info') {
  if (statusText) statusText.textContent = msg;
  if (statusBar) statusBar.className = 'status ' + type;
  console.log(`[${type.toUpperCase()}] ${msg}`);
}

function addTranscriptEntry(role, content) {
  conversationTranscript.push({ role, content, timestamp: new Date().toISOString() });
  console.log(`[transcript] ${role}: ${content}`);
}

// small helper to test for UUIDs (for optional persona use)
const isUuid = (id) => !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// Generate a v4 UUID (fallback for context_id when not provided)
function generateUuidV4() {
  // simple client-side UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// START flow
startBtn.addEventListener('click', async () => {
  try {
    startBtn.disabled = true;
    updateStatus('Initializing session...', 'connecting');
    sessionStartTime = new Date().toISOString();

    // Ensure any existing session is disconnected before starting a new one
    // (prevents "Session concurrency limit reached" errors)
    if (isConnected && room) {
      try {
        console.log('[start] Disconnecting existing session to prevent concurrency limit');
        room.disconnect();
        room = null;
        isConnected = false;
      } catch (e) {
        console.warn('[start] error disconnecting old session:', e && e.message);
      }
    }

    // If mock mode is enabled, simulate a connected session immediately.
    if (config.mockMode) {
      console.warn('[start] mockMode active — simulating session');
      setTimeout(() => {
        try {
          if (videoOverlay) videoOverlay.classList.add('hidden');
        } catch (e) {}
          // Show a simple placeholder avatar image inside the video area for mock mode
          try {
            if (remoteVideo) {
              const svg = encodeURIComponent(`
                <svg xmlns='http://www.w3.org/2000/svg' width='1280' height='720' viewBox='0 0 1280 720'>
                  <rect width='100%' height='100%' fill='%23111827' />
                  <circle cx='640' cy='360' r='220' fill='%23ffd166' />
                  <circle cx='580' cy='330' r='30' fill='%23000000' />
                  <circle cx='700' cy='330' r='30' fill='%23000000' />
                  <path d='M560 420 Q640 480 720 420' stroke='%23000000' stroke-width='12' fill='none' stroke-linecap='round' />
                  <text x='50%' y='620' font-size='36' fill='%23ffffff' text-anchor='middle' font-family='Arial'>Mock Avatar</text>
                </svg>
              `);
              remoteVideo.style.backgroundImage = `url("data:image/svg+xml;utf8,${svg}")`;
              remoteVideo.style.backgroundSize = 'cover';
              remoteVideo.style.backgroundPosition = 'center';
              // remove any media source to avoid black screen
              try { remoteVideo.removeAttribute('src'); remoteVideo.load(); } catch (e) {}
            }
          } catch (e) {}
          updateStatus('Connected (mock)', 'connected');
        isConnected = true;
        startBtn.style.display = 'none';
        endBtn.style.display = 'inline-block';
        endBtn.disabled = false;
        addTranscriptEntry('system', 'Mock conversation started');
      }, 300);
      return;
    }

    // If client already has LiveKit creds via URL/config, use them
    if (config.liveKitUrl && config.liveKitToken) {
      await connectToLiveKit(config.liveKitUrl, config.liveKitToken);
      return;
    }

    // Validate avatar id
    if (!config.avatarId) {
      throw new Error('No avatarId configured. Set window.APP_CONFIG.avatarId or proxy /config must return avatarId.');
    }

    const proxy = config.proxyApiUrl;
    const avatarId = config.avatarId;
    const voiceId = config.voiceId;

    // STEP 1: Create session token (POST /v1/sessions/token)
    updateStatus('Requesting session token...', 'connecting');

    // Use CONVERSATION mode which does not require avatar_persona or voice UUIDs.
    const tokenPayload = {
      mode: 'CONVERSATION',
      avatar_id: avatarId
    };

    console.log('[start] POST', `${proxy}/v1/sessions/token`, tokenPayload);
    let tokenResp = await fetch(`${proxy}/v1/sessions/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenPayload)
    });

    // If token creation failed due to mode/persona validation, attempt a safe FULL-mode fallback.
    if (!tokenResp.ok) {
      const txt = await tokenResp.text().catch(() => 'no body');
      console.warn('[start] token creation initial attempt failed:', tokenResp.status, txt);

      // Try to detect common validation errors and retry with a minimal FULL persona payload.
      const shouldFallback = (tokenResp.status === 422) && (String(txt).toLowerCase().includes('conversation') || String(txt).toLowerCase().includes('avatar_persona') || String(txt).toLowerCase().includes('field required'));
      if (shouldFallback) {
        console.log('[start] Attempting fallback: retrying token creation with minimal FULL avatar_persona');
        // Ensure avatar_persona includes a context_id — upstream requires this for FULL mode.
        // If configured, use it; otherwise use a stable placeholder UUID.
        const contextIdToUse = config.contextId && config.contextId.length ? config.contextId : '00000000-0000-0000-0000-000000000001';
        console.log('[start] Using context_id for token creation:', contextIdToUse);
        const fallbackPayload = {
          mode: 'FULL',
          avatar_id: avatarId,
          avatar_persona: {
            context_id: contextIdToUse,
            instructions: 'You are a supportive, helpful avatar that assists the user clearly and concisely.',
            style: 'conversational',
            knowledge: ''
          }
        };
        console.log('[start] POST (fallback)', `${proxy}/v1/sessions/token`, fallbackPayload);
        tokenResp = await fetch(`${proxy}/v1/sessions/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackPayload)
        });
        if (!tokenResp.ok) {
          const txt2 = await tokenResp.text().catch(() => 'no body');
          throw new Error(`Token creation failed (fallback): ${tokenResp.status} ${txt2}`);
        }
      } else {
        throw new Error(`Token creation failed: ${tokenResp.status} ${txt}`);
      }
    }

    const tokenDataRaw = await tokenResp.json();
    console.log('[start] token response', tokenDataRaw);

    // Support both raw and wrapped responses. Some proxy versions return:
    // { code: 1000, data: { session_token: '...', ... }, message: '...' }
    // while others return the old flat form: { session_token: '...', ... }
    const tokenData = (tokenDataRaw && tokenDataRaw.data) ? tokenDataRaw.data : tokenDataRaw;

    const sessionToken = tokenData.session_token || tokenData.token || tokenData.sessionToken;
    const sessionId = tokenData.session_id || tokenData.sessionId || tokenData.session;

    if (!sessionToken) {
      console.error('[start] token endpoint returned (unexpected):', tokenDataRaw);
      throw new Error('No session_token returned from token endpoint');
    }

    config.sessionId = sessionId || config.sessionId;
    if (sessionIdDisplay) sessionIdDisplay.textContent = config.sessionId;

    // STEP 2: Start session (POST /v1/sessions/start) using Bearer session_token
    updateStatus('Starting session...', 'connecting');
    console.log('[start] POST', `${proxy}/v1/sessions/start`);

    const startResp = await fetch(`${proxy}/v1/sessions/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({}) // empty body is acceptable; proxy uses auth header
    });

    if (!startResp.ok) {
      const txt = await startResp.text().catch(() => 'no body');
      throw new Error(`Session start failed: ${startResp.status} ${txt}`);
    }

    const startDataRaw = await startResp.json();
    console.log('[start] start response', startDataRaw);

    // Some proxies wrap the payload in { code, data: {...} }
    const startData = (startDataRaw && startDataRaw.data) ? startDataRaw.data : startDataRaw;

    // LiveAvatar should return livekit url + token (various possible field names)
    const liveKitUrl = startData.url || startData.livekit_url || startData.livekitUrl || startData.room_url;
    const liveKitToken = startData.token || startData.room_token || startData.livekit_token || startData.livekit_client_token || startData.livekitToken;

    if (!liveKitUrl || !liveKitToken) {
      console.error('[start] start response:', startDataRaw);
      throw new Error('start response missing liveKit url/token');
    }

    // STEP 3: Connect to LiveKit
    await connectToLiveKit(liveKitUrl, liveKitToken);

  } catch (err) {
    console.error('[start] error', err);
    updateStatus('Failed: ' + (err.message || err), 'error');
    startBtn.disabled = false;

    if (config.mockMode) {
      console.warn('[start] mockMode active — simulating');
      setTimeout(() => {
        if (videoOverlay) videoOverlay.classList.add('hidden');
        updateStatus('Connected (mock)', 'connected');
        isConnected = true;
        startBtn.style.display = 'none';
        endBtn.style.display = 'inline-block';
        endBtn.disabled = false;
        addTranscriptEntry('system', 'Mock conversation started');
      }, 400);
    }
  }
});

// CONNECT TO LIVEKIT
async function connectToLiveKit(url, token) {
  try {
    updateStatus('Connecting to LiveKit...', 'connecting');

    if (typeof LivekitClient === 'undefined') {
      throw new Error('LiveKit client missing. Add script tag for livekit-client.umd.min.js');
    }

    console.log('[livekit] connect', url);

    // Create Room object (LiveKit client global API)
    room = new LivekitClient.Room({
      adaptiveStream: true,
      dynacast: true
    });

    room.on(LivekitClient.RoomEvent.Disconnected, (reason) => {
      console.log('[livekit] disconnected', reason);
      updateStatus('Disconnected', 'error');
    });

    room.on(LivekitClient.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('[livekit] track subscribed', track.kind);
      if (track.kind === LivekitClient.Track.Kind.Video) {
        try {
          // attach to <video> element
          const attached = track.attach();
          if (remoteVideo) {
            remoteVideo.srcObject = attached instanceof HTMLMediaElement ? attached.srcObject : null;
            // fallback: append video element
            if (!remoteVideo.srcObject) {
              if (attached instanceof HTMLMediaElement) {
                remoteVideo.parentNode.replaceChild(attached, remoteVideo);
              } else {
                remoteVideo.appendChild(attached);
              }
            }
          } else {
            document.body.appendChild(track.attach());
          }
          if (videoOverlay) videoOverlay.classList.add('hidden');
          updateStatus('Avatar live - Speak now!', 'connected');
          isConnected = true;
        } catch (e) {
          console.warn('[livekit] attach video error', e && e.message);
        }
      } else if (track.kind === LivekitClient.Track.Kind.Audio) {
        // audio attaches itself
        const audioEl = track.attach();
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        console.log('[livekit] audio attached');
      }
    });

    console.log('[livekit] connecting to room');
    await room.connect(url, token, { autoSubscribe: true });
    console.log('[livekit] connected');

    // enable local mic (ask for permission)
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      console.log('[livekit] microphone enabled');
    } catch (e) {
      console.warn('[livekit] microphone enable failed', e && e.message);
    }

    updateStatus('Ready - Speak to the avatar!', 'connected');
    if (startBtn) startBtn.style.display = 'none';
    if (endBtn) { endBtn.style.display = 'inline-block'; endBtn.disabled = false; }
    addTranscriptEntry('system', 'Conversation started');

  } catch (err) {
    console.error('[livekit] error', err);
    throw err;
  }
}

// END / cleanup
endBtn.addEventListener('click', async () => {
  try {
    updateStatus('Ending session...', 'connecting');
    addTranscriptEntry('system', 'Conversation ended');

    if (room) {
      room.disconnect();
      room = null;
    }

    await sendTranscriptToWebhook();

    updateStatus('Session ended', 'info');
    if (startBtn) startBtn.style.display = 'inline-block';
    if (endBtn) endBtn.style.display = 'none';
    if (videoOverlay) videoOverlay.classList.remove('hidden');
    isConnected = false;
    conversationTranscript = [];
  } catch (e) {
    console.error('[end] error', e);
  }
});

// SEND TRANSCRIPT
async function sendTranscriptToWebhook() {
  try {
    updateStatus('Saving conversation...', 'connecting');
    const payload = {
      session_id: config.sessionId,
      transcript: conversationTranscript,
      started_at: sessionStartTime,
      ended_at: new Date().toISOString(),
      duration_ms: sessionStartTime ? (new Date() - new Date(sessionStartTime)) : 0
    };
    console.log('[webhook] posting', config.webhookUrl, payload);
    const resp = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (resp.ok) {
      console.log('[webhook] sent successfully (status', resp.status + ')');
    } else {
      const errText = await resp.text().catch(() => '(no body)');
      console.error('[webhook] failed', resp.status, errText);
    }
  } catch (e) {
    console.error('[webhook] error', e && e.message);
  }
}

// cleanup on unload
window.addEventListener('beforeunload', () => {
  if (isConnected && room) {
    try { room.disconnect(); } catch (e) {}
    sendTranscriptToWebhook();
  }
});

// video error handling
if (remoteVideo) {
  remoteVideo.addEventListener('error', (ev) => {
    console.error('[video] error', ev);
    updateStatus('Video playback error', 'error');
  });
}

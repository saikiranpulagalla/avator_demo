// we-proxy.js
// Combined WebSocket + HTTP proxy for LiveAvatar (modern token/start flow)
// Usage: set .env values then run `node we-proxy.js`
//
// Required env variables:
//   LIVEAVATAR_API_KEY       - your LiveAvatar API key
//   LIVEAVATAR_AVATAR_ID    (optional) default avatar id returned by GET /config
//   LIVEAVATAR_VOICE_ID     (optional) default voice id (can be UUID or omitted)
//   WS_PROXY_PORT (optional) default 8081
//   HTTP_PROXY_PORT (optional) default 8082

// --- dotenv fallback (works even if dotenv package not installed) ---
function loadDotenvFallback() {
  try { require('dotenv').config(); return; } catch (e) { /* dotenv not installed */ }
  const fs = require('fs');
  const path = require('path');
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  });
}
loadDotenvFallback();

const WebSocket = require('ws');
const http = require('http');
const https = require('https');

const LIVEAVATAR_API_KEY = process.env.LIVEAVATAR_API_KEY;
const LIVEAVATAR_API_BASE = process.env.LIVEAVATAR_API_BASE || 'api.liveavatar.com';
const TARGET_WS = process.env.LIVEAVATAR_WS_URL || 'wss://api.liveavatar.com/v1/streaming';
const WS_PROXY_PORT = parseInt(process.env.WS_PROXY_PORT || '8081', 10);
const HTTP_PROXY_PORT = parseInt(process.env.HTTP_PROXY_PORT || '8082', 10);
const DEFAULT_AVATAR_ID = process.env.LIVEAVATAR_AVATAR_ID || '';
const DEFAULT_VOICE_ID = process.env.LIVEAVATAR_VOICE_ID || '';
const DEFAULT_CONTEXT_ID = process.env.LIVEAVATAR_CONTEXT_ID || '';

if (!LIVEAVATAR_API_KEY) {
  console.error('❌ LIVEAVATAR_API_KEY not set. Put it in .env or env vars.');
  process.exit(1);
}

console.log('\n🎭 LiveAvatar Proxy starting');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(` HTTP proxy port : ${HTTP_PROXY_PORT}`);
console.log(` WS proxy port   : ${WS_PROXY_PORT}`);
console.log(` LiveAvatar API  : https://${LIVEAVATAR_API_BASE}`);
console.log(` Default avatar  : ${DEFAULT_AVATAR_ID || '(none)'}`);
console.log(` Default voice   : ${DEFAULT_VOICE_ID || '(none)'}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// -------------------- WebSocket proxy --------------------
const wsServer = new WebSocket.Server({ port: WS_PROXY_PORT });
wsServer.on('connection', (client, req) => {
  const clientAddr = (req.socket && (req.socket.remoteAddress + ':' + req.socket.remotePort)) || 'unknown';
  console.log(`→ WS client connected: ${clientAddr}`);

  let remote = null;
  let remoteOpened = false;
  const pendingClientMessages = [];

  function openRemote(targetUrl, authHeader) {
    const headers = authHeader ? { Authorization: authHeader } : { Authorization: `Bearer ${LIVEAVATAR_API_KEY}` };
    console.log(`↗ Opening remote WS -> ${targetUrl}`);
    try {
      remote = new WebSocket(targetUrl, { headers });
    } catch (e) {
      console.error('Failed to open remote WS:', e && e.message);
      try { client.close(); } catch (e) {}
      return;
    }

    remote.on('open', () => {
      remoteOpened = true;
      console.log('↔ Remote WS connected');
      // flush queue
      while (pendingClientMessages.length) {
        const m = pendingClientMessages.shift();
        try { if (remote.readyState === WebSocket.OPEN) remote.send(m); } catch (e) {}
      }
    });

    remote.on('message', (msg) => {
      try { if (client.readyState === WebSocket.OPEN) client.send(msg); } catch (e) {}
    });

    remote.on('close', (code, reason) => {
      console.log(`↔ Remote WS closed code=${code} reason=${reason}`);
      try { if (client.readyState === WebSocket.OPEN) client.close(); } catch (e) {}
    });

    remote.on('error', (err) => {
      console.error('Remote WS error:', err && err.message);
      try { client.terminate(); } catch (e) {}
    });
  }

  client.on('message', (msg) => {
    try {
      if (!remote) {
        let parsed = null;
        try { parsed = JSON.parse(msg); } catch (e) { /* not JSON */ }
        if (parsed && parsed.connect_to) {
          const target = parsed.connect_to;
          const auth = parsed.access_token ? `Bearer ${parsed.access_token}` : null;
          openRemote(target, auth);
          return; // don't forward control message
        }
        // no explicit control msg => open default remote
        openRemote(TARGET_WS, null);
      }

      if (!remoteOpened) {
        pendingClientMessages.push(msg);
        return;
      }

      if (remote.readyState === WebSocket.OPEN) remote.send(msg);
    } catch (err) {
      console.error('WS proxy client message error:', err && err.message);
    }
  });

  client.on('close', (code) => {
    console.log(`← WS client disconnected: ${clientAddr} code=${code}`);
    try { if (remote) remote.close(); } catch (e) {}
  });

  client.on('error', (err) => {
    console.error('WS client error:', err && err.message);
    try { if (remote) remote.terminate(); } catch (e) {}
  });
});

wsServer.on('listening', () => {
  console.log(`🌉 WebSocket proxy listening on ws://localhost:${WS_PROXY_PORT}`);
});

wsServer.on('error', (err) => {
  console.error('WS server error:', err && err.message);
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${WS_PROXY_PORT} is already in use.`);
  }
});

// -------------------- HTTP proxy & REST forwarder --------------------
const httpServer = http.createServer((req, res) => {
  // Basic CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  // GET /config
  if (req.method === 'GET' && req.url === '/config') {
    const c = {
      avatarId: DEFAULT_AVATAR_ID,
      voiceId: DEFAULT_VOICE_ID,
      contextId: DEFAULT_CONTEXT_ID
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(c));
  }

  // GET /health
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', apiKey: !!LIVEAVATAR_API_KEY }));
  }

  // Only accept POST for forward
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    return res.end('Only POST supported on this endpoint (or GET /config /health)');
  }

  // Collect body
  let body = '';
  req.on('data', (chunk) => body += chunk);
  req.on('end', () => {
    console.log(`\n📤 HTTP ${req.method} ${req.url}`);
    console.log(`   Body (first 300 chars): ${String(body).substring(0,300)}${body.length > 300 ? '...' : ''}`);

    // Legacy streaming.new -> return helpful error
    if (req.url && req.url.indexOf('streaming.new') !== -1) {
      const msg = {
        error: 'streaming.new endpoint removed',
        detail: 'Use /v1/sessions/token then /v1/sessions/start (token/start flow). See GET /config for avatar/voice defaults.'
      };
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(msg));
    }

    // Special proxy endpoints: forward to configured webhook URLs in .env
    // POST /create-avatar -> forwards to WEBHOOK_URL_1
    // POST /submit-user  -> forwards to WEBHOOK_URL_2
    const forwardToWebhook = (req.url === '/create-avatar' && process.env.WEBHOOK_URL_1) || (req.url === '/submit-user' && process.env.WEBHOOK_URL_2);
    if (forwardToWebhook) {
      const targetUrl = req.url === '/create-avatar' ? process.env.WEBHOOK_URL_1 : process.env.WEBHOOK_URL_2;
      try {
        const target = new URL(targetUrl);
        const useHttps = target.protocol === 'https:';
        const forwardOptions = {
          hostname: target.hostname,
          port: target.port ? parseInt(target.port, 10) : (useHttps ? 443 : 80),
          path: target.pathname + (target.search || ''),
          method: 'POST',
          headers: {
            'Content-Type': req.headers['content-type'] || 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(body || '')
          },
          timeout: 20000
        };

        const client = useHttps ? https : http;
        const forwarded = client.request(forwardOptions, (fwdRes) => {
          let data = '';
          fwdRes.on('data', (chunk) => data += chunk);
          fwdRes.on('end', () => {
            const headers = {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization',
              'Content-Type': 'application/json'
            };
            res.writeHead(fwdRes.statusCode || 200, headers);
            return res.end(data);
          });
        });
        forwarded.on('error', (err) => {
          console.error('Webhook forward error:', err && err.message);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: err.message }));
        });
        forwarded.write(body || '');
        forwarded.end();
      } catch (err) {
        console.error('Invalid WEBHOOK_URL target:', err && err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid WEBHOOK_URL configured' }));
      }
      return;
    }

    // Determine authentication to forward
    // If client included Authorization header, forward it. Otherwise use X-API-KEY
    let authHeaderName = 'X-API-KEY';
    let authHeaderValue = LIVEAVATAR_API_KEY;
    if (req.headers && req.headers.authorization) {
      authHeaderName = 'authorization';
      authHeaderValue = req.headers.authorization;
    } else {
      // For session start endpoints, the client should pass session_token in body - but we still allow X-API-KEY fallback
      // (Most endpoints accept X-API-KEY on server-to-server; session actions accept Bearer session_token)
    }

    // Forward to LiveAvatar API
    const options = {
      hostname: LIVEAVATAR_API_BASE,
      port: 443,
      path: req.url,
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body || '')
      },
      timeout: 20000
    };
    if (authHeaderValue) options.headers[authHeaderName] = authHeaderValue;

    console.log(`   Forwarding to https://${options.hostname}${options.path}`);
    const proxied = https.request(options, (proxyRes) => {
      let data = '';
      proxyRes.on('data', (chunk) => data += chunk);
      proxyRes.on('end', () => {
        console.log(`📥 LiveAvatar responded: ${proxyRes.statusCode} (first 300 chars)`);
        console.log(`   ${String(data).substring(0,300)}${data.length > 300 ? '...' : ''}`);

        // Forward response back to client
        const headers = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Content-Type': 'application/json'
        };
        res.writeHead(proxyRes.statusCode || 200, headers);
        res.end(data);
      });
    });

    proxied.on('error', (err) => {
      console.error('HTTP proxy error:', err && err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    proxied.write(body || '');
    proxied.end();
  });
});

httpServer.listen(HTTP_PROXY_PORT, '127.0.0.1', () => {
  console.log(`🔁 HTTP proxy listening on http://localhost:${HTTP_PROXY_PORT}`);
  console.log('   → endpoints: GET /config, GET /health, POST /v1/sessions/token, POST /v1/sessions/start, etc.');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

httpServer.on('error', (err) => {
  console.error('HTTP server error:', err && err.message);
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${HTTP_PROXY_PORT} already in use.`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down proxy...');
  try { wsServer.close(); } catch (e) {}
  try { httpServer.close(); } catch (e) {}
  process.exit(0);
});

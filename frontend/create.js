// create.js - handles avatar creation form, posts to proxy /create-avatar
const avatarImageEl = document.getElementById('avatarImage');
const personaPromptEl = document.getElementById('personaPrompt');
const languageEl = document.getElementById('languageSelect');
const createBtn = document.getElementById('createBtn');
const statusEl = document.getElementById('createStatus');

function updateCreateStatus(msg, type='info'){
  if(!statusEl) return;
  statusEl.textContent = msg;
  statusEl.className = type;
  console.log('[create] ' + msg);
}

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    if(!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = ()=> resolve(String(reader.result).split(',')[1]);
    reader.onerror = (e)=> reject(e && e.message);
    reader.readAsDataURL(file);
  });
}

createBtn.addEventListener('click', async ()=>{
  try{
    createBtn.disabled = true;
    updateCreateStatus('Preparing payload...', 'info');
    const file = avatarImageEl && avatarImageEl.files && avatarImageEl.files[0];
    const image_b64 = await fileToBase64(file);
    const persona_prompt = personaPromptEl ? personaPromptEl.value : '';
    const language = languageEl ? languageEl.value : 'en';

    const payload = { image_base64: image_b64, persona_prompt, language };

    updateCreateStatus('Sending create request...', 'info');
    const proxyUrl = (window.APP_CONFIG && window.APP_CONFIG.proxyApiUrl) || 'http://localhost:8083';
    console.log('[create] Using proxyUrl ->', proxyUrl);
    const resp = await fetch(`${proxyUrl}/create-avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Read response body safely (may be empty or not JSON)
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '(no body)');
      throw new Error(`Create failed: ${resp.status} ${txt}`);
    }

    let textBody = '';
    try {
      textBody = await resp.text();
    } catch (e) {
      console.warn('[create] failed to read response text', e && e.message);
    }

    console.log('[create] create response status=', resp.status, 'body=', textBody);

    let data = null;
    if (!textBody || textBody.trim().length === 0) {
      // Empty body — create webhook may have returned 204 or no content.
      data = { status: resp.status, message: 'no response body from create webhook' };
    } else {
      try {
        data = JSON.parse(textBody);
      } catch (e) {
        // Not JSON — store raw text so main page can inspect it
        data = { status: resp.status, raw: textBody };
      }
    }

    updateCreateStatus('Avatar created successfully (response received), redirecting...', 'success');

    // Persist response to sessionStorage for the main page to pick up
    try { sessionStorage.setItem('AVATAR_CREATION_RESPONSE', JSON.stringify(data)); } catch (e) { console.warn('sessionStorage write failed', e); }

    // Redirect to main page
    setTimeout(()=>{ window.location.href = 'index.html'; }, 600);
  }catch(err){
    console.error('[create] error', err);
    updateCreateStatus('Create error: ' + (err.message || err), 'error');
    createBtn.disabled = false;
  }
});

# Challenges & Solutions - HeyGen Avatar Project

## Overview
This document outlines all major challenges encountered during the development of the HeyGen Live Avatar integration with n8n, and the solutions implemented to overcome them.

---

## 1. Authentication & API Integration

### Challenge 1.1: HeyGen API Authentication
**Problem:** HeyGen requires API key authentication via X-Api-Key header, but initial attempts failed with 401 errors.

**Solution:**
- Used n8n's HTTP Request node with custom header authentication
- Set header name: `X-Api-Key`
- Used credential placeholder that gets replaced at runtime
- Added Content-Type header explicitly: `application/json`

```javascript
// In n8n HTTP Request node
headers: {
  "X-Api-Key": "={{$credentials.heygenApiKey}}",
  "Content-Type": "application/json"
}
```

### Challenge 1.2: Google Sheets OAuth2 Setup
**Problem:** Google Sheets API requires OAuth2 credentials which are complex to set up.

**Solution:**
- Created Google Cloud Project
- Enabled Google Sheets API
- Created OAuth 2.0 credentials (Web application type)
- Added authorized redirect URI: `https://your-n8n-instance.com/rest/oauth2-credential/callback`
- Used n8n's built-in Google Sheets OAuth2 credential type

**Steps:**
1. Go to Google Cloud Console
2. Create new project or select existing
3. Enable Google Sheets API
4. Create OAuth 2.0 Client ID
5. Add to n8n credentials with proper scopes: `https://www.googleapis.com/auth/spreadsheets`

---

## 2. LiveKit / WebRTC Streaming Issues

### Challenge 2.1: CORS Policy Restrictions
**Problem:** Browser blocked WebRTC connection due to CORS policy when testing locally.

**Solution:**
- Deployed frontend to same domain as n8n or used proper CORS headers
- For local development: Used CORS proxy or Chrome with `--disable-web-security`
- Ensured HeyGen API returned proper CORS headers in response

**Production Fix:**
```nginx
# Nginx configuration
add_header 'Access-Control-Allow-Origin' '*';
add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization';
```

### Challenge 2.2: ICE Candidate Gathering Failures
**Problem:** WebRTC connection failed to establish due to ICE candidate issues, especially behind corporate firewalls.

**Solution:**
- Implemented multiple STUN servers for redundancy
- Added TURN server configuration for restrictive networks
- Increased ICE gathering timeout

```javascript
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    // TURN server for restrictive networks
    {
      urls: 'turn:turnserver.example.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ],
  iceCandidatePoolSize: 10
};
```

### Challenge 2.3: Audio Echo and Feedback
**Problem:** Users experienced echo when avatar's voice was picked up by their microphone.

**Solution:**
- Enabled echo cancellation in getUserMedia constraints
- Recommended headphones in UI
- Added audio processing options

```javascript
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  video: false
});
```

---

## 3. n8n Workflow Configuration

### Challenge 3.1: Form Trigger File Upload Handling
**Problem:** Form trigger file uploads returned base64 data that needed special handling.

**Solution:**
- Extracted file data from form submission: `formData['Avatar Image'].data`
- Passed base64 directly to HeyGen API
- Added file type validation in form configuration

```javascript
// In Format HeyGen Request node
const imageData = formData['Avatar Image'];
const avatarRequest = {
  avatar_image: imageData ? imageData.data : null, // base64 string
  // ... other params
};
```

### Challenge 3.2: Webhook Path Configuration
**Problem:** Webhook URLs kept changing between test and production environments.

**Solution:**
- Used static webhook path: `/avatar-transcript`
- Created environment variable for base URL
- Generated dynamic webhook URL in Function node

```javascript
// In Generate Landing Page node
const webhookUrl = `${process.env.N8N_BASE_URL}/webhook/avatar-transcript`;
// Inject into HTML template
```

### Challenge 3.3: Node Execution Order
**Problem:** Some nodes executed before required data was available, causing undefined errors.

**Solution:**
- Used n8n's execution order settings: `v1` (sequential)
- Added explicit connections between all nodes
- Used `$()` syntax to reference specific node outputs

```javascript
// In Parse LLM Response node
const sessionData = $('Clean & Format Transcript').item.json;
// This ensures execution order
```

---

## 4. LLM Integration & Data Extraction

### Challenge 4.1: Gemini API Response Format
**Problem:** Gemini returned complex nested JSON structure, not plain text.

**Solution:**
- Parsed response structure correctly: `response.candidates[0].content.parts[0].text`
- Added error handling for missing fields
- Validated JSON extraction with regex

```javascript
const llmResponse = $input.item.json;
const responseText = llmResponse.candidates?.[0]?.content?.parts?.[0]?.text || '';

// Extract JSON from response
const jsonMatch = responseText.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  extractedData = JSON.parse(jsonMatch[0]);
}
```

### Challenge 4.2: Inconsistent Transcript Format
**Problem:** HeyGen webhook sent transcript in different formats (array vs string, different field names).

**Solution:**
- Added flexible parsing in Clean Transcript node
- Handled both array and string formats
- Normalized all transcript entries to consistent format

```javascript
let fullConversation = '';

if (Array.isArray(transcript)) {
  fullConversation = transcript.map(entry => {
    const speaker = entry.role || 'User';
    const text = entry.content || entry.text || '';
    return `${speaker}: ${text}`;
  }).join('\n');
} else if (typeof transcript === 'string') {
  fullConversation = transcript;
}
```

### Challenge 4.3: LLM Extraction Accuracy
**Problem:** LLM sometimes failed to extract phone numbers or returned incomplete data.

**Solution:**
- Improved prompt with specific instructions and format
- Added default values: "Not provided"
- Used lower temperature (0.2) for more consistent extraction
- Specified exact JSON output format in prompt

---

## 5. Google Sheets Integration

### Challenge 5.1: Dynamic Column Mapping
**Problem:** Google Sheets node required exact column names that didn't always match our data.

**Solution:**
- Created header row manually first
- Used "Define Below" mapping mode
- Explicitly mapped each field to column name

```json
{
  "Timestamp": "={{ $json.timestamp }}",
  "Session ID": "={{ $json.sessionId }}",
  "Client Name": "={{ $json.name }}",
  "Phone Number": "={{ $json.phone }}",
  "Requirement": "={{ $json.requirement }}",
  "Minutes Used": "={{ $json.minutesUsed }}",
  "Cost (USD)": "={{ $json.costUSD }}",
  "Credits Used": "={{ $json.creditsUsed }}"
}
```

### Challenge 5.2: Sheet Not Found Errors
**Problem:** Workflow failed when sheet name didn't exist.

**Solution:**
- Created sheet manually before running workflow
- Named sheet exactly: "Avatar Sessions"
- Added error handling in workflow settings

---

## 6. Usage Tracking & Cost Calculation

### Challenge 6.1: Inaccurate Duration Calculation
**Problem:** Session duration was sometimes negative or zero.

**Solution:**
- Captured timestamps at session start and end
- Calculated duration in milliseconds first, then converted
- Added minimum duration of 1 minute

```javascript
const startTime = webhookData.started_at ? new Date(webhookData.started_at) : new Date();
const endTime = webhookData.ended_at ? new Date(webhookData.ended_at) : new Date();
const durationMs = endTime - startTime;
const durationMinutes = Math.max(1, Math.ceil(durationMs / 60000));
```

### Challenge 6.2: Credit Cost Calculation
**Problem:** Needed to calculate cost based on HeyGen pricing tiers.

**Solution:**
- Created configurable rate constants
- Calculated cost with proper decimal formatting
- Added usage report generation

```javascript
const RATE_PER_MINUTE = 0.15; // $0.15 per minute
const CREDITS_PER_MINUTE = 1;

const totalCost = (durationMinutes * RATE_PER_MINUTE).toFixed(2);
const totalCredits = durationMinutes * CREDITS_PER_MINUTE;
```

---

## 7. Error Handling & Reliability

### Challenge 7.1: Silent Failures
**Problem:** Workflow sometimes failed without clear error messages.

**Solution:**
- Added try-catch blocks in all Function nodes
- Implemented comprehensive error logging
- Used n8n's "Continue on Fail" option selectively
- Added status updates in frontend

### Challenge 7.2: Webhook Validation
**Problem:** Invalid webhook payloads caused workflow crashes.

**Solution:**
- Validated webhook data structure before processing
- Added default values for missing fields
- Implemented graceful degradation

```javascript
const sessionId = webhookData.session_id || 'unknown';
const transcript = webhookData.transcript || [];
```

---

## 8. Frontend / UI Challenges

### Challenge 8.1: Loading State Management
**Problem:** UI didn't show proper loading states during connection.

**Solution:**
- Added video overlay with loading animation
- Implemented status indicator with color coding
- Updated status messages at each connection stage

### Challenge 8.2: Mobile Responsiveness
**Problem:** Layout broke on mobile devices.

**Solution:**
- Added responsive CSS media queries
- Made buttons full-width on small screens
- Adjusted video container aspect ratio

```css
@media (max-width: 768px) {
  .btn {
    width: 100%;
    justify-content: center;
  }
}
```

---

## 9. Security Considerations

### Challenge 9.1: API Key Exposure
**Problem:** Risk of exposing API keys in frontend code.

**Solution:**
- Never embedded API keys in HTML
- Used URL parameters for session tokens (temporary)
- Generated tokens server-side in n8n
- Implemented token expiration

### Challenge 9.2: Webhook Authentication
**Problem:** Webhook endpoint was publicly accessible.

**Solution:**
- Used n8n's webhook authentication options
- Validated session IDs
- Implemented rate limiting (n8n feature)

---

## 10. Deployment & Environment Setup

### Challenge 10.1: Environment Variables
**Problem:** Different configurations for dev/staging/prod environments.

**Solution:**
- Used n8n environment variables
- Created separate workflows for each environment
- Used config.js file in frontend for environment-specific URLs

### Challenge 10.2: HTTPS Requirements
**Problem:** WebRTC requires HTTPS for getUserMedia in production.

**Solution:**
- Deployed to HTTPS-enabled hosting
- Used Let's Encrypt for SSL certificates
- Configured n8n with proper SSL settings

---

## Summary of Key Learnings

1. **Always use HTTPS** in production for WebRTC
2. **Implement comprehensive error handling** at every step
3. **Validate all external data** before processing
4. **Use environment variables** for all configuration
5. **Test with real users** in different network conditions
6. **Log everything** during development for debugging
7. **Provide clear UI feedback** at each stage
8. **Plan for failures** - webhooks can fail, APIs can timeout
9. **Document API requirements** before starting integration
10. **Use n8n's execution order settings** to prevent race conditions

---

## 7. HeyGen API Parameter Validation

### Challenge 7.1: Invalid Parameters on /v1/streaming.start
**Problem:** The `/v1/streaming.start` endpoint returned `400 Bad Request` with error code `400006` (Invalid params) when using placeholder or incorrectly formatted parameters.

**Root Cause:**
- The endpoint requires properly nested `voice` and `video` objects
- Avatar and voice IDs must be real, valid IDs from the HeyGen account
- Using placeholder IDs like `"local-demo-avatar"` or `"local-demo-voice"` causes rejection

**Solution:**
The correct payload structure for `/v1/streaming.start`:
```json
{
  "session_id": "actual-session-id-from-create",
  "voice": {
    "voice_id": "REAL_VOICE_ID"
  },
  "video": {
    "avatar_id": "REAL_AVATAR_ID",
    "background": "color",
    "resolution": "720p"
  }
}
```

**How to Get Real IDs:**
1. **Avatar ID**: Go to https://app.heygen.com/avatars, select an avatar, copy its ID
2. **Voice ID**: Go to https://app.heygen.com/voices, select a voice, copy its ID
3. Add both to your `.env` file:
   ```env
   HEYGEN_AVATAR_ID=sarah_avatar_001
   HEYGEN_VOICE_ID=en-US-amy
   ```

**Implementation in Frontend:**
```javascript
// In frontend/script.js - the code now reads from config:
const avatarId = config.avatarId || 'sarah_avatar_001';
const voiceId = config.voiceId || 'en-US-amy';

const startResp = await fetch(`${proxyApi}/v1/streaming.start`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: sessionIdToUse,
    voice: { voice_id: voiceId },
    video: {
      avatar_id: avatarId,
      background: 'color',
      resolution: '720p'
    }
  })
});
```

**Testing the Fix:**
- Update `.env` with your real avatar and voice IDs
- Refresh the browser
- Click "Start Conversation"
- Check browser console for: `"Activating session with avatar: xxx, voice: yyy"`
- Session should now activate successfully

---

## Next Steps / Future Improvements

1. Add retry logic for failed API calls
2. Implement conversation recording/playback
3. Add real-time transcript display in UI
4. Create admin dashboard for session monitoring
5. Add support for multiple avatar personas
6. Implement A/B testing for different prompts
7. Add analytics and reporting features
8. Create mobile native apps
9. Implement conversation history/replay
10. Add multi-language support beyond voice
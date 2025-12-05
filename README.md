# 🎭 LiveAvatar Demo - Interactive AI Avatar Platform

An end-to-end solution integrating **LiveAvatar AI**, **n8n workflows**, **LLM-powered data extraction**, and **Google Sheets** to create interactive AI conversations with automatic lead capture and analytics.

## 🌟 Features

- **📝 Avatar Creation Form** - Upload avatar images and configure persona/knowledge/language
- **🎤 Real-Time Voice Interaction** - WebRTC-powered live conversations with AI avatars
- **🤖 AI-Powered Data Extraction** - Automatic lead capture (name, phone, requirements)
- **📊 Google Sheets Integration** - Automatic logging of all interactions
- **💰 Session Tracking** - Monitor conversation durations and outcomes
- **📱 Responsive Design** - Works on desktop and mobile browsers
- **🔒 Secure** - API keys and secrets managed server-side via Node proxy

---

## 🏗️ Architecture

```
User → Avatar Creation Form → LiveAvatar API → Main Session Page → LiveKit Connection
                                      ↓                    ↓
                              Node HTTP Proxy       WebRTC Conversation
                                      ↓                    ↓
                              n8n Webhook             Transcript Webhook
                              (create-avatar)         (avatar-transcript)
                                      ↓                    ↓
                              Session Data         LLM Data Extraction
                                      ↓                    ↓
                              Google Sheets Storage
```

---

## 📁 Project Structure

```
avatar-demo/
├── frontend/                       # Static frontend (HTML/JS/CSS)
│   ├── index.html                 # Main session page (avatar interaction)
│   ├── create.html                # Avatar creation form page
│   ├── script.js                  # Session logic (token/start/LiveKit flow)
│   ├── create.js                  # Avatar creation form handler
│   ├── config.js                  # Frontend configuration (proxy URL, defaults)
│   └── style.css                  # Unified styling
├── scripts/                        # Backend utilities
│   ├── ws-proxy.js                # Node HTTP/WebSocket proxy (forwards to LiveAvatar & webhooks)
│   └── validate-webhook.js        # Local webhook validator for testing
├── n8n/                           # n8n workflow automation
│   ├── workflow.json              # Complete n8n workflow (avatar creation, data extraction)
│   └── README.md                  # n8n setup instructions
├── docs/                          # Documentation
│   ├── setup-guide.md             # Step-by-step setup
│   ├── architecture.md            # System architecture details
│   ├── challenges.md              # Known issues & solutions
│   └── api-integration.md         # API reference
├── .env                           # Local secrets & config (copy from .env.example)
├── .env.example                   # Template for .env
├── package.json                   # Node dependencies & scripts
└── README.md                      # This file
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v14 or higher) — for running the proxy server
- **Python 3** (for serving static frontend during development)
- **LiveAvatar API Key** — get from https://liveavatar.com
- **n8n instance** (optional) — for workflow automation & data extraction
- **Google Sheets & Gemini API** (optional) — for data logging & LLM extraction

### 1. Setup Environment

Clone the repository and configure:

```bash
# Clone/extract the project
cd avatar-demo

# Copy environment template
cp .env.example .env

# Edit .env with your values
```

### 2. Configure .env

Update `.env` with your LiveAvatar credentials:

```dotenv
# LiveAvatar API credentials
LIVEAVATAR_API_KEY=your_api_key_here
LIVEAVATAR_AVATAR_ID=your_avatar_uuid
LIVEAVATAR_VOICE_ID=en-US-amy
LIVEAVATAR_CONTEXT_ID=your_context_uuid

# HTTP/WebSocket proxy ports (local)
HTTP_PROXY_PORT=8083
WS_PROXY_PORT=8081

# Webhook URLs for avatar creation and user submissions
WEBHOOK_URL_1=http://localhost:5678/webhook/create-avatar-session
WEBHOOK_URL_2=http://localhost:5679/webhook/avatar-transcript

# Frontend host
FRONTEND_HOST=http://localhost:5173
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run the Application (Local Development)

Start the services in separate terminal windows:

**Terminal 1 - Node HTTP/WebSocket Proxy** (forwards to LiveAvatar API):
```bash
npm run start:ws-proxy
```
Expected output:
```
HTTP proxy listening on http://localhost:8083
WebSocket proxy listening on ws://localhost:8081
```

**Terminal 2 - Frontend Web Server**:
```bash
npm run start:web
```
Expected output:
```
Serving HTTP on 0.0.0.0 port 5173 (http://0.0.0.0:5173/)
```

**Terminal 3 (Optional) - Local Webhook Validator**:
```bash
npm run start:webhook
```
Expected output:
```
Webhook validator listening on port 5679
```

### 5. Access the Application

Open your browser and navigate to:

```
http://localhost:5173/create.html
```

**User Flow:**
1. **Create Avatar Page** (`create.html`) — Upload image, add persona prompt, select language
   - Form POSTs to `http://localhost:8083/create-avatar`
   - Proxy forwards to `WEBHOOK_URL_1` (n8n or your webhook)
   - Response saved to browser storage and page redirects
2. **Main Session Page** (`index.html`) — Auto-starts session using data from create page
   - Calls `http://localhost:8083/v1/sessions/token` (LiveAvatar token endpoint)
   - Calls `http://localhost:8083/v1/sessions/start` (LiveAvatar start endpoint)
   - Connects to LiveKit and opens WebRTC session

### 6. Test the Proxy

Verify the proxy is running correctly:

```bash
# Check proxy health
curl http://localhost:8083/health

# Fetch proxy configuration
curl http://localhost:8083/config
```

Expected responses:
```json
{
  "status": "ok",
  "apiKey": true
}
```

and

```json
{
  "avatarId": "your-avatar-uuid-here",
  "voiceId": "en-US-amy",
  "contextId": "your-context-uuid-here"
}
```

---

## 🔧 Configuration

### Environment Variables (`.env`)

Copy `.env.example` to `.env` and populate with your values. **Never commit real secrets.**

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `LIVEAVATAR_API_KEY` | ✅ Yes | LiveAvatar API key | `your-api-key-here` |
| `LIVEAVATAR_AVATAR_ID` | ✅ Yes | Avatar UUID from LiveAvatar dashboard | `your-avatar-uuid-here` |
| `LIVEAVATAR_VOICE_ID` | ✅ Yes | Voice ID or name | `en-US-amy` |
| `LIVEAVATAR_CONTEXT_ID` | ✅ Yes | Context UUID for avatar persona | `your-context-uuid-here` |
| `HTTP_PROXY_PORT` | ⚠️ Optional | Port for HTTP proxy (default: 8083) | `8083` |
| `WS_PROXY_PORT` | ⚠️ Optional | Port for WebSocket proxy (default: 8081) | `8081` |
| `WEBHOOK_URL_1` | ⚠️ Optional | Webhook for avatar creation (n8n or custom) | `http://localhost:5678/webhook/create-avatar` |
| `WEBHOOK_URL_2` | ⚠️ Optional | Webhook for user submissions/transcripts | `http://localhost:5679/webhook/avatar-transcript` |
| `FRONTEND_HOST` | ⚠️ Optional | Frontend base URL (for redirects) | `http://localhost:5173` |

### Getting LiveAvatar Credentials

1. **Go to LiveAvatar Dashboard**: https://app.liveavatar.com
2. **API Key**: Settings → API Keys → Create new key
3. **Avatar ID & Context ID**: 
   - Navigate to Avatars or Personas section
   - Copy the UUID of your chosen avatar/context
   - Add to `.env`

### Frontend Configuration

Edit `frontend/config.js` to override defaults:

```javascript
window.APP_CONFIG = {
  proxyApiUrl: 'http://localhost:8083',     // Proxy server URL
  avatarId: 'your-avatar-uuid',             // LiveAvatar avatar ID
  voiceId: 'en-US-amy',                     // LiveAvatar voice
  contextId: 'your-context-uuid',           // Avatar context/persona
  webhookUrl: 'http://localhost:5679/webhook/avatar-transcript',
  mockMode: false                           // Set true to skip LiveKit (UI testing only)
};
```

---

## 📊 Data Flow

### 1. Avatar Creation Submission
User fills `create.html` form:
```json
{
  "image_base64": "data:image/jpeg;base64,...",
  "persona_prompt": "You are a helpful sales assistant...",
  "language": "en"
}
```
POST → `http://localhost:8083/create-avatar` → forwarded to `WEBHOOK_URL_1`

### 2. Webhook Response (from n8n)
Expected response structure:
```json
{
  "session_token": "token_xyz123",
  "session_id": "ses_abc123",
  "avatar_id": "your-avatar-uuid-here",
  "livekit_url": "wss://liveavatar.livekit.cloud",
  "livekit_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "identity": "user-123"
}
```
Saved to `sessionStorage.AVATAR_CREATION_RESPONSE`

### 3. Main Page Auto-Start
Frontend reads storage and calls:
- POST `/v1/sessions/token` → LiveAvatar returns `session_token`
- POST `/v1/sessions/start` → LiveAvatar returns `livekit_url` + `livekit_token`

### 4. WebRTC Connection
Frontend connects to LiveKit using token and streams:
- Audio/video from user
- Receives avatar video/audio stream

### 5. Transcript Webhook (Optional)
After session ends, transcript POSTed to `WEBHOOK_URL_2`:
```json
{
  "session_id": "ses_abc123",
  "transcript": [
    {"role": "user", "content": "Hello, I'm John"},
    {"role": "avatar", "content": "Hi John! How can I help?"}
  ],
  "duration_seconds": 300,
  "started_at": "2025-12-05T10:00:00Z"
}
```
n8n workflow can extract data and log to Google Sheets

---

## 📝 NPM Scripts

Convenience npm scripts for running the application:

```bash
npm run start:web       # Serve frontend at http://localhost:5173
npm run start:ws-proxy  # Start Node HTTP/WS proxy at :8083 and :8081
npm run start:webhook   # Start local webhook validator at http://localhost:5679
```

All scripts read configuration from `.env` file.

---

## 📚 API Documentation

### LiveAvatar API
- **Base URL**: `https://api.liveavatar.com`
- **Auth**: `X-API-KEY` header
- **Endpoints**:
  - `POST /v1/sessions/token` — Create session token
  - `POST /v1/sessions/start` — Start session (requires Bearer token)
  - `GET /v1/sessions/{id}` — Get session status
- **Docs**: https://docs.liveavatar.com

### Node Proxy Endpoints
- `GET /config` — Returns avatar/voice/context IDs from `.env`
- `GET /health` — Returns `{status: "ok"}`
- `POST /v1/sessions/token` — Forwarded to LiveAvatar
- `POST /v1/sessions/start` — Forwarded to LiveAvatar
- `POST /create-avatar` — Forwarded to `WEBHOOK_URL_1`
- `POST /submit-user` — Forwarded to `WEBHOOK_URL_2`

### n8n Integration (Optional)
- **Base URL**: Your n8n instance
- **Webhooks**: `WEBHOOK_URL_1` and `WEBHOOK_URL_2` from `.env`
- **Docs**: https://docs.n8n.io

### Google Sheets API (Optional)
- **Auth**: OAuth 2.0
- **Scopes**: `https://www.googleapis.com/auth/spreadsheets`
- **Docs**: https://developers.google.com/sheets

### Gemini LLM API (Optional)
- **Base URL**: `https://generativelanguage.googleapis.com`
- **Auth**: Query param `?key=YOUR_KEY`
- **Docs**: https://ai.google.dev/docs

---

## 🎯 Use Cases

1. **Lead Generation** - Capture visitor info automatically
2. **Customer Support** - Interactive FAQ with lead capture
3. **Sales Qualification** - Pre-qualify leads via conversation
4. **Event Registration** - Conversational form filling
5. **Product Demos** - Interactive product walkthroughs
6. **Training/Onboarding** - Educational avatars with progress tracking

---

## 🔐 Security Best Practices

✅ **DO:**
- Store API keys in `.env` (git-ignored)
- Use HTTPS for production endpoints
- Validate webhook signatures
- Implement rate limiting on proxy
- Add user consent for recording
- Comply with GDPR/privacy laws

❌ **DON'T:**
- Hardcode API keys in frontend code
- Allow unauthenticated webhook access
- Store sensitive data unencrypted in browser
- Expose `.env` or `.git` publicly
- Log API keys or tokens to console in production

---

## 💡 Customization Ideas

### Modify Avatar Behavior
Edit the persona prompt in `create.html` form submission:
```
You are a professional sales representative. Ask about:
- Customer needs and budget
- Timeline and preferences
- Any specific pain points
Be friendly, professional, and helpful.
```

### Add More Form Fields
Edit `frontend/create.html` to add more inputs (company name, industry, etc.) and pass via the create payload to your webhook.

### Store Session Data
Modify `create.js` to send additional metadata to `WEBHOOK_URL_1`:
```javascript
const payload = {
  image_base64: image_b64,
  persona_prompt: personaPrompt,
  language: language,
  custom_field_1: value,  // NEW
  custom_field_2: value   // NEW
};
```

### Add Custom Notifications
Replace Slack with:
- Email (using n8n Email node)
- SMS (using Twilio)
- Discord webhook
- Custom dashboard

---

## 📈 Monitoring

### Key Metrics to Track
- **Conversion Rate**: Form submissions → Completed conversations
- **Avg Session Length**: Minutes per conversation
- **Data Quality**: % of successful extractions
- **API Costs**: Daily/monthly spend
- **Error Rate**: Failed workflows

### n8n Execution Monitoring
```
Workflow → Executions → Filter by:
- Status (Success/Error)
- Date range
- Execution time
```

---

## 🐛 Troubleshooting

### Common Issues

**Problem**: "Connection failed" error
```
Solution:
- Check HeyGen API key is valid
- Verify credits are available
- Ensure HTTPS is enabled
- Check browser console for errors
```

**Problem**: No data in Google Sheets
```
Solution:
- Verify Sheet ID is correct
- Check OAuth2 credential is connected
- Ensure sheet name is "Avatar Sessions"
- Check column names match exactly
```

**Problem**: LLM extraction failing
```
Solution:
- Verify Gemini API key
- Check API quota
- Test prompt in Google AI Studio
- Add more specific instructions
```

📚 **Full troubleshooting guide**: See `docs/challenges.md`

---

## 🧪 Testing

### Test Proxy Endpoints

Check if proxy is running and forwarding correctly:

```bash
# Check proxy health
curl http://localhost:8083/health

# Fetch configuration (avatar/voice/context IDs from .env)
curl http://localhost:8083/config

# Test token creation (get session_token)
curl -X POST http://localhost:8083/v1/sessions/token \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "FULL",
    "avatar_id": "your-avatar-uuid-here",
    "avatar_persona": {
      "context_id": "your-context-uuid-here",
      "instructions": "You are helpful."
    }
  }'
```

### Test Webhook Validator

Start local webhook validator in a terminal:

```bash
npm run start:webhook
```

Then simulate a transcript POST:

```bash
curl -X POST http://localhost:5679/webhook/avatar-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "ses_test",
    "transcript": [
      {"role": "user", "content": "Hello"},
      {"role": "avatar", "content": "Hi there!"}
    ],
    "duration_seconds": 60
  }'
```

Expected output in webhook validator terminal:
```
Received webhook payload {session_id: "ses_test", transcript: [...], ...}
```

### Troubleshooting Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 501 "Unsupported method" | POST hitting static server on wrong port | Ensure proxy runs on 8083; check `proxyApiUrl` in frontend config |
| Empty JSON response error | Webhook returned empty body | Update webhook to return JSON; or frontend now handles gracefully |
| Connection timeout | Proxy not running | Run `npm run start:ws-proxy` in separate terminal |
| 422 Validation error | Invalid avatar_persona or context_id | Verify `LIVEAVATAR_CONTEXT_ID` exists in LiveAvatar backend |
| CORS blocked | Wrong origin or headers | Proxy adds CORS headers; refresh browser if old headers cached |

📚 **See `docs/challenges.md` for more troubleshooting**

## 📝 NPM Scripts

Convenience npm scripts for running the application:

```bash
npm run start:web       # Serve frontend at http://localhost:5173
npm run start:ws-proxy  # Start Node HTTP/WS proxy at :8083 and :8081
npm run start:webhook   # Start local webhook validator at http://localhost:5679
```

All scripts read configuration from `.env` file.

---

## 🎓 Learning Resources

- **n8n Academy**: https://academy.n8n.io
- **WebRTC Fundamentals**: https://webrtc.org
- **HeyGen Interactive Avatar**: https://docs.heygen.com/reference/new-session-copy
- **Gemini Prompting Guide**: https://ai.google.dev/docs/prompting

---

## 🤝 Contributing

Want to improve this project?
1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

---

## 🙏 Credits

Built with:
- [n8n](https://n8n.io) - Workflow automation
- [HeyGen](https://heygen.com) - AI avatars
- [Google Gemini](https://ai.google.dev) - LLM extraction
- [Google Sheets](https://sheets.google.com) - Data storage

---

## 📞 Support

- **Issues**: Open GitHub issue
- **Questions**: Check `docs/` folder
- **n8n Community**: https://community.n8n.io

---

## 🗺️ Roadmap

- [ ] Add conversation history/replay
- [ ] Multi-language UI support
- [ ] Real-time transcript display
- [ ] Mobile native apps
- [ ] Advanced analytics dashboard
- [ ] A/B testing for prompts
- [ ] CRM integration (Salesforce, HubSpot)
- [ ] Voice cloning support
- [ ] Custom avatar upload
- [ ] Team collaboration features

---

## ⭐ Star This Project

If you found this helpful, please star the repository!

**Happy building! 🚀**

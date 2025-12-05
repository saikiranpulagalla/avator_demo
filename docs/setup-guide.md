# Complete Setup Guide - HeyGen Avatar Demo

## Prerequisites

Before starting, ensure you have:
- ✅ n8n instance (cloud or self-hosted)
- ✅ HeyGen account with API access
- ✅ Google account for Sheets
- ✅ Gemini API key (or OpenRouter account)
- ✅ Basic understanding of webhooks and APIs

---

## Part 1: HeyGen Setup

### Step 1.1: Create HeyGen Account
1. Go to [https://heygen.com](https://heygen.com)
2. Sign up for an account
3. Navigate to Account Settings → API Keys
4. Generate a new API key
5. **Save this key securely** - you'll need it for n8n

### Step 1.2: Enable LiveAvatar API
1. In HeyGen dashboard, go to **Products → Interactive Avatar**
2. Enable the **Streaming Avatar** feature
3. Note your available credits/minutes

### Step 1.3: Get Avatar ID
1. Go to **Avatars** in the HeyGen dashboard
2. Select an avatar you want to use
3. Copy the **Avatar ID** (e.g., `sarah_avatar_001`)
4. Add to `.env`: `HEYGEN_AVATAR_ID=your_avatar_id`

### Step 1.4: Get Voice ID
1. Go to **Voices** in the HeyGen dashboard
2. Select a voice you want to use
3. Copy the **Voice ID** (e.g., `en-US-amy`)
4. Add to `.env`: `HEYGEN_VOICE_ID=your_voice_id`

### Step 1.5: Test API Connection
Create a test script to verify your API key:

```bash
curl -X POST https://api.heygen.com/v1/streaming.new \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session",
    "avatar_id": "YOUR_AVATAR_ID",
    "quality": "high"
  }'
```

Expected response: 200 OK with session details and SDP offer. \
  -d '{
    "quality": "high",
    "avatar_name": "default_avatar",
    "voice": {
      "voice_id": "en-US-Neural2-A"
    }
  }'
```

Expected response: 200 OK with session details.

---

## Part 2: Google Sheets Setup

### Step 2.1: Create Google Sheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Name it: **"Avatar Sessions Tracker"**
4. Rename Sheet1 to: **"Avatar Sessions"**
5. Add header row with these exact columns:

```
| Timestamp | Session ID | Client Name | Phone Number | Requirement | Minutes Used | Cost (USD) | Credits Used |
```

6. Copy the **Sheet ID** from URL:
   `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`

### Step 2.2: Setup Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project: **"n8n-heygen-integration"**
3. Enable APIs:
   - Google Sheets API
   - Google Drive API (optional, for file access)

### Step 2.3: Create OAuth Credentials
1. In Google Cloud Console → **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Name: **"n8n HeyGen Integration"**
5. Authorized redirect URIs:
   ```
   https://YOUR-N8N-INSTANCE.com/rest/oauth2-credential/callback
   ```
6. Click Create
7. **Save Client ID and Client Secret**

---

## Part 3: Gemini API Setup

### Step 3.1: Get Gemini API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click **Get API Key**
3. Create or select a Cloud project
4. Click **Create API Key**
5. **Copy and save the API key**

### Step 3.2: Test Gemini API
```bash
curl -X POST \
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "contents": [{
      "parts":[{"text": "Hello, can you help me test the API?"}]
    }]
  }'
```

---

## Part 4: n8n Installation & Configuration

### Step 4.1: Install n8n (Choose One Method)

#### Option A: n8n Cloud (Easiest)
1. Go to [https://n8n.io](https://n8n.io)
2. Sign up for n8n Cloud
3. Choose a plan (free tier available)
4. Your instance URL: `https://YOUR-NAME.app.n8n.cloud`

#### Option B: Self-Hosted (Docker)
```bash
# Install with Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n

# Access at: http://localhost:5678
```

#### Option C: Self-Hosted (npm)
```bash
# Install globally
npm install n8n -g

# Start n8n
n8n start

# Access at: http://localhost:5678
```

### Step 4.2: Configure n8n Environment Variables
Add these to your n8n environment:

```bash
# For Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -e WEBHOOK_URL=https://your-domain.com \
  -e N8N_BASE_URL=https://your-domain.com \
  -e N8N_EDITOR_BASE_URL=https://your-domain.com \
  -v ~/.n8n:/home/node/.n8n \
  docker.n8n.io/n8nio/n8n
```

For self-hosted, create `.env` file:
```env
WEBHOOK_URL=https://your-domain.com
N8N_BASE_URL=https://your-domain.com
GOOGLE_SHEET_ID=your-sheet-id
```

### Step 4.3: Setup n8n Credentials

#### A. HeyGen API Credential
1. In n8n, go to **Credentials**
2. Click **Add Credential**
3. Search for **Header Auth**
4. Configure:
   - **Name**: `HeyGen API`
   - **Name**: `X-Api-Key`
   - **Value**: `YOUR_HEYGEN_API_KEY`
5. Save

#### B. Google Sheets OAuth2
1. Click **Add Credential**
2. Search for **Google Sheets OAuth2 API**
3. Configure:
   - **Client ID**: `your-client-id`
   - **Client Secret**: `your-client-secret`
   - **OAuth Redirect URL**: (auto-filled)
4. Click **Connect my account**
5. Authorize in Google popup
6. Save

#### C. Gemini API (or OpenRouter)
1. Click **Add Credential**
2. Search for **HTTP Query Auth**
3. Configure:
   - **Name**: `Gemini API Key`
   - **Name**: `key`
   - **Value**: `YOUR_GEMINI_API_KEY`
4. Save

---

## Part 5: Import n8n Workflow

### Step 5.1: Download Workflow JSON
1. Copy the workflow JSON from the artifact provided
2. Save as: `heygen-avatar-workflow.json`

### Step 5.2: Import to n8n
1. In n8n, click **Workflows** in sidebar
2. Click **Import from File**
3. Select `heygen-avatar-workflow.json`
4. Click **Import**

### Step 5.3: Configure Workflow Nodes

#### Update Form Trigger Node:
- No changes needed - form fields are already configured

#### Update HTTP Request (HeyGen) Node:
1. Double-click **"HeyGen - Create LiveAvatar Session"**
2. In **Authentication**, select your HeyGen credential
3. Save

#### Update Gemini LLM Node:
1. Double-click **"LLM - Extract Client Data"**
2. Update URL to include your API key OR
3. Select your Gemini credential
4. Save

#### Update Google Sheets Node:
1. Double-click **"Save to Google Sheets"**
2. Select your Google Sheets credential
3. Update **Document ID** with your Sheet ID
4. Verify **Sheet Name**: `Avatar Sessions`
5. Save

#### Update Slack/Email Node (Optional):
1. Double-click **"Send Summary (Optional)"**
2. Update webhook URL or configure email
3. Or disable this node if not needed

### Step 5.4: Update Webhook URLs
1. Click **Webhook - Receive Transcript** node
2. Note the webhook URL shown
3. Copy it: `https://your-n8n.com/webhook/avatar-transcript`
4. Update this URL in **Generate Landing Page HTML** node:
   ```javascript
   const webhookUrl = 'YOUR_WEBHOOK_URL';
   ```

### Step 5.5: Activate Workflow
1. Click the toggle at top: **Inactive → Active**
2. Workflow is now live!

---

## Part 6: Frontend Deployment

### Step 6.1: Prepare Frontend Files
Create project structure:
```
avatar-demo/
├── index.html
├── style.css
├── script.js
└── config.js
```

### Step 6.2: Create config.js
```javascript
// config.js
const CONFIG = {
  // Update with your n8n form URL
  formUrl: 'https://your-n8n.com/form/avatar-setup',
  
  // Update with your n8n webhook URL
  webhookUrl: 'https://your-n8n.com/webhook/avatar-transcript'
};
```

### Step 6.3: Deploy Frontend (Choose One)

#### Option A: Netlify (Easiest)
1. Create account at [netlify.com](https://netlify.com)
2. Drag and drop your `avatar-demo` folder
3. Site is live at: `https://random-name.netlify.app`
4. Configure custom domain (optional)

#### Option B: Vercel
```bash
npm install -g vercel
cd avatar-demo
vercel deploy
```

#### Option C: GitHub Pages
1. Create GitHub repository
2. Push your files
3. Enable GitHub Pages in Settings
4. Site available at: `https://username.github.io/repo-name`

#### Option D: Same server as n8n
If self-hosting n8n, add nginx config:
```nginx
server {
    listen 80;
    server_name avatar.yourdomain.com;
    
    root /var/www/avatar-demo;
    index index.html;
    
    location / {
        try_files $uri $uri/ =404;
    }
}
```

---

## Part 7: Testing the Complete System

### Step 7.1: Test Form Submission
1. Go to your n8n Form URL or frontend
2. Fill in:
   - Upload a test image (JPG/PNG)
   - Enter custom prompt: "You are a helpful sales assistant"
   - Select language: "English"
3. Click Submit
4. You should see the landing page with video container

### Step 7.2: Test Avatar Connection
1. On landing page, click **"Start Conversation"**
2. Allow microphone access
3. Wait for connection (should see "Connected" status)
4. Speak: "Hello, my name is John and my phone is 555-1234. I need help with product pricing."
5. Avatar should respond
6. Click **"End Session"**

### Step 7.3: Verify Data Flow
1. Check Google Sheet - new row should appear with:
   - Timestamp
   - Session ID
   - Client Name: John (extracted by LLM)
   - Phone: 555-1234 (extracted by LLM)
   - Requirement: "Help with product pricing"
   - Minutes Used, Cost, Credits

### Step 7.4: Check Webhook Logs
1. In n8n, click **Executions** in sidebar
2. Find the webhook execution
3. Click to view details
4. Verify all nodes executed successfully
5. Check any errors in red nodes

---

## Part 8: Troubleshooting Common Issues

### Issue 1: Form doesn't load
**Fix:**
- Check workflow is activated
- Verify form trigger node configuration
- Check browser console for errors

### Issue 2: "Connection failed" on avatar start
**Fix:**
- Verify HeyGen API key is correct
- Check HeyGen account has available credits
- Ensure HTTPS is enabled (required for WebRTC)
- Check browser console for CORS errors

### Issue 3: Transcript not saving to Google Sheets
**Fix:**
- Verify Google Sheets credential is connected
- Check Sheet ID is correct
- Verify sheet name is exactly "Avatar Sessions"
- Check column mapping in Google Sheets node

### Issue 4: LLM extraction returns "Not provided"
**Fix:**
- Check Gemini API key is valid
- Verify API quota isn't exceeded
- Test with clearer conversation (mention name/phone explicitly)
- Check LLM node execution logs

### Issue 5: Webhook not receiving data
**Fix:**
- Verify webhook URL in frontend matches n8n webhook
- Check webhook node is in workflow
- Ensure workflow is active
- Test webhook with Postman/curl

---

## Part 9: Production Checklist

Before going live, ensure:

- [ ] All API keys are secured (use environment variables)
- [ ] HTTPS is enabled on all endpoints
- [ ] Workflow has proper error handling
- [ ] Google Sheet permissions are set correctly
- [ ] Frontend is deployed to reliable hosting
- [ ] Tested on multiple browsers (Chrome, Firefox, Safari)
- [ ] Tested on mobile devices
- [ ] Monitoring/logging is configured
- [ ] Backup system for critical data
- [ ] Rate limiting is configured
- [ ] Terms of service / privacy policy added to UI
- [ ] User consent for recording conversations
- [ ] GDPR compliance (if applicable)
- [ ] Cost monitoring for API usage

---

## Part 10: Monitoring & Maintenance

### Monitor These Metrics:
1. **n8n Executions**: Check for failed workflows
2. **HeyGen Credits**: Track usage vs budget
3. **Google Sheets**: Ensure data is being saved
4. **API Quotas**: Monitor Gemini API usage
5. **Error Logs**: Review regularly

### Regular Maintenance:
- **Weekly**: Review execution logs
- **Monthly**: Audit API costs
- **Quarterly**: Update dependencies
- **As needed**: Adjust LLM prompts for better extraction

---

## Support Resources

- **n8n Documentation**: https://docs.n8n.io
- **HeyGen Docs**: https://docs.heygen.com
- **Gemini API**: https://ai.google.dev/docs
- **Google Sheets API**: https://developers.google.com/sheets
- **WebRTC Guide**: https://webrtc.org/getting-started

---

## Next Steps

After successful setup:
1. Customize avatar prompts for your use case
2. Add more fields to Google Sheet
3. Create analytics dashboard
4. Implement conversation history
5. Add multi-language support
6. Create mobile app version

**Congratulations! Your HeyGen Avatar Demo is now live! 🎉**
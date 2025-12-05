// Local frontend configuration
// You can edit this file for quick local development. Do NOT commit
// production secrets here. For CI or deploys, inject configuration at
// build time or server-side.

console.log('[config.js] Loading default frontend config');

window.APP_CONFIG = window.APP_CONFIG || {
	// Endpoint where the frontend will POST transcripts
	webhookUrl: 'http://localhost:5678/webhook/avatar-transcript',

	// Optional: override session values for quick local testing
	sessionId: 'local-demo-session',
	accessToken: 'local-demo-token',

	// HeyGen Avatar ID (get from https://app.heygen.com/avatars)
	avatarId: "da8f03da7bb54ae7bbefb12eac3ce277",

	// HeyGen Voice ID (get from https://app.heygen.com/voices)
	voiceId: "en-US-Journey-D",

	// Optional: override WebRTC endpoint
	webrtcUrl: 'wss://api.heygen.com/v1/streaming',

	// Dev helpers
	// If true, append the access token as a query param to the WebSocket URL
	useTokenInWsUrl: true,

	// If true, the frontend will run in mock mode: it will skip real signaling
	// and simulate a connected session to allow testing UI + webhook flows.
	mockMode: false,

	// If signaling fails, automatically fall back to mock mode so UI/webhook flows still work
	allowMockFallback: true
	,
	// Proxy URL for POSTing to the backend proxy (token/start/liveavatar forwarding)
	// Using 8083 to avoid conflicts with local static servers that reject POST.
	proxyApiUrl: 'http://localhost:8083'
};

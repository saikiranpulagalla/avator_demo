#!/usr/bin/env node

/*
 Simple webhook validator (no dependencies)
 Usage:
	 node validate-webhook.js
 Environment:
	 PORT - optional (default 5679)

 Accepts POST requests with JSON body and logs the payload to stdout.
*/

// Load `.env` values without requiring external dependencies.
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

const http = require('http');

const PORT = process.env.PORT || 5679;

const server = http.createServer((req, res) => {
	// Add CORS headers to allow requests from frontend
	const corsHeaders = {
		'Access-Control-Allow-Origin': '*',
		'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type'
	};

	// Handle preflight requests (OPTIONS)
	if (req.method === 'OPTIONS') {
		res.writeHead(200, corsHeaders);
		return res.end();
	}

	if (req.method === 'POST') {
		let body = '';
		req.on('data', (chunk) => { body += chunk; });
		req.on('end', () => {
			try {
				const data = JSON.parse(body || '{}');
				console.log('--- Received webhook payload ---');
				console.log(JSON.stringify(data, null, 2));
				console.log('--------------------------------');
				res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
				res.end(JSON.stringify({ status: 'ok' }));
			} catch (err) {
				console.error('Failed to parse JSON payload:', err.message);
				res.writeHead(400, { ...corsHeaders, 'Content-Type': 'text/plain' });
				res.end('Invalid JSON');
			}
		});
		req.on('error', (err) => {
			console.error('Request error:', err);
			res.writeHead(500, corsHeaders);
			res.end('Server error');
		});
	} else {
		res.writeHead(200, { ...corsHeaders, 'Content-Type': 'text/plain' });
		res.end('Webhook validator running. Send POST JSON to this URL.\n');
	}
});

server.listen(PORT, () => {
	console.log(`Webhook validator listening on http://localhost:${PORT}`);
});

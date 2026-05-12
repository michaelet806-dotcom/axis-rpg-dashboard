const https = require('https');
const TOKEN = process.env.SLACK_TOKEN || '';
const msg = [
  'CHARACTER FIX — Three.js FPS Dashboard',
  '1. Bloom threshold raised 0.55→0.82: only emissive geometry (rings, monitors, neon) blooms — sprites no longer glow',
  '2. Eye irises: replaced dept-color irises (cyan AI Roles = bloom artifact) with 6 natural eye colors assigned per agent',
  '3. AI Roles accessory: VISOR→GLASSES (professional look)',
  'Deployed: ~/axis-revenue-os/office/public/rpg.html',
  'Access: http://localhost:5000/rpg.html'
].join('\n');

const data = JSON.stringify({ channel: '#axis-updates', text: msg });
const req = https.request({
  hostname: 'slack.com',
  path: '/api/chat.postMessage',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
    'Authorization': 'Bearer ' + TOKEN
  }
}, res => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const j = JSON.parse(body);
    console.log('Slack:', res.statusCode, j.ok ? 'POSTED OK' : j.error);
  });
});
req.on('error', e => console.error(e.message));
req.write(data);
req.end();

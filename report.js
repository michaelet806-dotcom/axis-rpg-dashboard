const https = require('https');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || '';
const SLACK_TOKEN  = process.env.SLACK_TOKEN || '';

function post(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const now = new Date().toISOString();

  // 1. Supabase agent_runs
  const sbRes = await post(
    'zvxlqwoyappxrcxaspbs.supabase.co',
    '/rest/v1/agent_runs',
    { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY, 'Prefer': 'return=minimal' },
    {
      agent_id: 'session-fps-rewrite',
      output: 'Rewrote AXIS RPG dashboard from Phaser 3 top-down to Three.js r134 first-person FPS. 32x28m 3D office, 15 dept zones, glass partitions, emissive desks/monitors, billboard agent sprites, status rings, pointer-lock FPS controls, wandering AI, dept lighting, FogExp2, ACESFilmic tone mapping, minimap, inline dispatch modal. 80 agents preserved. Socket+Supabase integration preserved. 1270 lines.',
      last_run: now
    }
  );
  console.log('Supabase agent_runs:', sbRes.status, sbRes.status === 201 ? 'INSERTED OK' : sbRes.body.substring(0, 200));

  // 2. Slack #axis-updates
  const slackMsg = [
    'SESSION COMPLETE — Three.js FPS Dashboard Rewrite',
    'Built: Replaced Phaser 3 top-down with Three.js r134 first-person office. 15 dept zones, glass partitions, emissive desks with monitor textures, billboard agent sprites, status rings, FogExp2, ACESFilmic tonemapping, pointer-lock FPS controls, wandering AI, inline dispatch modal (no more window.prompt).',
    'Verified: 76 THREE refs present, 0 Phaser refs, 1270 lines, deployed to server public dir.',
    'Pending: Playwright visual verify (browser timeout issue), Supabase live credentials test.',
    'Files changed: C:\\Users\\michael\\axis-rpg-dashboard\\index.html | ~/axis-revenue-os/office/public/rpg.html'
  ].join('\n');

  const slackRes = await post(
    'slack.com',
    '/api/chat.postMessage',
    { 'Authorization': 'Bearer ' + SLACK_TOKEN },
    { channel: '#axis-updates', text: slackMsg }
  );
  const slackBody = JSON.parse(slackRes.body);
  console.log('Slack #axis-updates:', slackRes.status, slackBody.ok ? 'POSTED OK' : ('ERROR: ' + slackBody.error));
}

main().catch(e => console.error('FATAL:', e.message));

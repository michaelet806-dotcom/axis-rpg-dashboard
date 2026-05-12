const https = require('https');
const SLACK_TOKEN = process.env.SLACK_TOKEN || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

function postHTTPS(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({ hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers }
    }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

async function main() {
  const msg = [
    'SESSION COMPLETE — Three.js FPS + Professional Game Enhancement',
    'Built: Full Three.js r134 FPS office (32x28m, 15 dept zones). UnrealBloom post-processing. 128x200px high-detail character sprites with dept accessories (ties, glasses, headsets, berets). Zone-specific 3D props: server racks with LED indicators, plants with leaf clusters, wall screens per dept, security cameras, trophies, crates, holographic neural net, bookshelf. 400-particle ambient dust system. Professional loading screen with progress bar. Game-style crosshair + center dot. Inline dispatch modal. Wandering AI in 3D.',
    'Verified: 1686 lines, 124 THREE refs, 5 bloom refs, 22 prop function refs, 0 Phaser refs, 0 window.prompt refs. Deployed to server.',
    'Pending: Supabase agent_runs table needs CREATE TABLE migration. Playwright visual verify pending browser fix.',
    'Files: C:\\Users\\michael\\axis-rpg-dashboard\\index.html | ~/axis-revenue-os/office/public/rpg.html'
  ].join('\n');

  const r = await postHTTPS('slack.com', '/api/chat.postMessage',
    { 'Authorization': 'Bearer ' + SLACK_TOKEN },
    { channel: '#axis-updates', text: msg }
  );
  const b = JSON.parse(r.body);
  console.log('Slack:', r.status, b.ok ? 'POSTED OK' : b.error);

  // Try Supabase insert - will fail if table missing, that's expected
  const sr = await postHTTPS('zvxlqwoyappxrcxaspbs.supabase.co', '/rest/v1/agent_runs',
    { 'apikey': SERVICE_KEY, 'Authorization': 'Bearer ' + SERVICE_KEY, 'Prefer': 'return=minimal' },
    { agent_id: 'session-fps-professional-rewrite', output: msg, last_run: new Date().toISOString() }
  );
  console.log('Supabase:', sr.status, sr.status === 201 ? 'INSERTED OK' : 'TABLE MISSING - needs migration');
}

main().catch(e => console.error(e.message));

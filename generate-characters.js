/**
 * AXIS RPG — DALL-E 3 Character Generator
 * Generates one portrait per department, saves as PNG to ./characters/
 * Run: node generate-characters.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.OPENAI_API_KEY || '';
const OUT_DIR = path.join(__dirname, 'characters');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

const DEPT_CHARACTERS = {
  'Finance':           { role: 'wealthy court treasurer in shimmering golden robes, coin purse belt, holding a ledger scroll, regal and sharp-eyed',          color: 'gold' },
  'Operations':        { role: 'master-at-arms commander in polished chainmail with a tactical scroll, confident posture, strategic eyes',                    color: 'blue' },
  'Legal':             { role: 'royal magistrate in dark purple robes, holding scales of justice and a wax-sealed parchment, stern expression',               color: 'purple' },
  'HR':                { role: 'benevolent guild master in warm earth-toned robes with a feather quill and recruitment scroll, kind and approachable',         color: 'pink' },
  'Brand':             { role: 'royal herald in vibrant colorful tabard with a ceremonial banner, charismatic performer, expressive face',                    color: 'red' },
  'Product':           { role: 'royal inventor in a leather apron surrounded by blueprints and mechanical tools, curious genius expression',                  color: 'green' },
  'Data':              { role: 'arcane data mage with floating glowing crystal orbs orbiting them, mystical robes with rune patterns, intense focused gaze',  color: 'cyan' },
  'Tech':              { role: 'artificer wizard with mechanical gadgets and arcane devices, goggles on forehead, tinkering with a glowing device',           color: 'light blue' },
  'Security':          { role: 'elite royal guard knight in full plate armor with a glowing red crest, vigilant warrior stance, battle-hardened face',        color: 'red' },
  'Sales':             { role: 'silver-tongued merchant bard in fine velvet clothes, charming smile, a lute slung over one shoulder and a coin bag',          color: 'teal' },
  'CX':                { role: 'wise innkeeper healer in warm amber robes holding a golden chalice, warm welcoming smile, caring presence',                   color: 'amber' },
  'Media':             { role: 'traveling court storyteller in flamboyant robes with a magical glowing lantern, animated expression mid-tale',                color: 'orange' },
  'Logistics':         { role: 'experienced caravan master in weathered traveling gear with detailed trade maps, road-worn and reliable expression',           color: 'purple' },
  'AI Roles':          { role: 'mysterious hooded sorcerer with glowing arcane runes floating around them, digital arcane patterns on dark robes, ethereal aura', color: 'cyan' },
  'Business-Critical': { role: 'supreme war commander general in ornate full plate armor studying a war map, decisive powerful presence, medal-covered chest',  color: 'orange red' },
};

const BASE_STYLE = 'Ultra-detailed fantasy RPG character portrait, front-facing, centered in frame, dramatic cinematic lighting, 3D game art style matching The Legend of Zelda: Tears of the Kingdom or Dragon\'s Dogma 2. Square portrait format, dark medieval stone dungeon background with warm torch glow, character fills most of the frame from chest up. Highly detailed face, professional game art quality, 3D rendered. No text, no watermarks.';

function callDallE(dept, config) {
  return new Promise((resolve, reject) => {
    const prompt = `${BASE_STYLE} Character: ${config.role}. ${config.color} magical aura rim light.`;
    const body = JSON.stringify({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
      response_format: 'b64_json',
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) { reject(new Error(json.error.message)); return; }
          const b64 = json.data?.[0]?.b64_json;
          if (!b64) { reject(new Error('No image data')); return; }
          const outPath = path.join(OUT_DIR, `${dept.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`);
          fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
          resolve(outPath);
        } catch (e) { reject(e); }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const depts = Object.keys(DEPT_CHARACTERS);
  console.log(`\n⚔  AXIS Character Generator — ${depts.length} departments\n`);

  // Generate 2 at a time to avoid rate limits
  for (let i = 0; i < depts.length; i += 2) {
    const batch = depts.slice(i, i + 2);
    await Promise.all(batch.map(async dept => {
      const outFile = path.join(OUT_DIR, `${dept.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`);
      if (fs.existsSync(outFile)) {
        console.log(`  ✓ ${dept} — already exists, skipping`);
        return;
      }
      process.stdout.write(`  ⏳ ${dept}…`);
      try {
        const saved = await callDallE(dept, DEPT_CHARACTERS[dept]);
        console.log(` saved → ${path.basename(saved)}`);
      } catch (e) {
        console.log(` ✗ FAILED: ${e.message}`);
      }
    }));
  }

  console.log('\n✅ Character generation complete. Images in ./characters/\n');
  console.log('Manifest:');
  fs.readdirSync(OUT_DIR).filter(f => f.endsWith('.png')).forEach(f => console.log(`  ${f}`));
}

main();

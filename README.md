# AXIS KELLEY LENNOX — Agent Command RPG Dashboard

A Phaser 3 RPG game dashboard for the AXIS Revenue OS. All 80 AI agents are unique
playable UGC characters you can interact with in real time.

## Features

- **80 unique pixel characters** — procedurally generated per agent, department-colored uniforms
- **15 department zones** — Finance, Sales, Security Lab, Tech Tower, AI Roles HQ, and more
- **Real-time status** — WebSocket sync from AXIS Office (active, idle, blocked, approval pending)
- **RPG stat panels** — level, XP bar, ability tools, approval gates, lore
- **Quest log** — active tasks shown as quests in the corner
- **Camera controls** — WASD/arrows to pan, scroll wheel to zoom, click-drag to roam
- **Minimap** — live overview with viewport indicator
- **Dispatch & Message** — send tasks directly to agents from the panel

## Deploy

### Local
Open `index.html` directly in Chrome — connects to AXIS Office at `localhost:5000`.

### Remote API
Add `?api=https://your-tunnel-url` to the URL to point at a remote AXIS instance.

### Cloudflare Pages
1. Push this folder to a GitHub repo
2. In Cloudflare Pages → Create project → Connect repo
3. Build command: (none) — it's static HTML
4. Output directory: `/` (root)
5. Custom domain: `app.vidatech.org` or `rpg.vidatech.org`

## Stack
- [Phaser 3](https://phaser.io) (CDN) — 2D game engine
- [Socket.io](https://socket.io) (CDN) — real-time WebSocket
- Zero build step — pure HTML/JS, deploy anywhere

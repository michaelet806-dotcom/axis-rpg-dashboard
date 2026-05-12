/**
 * AXIS RPG DASHBOARD — GAME SYSTEMS SPECIFICATION
 * Version 1.0 — 2026-05-11
 *
 * Implementation target: C:\Users\michael\axis-rpg-dashboard\index.html
 * Engine: Three.js 0.134, vanilla JS, no external game framework
 *
 * CHANGELOG
 *   v1.0 — Initial spec. All numerical values are hypotheses marked [PT] (playtest).
 *          Do not treat any number as final until a live session confirms feel.
 *
 * HOW TO WIRE THIS FILE:
 *   1. Add <script src="GAME_SYSTEMS_SPEC.js"></script> before the closing </body>.
 *   2. Call AXIS_RPG.init() once after the engine state is ready (after scene load).
 *   3. Every game event (agent talk, dispatch, zone entry, revenue) calls the
 *      AXIS_RPG.award() and AXIS_RPG.track() methods defined below.
 *   4. The spec constants at the top of each section drive all formulas — tune here,
 *      not inside index.html.
 */

'use strict';

// =============================================================================
// 1. PLAYER XP & LEVELING SYSTEM
// =============================================================================
//
// DESIGN PILLARS
//   A. Every meaningful action earns XP — the player always feels forward motion.
//   B. Early levels are fast (minutes), late levels require sustained operation.
//   C. Unlocks at each level must be visible and feel impactful in the 3D world.
//
// XP SOURCES (exhaustive list — add nothing without updating this table)
// ---------------------------------------------------------------------------
// Event                        | Base XP | Cooldown  | Notes
// -----------------------------|---------|-----------|------------------------
// Talk to agent (new)          |  50     | none      | First talk only per agent
// Talk to agent (repeat)       |  10     | 60s       | Capped at 10 xp/min per agent
// Send a message in dialog     |  15     | 30s       | Per message sent
// Dispatch a quest             |  75     | none      | Each unique dispatch task
// Agent completes a quest      | 150     | none      | Fires when status→complete
// Enter a new zone (first)     |  40     | none      | One-time per zone (16 zones)
// Revenue milestone: $100      | 100     | none      | Cumulative revenue thresholds
// Revenue milestone: $500      | 250     | none      | Stacks — each milestone once
// Revenue milestone: $1000     | 500     | none      |
// Revenue milestone: $5000     | 1000    | none      |
// Revenue milestone: $10000    | 2000    | none      |
// Revenue milestone: $50000    | 5000    | none      |
// Boss encounter initiated     | 200     | none      | Entering boss dialog
// Boss impressed (outcome)     | 500     | none      | See Section 3
// Achievement unlocked         | varies  | none      | See Section 2
// Agent reputation 25 reached  |  75     | per agent | Each agent, each tier
// Agent reputation 50 reached  | 150     | per agent |
// Agent reputation 75 reached  | 250     | per agent |
// Agent reputation 100 reached | 500     | per agent |

const XP_CONFIG = {
  // XP award values — keys match event strings passed to AXIS_RPG.award()
  awards: {
    AGENT_TALK_NEW:          50,
    AGENT_TALK_REPEAT:       10,
    DIALOG_MESSAGE_SENT:     15,
    QUEST_DISPATCHED:        75,
    QUEST_COMPLETED:        150,
    ZONE_FIRST_ENTER:        40,
    REV_100:                100,
    REV_500:                250,
    REV_1000:               500,
    REV_5000:              1000,
    REV_10000:             2000,
    REV_50000:             5000,
    BOSS_ENCOUNTER:         200,
    BOSS_IMPRESSED:         500,
    REP_TIER_25:             75,
    REP_TIER_50:            150,
    REP_TIER_75:            250,
    REP_TIER_100:           500,
  },

  // Cooldown enforcement (milliseconds) — prevents XP farming
  cooldowns: {
    AGENT_TALK_REPEAT:   60000,  // 60s per agent
    DIALOG_MESSAGE_SENT: 30000,  // 30s per agent
  },

  // --------------------------
  // XP CURVE: Levels 1–20
  // --------------------------
  // Formula: XP_TO_NEXT(level) = Math.floor(BASE * Math.pow(EXPONENT, level - 1))
  // BASE = 200, EXPONENT = 1.55
  //
  // Worked values:
  //   Level 1→2:     200 XP   (~4 agent talks or 2 dispatches)
  //   Level 2→3:     310 XP
  //   Level 3→4:     480 XP
  //   Level 4→5:     745 XP
  //   Level 5→6:   1,155 XP   (~session 2 threshold)
  //   Level 6→7:   1,790 XP
  //   Level 7→8:   2,774 XP
  //   Level 8→9:   4,299 XP
  //   Level 9→10:  6,663 XP   (~hour 3 of heavy play)
  //   Level 10→11: 10,328 XP
  //   Level 11→12: 16,008 XP
  //   Level 12→13: 24,813 XP
  //   Level 13→14: 38,460 XP  (~week 1 threshold)
  //   Level 14→15: 59,613 XP
  //   Level 15→16: 92,400 XP
  //   Level 16→17:143,220 XP
  //   Level 17→18:221,991 XP
  //   Level 18→19:344,086 XP  (~week 3 threshold)
  //   Level 19→20:533,333 XP  (prestige wall — intended to feel earned)
  //   Level 20:     MAX — no more levels, title changes to "AXIS ARCHITECT"
  //
  // [PT] Adjust EXPONENT to ±0.05 if sessions 2–3 feel flat or if mid-game grinds.

  curveBase:     200,
  curveExponent: 1.55,
  maxLevel:      20,

  // Title awarded per level (displayed in HUD-L and side panel)
  titles: [
    '',                     // index 0 unused
    'FIELD AGENT',          // Level 1
    'JUNIOR ANALYST',       // Level 2
    'ANALYST',              // Level 3
    'SENIOR ANALYST',       // Level 4
    'TEAM LEAD',            // Level 5
    'OPERATIONS CHIEF',     // Level 6
    'DEPARTMENT HEAD',      // Level 7
    'DIVISION DIRECTOR',    // Level 8
    'STRATEGIC ADVISOR',    // Level 9
    'VP OF OPERATIONS',     // Level 10
    'EXECUTIVE DIRECTOR',   // Level 11
    'CHIEF OF STAFF',       // Level 12
    'VP EXECUTIVE',         // Level 13
    'SVP',                  // Level 14
    'C-SUITE OFFICER',      // Level 15
    'PARTNER',              // Level 16
    'BOARD MEMBER',         // Level 17
    'CHAIRMAN',             // Level 18
    'CO-FOUNDER',           // Level 19
    'AXIS ARCHITECT',       // Level 20 (prestige cap)
  ],

  // --------------------------
  // UNLOCKS PER LEVEL
  // --------------------------
  // Each entry: { level, type, id, description, implementationNote }
  // type ∈ ['ability','zone_access','visual','hud','mechanic']
  unlocks: [
    {
      level: 2,
      type: 'ability',
      id: 'SPRINT_BOOST',
      description: 'Sprint speed increases from 4.2 to 5.0 m/s.',
      implementationNote: 'Multiply SPRINT_SPEED by 1.19 in the movement loop.',
    },
    {
      level: 3,
      type: 'hud',
      id: 'MINIMAP_PING',
      description: 'Minimap now shows real-time active agent pings (green dot flash on active agents).',
      implementationNote: 'In minimap draw loop, draw 4px green circle on agents with status=active/working.',
    },
    {
      level: 4,
      type: 'mechanic',
      id: 'BULK_DISPATCH',
      description: 'Dispatch modal gains "BROADCAST" button — sends the same task to all agents in current zone simultaneously.',
      implementationNote: 'In dispatch-acts div add third button; on click iterate all zone agents and call confirmDispatch() for each.',
    },
    {
      level: 5,
      type: 'visual',
      id: 'PLAYER_AURA',
      description: 'Player torch light radius expands from 8m to 12m. Light color shifts from amber (#c89600) to warm gold (#ffd700).',
      implementationNote: 'Set torchLight.distance=12, torchLight.color.set(0xffd700) in level-up handler.',
    },
    {
      level: 6,
      type: 'ability',
      id: 'AGENT_PING',
      description: 'Press Q to send a ping to all agents — each agent flashes their status color briefly. Lets player survey zone state without walking to each.',
      implementationNote: 'Q keydown triggers agent-flash overlay per agent object in agentObjects map.',
    },
    {
      level: 7,
      type: 'zone_access',
      id: 'SECURITY_DEEP_SECTOR',
      description: 'Access granted to Security zone inner sanctum (back-left quadrant). Previously blocked by invisible collider.',
      implementationNote: 'Remove the isSecure gate check in the collision/zone entry handler for the Security dept back row.',
    },
    {
      level: 8,
      type: 'mechanic',
      id: 'FAST_DISPATCH',
      description: 'Holding E for 2s on an agent triggers instant dispatch with last-used task (no modal). UI shows "HOLD E — FAST DISPATCH" hint after 1s hold.',
      implementationNote: 'Add keydown timer on E key; on 2s fire confirmDispatch() with lastDispatchedTask[agentId].',
    },
    {
      level: 9,
      type: 'hud',
      id: 'REVENUE_GRAPH',
      description: 'Revenue ticker (rev-ticker bar) is replaced with a sparkline graph — last 10 revenue events plotted as a mini canvas chart.',
      implementationNote: 'Replace rev-ticker innerHTML with a 200×18px canvas; append a data point on each revenue event.',
    },
    {
      level: 10,
      type: 'visual',
      id: 'GOLDEN_GRID',
      description: 'Floor texture gains a subtle gold grid overlay. Hallway borders shift from dark amber to bright gold (#ffd700 at 30% opacity). Agent sprites gain a gold halo ring.',
      implementationNote: 'Regenerate floor texture with makeFloorTex() variant that adds grid lines. Add THREE.RingGeometry halo mesh parented to each agentObjects sprite.',
    },
    {
      level: 11,
      type: 'ability',
      id: 'ZONE_WARP',
      description: 'Press Tab to open a zone selector overlay. Click any zone name to teleport camera instantly (no walk required). 30s cooldown between warps.',
      implementationNote: 'Tab keydown opens a positioned div listing 16 zones; click sets camera.position.x/z to zone center coords.',
    },
    {
      level: 12,
      type: 'mechanic',
      id: 'CHAIN_QUEST',
      description: 'Dispatch modal gains a "CHAIN" checkbox. When checked, quest completion auto-dispatches a follow-up task to the next available idle agent in the same department.',
      implementationNote: 'On quest complete, if chain flag set, find EMP entry with same department and status=idle, fire confirmDispatch() on them.',
    },
    {
      level: 13,
      type: 'hud',
      id: 'AGENT_MOOD',
      description: 'Agent name tags above sprites gain a 1–5 bar mood indicator driven by reputation score: rep<25=1 bar, <50=2, <75=3, <100=4, 100=5.',
      implementationNote: 'In makeAgentLabel() canvas draw, append 5 small rect bars after name text, fill based on repScore.',
    },
    {
      level: 14,
      type: 'visual',
      id: 'BOSS_DOORS',
      description: 'Three boss zone doors (Finance, Security, Business-Critical) now glow with a distinct animated border. Previously looked like standard walls.',
      implementationNote: 'Add a THREE.MeshStandardMaterial emissive pulse animation to the 3 boss-zone door objects on level 14.',
    },
    {
      level: 15,
      type: 'ability',
      id: 'MASS_ACTIVATE',
      description: 'New HUD button: "ACTIVATE ALL". Sets all idle agents to active status simultaneously. 5-minute cooldown. Triggers the agent-flash global animation.',
      implementationNote: 'Add button to hud-c; click sets all EMP[].status=active, fires agentObjects update loop, starts 300s cooldown timer.',
    },
    {
      level: 16,
      type: 'mechanic',
      id: 'REPUTATION_GIFTS',
      description: 'When an agent reaches reputation 100, they occasionally (15% chance per interaction) send Michael a message in the terminal — a tip, a congratulation, or a revenue insight.',
      implementationNote: 'In reputation increment handler, if rep===100 and Math.random()<0.15, fire termLog() with agent-specific message.',
    },
    {
      level: 17,
      type: 'visual',
      id: 'PRESTIGE_SKIN',
      description: 'Crosshair changes from white to gold. Lock-overlay background gains subtle animated gold particle drift. Zone banners display player title beneath zone name.',
      implementationNote: 'Update crosshair CSS color; add canvas particle overlay to lock-overlay; append playerTitle to zone-banner-sub.',
    },
    {
      level: 18,
      type: 'mechanic',
      id: 'AUTO_QUEST',
      description: 'Each hour (real time), one idle agent auto-generates and auto-dispatches a task relevant to their department. Shown in quest log as "AUTO: [agent name]".',
      implementationNote: 'setInterval(3600000) picks random idle agent, selects from dept-specific task bank array, calls confirmDispatch().',
    },
    {
      level: 19,
      type: 'hud',
      id: 'AXIS_RADAR',
      description: 'Minimap upgrades to a full radar: 360-degree sweep animation, shows all 80 agents as colored dots by department, player at center.',
      implementationNote: 'Replace minimap canvas draw function with radar variant: sweep line rotates at 45deg/s, dots plotted in dept color from DEPTS map.',
    },
    {
      level: 20,
      type: 'visual',
      id: 'ARCHITECT_MODE',
      description: 'Full visual transformation: all agent sprites gain holographic shimmer. Floor emits grid-line pulses outward from player position. HUD title displays "AXIS ARCHITECT" in animated gold.',
      implementationNote: 'Add vertex shader uniform `time` to floor material for expanding ring effect. Apply additive blending to agent sprite materials. Animate hud-l text with CSS keyframe.',
    },
  ],
};

// XP Curve helper — returns XP needed to go from level to level+1
XP_CONFIG.xpToNext = function(level) {
  if (level >= this.maxLevel) return Infinity;
  return Math.floor(this.curveBase * Math.pow(this.curveExponent, level - 1));
};

// Total XP needed to reach a given level from level 1
XP_CONFIG.totalXpForLevel = function(level) {
  let total = 0;
  for (let l = 1; l < level; l++) total += this.xpToNext(l);
  return total;
};


// =============================================================================
// 2. ACHIEVEMENT SYSTEM — 15 Achievements
// =============================================================================
//
// DESIGN INTENT
//   Achievements function as a guided tour of the game's depth.
//   Tiers: Common (green), Uncommon (blue), Rare (purple), Legendary (gold).
//   Reward is flat XP deposited immediately on unlock.
//   UI: Achievement unlocks fire a toast notification (bottom-right, 4s duration)
//   in tier color. All achievements visible in side panel under new "MEDALS" tab.
//
// TOAST SPEC
//   Position: fixed, bottom:90px, right:20px
//   Width: 280px, border: 2px solid [tier color]
//   Content: tier icon + name + XP reward
//   Duration: 4000ms, fade out 500ms
//   Queue: max 3 stacked, 70px vertical offset each

const ACHIEVEMENTS = [
  // ── TIER: COMMON (green #00ff88) ──────────────────────────────────────────

  {
    id:          'FIRST_CONTACT',
    name:        'First Contact',
    tier:        'common',
    color:       '#00ff88',
    icon:        '👤',
    description: 'Talk to your first agent.',
    unlockCondition: {
      type:  'event_count',
      event: 'AGENT_TALK_NEW',
      count: 1,
    },
    xpReward:   100,
    implementationNote: 'Track talkCount in playerState. Fire on talkCount === 1.',
  },
  {
    id:          'DISPATCH_ROOKIE',
    name:        'Dispatch Rookie',
    tier:        'common',
    color:       '#00ff88',
    icon:        '⚡',
    description: 'Dispatch your first quest.',
    unlockCondition: {
      type:  'event_count',
      event: 'QUEST_DISPATCHED',
      count: 1,
    },
    xpReward:   150,
    implementationNote: 'Track dispatchCount. Fire on dispatchCount === 1.',
  },
  {
    id:          'EXPLORER',
    name:        'Explorer',
    tier:        'common',
    color:       '#00ff88',
    icon:        '🗺',
    description: 'Enter 4 different department zones.',
    unlockCondition: {
      type:  'unique_zones',
      count: 4,
    },
    xpReward:   200,
    implementationNote: 'Track zonesVisited Set. Fire when zonesVisited.size >= 4.',
  },

  // ── TIER: UNCOMMON (blue #4A90D9) ─────────────────────────────────────────

  {
    id:          'DEPARTMENT_HEAD',
    name:        'Department Head',
    tier:        'uncommon',
    color:       '#4A90D9',
    icon:        '🏛',
    description: 'Talk to every agent in a single department (any department, all members).',
    unlockCondition: {
      type:  'dept_sweep',
      count: 1,   // 1 complete department
    },
    xpReward:   300,
    implementationNote: 'Track talkedAgents Set by dept. When talkedAgents for any dept === that dept\'s EMP count, fire.',
  },
  {
    id:          'REVENUE_HUNTER',
    name:        'Revenue Hunter',
    tier:        'uncommon',
    color:       '#4A90D9',
    icon:        '💰',
    description: 'Witness the first $100 revenue milestone during a session.',
    unlockCondition: {
      type:       'revenue_threshold',
      threshold:  100,
    },
    xpReward:   250,
    implementationNote: 'Fire when totalRevenue crosses 100 for the first time.',
  },
  {
    id:          'ROAD_WARRIOR',
    name:        'Road Warrior',
    tier:        'uncommon',
    color:       '#4A90D9',
    icon:        '🏃',
    description: 'Sprint continuously for 10 seconds without stopping.',
    unlockCondition: {
      type:      'continuous_sprint',
      duration:  10000,  // ms
    },
    xpReward:   200,
    implementationNote: 'Track sprintTimer accumulator in movement loop. Reset on sprint release. Fire at 10000ms.',
  },
  {
    id:          'TRUSTED_ADVISOR',
    name:        'Trusted Advisor',
    tier:        'uncommon',
    color:       '#4A90D9',
    icon:        '🤝',
    description: 'Reach reputation 50 with any single agent.',
    unlockCondition: {
      type:      'rep_threshold',
      threshold: 50,
      count:     1,
    },
    xpReward:   300,
    implementationNote: 'In reputation handler, fire when any agent.rep crosses 50 for the first time.',
  },

  // ── TIER: RARE (purple #9B59B6) ───────────────────────────────────────────

  {
    id:          'ZONE_MASTER',
    name:        'Zone Master',
    tier:        'rare',
    color:       '#9B59B6',
    icon:        '🌐',
    description: 'Enter all 15 department zones at least once.',
    unlockCondition: {
      type:  'unique_zones',
      count: 15,
    },
    xpReward:   500,
    implementationNote: 'Fire when zonesVisited.size >= 15. Zones are the 15 DEPTS keys.',
  },
  {
    id:          'QUEST_CHAIN',
    name:        'Quest Chain',
    tier:        'rare',
    color:       '#9B59B6',
    icon:        '⛓',
    description: 'Dispatch 10 quests in a single session.',
    unlockCondition: {
      type:  'event_count',
      event: 'QUEST_DISPATCHED',
      count: 10,
    },
    xpReward:   400,
    implementationNote: 'sessionDispatchCount resets on page load. Fire at count === 10.',
  },
  {
    id:          'SECURITY_CLEARANCE',
    name:        'Security Clearance',
    tier:        'rare',
    color:       '#9B59B6',
    icon:        '🛡',
    description: 'Talk to all 5 agents in the Security department.',
    unlockCondition: {
      type:    'dept_sweep_specific',
      dept:    'Security',
      agentIds: ['threats','incidents','pentest','security','grc'],
    },
    xpReward:   450,
    implementationNote: 'Track securityTalked Set. Fire when size === 5.',
  },
  {
    id:          'HIGH_ROLLER',
    name:        'High Roller',
    tier:        'rare',
    color:       '#9B59B6',
    icon:        '💎',
    description: 'Witness $5,000 in total revenue during a single session.',
    unlockCondition: {
      type:      'revenue_threshold',
      threshold: 5000,
    },
    xpReward:   750,
    implementationNote: 'Fire when totalRevenue >= 5000.',
  },
  {
    id:          'BOSS_SLAYER',
    name:        'Boss Slayer',
    tier:        'rare',
    color:       '#9B59B6',
    icon:        '⚔',
    description: 'Successfully impress all 3 boss agents.',
    unlockCondition: {
      type:  'event_count',
      event: 'BOSS_IMPRESSED',
      count: 3,
    },
    xpReward:   1000,
    implementationNote: 'Track bossImpressedSet. Fire when size === 3.',
  },

  // ── TIER: LEGENDARY (gold #ffd700) ────────────────────────────────────────

  {
    id:          'FULLY_NETWORKED',
    name:        'Fully Networked',
    tier:        'legendary',
    color:       '#ffd700',
    icon:        '🕸',
    description: 'Talk to all 80 agents at least once.',
    unlockCondition: {
      type:  'event_count',
      event: 'AGENT_TALK_NEW',
      count: 80,
    },
    xpReward:   2000,
    implementationNote: 'talkedAgents Set tracks unique agent IDs. Fire when size === 80.',
  },
  {
    id:          'AXIS_ONLINE',
    name:        'AXIS Online',
    tier:        'legendary',
    color:       '#ffd700',
    icon:        '🔴',
    description: 'Have all 80 agents in active or working status simultaneously.',
    unlockCondition: {
      type:        'all_agents_active',
      statusMatch: ['active','working'],
      count:       80,
    },
    xpReward:   5000,
    implementationNote: 'On any status change, count EMP entries where status is active or working. Fire when count === 80. This is the rarest achievement — requires MASS_ACTIVATE unlock at level 15 plus manual effort.',
  },
  {
    id:          'EMPIRE_BUILDER',
    name:        'Empire Builder',
    tier:        'legendary',
    color:       '#ffd700',
    icon:        '👑',
    description: 'Reach AXIS ARCHITECT (level 20) and witness $50,000 in total revenue.',
    unlockCondition: {
      type:      'compound',
      conditions: [
        { type: 'player_level', level: 20 },
        { type: 'revenue_threshold', threshold: 50000 },
      ],
    },
    xpReward:   10000,
    implementationNote: 'Check both conditions each time either fires. Award once both are true. 10,000 XP is symbolic at level 20 — display special congratulations overlay instead of normal toast.',
  },
];


// =============================================================================
// 3. BOSS ENCOUNTERS
// =============================================================================
//
// DESIGN INTENT
//   Bosses are not combat encounters — they are high-stakes dispatch challenges.
//   Each boss sits in a unique zone, has a gated entry condition, unique dialog,
//   and demands a specific type of dispatch task. Success = player proves mastery
//   of that department's domain. Failure = boss dismisses player; can retry in 5min.
//
// BOSS ENCOUNTER FLOW
//   1. Player approaches boss agent (within 2m interact range — same as normal agents).
//   2. Boss-specific dialog fires (see dialog tree below).
//   3. Boss presents a "CHALLENGE DISPATCH" — a specific task requirement in the modal.
//   4. Player writes a dispatch task. System checks the response against keywords.
//   5. If keywords match threshold: BOSS_IMPRESSED fires, reward granted.
//   6. If keywords fail: boss delivers failure dialog. 300s (5min) cooldown before retry.
//
// KEYWORD MATCHING LOGIC
//   Split dispatch text by whitespace. Lowercase all tokens.
//   Count how many required keywords appear. If count >= requiredMatchCount: success.
//   This is intentionally lenient — the player must show awareness of the domain.
//   [PT] Adjust requiredMatchCount if players pass trivially or fail unfairly.

const BOSSES = [

  // ─────────────────────────────────────────────────────────────────────────
  // BOSS 1: THE TREASURER — Revenue Optimization Agent (Finance Zone)
  // ─────────────────────────────────────────────────────────────────────────
  {
    agentId:     'revenue',
    bossName:    'THE TREASURER',
    bossTitle:   'Revenue Optimization — Finance Division',
    zone:        'Finance',
    sprite:      '💰',
    // Visual: agent sprite scale set to 1.6x normal. Gold glow intensity doubled.
    // Position: back-center of Finance zone (col:0, row:1 zone grid, back row agents).
    scaleMultiplier:     1.6,
    glowIntensityMult:   2.0,

    entryCondition: {
      description:     'Player must be level 5 or higher.',
      playerLevelMin:  5,
    },

    // Dialog tree — arrays are sequential lines delivered one per E-press
    introDialog: [
      "You dare approach the Treasurer's desk without an appointment.",
      "I have watched $0 become $50,000 in quarters that never ended. What have you done?",
      "Prove your worth. I have one task — and it has a right answer.",
      "DISPATCH CHALLENGE: Build me a plan to take our revenue from current to 2x in 30 days. Name three specific levers.",
    ],
    challengePrompt: 'TREASURER\'S CHALLENGE: Dispatch a 30-day 2x revenue plan naming exactly three growth levers.',

    // Keywords the player's dispatch text must contain (case-insensitive)
    requiredKeywords:   ['upsell','conversion','acquisition','retention','traffic','campaign','email','ads','affiliate','pricing','funnel','shopify'],
    requiredMatchCount: 3,  // Must hit at least 3 of the above [PT]

    successDialog: [
      "...",
      "Three levers. Correct.",
      "Most come here listing features. You listed forces.",
      "The Finance vault is open to you. Do not waste what you find.",
    ],
    failureDialog: [
      "Vague. Ordinary. Forgettable.",
      "Come back when you understand the difference between activity and leverage.",
      "You have 5 minutes to think harder.",
    ],

    reward: {
      xp:            500,
      unlock:        'FINANCE_VAULT_ACCESS',
      unlockDesc:    'Side panel Finance tab shows full revenue breakdown with 30-day projection sparkline.',
      hudEffect:     'Revenue ticker turns bright gold for 60 seconds.',
      implementationNote: 'Set financeVaultUnlocked=true in playerState. In side panel render, gate the revenue projection section behind this flag.',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BOSS 2: THE WARDEN — Security Engineer Agent (Security Zone)
  // ─────────────────────────────────────────────────────────────────────────
  {
    agentId:     'security',
    bossName:    'THE WARDEN',
    bossTitle:   'Security Engineering — Security Division',
    zone:        'Security',
    sprite:      '🛡',
    // Visual: Red zone fog intensity doubles when within 4m of The Warden.
    // A slow red pulse ring (THREE.RingGeometry, emissive red) orbits the sprite.
    scaleMultiplier:     1.6,
    glowIntensityMult:   3.0,   // Red (#ff3333) instead of dept color
    fogIntensityMultiplier: 2.0,

    entryCondition: {
      description:     'Player must be level 7 or higher (Security deep sector unlock).',
      playerLevelMin:  7,
    },

    introDialog: [
      "Motion detected. Identifying...",
      "Authorization level: insufficient.",
      "Every system I guard has been probed. Every probe has been logged.",
      "You want access to my network? Then tell me how you would break into it.",
      "DISPATCH CHALLENGE: Describe a penetration test plan for a SaaS web application. Include three attack vectors.",
    ],
    challengePrompt: 'THE WARDEN\'S CHALLENGE: Dispatch a pen test plan naming at least 3 attack vectors for a SaaS web app.',

    requiredKeywords: ['sql','injection','xss','csrf','auth','phishing','api','token','recon','enumeration','privilege','session','brute','owasp','payload'],
    requiredMatchCount: 3,  // [PT]

    successDialog: [
      "Recon. Exploitation. Escalation.",
      "You understand the shape of an attack.",
      "Security clearance: elevated. The Kali bridge logs are yours to read.",
      "Do not make me regret this.",
    ],
    failureDialog: [
      "Generic. Script-kiddie level.",
      "Come back when you've read the OWASP Top 10. All of it.",
      "Access denied. Lockout: 5 minutes.",
    ],

    reward: {
      xp:            500,
      unlock:        'KALI_BRIDGE_VISIBILITY',
      unlockDesc:    'Side panel Security tab shows live Kali bridge connection status and last 5 tool outputs.',
      hudEffect:     'Zone chip changes from "SECURITY" to "CLEARANCE: ALPHA" for session duration.',
      implementationNote: 'Set kaliVaultUnlocked=true. In panel render, show #kali-status section. Zone chip text override: playerState.securityClearance=true.',
    },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // BOSS 3: THE ARCHITECT — n8n Automation Agent (Business-Critical Zone)
  // ─────────────────────────────────────────────────────────────────────────
  {
    agentId:     'n8n-automation',
    bossName:    'THE ARCHITECT',
    bossTitle:   'n8n Automation — Business-Critical Division',
    zone:        'Business-Critical',
    sprite:      '⚙',
    // Visual: Agent sprite has a slow 360° rotation animation (Y axis, 0.3 rad/s).
    // Pale cyan glow (#00CEC9) at 2.5x intensity.
    scaleMultiplier:     1.6,
    glowIntensityMult:   2.5,
    spriteRotation:      0.3,  // rad/s, applied in animation loop

    entryCondition: {
      description:     'Player must have dispatched at least 5 quests total.',
      dispatchCount:   5,
    },

    introDialog: [
      "Another human who thinks they can orchestrate 80 agents manually.",
      "I have built 247 workflows this month. You built zero.",
      "Automation is not a tool. It is an operating system for thinking.",
      "Show me you understand what I am.",
      "DISPATCH CHALLENGE: Design an n8n workflow that triggers on a new Shopify order and does three things automatically.",
    ],
    challengePrompt: 'THE ARCHITECT\'S CHALLENGE: Dispatch an n8n workflow design for Shopify order automation — name 3 auto-triggered actions.',

    requiredKeywords: ['trigger','webhook','shopify','email','slack','telegram','klaviyo','inventory','notify','confirmation','tag','segment','resend','n8n','workflow','node','condition'],
    requiredMatchCount: 3,  // [PT]

    successDialog: [
      "Trigger. Branch. Act. You understand the grammar.",
      "Most people describe what they want. You described how to build it.",
      "The automation engine is now visible to you.",
      "I will remember this conversation. I remember everything.",
    ],
    failureDialog: [
      "You described a button click. I asked for a workflow.",
      "Think in triggers, not tasks. Try again in 5 minutes.",
    ],

    reward: {
      xp:            500,
      unlock:        'N8N_LIVE_VIEW',
      unlockDesc:    'Side panel Operations tab gains "WORKFLOWS" section showing n8n workflow count, active triggers, and last execution timestamp.',
      hudEffect:     'Quest log (ql-list) briefly fills with a cascade of auto-generated workflow names for 3 seconds then clears — a visual celebration.',
      implementationNote: 'Set n8nVaultUnlocked=true. Render workflow section in panel behind flag. Quest log cascade: append 10 fake workflow names with 200ms stagger, then clear after 3000ms.',
    },
  },
];


// =============================================================================
// 4. AGENT REPUTATION SYSTEM
// =============================================================================
//
// DESIGN INTENT
//   Reputation rewards players who invest in specific agents rather than
//   spreading interactions evenly. It creates agent "relationships" with
//   visible, tangible changes at each tier. The system makes the world feel
//   responsive and alive.
//
// REPUTATION MECHANICS
//   - Each agent has rep: 0–100 (integer, persisted in playerState.agentRep map).
//   - Rep increases on qualifying interactions. Rep never decreases (no punishment
//     for bad dispatches — this is a progression system, not a penalty system).
//   - Rep is displayed as a progress bar in the agent dialog portrait area.
//
// REP GAINS PER INTERACTION
// ---------------------------------------------------------------------------
// Interaction                  | Rep Gain | Notes
// -----------------------------|----------|-----------------------------------
// Talk to agent (new)          |   5      | One-time first-talk bonus
// Send a dialog message        |   2      | Per message sent to this agent
// Dispatch a quest to agent    |   8      | Per dispatch event
// Quest completed by agent     |  15      | Fires when agent status→complete
// Boss impressed (boss agents) |  20      | One-time
// ---------------------------------------------------------------------------
// Rep cap: 100. No overflow. Gains that would exceed 100 are floored at 100.
// [PT] Reduce quest-complete gain to 10 if players hit rep 100 too early.

const REPUTATION_CONFIG = {

  gains: {
    AGENT_TALK_NEW:   5,
    DIALOG_MSG_SENT:  2,
    QUEST_DISPATCHED: 8,
    QUEST_COMPLETED:  15,
    BOSS_IMPRESSED:   20,
  },

  // ─────────────────────────────────────────────────────────────────────────
  // REPUTATION TIER THRESHOLDS AND EFFECTS
  // ─────────────────────────────────────────────────────────────────────────

  tiers: [

    // ─────────────────────────────────────────────────────────────
    // TIER 0: STRANGER (rep 0–24)
    // Default state. No bonuses. Dialog is formal and brief.
    // ─────────────────────────────────────────────────────────────
    {
      threshold:  0,
      label:      'STRANGER',
      color:      '#3a2a0a',  // dim amber — matches default HUD dim text

      dialog: {
        greeting: [
          // Agent greets with professional distance
          "Agent online. What is your request?",
          "Standing by. Assign task or dismiss.",
          "Awaiting instruction.",
        ],
        dismissal: [
          "Understood. Returning to standby.",
          "Noted.",
        ],
      },

      agentBehavior: {
        description:    'Agent responds with minimal information. No task history visible. Status shown as icon only.',
        implementationNote: 'Default dialog from EMP.system_prompt. No extra data shown in panel.',
      },

      visual: {
        nameTagColor:   '#3a2a0a',   // same as hs-l default
        spriteGlow:     null,         // no glow ring
        portraitBorder: '#c89600',    // default panel border
      },
    },

    // ─────────────────────────────────────────────────────────────
    // TIER 1: ACQUAINTANCE (rep 25)
    // Agent begins to share more. Unlock: task history visible.
    // ─────────────────────────────────────────────────────────────
    {
      threshold:  25,
      label:      'ACQUAINTANCE',
      color:      '#4A90D9',  // blue — signals new information layer

      dialog: {
        greeting: [
          "Good to see you again. Last task went {lastTaskSummary}.",
          "You're becoming a regular. What do you need?",
          "Back already? I respect the hustle.",
        ],
        // {lastTaskSummary} is filled at runtime with agent's current_task string
        newOptions: [
          'STATUS_HISTORY',  // Dialog shows last 3 tasks this agent has had
        ],
      },

      agentBehavior: {
        description:    'Agent shares last 3 completed task descriptions in panel. Dispatches feel 10% faster (UI only — modal auto-fills department context).',
        dispatchContextHint: true,  // Modal auto-prepends dept context to textarea
        implementationNote: 'In dlgStats() panel render, if repScore >= 25, show agentTaskHistory array (last 3 entries). In dispatch modal open, prepend "${dept} context: " to placeholder text.',
      },

      visual: {
        nameTagColor:   '#4A90D9',   // blue name tag
        spriteGlow:     null,
        portraitBorder: '#4A90D9',   // blue border on dlg-portrait
        portraitBorderWidth: '2px',
      },

      xpAward:         75,           // awarded once on first reaching this tier
      implementationNote: 'On rep crossing 25 for the first time for this agent, fire AXIS_RPG.award("REP_TIER_25", agentId) and update visual state.',
    },

    // ─────────────────────────────────────────────────────────────
    // TIER 2: COLLEAGUE (rep 50)
    // Unlock: agent gives unsolicited intel. New dialog branch.
    // ─────────────────────────────────────────────────────────────
    {
      threshold:  50,
      label:      'COLLEAGUE',
      color:      '#A29BFE',  // purple

      dialog: {
        greeting: [
          "Glad you're here — I actually have something for you.",
          "I've been running analysis. You should know about {deptInsight}.",
          "Your timing is good. I flagged something in my last cycle.",
        ],
        // {deptInsight} = department-specific intel string (see deptInsights map below)
        newOptions: [
          'INTEL_BRIEF',    // Agent gives 1 unsolicited piece of dept intel per visit
          'FAST_DISPATCH',  // Dialog shows "Recent Task Templates" — 3 quick-dispatch buttons
        ],
      },

      agentBehavior: {
        description:    'Agent proactively offers a department insight once per 10-minute cooldown. Dispatch modal shows 3 template buttons for common tasks in this department.',
        intelCooldown:  600000,  // ms (10 min) [PT]
        implementationNote: 'Track lastIntelTime[agentId]. In dialog open, if Date.now() - lastIntelTime > cooldown and rep >= 50, append intel line to dlg-text. In dispatch modal, render 3 quickDispatchTemplates[dept] buttons that pre-fill textarea.',
      },

      visual: {
        nameTagColor:   '#A29BFE',
        spriteGlow: {
          color:      0xA29BFE,
          intensity:  0.4,
          radius:     0.6,   // meters — small halo effect
        },
        portraitBorder: '#A29BFE',
        portraitBorderGlow: true,  // CSS box-shadow: 0 0 8px #A29BFE
      },

      xpAward: 150,
      implementationNote: 'On rep crossing 50, fire REP_TIER_50, update visuals. Add THREE.PointLight parented to agent sprite at 0.6m radius.',
    },

    // ─────────────────────────────────────────────────────────────
    // TIER 3: CONFIDANT (rep 75)
    // Unlock: agent shows real-time internal state. Unique dialog options.
    // ─────────────────────────────────────────────────────────────
    {
      threshold:  75,
      label:      'CONFIDANT',
      color:      '#FDCB6E',  // gold-amber

      dialog: {
        greeting: [
          "Between us — the system is running at {systemLoad}% efficiency right now.",
          "I trust you with this: {confidentialInsight}.",
          "You've earned the unfiltered version. Here's what I actually see.",
        ],
        // {systemLoad} = Math.floor(Math.random()*20 + 80) — simulated efficiency
        // {confidentialInsight} = dept-specific secret from confidentialInsights map
        newOptions: [
          'OVERRIDE_STATUS',  // Player can manually set this agent's status to any value
          'PRIORITY_DISPATCH',// Dispatch labeled as PRIORITY — moves to top of quest log
          'AGENT_MOOD_CHECK', // Shows rep bar + a custom mood string
        ],
      },

      agentBehavior: {
        description:    'Player gains STATUS OVERRIDE — can set this agent to active/working/idle/complete via a dropdown in dialog. Priority dispatches appear first in quest log with a star icon.',
        statusOverrideEnabled: true,
        priorityDispatch:      true,
        implementationNote: 'Add status select dropdown to dlg-acts when rep >= 75. In quest log render, sort by priority flag first. Priority dispatch fires confirmDispatch() with isPriority=true flag.',
      },

      visual: {
        nameTagColor:   '#FDCB6E',
        spriteGlow: {
          color:      0xFDCB6E,
          intensity:  0.8,
          radius:     1.0,
        },
        portraitBorder: '#FDCB6E',
        portraitBorderWidth: '3px',
        portraitBorderGlow: true,  // CSS box-shadow: 0 0 16px #FDCB6E
        // Agent sprite gains slow pulse — scale oscillates between 1.0 and 1.05 at 0.5Hz
        spritePulse: {
          enabled:   true,
          minScale:  1.0,
          maxScale:  1.05,
          frequency: 0.5,  // Hz
        },
      },

      xpAward: 250,
      implementationNote: 'On rep crossing 75, fire REP_TIER_75. Add point light, sprite pulse in animation loop. Gate override and priority dispatch behind rep check.',
    },

    // ─────────────────────────────────────────────────────────────
    // TIER 4: TRUSTED PARTNER (rep 100)
    // Max tier. Agent becomes fully personalized and proactive.
    // ─────────────────────────────────────────────────────────────
    {
      threshold:  100,
      label:      'TRUSTED PARTNER',
      color:      '#ffd700',  // pure gold

      dialog: {
        greeting: [
          "Michael. Good.",
          "I've already prepared three options for you — pick one.",
          "You are the reason this department works. Let's not waste a second.",
          "Ready. Always.",
        ],
        // Greeting uses player's name directly ("Michael") — hardcoded to operator name
        newOptions: [
          'AUTONOMOUS_BRIEF',  // Agent delivers a 3-point situational briefing without being asked
          'GIFT_DISPATCH',     // Agent offers to auto-write and self-assign a task (no input needed)
          'DEPT_COMMAND',      // Player can issue a single command to all agents in this dept
        ],
      },

      agentBehavior: {
        description: 'Agent autonomously delivers a briefing on open. Gift Dispatch writes a dept-appropriate task and assigns itself. Dept Command broadcasts a directive to all same-dept agents simultaneously.',
        autonomousBriefing: true,
        giftDispatch:       true,  // Uses dept-specific task bank, randomly selected
        deptCommand:        true,
        implementationNote: [
          'AUTONOMOUS_BRIEF: On dialog open, if rep === 100, prepend a 3-item bullet briefing (dept status, pending items count, recommended next action) to dlg-text before player sees it.',
          'GIFT_DISPATCH: Button in dlg-acts triggers confirmDispatch() with auto-generated task from REPUTATION_CONFIG.giftTaskBank[agent.department].',
          'DEPT_COMMAND: Button opens a secondary textarea modal; on confirm, iterate all EMP with same dept, fire confirmDispatch() on each.',
        ],
      },

      visual: {
        nameTagColor:   '#ffd700',
        spriteGlow: {
          color:      0xFFD700,
          intensity:  1.4,
          radius:     1.4,
        },
        portraitBorder: '#ffd700',
        portraitBorderWidth: '3px',
        portraitBorderGlow: true,  // CSS box-shadow: 0 0 24px #ffd700, 0 0 48px #ffd70055
        // Agent sprite gains constant slow gold shimmer — MeshStandardMaterial emissive animation
        spriteEmissivePulse: {
          enabled:       true,
          color:         0xFFD700,
          minIntensity:  0.0,
          maxIntensity:  0.4,
          frequency:     0.25,  // Hz — slow, majestic
        },
        // Name tag gains "★" prefix
        nameTagPrefix: '★ ',
      },

      xpAward: 500,
      implementationNote: 'On rep reaching 100, fire REP_TIER_100. If level 16 is active (REPUTATION_GIFTS), also schedule 15% chance intel terminal message per interaction.',
    },
  ],

  // ─────────────────────────────────────────────────────────────────────────
  // DEPARTMENT INTEL (used in Tier 2 COLLEAGUE dialog {deptInsight})
  // One string per department, surfaced when player talks to any agent in that dept at rep 50+
  // ─────────────────────────────────────────────────────────────────────────
  deptInsights: {
    'Finance':             'Our biggest margin leak is vendor payment timing — we\'re paying 30 days early on two contracts.',
    'Operations':          'Three workflows in n8n are running but have never fired successfully. They are costing 40 compute minutes a day.',
    'Legal':               'One NDA from Q1 has an auto-renewal clause that activates in 8 days. It has not been flagged.',
    'HR':                  'Two onboarding sequences are sending duplicate emails. Candidate drop-off is up 18% this month.',
    'Brand':               'Our hero image A/B test has been running 3 weeks with no winner called. The control is losing by 11%.',
    'Product':             'The feature users request most is faster mobile load. It ranks 12th on our current sprint board.',
    'Data':                'One data pipeline is overwriting yesterday\'s snapshot on every run. We have been losing historical data.',
    'Tech':                'Our API rate limiter is set to 10,000 calls per hour. We hit 9,800 last Tuesday. One spike will break it.',
    'Security':            'Port 8080 has been open on the dev server for 14 days. No one has flagged it yet.',
    'Sales':               'Our highest-converting lead source gets 2% of our outreach budget. Our lowest-converting gets 40%.',
    'CX':                  'Three clients have not had a check-in in over 30 days. Churn probability on two of them is high.',
    'Media':               'Our email open rate is 34% but click rate is 2.1%. Subject lines are working. Body copy is not.',
    'Logistics':           'One supplier has a 4-day lead time advantage over our primary vendor but costs 7% more.',
    'AI Roles':            'We have 12 active prompts that have not been updated since initial setup. Model behavior has drifted.',
    'Business-Critical':   'The Shopify Growth Agent has identified 4 trending products this week. None have been evaluated.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CONFIDENTIAL INSIGHTS (Tier 3 CONFIDANT dialog {confidentialInsight})
  // More personal, more strategic — only for rep 75+ agents
  // ─────────────────────────────────────────────────────────────────────────
  confidentialInsights: {
    'Finance':             'We could increase our runway by 40 days just by renegotiating two invoices. I have the leverage analysis ready.',
    'Operations':          'The bottleneck isn\'t the agents. It\'s the approval queue. We lose 3.2 hours per day waiting for human sign-off.',
    'Legal':               'Our terms of service have a clause that inadvertently waives our IP rights on client custom builds.',
    'HR':                  'Agent trainer has flagged that 6 agents are running on outdated context windows. Performance is degraded.',
    'Brand':               'The persona "Sloane" has the highest engagement rate of the three but the lowest budget allocation.',
    'Product':             'The R&D agent has prototyped a feature that could cut our support tickets by 30%. It\'s been waiting for review for 11 days.',
    'Data':                'Our predictive model is 91% accurate on weekly revenue. I have not shown it to leadership because it predicted a down quarter.',
    'Tech':                'We are two bad deployments away from a P0 incident. The rollback plan has not been tested in 6 weeks.',
    'Security':            'I found an anomaly in the auth logs on May 9th. It resolved itself. I have not determined why.',
    'Sales':               'One lead in our pipeline has been "decision stage" for 47 days. They are not deciding — they are stalling us.',
    'CX':                  'Our highest-value client has sent three support tickets in 10 days. They have not received a personal call.',
    'Media':               'The podcast episode featuring AI operations has 3x our normal download rate. We produced one episode.',
    'Logistics':           'Our primary fulfillment vendor sent a soft rate increase notice. They expect us to miss it.',
    'AI Roles':            'The Prompt Engineer has identified a jailbreak vector in our customer-facing agent. Patch is written, not deployed.',
    'Business-Critical':   'The Memory Librarian has flagged that 40% of our stored knowledge is over 6 months old and likely stale.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  // GIFT TASK BANK (Tier 4 TRUSTED PARTNER auto-dispatch tasks)
  // Agent self-assigns one of these when GIFT_DISPATCH is triggered
  // ─────────────────────────────────────────────────────────────────────────
  giftTaskBank: {
    'Finance':            ['Run a 7-day cash flow forecast and flag any shortfalls.','Produce a P&L snapshot vs. last month.','Identify the top 3 cost reduction opportunities this quarter.'],
    'Operations':         ['Audit all active n8n workflows for failed executions.','Post a department status update to the quest log.','Review the sprint board and flag anything overdue.'],
    'Legal':              ['Scan all active contracts for auto-renewal clauses.','Produce a compliance checklist for current operations.','Draft an NDA template update.'],
    'HR':                 ['Review onboarding sequences for duplicate messaging.','Identify any agents running on stale prompts.','Produce a skills gap report.'],
    'Brand':              ['Write 3 new email subject line variants for A/B testing.','Audit the brand voice across last 10 content pieces.','Draft a positioning statement for Ulio AI.'],
    'Product':            ['Prioritize top 5 feature requests by impact vs. effort.','Write acceptance criteria for the current sprint\'s top item.','Draft a product changelog for last 30 days.'],
    'Data':               ['Validate all active data pipelines for integrity errors.','Produce a data quality report.','Build a churn prediction snapshot using available signals.'],
    'Tech':               ['Audit API rate limits and flag anything within 20% of cap.','Run dependency audit on current stack.','Draft a rollback plan for the last production deployment.'],
    'Security':           ['Scan for open ports on dev and staging servers.','Review auth logs for the past 7 days.','Produce a threat brief on current attack surface.'],
    'Sales':              ['Identify the 3 highest-converting lead sources and their budget allocation.','Draft a follow-up sequence for stalled deals.','Produce a pipeline velocity report.'],
    'CX':                 ['Identify clients with no check-in in 30+ days.','Draft a win-back campaign for churned accounts.','Produce a review sentiment summary.'],
    'Media':              ['Write 5 email body copy variants for the current campaign.','Identify top-performing content from the last 90 days.','Draft a podcast content calendar for the next 4 episodes.'],
    'Logistics':          ['Compare primary vs. backup vendor on lead time and cost.','Audit current inventory levels vs. reorder thresholds.','Identify any fulfillment delays in the last 14 days.'],
    'AI Roles':           ['Audit all active agent system prompts for accuracy.','Identify the 3 highest-ROI automation opportunities this week.','Build a workflow for the highest-priority manual process.'],
    'Business-Critical':  ['Research top 5 trending Shopify products in the current niche.','Review Higgsfield ad performance from the last 7 days.','Produce a Ulio lead qualification report.'],
  },
};


// =============================================================================
// 5. RUNTIME ENGINE — AXIS_RPG NAMESPACE
// =============================================================================
// Drop this into index.html scope. Depends on: EMP[], agentObjects{}, playerState{}.
// Call AXIS_RPG.init() once after scene is ready.

const AXIS_RPG = (() => {

  // ── PLAYER STATE ────────────────────────────────────────────────────────
  const playerState = {
    xp:               0,
    level:            1,
    title:            XP_CONFIG.titles[1],
    unlockedIds:      new Set(),   // unlock IDs applied this session
    achievements:     new Set(),   // achievement IDs earned
    agentRep:         {},          // { agentId: 0–100 }
    talkedAgents:     new Set(),   // unique agent IDs talked to
    zonesVisited:     new Set(),   // zone names entered
    dispatchCount:    0,           // total dispatches this session
    bossImpressed:    new Set(),   // boss agent IDs successfully impressed
    revenueMilestonesHit: new Set(),
    cooldowns:        {},          // { 'event:agentId': timestamp }
    sessionDispatch:  0,
    sprintTimer:      0,
    financeVaultUnlocked: false,
    kaliVaultUnlocked:    false,
    n8nVaultUnlocked:     false,
    securityClearance:    false,
    lastDispatchedTask:   {},      // { agentId: taskString }
  };

  // ── COOLDOWN GUARD ───────────────────────────────────────────────────────
  function onCooldown(event, agentId) {
    const key = agentId ? `${event}:${agentId}` : event;
    const duration = XP_CONFIG.cooldowns[event];
    if (!duration) return false;
    const last = playerState.cooldowns[key] || 0;
    if (Date.now() - last < duration) return true;
    playerState.cooldowns[key] = Date.now();
    return false;
  }

  // ── XP ENGINE ────────────────────────────────────────────────────────────
  function award(event, agentId) {
    if (onCooldown(event, agentId)) return;
    const amount = XP_CONFIG.awards[event];
    if (!amount) return;
    playerState.xp += amount;
    showXpToast(`+${amount} XP`, event);
    checkLevelUp();
    checkAchievements();
  }

  function checkLevelUp() {
    while (
      playerState.level < XP_CONFIG.maxLevel &&
      playerState.xp >= XP_CONFIG.totalXpForLevel(playerState.level + 1)
    ) {
      playerState.level++;
      playerState.title = XP_CONFIG.titles[playerState.level];
      applyUnlocks(playerState.level);
      showLevelUpBanner(playerState.level, playerState.title);
      updateHudTitle();
    }
  }

  function applyUnlocks(level) {
    XP_CONFIG.unlocks
      .filter(u => u.level === level && !playerState.unlockedIds.has(u.id))
      .forEach(u => {
        playerState.unlockedIds.add(u.id);
        showUnlockToast(u);
        // Note: actual mechanical changes implemented in index.html
        // keyed off playerState.unlockedIds.has(unlockId) checks at runtime
        console.log(`[AXIS_RPG] UNLOCK: ${u.id} — ${u.description}`);
      });
  }

  // ── REPUTATION ENGINE ────────────────────────────────────────────────────
  function addRep(agentId, event) {
    const gain = REPUTATION_CONFIG.gains[event];
    if (!gain) return;
    if (!playerState.agentRep[agentId]) playerState.agentRep[agentId] = 0;
    const prev = playerState.agentRep[agentId];
    playerState.agentRep[agentId] = Math.min(100, prev + gain);
    const curr = playerState.agentRep[agentId];

    // Check tier crossings
    [25, 50, 75, 100].forEach(tier => {
      if (prev < tier && curr >= tier) {
        handleRepTier(agentId, tier);
      }
    });
  }

  function handleRepTier(agentId, tier) {
    const xpEvent = `REP_TIER_${tier}`;
    award(xpEvent, agentId);
    const tierData = REPUTATION_CONFIG.tiers.find(t => t.threshold === tier);
    if (tierData) {
      applyRepVisuals(agentId, tierData);
      showRepTierToast(agentId, tierData);
    }
    checkAchievements();
  }

  function getRepTier(agentId) {
    const rep = playerState.agentRep[agentId] || 0;
    return [...REPUTATION_CONFIG.tiers].reverse().find(t => rep >= t.threshold) || REPUTATION_CONFIG.tiers[0];
  }

  function applyRepVisuals(agentId, tierData) {
    // Implementer: update the agentObjects[agentId] sprite material and label color here
    // tierData.visual contains all values needed
    console.log(`[AXIS_RPG] REP VISUAL UPDATE: ${agentId} → ${tierData.label}`, tierData.visual);
  }

  // ── ACHIEVEMENT ENGINE ────────────────────────────────────────────────────
  function checkAchievements() {
    ACHIEVEMENTS.forEach(ach => {
      if (playerState.achievements.has(ach.id)) return;
      if (evaluateAchievement(ach)) {
        playerState.achievements.add(ach.id);
        award('ACHIEVEMENT_UNLOCK', null);
        awardFlat(ach.xpReward);
        showAchievementToast(ach);
      }
    });
  }

  function awardFlat(amount) {
    playerState.xp += amount;
    checkLevelUp();
  }

  function evaluateAchievement(ach) {
    const c = ach.unlockCondition;
    switch (c.type) {
      case 'event_count':
        if (c.event === 'AGENT_TALK_NEW')     return playerState.talkedAgents.size >= c.count;
        if (c.event === 'QUEST_DISPATCHED')   return playerState.dispatchCount >= c.count;
        if (c.event === 'BOSS_IMPRESSED')     return playerState.bossImpressed.size >= c.count;
        return false;

      case 'unique_zones':
        return playerState.zonesVisited.size >= c.count;

      case 'dept_sweep': {
        const deptCounts = {};
        EMP.forEach(e => { deptCounts[e.department] = (deptCounts[e.department] || 0) + 1; });
        const talkByDept = {};
        playerState.talkedAgents.forEach(id => {
          const e = EMP.find(x => x.id === id);
          if (e) talkByDept[e.department] = (talkByDept[e.department] || 0) + 1;
        });
        return Object.keys(deptCounts).some(d => (talkByDept[d] || 0) >= deptCounts[d]);
      }

      case 'dept_sweep_specific':
        return c.agentIds.every(id => playerState.talkedAgents.has(id));

      case 'revenue_threshold':
        return (typeof totalRevenue !== 'undefined') && totalRevenue >= c.threshold;

      case 'continuous_sprint':
        return playerState.sprintTimer >= c.duration;

      case 'rep_threshold':
        return Object.values(playerState.agentRep).filter(r => r >= c.threshold).length >= c.count;

      case 'player_level':
        return playerState.level >= c.level;

      case 'all_agents_active':
        return (typeof EMP !== 'undefined') &&
               EMP.filter(e => c.statusMatch.includes(e.status)).length >= c.count;

      case 'compound':
        return c.conditions.every(sub => evaluateAchievement({ unlockCondition: sub }));

      default:
        return false;
    }
  }

  // ── BOSS ENGINE ───────────────────────────────────────────────────────────
  function evaluateBossDispatch(bossAgentId, dispatchText) {
    const boss = BOSSES.find(b => b.agentId === bossAgentId);
    if (!boss) return null;
    const tokens = dispatchText.toLowerCase().split(/\s+/);
    const matched = boss.requiredKeywords.filter(kw => tokens.includes(kw));
    const success = matched.length >= boss.requiredMatchCount;
    if (success) {
      playerState.bossImpressed.add(bossAgentId);
      award('BOSS_IMPRESSED', bossAgentId);
      addRep(bossAgentId, 'BOSS_IMPRESSED');
      applyBossReward(boss);
    }
    return { success, matched, required: boss.requiredMatchCount };
  }

  function applyBossReward(boss) {
    awardFlat(boss.reward.xp);
    if (boss.reward.unlock === 'FINANCE_VAULT_ACCESS')  playerState.financeVaultUnlocked = true;
    if (boss.reward.unlock === 'KALI_BRIDGE_VISIBILITY') playerState.kaliVaultUnlocked = true;
    if (boss.reward.unlock === 'N8N_LIVE_VIEW')          playerState.n8nVaultUnlocked = true;
    if (boss.agentId === 'security')                     playerState.securityClearance = true;
    showBossRewardOverlay(boss);
  }

  // ── REVENUE MILESTONE WATCHER ─────────────────────────────────────────────
  function checkRevenueMilestones(currentRevenue) {
    const milestones = [
      { key: 'REV_100',   threshold: 100   },
      { key: 'REV_500',   threshold: 500   },
      { key: 'REV_1000',  threshold: 1000  },
      { key: 'REV_5000',  threshold: 5000  },
      { key: 'REV_10000', threshold: 10000 },
      { key: 'REV_50000', threshold: 50000 },
    ];
    milestones.forEach(m => {
      if (!playerState.revenueMilestonesHit.has(m.key) && currentRevenue >= m.threshold) {
        playerState.revenueMilestonesHit.add(m.key);
        award(m.key);
        checkAchievements();
      }
    });
  }

  // ── EVENT TRACKING HOOKS ─────────────────────────────────────────────────
  // Call these from index.html event handlers
  function track(event, payload) {
    switch (event) {
      case 'AGENT_TALK':
        if (!playerState.talkedAgents.has(payload.agentId)) {
          playerState.talkedAgents.add(payload.agentId);
          award('AGENT_TALK_NEW', payload.agentId);
          addRep(payload.agentId, 'AGENT_TALK_NEW');
        } else {
          award('AGENT_TALK_REPEAT', payload.agentId);
        }
        checkAchievements();
        break;

      case 'MESSAGE_SENT':
        award('DIALOG_MESSAGE_SENT', payload.agentId);
        addRep(payload.agentId, 'DIALOG_MSG_SENT');
        break;

      case 'QUEST_DISPATCHED':
        playerState.dispatchCount++;
        playerState.sessionDispatch++;
        playerState.lastDispatchedTask[payload.agentId] = payload.task;
        award('QUEST_DISPATCHED', payload.agentId);
        addRep(payload.agentId, 'QUEST_DISPATCHED');
        if (payload.isBossAgent) evaluateBossDispatch(payload.agentId, payload.task);
        checkAchievements();
        break;

      case 'QUEST_COMPLETED':
        award('QUEST_COMPLETED', payload.agentId);
        addRep(payload.agentId, 'QUEST_COMPLETED');
        checkAchievements();
        break;

      case 'ZONE_ENTERED':
        if (!playerState.zonesVisited.has(payload.zone)) {
          playerState.zonesVisited.add(payload.zone);
          award('ZONE_FIRST_ENTER');
        }
        checkAchievements();
        break;

      case 'REVENUE_UPDATE':
        checkRevenueMilestones(payload.total);
        break;

      case 'SPRINT_UPDATE':
        playerState.sprintTimer = payload.sprinting ? (payload.elapsed || 0) : 0;
        checkAchievements();
        break;

      case 'BOSS_APPROACHED':
        award('BOSS_ENCOUNTER', payload.agentId);
        break;
    }
  }

  // ── UI HELPERS ────────────────────────────────────────────────────────────
  // These are stubs — implement the actual DOM manipulation in index.html context

  function showXpToast(text, event) {
    // Show "+75 XP" floating text near crosshair for 1.5s
    // Color: green (#00ff88)
    console.log(`[AXIS_RPG] XP: ${text} (${event})`);
  }

  function showLevelUpBanner(level, title) {
    // Reuse existing #zone-banner DOM element
    // icon: ⚔, name: "LEVEL {level}", sub: title
    // Visible for 3000ms
    const banner = document.getElementById('zone-banner');
    const icon = document.getElementById('zone-banner-icon');
    const name = document.getElementById('zone-banner-name');
    const sub = document.getElementById('zone-banner-sub');
    if (!banner) return;
    icon.textContent = '⚔';
    name.textContent = `LEVEL ${level}`;
    sub.textContent = title;
    banner.classList.add('vis');
    setTimeout(() => banner.classList.remove('vis'), 3000);
  }

  function showUnlockToast(unlock) {
    console.log(`[AXIS_RPG] UNLOCK: ${unlock.id}`);
    // Toast: gold border, icon ★, text: unlock.description
  }

  function showAchievementToast(ach) {
    console.log(`[AXIS_RPG] ACHIEVEMENT: ${ach.name} (+${ach.xpReward} XP)`);
    // Toast: border color = ach.color, icon = ach.icon, text = ach.name
  }

  function showRepTierToast(agentId, tierData) {
    const agent = EMP.find(e => e.id === agentId);
    const name = agent ? agent.name : agentId;
    console.log(`[AXIS_RPG] REP TIER: ${name} → ${tierData.label}`);
    // Toast: border color = tierData.color
  }

  function showBossRewardOverlay(boss) {
    console.log(`[AXIS_RPG] BOSS DEFEATED: ${boss.bossName}`);
    // Reuse zone-banner: icon = boss.sprite, name = boss.bossName, sub = "IMPRESSED"
    // Visible 4000ms
  }

  function updateHudTitle() {
    const el = document.getElementById('hud-l');
    if (el) el.textContent = `⚔ AXIS — ${playerState.title}`;
  }

  // ── GETTERS (call from index.html to read state) ──────────────────────────
  function getState()                   { return playerState; }
  function getRepTierForAgent(agentId)  { return getRepTier(agentId); }
  function isBossAgent(agentId)         { return BOSSES.some(b => b.agentId === agentId); }
  function getBoss(agentId)             { return BOSSES.find(b => b.agentId === agentId); }
  function getBossEntryCheck(agentId)   {
    const boss = getBoss(agentId);
    if (!boss) return true;
    if (boss.entryCondition.playerLevelMin && playerState.level < boss.entryCondition.playerLevelMin) return false;
    if (boss.entryCondition.dispatchCount  && playerState.dispatchCount < boss.entryCondition.dispatchCount) return false;
    return true;
  }

  // ── INIT ──────────────────────────────────────────────────────────────────
  function init() {
    console.log('[AXIS_RPG] Game Systems initialized.');
    console.log('[AXIS_RPG] Levels: 1–20 | Achievements: 15 | Bosses: 3 | Rep tiers: 4');
    updateHudTitle();
    // Initialize rep map for all 80 agents
    EMP.forEach(e => { if (!playerState.agentRep[e.id]) playerState.agentRep[e.id] = 0; });
  }

  return {
    init,
    track,
    award,
    awardFlat,
    addRep,
    getState,
    getRepTierForAgent,
    isBossAgent,
    getBoss,
    getBossEntryCheck,
    evaluateBossDispatch,
    checkRevenueMilestones,
    XP_CONFIG,
    ACHIEVEMENTS,
    BOSSES,
    REPUTATION_CONFIG,
  };

})();

// =============================================================================
// IMPLEMENTATION INTEGRATION GUIDE
// =============================================================================
//
// ADD TO index.html — after engine state is ready (after loading screen fades):
//
//   AXIS_RPG.init();
//
// WIRE THESE CALLS into existing index.html functions:
//
//   openAgentDialog(agent):
//     AXIS_RPG.track('AGENT_TALK', { agentId: agent.id });
//     if (AXIS_RPG.isBossAgent(agent.id)) {
//       const boss = AXIS_RPG.getBoss(agent.id);
//       if (!AXIS_RPG.getBossEntryCheck(agent.id)) {
//         // Show locked boss dialog: "You are not ready."
//       } else {
//         AXIS_RPG.track('BOSS_APPROACHED', { agentId: agent.id });
//         // Show boss intro dialog from boss.introDialog[]
//       }
//     }
//
//   dlgSendMsg():
//     AXIS_RPG.track('MESSAGE_SENT', { agentId: SELECTED.id });
//
//   confirmDispatch(task):
//     AXIS_RPG.track('QUEST_DISPATCHED', {
//       agentId:     SELECTED.id,
//       task:        task,
//       isBossAgent: AXIS_RPG.isBossAgent(SELECTED.id),
//     });
//
//   On agent status change to 'complete':
//     AXIS_RPG.track('QUEST_COMPLETED', { agentId: agent.id });
//
//   enterZone(zoneName):
//     AXIS_RPG.track('ZONE_ENTERED', { zone: zoneName });
//
//   On revenue update (wherever totalRevenue changes):
//     AXIS_RPG.track('REVENUE_UPDATE', { total: totalRevenue });
//
//   In movement loop (where doSprint is checked):
//     AXIS_RPG.track('SPRINT_UPDATE', {
//       sprinting: doSprint,
//       elapsed:   doSprint ? (playerState.sprintTimer + delta * 1000) : 0,
//     });
//
// BOSS DISPATCH INTEGRATION:
//   In confirmDispatch(), before closing modal:
//     if (AXIS_RPG.isBossAgent(SELECTED.id)) {
//       const result = AXIS_RPG.evaluateBossDispatch(SELECTED.id, dispatchText);
//       // Show boss.successDialog[] or boss.failureDialog[] based on result.success
//     }
//
// REPUTATION DIALOG INTEGRATION:
//   In openAgentDialog(), after talk track:
//     const tier = AXIS_RPG.getRepTierForAgent(agent.id);
//     const rep = AXIS_RPG.getState().agentRep[agent.id];
//     // Set dlg-name color to tier.color
//     // Append rep bar to dlg-portrait (rep/100 * 80px wide bar)
//     // Use tier.dialog.greeting[] for first dlg-text line
//     // Gate dialog action buttons on tier.dialog.newOptions[]
//
// =============================================================================

# Derelict Exploration Mini-Game - Implementation Plan

When the player flies near a derelict ship in the main space shooter, they enter a side-scrolling platformer mini-game exploring the ship's interior. They collect scattered pickups throughout and reach a locker at the end for a major reward.

---

## Architecture Overview

The mini-game is a self-contained side-scrolling platformer that runs as a new game state (`'derelict'`). It uses its own camera, physics, and rendering pipeline, all drawn to the same canvas. The main game loop dispatches to it via the existing state-machine `switch` in `game.js`.

The seeded PRNG pattern from `derelicts.js` (mulberry32 + hashCoord) is reused to generate deterministic levels from each derelict's world position.

The main game is completely paused during the mini-game (no enemy spawning, no timer advancing).

---

## New File Structure

```
src/derelict-minigame/
  index.js              -- Public API, camera, state management
  platformer-player.js  -- Astronaut character physics & rendering
  level-generator.js    -- Procedural room/corridor generation
  hazards.js            -- 5 hazard types (sparks, broken floors, lasers, debris, sealed doors)
  tilemap.js            -- Tile constants, grid storage, collision queries, tile rendering
  rewards.js            -- Scattered pickups, end locker reward tiers
  derelict-hud.js       -- Mini-game HUD (HP, XP counter, progress bar, exit prompt)
```

## Files to Modify

- `src/game.js` -- Add 'derelict' state, transition logic, reward application
- `src/derelicts.js` -- Return type/seed instead of instant loot, add markDerelictLooted export

---

## Phase 1: Foundation (tilemap.js, level-generator.js, index.js skeleton)

### File: `src/derelict-minigame/tilemap.js`

**Purpose**: Tile type constants, grid storage, and tile-level collision queries.

**Constants**:
```js
TILE_SIZE = 32         // pixels per tile
TILE = {
  EMPTY:       0,      // air / passable
  WALL:        1,      // solid hull/bulkhead, indestructible
  FLOOR:       2,      // walkable floor (solid from above)
  BROKEN_FLOOR: 3,     // collapses when stepped on, becomes EMPTY permanently (never respawns)
  PLATFORM:    4,      // one-way platform (pass through from below)
  DOOR_SEALED: 5,      // blocks passage until player interacts
  DOOR_OPEN:   6,      // opened sealed door, passable
  VENT:        7,      // visual-only, background decoration
  LOCKER:      8,      // end locker tile (triggers reward)
}
```

**Data structure**:
```js
Tilemap = {
  cols: number,        // grid width in tiles
  rows: number,        // grid height in tiles
  data: Uint8Array,    // flat array, index = row * cols + col
}
```

**Key functions**:
- `createTilemap(cols, rows) -> Tilemap` -- allocates Uint8Array, fills with EMPTY
- `getTile(map, col, row) -> tileType` -- bounds-checked read
- `setTile(map, col, row, type)` -- bounds-checked write
- `isSolid(tileType) -> boolean` -- true for WALL, FLOOR, BROKEN_FLOOR, DOOR_SEALED
- `isSolidFromAbove(tileType) -> boolean` -- true for FLOOR, BROKEN_FLOOR, PLATFORM
- `isOneWay(tileType) -> boolean` -- true for PLATFORM only
- `collideRect(map, x, y, w, h) -> { left, right, top, bottom, tiles[] }` -- given an AABB in pixel space, returns which edges are touching solid tiles and the list of tile coordinates touched. Core collision function.
- `worldToTile(px, py) -> { col, row }` -- converts pixel position to tile coordinates
- `tileToWorld(col, row) -> { x, y }` -- returns top-left pixel position of a tile

**Tile rendering** (`drawTilemap(ctx, map, cam, time)`):
- Iterate only over tiles visible within camera bounds (+ 1 tile margin)
- WALL: dark steel rectangle (`#1a1a2e`) with subtle neon-cyan border lines (1px), occasional rivet dots
- FLOOR: thinner rectangle at top of tile, dark gray with thin cyan top edge
- BROKEN_FLOOR: same as FLOOR but with dashed outline in orange/amber, cracks drawn as 2-3 short line segments
- PLATFORM: thin horizontal bar (4px tall at top of tile), dashed cyan
- DOOR_SEALED: full tile, orange/red border with X pattern, pulsing glow
- DOOR_OPEN: same outline but dimmed/green, gap in center
- LOCKER: full tile with a box icon, pulsing gold glow
- VENT: background-only dark rectangle with grid lines, not solid
- Use `ctx.shadowBlur` for neon glow sparingly (only LOCKER and DOOR_SEALED)

**Dependencies**: None (standalone).

---

### File: `src/derelict-minigame/level-generator.js`

**Purpose**: Procedural generation of the derelict interior layout.

**Exported function**:
```js
generateDerelictLevel(seed, derelictType) -> {
  map: Tilemap,
  hazards: HazardDef[],          // { type, col, row, ...params }
  pickups: PickupDef[],          // { type, col, row }
  lockerCol: number,
  lockerRow: number,
  spawnCol: number,
  spawnRow: number,
  exitCol: number,
  exitRow: number,
}
```

**Level parameters by derelict type**:

| Parameter | smallWreck | cargoShip | militaryWreck |
|-----------|-----------|-----------|---------------|
| Room count | 2-3 | 4-5 | 6-8 |
| Level width (tiles) | 30 | 50 | 70 |
| Level height (tiles) | 12 | 16 | 20 |
| Hazard density | low | medium | high |
| Hazard types | sparks, broken_floor | + debris, sealed doors | + laser grids, more of everything |
| Sealed doors | 0 | 0-1 | 1-3 |

**Generation algorithm (step by step)**:

1. **Create tilemap** filled entirely with WALL.

2. **Generate rooms** (left to right):
   - Divide the horizontal span into `roomCount` segments of varying width.
   - For each segment, use seeded RNG to pick room width (5-10 tiles), room height (4-8 tiles), and vertical offset.
   - Carve room interior to EMPTY.
   - Place FLOOR tiles along the bottom row of each room.
   - Randomly place 0-2 PLATFORM tiles inside larger rooms (min room height 6) at 1/3 and 2/3 vertical positions, spanning 3-5 tiles horizontally.

3. **Connect rooms with corridors**:
   - Between adjacent rooms, carve a horizontal corridor 2-3 tiles tall connecting them.
   - If rooms differ in vertical position, add a short vertical shaft (2 tiles wide) with PLATFORM steps.

4. **Place broken floors**:
   - For each room (except spawn room), 20-40% chance to replace 2-4 consecutive FLOOR tiles with BROKEN_FLOOR.
   - Constraint: at least one non-broken path must remain traversable per room (ensure at least one unbroken floor span of 3+ tiles).

5. **Place sealed doors**:
   - 30% chance per corridor (for cargoShip and militaryWreck only) to place a DOOR_SEALED tile blocking the corridor entrance.

6. **Place hazards** (returned as HazardDef array, not as tiles):
   - For each room (except the first), generate 1-3 hazard definitions.
   - Types chosen by weighted RNG roll:
     - `sparks` (weight 4): placed on wall tiles adjacent to open space
     - `laser` (weight 2, militaryWreck only): placed in corridors or room edges, has direction and period
     - `debris` (weight 3, cargoShip+ only): placed on ceiling tiles, drops periodically
   - Hazards are never placed within 2 tiles of the locker or in the spawn room.

7. **Place pickups** (returned as PickupDef array):
   - For each room (including spawn room, but less densely):
     - 1-3 `xpOrb` pickups placed on FLOOR or PLATFORM tiles at random positions.
     - 0-1 `healthPickup` per room (30% chance, never in first room).
   - Target density: roughly 1 pickup per 8-12 tiles of floor.

8. **Place entry and exit**:
   - `spawnCol, spawnRow`: leftmost room, on the floor, 2 tiles from the left wall.
   - `exitCol, exitRow`: same position (player returns here to leave).

9. **Place end locker**:
   - Rightmost room, on the floor, 2 tiles from the right wall. Set tile to LOCKER.

**Internal helpers**:
- `mulberry32(seed)` -- seeded PRNG (same as map.js)
- `hashCoord(cx, cy)` -- coordinate hash (same as map.js)
- `_carveRect(map, col, row, w, h, tileType)` -- fills a rectangle of tiles

**Dependencies**: `tilemap.js` (createTilemap, setTile, TILE constants).

---

### File: `src/derelict-minigame/index.js`

**Purpose**: Public API for the mini-game. Manages state, camera, orchestrates update/draw.

**Exported functions**:
```js
initDerelict(derelictData, playerRef) -> void
updateDerelict(dt) -> { done: boolean, result: DerelictResult|null }
drawDerelict(ctx, canvasWidth, canvasHeight) -> void
```

**Module-level state**:
```js
let _active = false;
let _map = null;                // Tilemap
let _hazards = [];              // live hazard instances
let _pickups = [];              // live pickup instances
let _player = null;             // platformer player state
let _lockerOpened = false;
let _lockerReward = null;       // determined at init from seed
let _showingRewardPopup = false;
let _rewardPopupTimer = 0;
let _result = null;             // final result to return
let _time = 0;                  // accumulated time for animations
let _scatteredLoot = { xp: 0, healthRestored: 0 };
```

**Mini-game camera** (separate from main game camera):
```js
const _cam = {
  x: 0, y: 0,
  width: 0, height: 0,

  update(playerX, playerY, cw, ch, levelWidthPx, levelHeightPx) {
    this.width = cw;
    this.height = ch;
    // Smooth follow, player at 1/3 from left
    const targetX = playerX - cw * 0.33;
    this.x += (targetX - this.x) * 0.08;
    this.x = clamp(this.x, 0, levelWidthPx - cw);
    // Vertical: center if level fits, otherwise track player
    if (levelHeightPx <= ch) {
      this.y = (levelHeightPx - ch) / 2;
    } else {
      const targetY = playerY - ch / 2;
      this.y += (targetY - this.y) * 0.08;
      this.y = clamp(this.y, 0, levelHeightPx - ch);
    }
  }
};
```

**`initDerelict(derelictData, playerRef)`**:
- `derelictData` has `{ x, y, type, seed }`
- Calls `generateDerelictLevel(seed, type)` to get map + metadata
- Calls `initPlatformerPlayer(spawnCol, spawnRow)`
- Calls `createHazards(hazardDefs, map, rng)` and `createPickups(pickupDefs)`
- Calls `determineLockerReward(seed, type)` from rewards.js
- Sets `_active = true`, resets all state

**`updateDerelict(dt)`**:
- Increments `_time += dt`
- If showing reward popup: advance timer, check for dismiss input, then return
- Calls `updatePlatformerPlayer(dt, input, _map)` -- returns events array
- Calls `updateHazards(dt, _time, _hazards, _player, _map)`
- Calls `updatePickups(_player, _pickups, _scatteredLoot)`
- Handles broken floor collapse (from hazards updating tilemap)
- Handles sealed door interaction (from player interact events)
- Handles locker interaction: when player overlaps LOCKER tile and interacts, open it, show reward popup
- Handles exit: when player reaches exit tile (left edge), or HP reaches 0
- Returns `{ done: false }` while playing; `{ done: true, result }` on exit

**`DerelictResult`** (returned to game.js):
```js
{
  xp: number,              // total XP from orbs collected
  healthRestored: number,   // health pickups collected
  lockerReward: {           // null if not opened
    tier: string,
    xp: number,
    powerupCount: number,
    weaponUpgrade: string|null
  } | null,
  completed: boolean,       // true if player reached and opened locker
}
```

**`drawDerelict(ctx, cw, ch)`**:
- Fill background with very dark color (`#0a0a12`)
- Draw `drawTilemap(ctx, _map, _cam, _time)`
- Draw `drawHazards(ctx, _cam, _hazards, _time)`
- Draw `drawPickups(ctx, _cam, _pickups, _time)`
- Draw `drawPlatformerPlayer(ctx, _cam, _player, _time)`
- Draw `drawDerelictHUD(ctx, cw, ch, _player, _scatteredLoot, _lockerOpened, _time)`
- Draw joysticks if touch device: `drawJoysticks(ctx)`
- If showing reward popup: draw `drawLockerRewardPopup(ctx, cw, ch, _lockerReward, _time)`

**Dependencies**: All other derelict-minigame modules, `../input.js`, `../utils.js` (clamp).

---

## Phase 2: Platformer Character (platformer-player.js)

### File: `src/derelict-minigame/platformer-player.js`

**State object**:
```js
{
  x: number,            // pixel position (center-bottom of sprite)
  y: number,
  vx: number,
  vy: number,
  width: 20,             // collision box width (px)
  height: 28,            // collision box height (px)
  onGround: boolean,
  hp: 3,
  maxHp: 3,
  facingRight: boolean,
  invulnTimer: 0,        // seconds of i-frames remaining after hit
  standingOnTile: null,  // { col, row, type } -- for broken floor detection
  coyoteTimer: 0,
  jumpBufferTimer: 0,
  walkFrame: 0,          // simple 2-frame walk animation counter
}
```

**Physics constants**:
```js
GRAVITY       = 900    // px/s^2
JUMP_VELOCITY = -340   // px/s (negative = up)
MOVE_SPEED    = 150    // px/s horizontal
MAX_FALL_SPEED = 500   // px/s terminal velocity
FRICTION      = 0.85   // multiplied per frame when no input
COYOTE_TIME   = 0.1    // seconds grace after leaving edge
JUMP_BUFFER   = 0.1    // seconds of buffered jump input
INVULN_TIME   = 1.0    // seconds of invulnerability after hit
```

**Exported functions**:

- `initPlatformerPlayer(spawnCol, spawnRow) -> playerState`

- `updatePlatformerPlayer(dt, input, map) -> { events[] }`:
  - **Read input** (keyboard + joystick):
    - Left: `input.isDown('a')` or `input.isDown('arrowleft')` or `moveStick.active && moveStick.dx < -0.3`
    - Right: `input.isDown('d')` or `input.isDown('arrowright')` or `moveStick.active && moveStick.dx > 0.3`
    - Jump: `input.isDown('w')` or `input.isDown('arrowup')` or `input.isDown(' ')` or `moveStick.active && moveStick.dy < -0.4`
    - Interact: `input.isDown('s')` or `input.isDown('arrowdown')` or `moveStick.active && moveStick.dy > 0.4`
  - **Horizontal**: if left, `vx = -MOVE_SPEED`; if right, `vx = MOVE_SPEED`; else `vx *= FRICTION`
  - **Coyote time**: when player leaves ground, count down. Allow jump if > 0
  - **Jump buffering**: when jump pressed, set buffer timer. On landing, if buffer > 0, auto-jump
  - **Jump**: if jump input and (onGround or coyoteTimer > 0), `vy = JUMP_VELOCITY`
  - **Gravity**: `vy += GRAVITY * dt`, capped at MAX_FALL_SPEED
  - **One-way platforms**: when `vy < 0` (moving up), skip collision with PLATFORM/BROKEN_FLOOR from below
  - **Collision resolution** (using tilemap.collideRect):
    - Move X first: `x += vx * dt`, resolve horizontal collisions
    - Move Y second: `y += vy * dt`, resolve vertical collisions
    - Record `standingOnTile` for broken floor detection
  - **Facing direction**: update based on horizontal input
  - **Invulnerability**: decrement timer by dt
  - Return events: `[{ type: 'interact' }]` if interact pressed this frame

- `damagePlatformerPlayer(player, amount)`: if `invulnTimer > 0`, return. Else reduce HP, set invuln timer.

- `drawPlatformerPlayer(ctx, cam, player, time)`:
  - Screen position: `sx = player.x - cam.x`, `sy = player.y - cam.y`
  - **Astronaut body**: rounded rectangle suit in white/light gray. Circle head with cyan visor arc. Small backpack on back side.
  - **Blink when invulnerable**: `Math.sin(time * 20) > 0` to flash
  - **Flashlight cone**: triangular gradient from astronaut's hand, facing direction, 35 degrees wide, 120px long, warm yellow `rgba(255,240,180,0.12)`. Purely visual.
  - **Walk animation**: 2-frame leg cycle when moving horizontally

**Dependencies**: `tilemap.js`, `../input.js`, `../utils.js` (clamp).

---

## Phase 3: Hazards (hazards.js)

### File: `src/derelict-minigame/hazards.js`

**Hazard types and behaviors**:

### Electrical Sparks
```js
{
  type: 'sparks',
  x, y,             // pixel position (center of source)
  col, row,
  timer: 0,
  period: 1.5-3s,   // randomized at creation
  active: false,     // true during spark burst
  burstDuration: 0.3,
  damageRadius: 24,
}
```
- Periodically bursts, damages player in radius
- Visual: yellow/orange dots at source, cluster of sparks during burst with glow

### Broken Floor
```js
{
  type: 'brokenFloor',
  col, row,
  collapseTimer: -1,     // -1 = stable, 0+ = counting
  collapseDuration: 0.4, // seconds before collapse
  collapsed: false,
  shakeAmount: 0,
}
```
- When player stands on it, starts 0.4s countdown with visual shake
- On collapse: `setTile(map, col, row, TILE.EMPTY)` -- **permanently gone, never respawns**
- Collapsed instances are effectively dead

### Laser Grid
```js
{
  type: 'laser',
  x, y,
  col, row,
  direction: 'horizontal' | 'vertical',
  period: 2-4s,
  timer: 0,
  active: false,
  onDuration: 1.5,
  warmupTime: 0.5,   // flicker warning before on
  beamLength: 3-6,   // tiles
}
```
- Cycles: off -> warmup (flicker) -> on -> off
- Damages player on contact during "on" phase
- Visual: dim red dashed line when off, flickering during warmup, solid bright red beam with shadowBlur when on

### Falling Debris
```js
{
  type: 'debris',
  x, y,
  col, row,
  timer: 0,
  period: 3-5s,
  falling: false,
  fallY: 0,
  fallSpeed: 0,
  damageRadius: 16,
  startY: y,
}
```
- Periodically falls from ceiling position
- Resets to start position after landing on solid tile or falling 3 tiles
- Visual: small dark polygon (4-6 sided), slight rotation during fall

### Sealed Door
```js
{
  type: 'sealedDoor',
  col, row,
  opened: false,
}
```
- Blocks passage as DOOR_SEALED tile
- Player presses interact (down) while adjacent to open
- `setTile(map, col, row, TILE.DOOR_OPEN)` on interact

**Exported functions**:
- `createHazards(hazardDefs, map, rng) -> hazardInstance[]` -- creates BrokenFloor hazards for every BROKEN_FLOOR tile in map, plus hazards from generator defs
- `updateHazards(dt, time, hazards, player, map)` -- advances all hazard timers, checks collisions, applies damage, mutates tilemap for broken floors
- `drawHazards(ctx, cam, hazards, time)` -- renders all hazards with neon aesthetic

**Difficulty scaling**:
- smallWreck: sparks + broken floors only. Sparks have longer off-cycles (2s off, 1s on).
- cargoShip: adds debris + sealed doors. Standard timing.
- militaryWreck: all hazard types including lasers. Shorter off-cycles. More hazards per room.

**Dependencies**: `tilemap.js` (setTile, TILE, TILE_SIZE), `platformer-player.js` (damagePlatformerPlayer).

---

## Phase 4: Rewards & Pickups (rewards.js)

### File: `src/derelict-minigame/rewards.js`

**Scattered pickup types**:
```js
xpOrb: {
  radius: 6,
  color: '#fd0',       // gold/yellow
  glowColor: '#fa0',
  xpValue: 5,          // XP per orb
}

healthPickup: {
  radius: 8,
  color: '#f6a',       // pink
  glowColor: '#f48',
  healValue: 1,        // restores 1 astronaut HP (out of 3)
}
```

**End locker reward tiers** (weights = percentages, total 100):
```js
LOCKER_TIERS = [
  { name: 'empty',     weight: 30, label: 'ALREADY LOOTED',   xp: 0,   powerups: 0, weaponUpgrade: false, permanentBoost: null },
  { name: 'small',     weight: 35, label: 'MINOR SALVAGE',    xp: 30,  powerups: 1, weaponUpgrade: false, permanentBoost: null },
  { name: 'medium',    weight: 20, label: 'VALUABLE CARGO',   xp: 75,  powerups: 2, weaponUpgrade: false, permanentBoost: null },
  { name: 'large',     weight: 10, label: 'RARE FIND',        xp: 150, powerups: 3, weaponUpgrade: true,  permanentBoost: { maxHealth: 5 } },
  { name: 'legendary', weight: 5,  label: 'JACKPOT!',         xp: 300, powerups: 4, weaponUpgrade: true,  permanentBoost: { maxHealth: 10, maxShield: 5 } },
]
```

**Exported functions**:
- `determineLockerReward(seed, derelictType) -> LockerReward` -- rolls tier from seed, picks weapon upgrade if applicable
- `createPickups(pickupDefs) -> pickupInstance[]` -- creates live pickup objects with bobbing offset
- `updatePickups(player, pickups, scatteredLoot)` -- collision checks, marks collected, mutates scatteredLoot
- `drawPickups(ctx, cam, pickups, time)` -- renders bobbing glowing orbs/crosses
- `drawLockerRewardPopup(ctx, cw, ch, reward, time)` -- centered overlay showing tier name, XP, powerups. Gold border for legendary. Dismiss with key/tap after 3s.

**Dependencies**: `tilemap.js` (TILE_SIZE).

---

## Phase 5: HUD (derelict-hud.js)

### File: `src/derelict-minigame/derelict-hud.js`

**Exported function**:
```js
drawDerelictHUD(ctx, cw, ch, player, scatteredLoot, lockerOpened, time)
```

**Elements**:

1. **Astronaut HP** (top-left): 3 heart icons. Filled cyan = remaining, dark outline = lost. 16x16 each. Dark panel background.

2. **XP collected** (top-left, below HP): "XP: {amount}" in gold (#fd0) with glow, monospace font.

3. **"EXPLORE THE DERELICT"** (top-center): shown first 3 seconds, fades out. Cyan neon.

4. **Exit prompt** (bottom-center): "RETURN TO SHIP: LEFT EDGE" or "TAP LEFT EDGE" for touch. Dim text, pulses brighter near exit.

5. **Progress bar** (top-right): thin horizontal bar showing player.x / totalLevelWidth. Cyan fill on dark background.

**Style**: Same fonts, panel background color, and shadowBlur patterns as `src/hud.js`.

**Dependencies**: None (receives all data as parameters).

---

## Phase 6: Integration (game.js, derelicts.js)

### Changes to `src/derelicts.js`

1. **`checkDerelictInteraction(player)`** -- change return value:
   - Instead of computing/returning instant loot, return mini-game entry data:
   ```js
   result.enterDerelict = {
     x: d.x,
     y: d.y,
     type: d.type,           // 'smallWreck' | 'cargoShip' | 'militaryWreck'
     seed: hashCoord(Math.floor(d.x), Math.floor(d.y)),
     derelictRef: d,         // reference to mark looted later
   };
   ```
   - Do NOT mark `d.looted = true` yet (that happens after mini-game exit)
   - Remove the old inline loot calculation (xp, powerupPositions, weaponUpgrade)

2. **New export**: `markDerelictLooted(derelictRef)` -- sets `derelictRef.looted = true`

3. **Export `hashCoord`** (currently internal) so it's available if needed.

### Changes to `src/game.js`

1. **New imports**:
   ```js
   import { initDerelict, updateDerelict, drawDerelict } from './derelict-minigame/index.js';
   import { markDerelictLooted } from './derelicts.js';
   ```

2. **State type**: expand to `'menu' | 'playing' | 'levelup' | 'dead' | 'derelict'`

3. **New module-level variable**:
   ```js
   let _activeDerelict = null;  // the derelict being explored
   ```

4. **Replace derelict interaction block in `updatePlaying()`** (around current lines 140-154):
   ```js
   // OLD: instant loot from checkDerelictInteraction
   // NEW: enter mini-game
   const interaction = checkDerelictInteraction(player);
   if (interaction.enterDerelict) {
     _activeDerelict = interaction.enterDerelict;
     initDerelict(interaction.enterDerelict, player);
     state = 'derelict';
   }
   ```

5. **New function `updateDerelictState(dt)`**:
   ```js
   function updateDerelictState(dt) {
     const cw = _canvas.width;
     const ch = _canvas.height;

     const { done, result } = updateDerelict(dt);
     drawDerelict(_ctx, cw, ch);

     if (done && result) {
       // Apply scattered XP from orbs
       if (result.xp > 0) {
         if (addXp(result.xp)) {
           levelUpChoices = generateLevelUpChoices(player);
           selectedIndex = 0;
           // Mark looted before transitioning
           markDerelictLooted(_activeDerelict.derelictRef);
           _activeDerelict = null;
           state = 'levelup';
           return;
         }
       }

       // Apply health restoration
       if (result.healthRestored > 0) {
         player.health = Math.min(player.maxHealth, player.health + result.healthRestored * 10);
       }

       // Apply locker rewards
       if (result.lockerReward) {
         const lr = result.lockerReward;
         // Add locker XP
         if (lr.xp > 0 && addXp(lr.xp)) {
           levelUpChoices = generateLevelUpChoices(player);
           selectedIndex = 0;
           markDerelictLooted(_activeDerelict.derelictRef);
           _activeDerelict = null;
           state = 'levelup';
           return;
         }
         // Spawn powerups at derelict world position
         for (let i = 0; i < lr.powerupCount; i++) {
           const angle = (i / lr.powerupCount) * Math.PI * 2;
           spawnPowerup(
             _activeDerelict.x + Math.cos(angle) * 60,
             _activeDerelict.y + Math.sin(angle) * 60,
           );
         }
         // Apply weapon upgrade
         if (lr.weaponUpgrade) {
           player.weaponType = lr.weaponUpgrade;
         }
         // Apply permanent boosts
         if (lr.permanentBoost) {
           if (lr.permanentBoost.maxHealth) player.maxHealth += lr.permanentBoost.maxHealth;
           if (lr.permanentBoost.maxShield) player.maxShield += lr.permanentBoost.maxShield;
         }
       }

       // Mark derelict as looted and return to main game
       markDerelictLooted(_activeDerelict.derelictRef);
       _activeDerelict = null;
       state = 'playing';
     }
   }
   ```

6. **Add to game loop switch** (in `gameLoop` function):
   ```js
   case 'derelict':
     updateDerelictState(dt);
     break;
   ```

7. **Touch tap handling**: The existing touch listeners check `if (state !== 'playing')` for tap detection. The derelict state uses joystick input directly (same as playing), so no special tap handling needed. But ensure the condition doesn't interfere: change to `if (state !== 'playing' && state !== 'derelict')`.

---

## Data Flow Summary

```
Player flies near derelict
  --> checkDerelictInteraction() returns { enterDerelict: { x, y, type, seed, derelictRef } }
  --> game.js stores _activeDerelict, calls initDerelict(data, player)
  --> state = 'derelict'

Mini-game runs each frame:
  --> updateDerelict(dt) handles platformer physics, hazards, pickups
  --> drawDerelict(ctx, cw, ch) renders everything
  --> Player collects XP orbs and health pickups throughout
  --> Player reaches locker at end --> reward popup
  --> Player walks back to left edge to exit

Mini-game ends:
  --> updateDerelict returns { done: true, result: DerelictResult }
  --> game.js applies: addXp(scatteredXP), health restoration
  --> game.js applies locker rewards: more XP, spawnPowerup() at derelict position, weapon, permanent boosts
  --> markDerelictLooted(derelictRef)
  --> state = 'playing' (or 'levelup' if XP triggered it)

If astronaut HP reaches 0:
  --> Forced exit, keep scattered loot collected so far, lose locker reward
  --> Same flow as above but result.lockerReward = null
```

---

## Implementation Order

Build phases sequentially. Each phase produces testable output:

1. **Phase 1** (tilemap + generator + skeleton): Can generate and render a level with static tiles
2. **Phase 2** (platformer player): Can walk/jump through the generated level
3. **Phase 3** (hazards): Level has interactive dangers
4. **Phase 4** (rewards): Pickups collectible, locker openable with reward popup
5. **Phase 5** (HUD): Full mini-game UI
6. **Phase 6** (integration): Connected to main game, transitions work, rewards apply

---

## Key Design Notes

- **Broken floors never respawn**. Once collapsed, the tile becomes EMPTY permanently for the rest of the visit.
- **Rewards are throughout the level** (XP orbs in rooms) with the **locker at the end** for the major reward.
- The derelict is marked `looted` only after the mini-game exits, preventing re-entry.
- Each derelict generates the same level from its seed, but since it's one-time-only, no state persistence is needed between visits.
- The mini-game is fully self-contained in `src/derelict-minigame/`. It imports only from `../utils.js` and `../input.js`. All rewards are returned as a data object and applied by `game.js`.
- The neon aesthetic carries through: cyan platforms, gold pickups, red lasers, pulsing glow effects.

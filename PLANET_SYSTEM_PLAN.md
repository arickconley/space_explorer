# Planet System Implementation Plan

## Overview

The planet system adds chunk-based procedurally generated planets in the world, a landing mini-game (side-view descent), a market/shop screen, and a new "coins" currency found in derelict ships and spent at planet markets.

---

## 1. New Files to Create

### 1.1. `src/planets.js`
**Purpose:** Chunk-based procedural planet generation, rendering, and interaction checking — directly mirrors `derelicts.js`.

**Contents:**
- Seeded PRNG (mulberry32 + hashCoord) with different seed offsets to avoid collision with derelicts
- Constants:
  - `CHUNK_SIZE = 5000` (much larger than derelicts' 2000)
  - `MAX_CACHED_CHUNKS = 40`
  - `SPAWN_CHANCE = 0.025` (2.5% per chunk)
- `PLANET_TYPES` array:
  ```
  rocky:    { weight: 4, radiusMin: 80,  radiusMax: 110, color: '#c96', glowColor: '#a74', specialization: 'hull' }
  gas:      { weight: 3, radiusMin: 100, radiusMax: 150, color: '#6af', glowColor: '#48d', specialization: 'shield' }
  ice:      { weight: 3, radiusMin: 80,  radiusMax: 120, color: '#aef', glowColor: '#8cf', specialization: 'engine' }
  volcanic: { weight: 2, radiusMin: 90,  radiusMax: 130, color: '#f64', glowColor: '#d42', specialization: 'weapon' }
  ```
- LRU chunk cache (same pattern as `derelicts.js`)
- `_generateChunk(cx, cy)`: seeded RNG, 2.5% chance per chunk to spawn one planet. Each planet gets:
  - `x, y, radius, type, color, glowColor, specialization`
  - `rotation, rotationSpeed` (very slow)
  - `interactRadius: radius + 50` (larger interaction zone than derelicts)
  - `_chunkKey` for cache reference
  - Pre-generated ring data: `rings` array with 1-3 rings for gas/ice types
  - `atmosphereColor` for rendering
  - NO `looted` flag — planets are always visitable
- Exported functions (mirror derelicts API):
  - `getVisiblePlanets(cam, canvasWidth, canvasHeight)`
  - `updatePlanets(dt)` — rotate planets, advance animation timer
  - `drawPlanets(ctx, cam)` — render planets with:
    - Atmosphere glow (radial gradient)
    - Planet body: filled circle with surface detail (craters for rocky, swirls for gas, crystals for ice, lava cracks for volcanic)
    - Optional rings (gas and ice types)
    - Pulsing interaction ring (dashed line like derelicts)
    - "LAND" label above planet
  - `checkPlanetInteraction(player)` — returns `{ enterPlanet: null | { x, y, type, seed, planetRef } }`
  - `getNearbyPlanets(playerX, playerY, radius)` — for cartographer scanning

**Planet drawing functions (one per type):**
- `_drawRockyPlanet(ctx, radius, rng)` — brown/tan circle with crater marks
- `_drawGasPlanet(ctx, radius, rng)` — banded horizontal lines in blues/purples
- `_drawIcePlanet(ctx, radius, rng)` — pale blue/white with crystalline facets
- `_drawVolcanicPlanet(ctx, radius, rng)` — dark red/black with glowing lava crack lines

### 1.2. `src/planet-minigame/index.js`
**Purpose:** Landing mini-game public API, state management — mirrors `derelict-minigame/index.js`.

**Contents:**
- Module state:
  - `_active`, `_result`, `_time`
  - `_ship` — landing ship state object
  - `_terrain` — generated terrain data
  - `_landingPad` — pad position/size
  - `_planetType` — which planet type (affects terrain visuals)
  - `_phase` — `'descending'` | `'landed'` | `'crashed'`
- `initLanding(planetData, playerRef)`:
  - Call `generateLandingTerrain(seed, type)` to create terrain
  - Initialize ship at top of screen, centered horizontally
  - Set initial velocity to slight downward (simulating approach)
- `updateLanding(dt)`:
  - If phase is `'descending'`:
    - Apply gravity (`GRAVITY = 60 px/s²`)
    - Read input: W/Up/moveStick for thrust, A/D for horizontal
    - Apply thrust (upward acceleration `THRUST_POWER = 120 px/s²`)
    - Apply horizontal steering
    - Update ship position, clamp speeds
    - Check collision with terrain:
      - If on landing pad:
        - Vertical speed ≤ `SAFE_LANDING_SPEED` (50 px/s) AND angle within ±15°: `phase = 'landed'`
        - Otherwise: `phase = 'crashed'`, damage 20 HP
      - If not on pad: `phase = 'crashed'`
    - Going off top of screen: abort, return to space, no damage
  - If `'landed'`: show success text for 1.5s, return `{ done: true, success: true }`
  - If `'crashed'`: show crash text for 1.5s, return `{ done: true, success: false, damage: 20 }`
- `drawLanding(ctx, cw, ch)`:
  - Background: gradient sky (dark space → atmosphere color)
  - Parallax: distant terrain silhouette at 0.3x scroll
  - Main terrain foreground
  - Landing pad with blinking lights
  - Ship with thrust flame
  - HUD elements (speed gauge, altitude, angle indicator)
  - Success/crash overlay text

### 1.3. `src/planet-minigame/terrain-generator.js`
**Purpose:** Procedural terrain generation for the landing sequence.

**Contents:**
- `generateLandingTerrain(seed, planetType)`:
  - Uses seeded PRNG (mulberry32)
  - Scene: 800px wide, 600px tall (logical size, scaled to canvas)
  - Terrain heightmap: array of Y values using layered sine waves (2-3 octaves)
  - One flat segment carved for landing pad (60-80px wide), placed in middle 60%
  - Planet type affects terrain style:
    - **Rocky:** jagged peaks, moderate height variation
    - **Gas:** smooth rolling hills (floating platform in gas)
    - **Ice:** sharp crystalline peaks with flat plateaus
    - **Volcanic:** irregular with "pools" (very low flat areas = lava)
  - Returns `{ heights: number[], padLeft, padRight, padY, features: [], bgColor }`
  - `features` array: decorative elements (boulders, crystals, vents)

### 1.4. `src/planet-minigame/landing-ship.js`
**Purpose:** Ship physics and rendering for the landing mini-game.

**Contents:**
- Constants:
  - `GRAVITY = 60` px/s²
  - `THRUST_POWER = 120` px/s² (upward, 2x gravity)
  - `STEER_POWER = 80` px/s² (horizontal)
  - `MAX_VSPEED = 200` px/s
  - `MAX_HSPEED = 120` px/s
  - `SAFE_LANDING_SPEED = 50` px/s
  - `SAFE_LANDING_ANGLE = 0.26` radians (~15°)
  - `SHIP_WIDTH = 20`, `SHIP_HEIGHT = 24`
- `createLandingShip(startX, startY)`: returns ship state
- `updateLandingShip(dt, ship)`: apply physics, read input, return `{ thrusting }`
- `drawLandingShip(ctx, ship, time)`: triangular ship (nose up), thrust flame
- `checkTerrainCollision(ship, terrain)`: sample heights, return `{ collided, onPad, speedSafe, angleSafe }`

### 1.5. `src/planet-minigame/landing-hud.js`
**Purpose:** HUD overlay for the landing mini-game.

**Contents:**
- `drawLandingHUD(ctx, cw, ch, ship, terrain, time)`:
  - Vertical speed indicator (bar, green/yellow/red zones)
  - Altitude indicator (distance to ground)
  - Angle indicator (green when within safe range)
  - "LAND ON PAD" instruction text (fades after 3s)
  - Controls hint: `[W] THRUST  [A/D] STEER`

### 1.6. `src/planet-minigame/market.js`
**Purpose:** Planet market/shop screen UI.

**Contents:**
- `MARKET_UPGRADES` array:
  ```
  hull:    baseCost 20, +10 max health, max 10
  shield:  baseCost 15, +5 max shield, max 10
  engine:  baseCost 25, +15 max speed, max 10
  weapon:  baseCost 20, +3 damage, max 10
  cooling: baseCost 22, -5% fire cooldown, max 10
  ```
- Cost formula: `baseCost * (level + 1)`, with 25% discount for planet specialization
- Specialization mapping: rocky→hull, gas→shield, ice→engine, volcanic→weapon
- `initMarket(planetType)`: set planet type, reset selection
- `updateMarket(dt)`:
  - Arrow keys up/down to navigate, Enter to buy, Escape to launch
  - Touch taps on rows and launch button
  - Return `{ done: boolean }`
- `drawMarket(ctx, cw, ch, player, planetType)`:
  - Dark overlay, title in planet-type color
  - Coin balance display (gold icon + count)
  - Upgrade rows (name, desc, level pips, cost in coins)
  - Specialized upgrades highlighted (star icon, green border)
  - LAUNCH button
- `applyMarketUpgrade(upgradeId, player)`: increment `player.marketUpgrades[id]`, deduct coins

---

## 2. Existing Files to Modify

### 2.1. `src/player.js`
- Add to `player` singleton:
  ```javascript
  coins: 0,              // persists across runs
  marketUpgrades: {       // persists across runs
      hull: 0, shield: 0, engine: 0, weapon: 0, cooling: 0,
  },
  ```
- In `initPlayer()`: Do NOT reset `coins` or `marketUpgrades` (persist like `permanentUpgrades`)
- In `applyPermanentUpgrades()`: Add market upgrade application:
  ```javascript
  const m = player.marketUpgrades;
  player.maxHealth += m.hull * 10;
  player.maxShield += m.shield * 5;
  player.speed += m.engine * 15;
  player.damage += m.weapon * 3;
  player.fireRate = Math.max(0.05, player.fireRate - m.cooling * 0.0125);
  ```

### 2.2. `src/game.js`
- Add imports: `planets.js`, `planet-minigame/index.js`, `planet-minigame/market.js`
- Update state comment: add `'planet-landing'` | `'planet-market'`
- Add `_activePlanet = null;` module state
- In `updatePlaying(dt)`:
  - After `updateDerelicts(dt)`: add `updatePlanets(dt);`
  - After derelict cartographer scan: add planet scanning via `scanPlanets(nearbyPlanets)`
  - After derelict interaction check: add planet interaction check
  - In render section, after `drawDerelicts`: add `drawPlanets(_ctx, camera);`
- Add state handler `updatePlanetLanding(dt)`:
  - Calls `updateLanding(dt)` and `drawLanding()`
  - On success → `initMarket()`, `state = 'planet-market'`
  - On crash → damage player, `state = 'playing'`
- Add state handler `updatePlanetMarket()`:
  - Calls `drawMarket()` and `updateMarket()`
  - On done → `state = 'playing'`
- In `gameLoop` switch: add cases for both new states
- In touch event listeners: `planet-landing` uses joystick (exclude from tap); `planet-market` needs taps

### 2.3. `src/hud.js`
- After Total XP indicator: add coin count display with gold coin icon
- In `drawMinimap()`: add planet discovery rendering (larger circles, planet-type colors)

### 2.4. `src/crew.js`
- Add to `crew.cartographer`: `discoveredPlanets: []`
- In `initCrew()`: reset `c.discoveredPlanets = []`
- Add exported `scanPlanets(nearbyPlanets)` function (same pattern as `scanDerelicts`)
- Add exported `getCartographerPlanetDiscoveries()` function

### 2.5. `src/derelict-minigame/rewards.js`
- Add `coinPickup` to `PICKUP_DEFS`:
  ```javascript
  coinPickup: { radius: 7, color: '#fd0', glowColor: '#da0', coinValue: 1 }
  ```
- Handle coin collection in `updatePickups()`: add to `scatteredLoot.coins`
- Draw coin pickups (gold hexagon/circle)
- Add `coins` field to `LOCKER_TIERS`:
  - empty: 0, small: 5, medium: 15, large: 30, legendary: 60

### 2.6. `src/derelict-minigame/level-generator.js`
- In step 6 (pickup placement), add coin pickups:
  - 40% chance per room
  - smallWreck: 1-2 per room, cargoShip: 1-3, militaryWreck: 2-4

### 2.7. `src/derelict-minigame/index.js`
- Add `coins: 0` to `_scatteredLoot` initialization
- Include `coins` in `_finishMinigame()` result
- Add coin reward to locker reward handling

### 2.8. `src/derelict-minigame/derelict-hud.js`
- Show coins collected alongside XP in the HUD

---

## 3. Coin Economy

### Sources (in derelict mini-game):

**Scattered coin pickups per room:**
- smallWreck: 1-2 coins/room × 3-4 rooms = **5-8 coins/wreck**
- cargoShip: 1-3 coins/room × 5-7 rooms = **10-21 coins/ship**
- militaryWreck: 2-4 coins/room × 7-10 rooms = **20-40 coins/wreck**

**Locker bonus coins:**
- empty: 0, small: 5, medium: 15, large: 30, legendary: 60

**Total expected per derelict:**
- smallWreck: ~5-13 (avg ~8)
- cargoShip: ~15-36 (avg ~25)
- militaryWreck: ~30-80 (avg ~50)

### Costs (market upgrades):

Formula: `baseCost * (level + 1)`, 25% off for planet specialization.

| Upgrade | Base | Level 1 | Level 5 | Level 10 | Specialized L1 |
|---------|------|---------|---------|----------|-----------------|
| Hull | 20 | 20 | 100 | 200 | 15 |
| Shield | 15 | 15 | 75 | 150 | 11 |
| Engine | 25 | 25 | 125 | 250 | 19 |
| Weapon | 20 | 20 | 100 | 200 | 15 |
| Cooling | 22 | 22 | 110 | 220 | 17 |

**Total to max one upgrade:** baseCost × 55 (e.g., Hull = 1,100 coins, ~44 derelict visits)
**Total to max all 5:** ~5,500 coins

---

## 4. Planet Type Differences

| Aspect | Rocky | Gas | Ice | Volcanic |
|--------|-------|-----|-----|----------|
| **Radius** | 80-110 | 100-150 | 80-120 | 90-130 |
| **Color** | #c96 | #6af | #aef | #f64 |
| **Rings** | None | 1-2 wide | 0-1 thin | None |
| **Surface** | Craters, rocky lines | Horizontal bands, swirls | Crystal facets, white highlights | Dark base, orange crack lines |
| **Atmosphere** | Thin tan haze | Thick blue glow | Faint white shimmer | Thick red/orange haze |
| **Landing Terrain** | Jagged peaks, brown | Smooth floating platforms | Sharp crystal peaks, flat ice | Irregular + lava pools |
| **Landing Difficulty** | Medium | Easy | Hard | Medium-Hard |
| **Market Specialty** | Hull (25% off) | Shield (25% off) | Engine (25% off) | Weapon (25% off) |

---

## 5. Implementation Phases

### Phase 1: Coins Currency Foundation
**Files:** player.js, derelict-minigame/rewards.js, derelict-minigame/level-generator.js, derelict-minigame/index.js, derelict-minigame/derelict-hud.js, game.js, hud.js

1. Add `coins` and `marketUpgrades` to player singleton
2. Add coinPickup to rewards.js PICKUP_DEFS
3. Add coin pickups to level-generator.js room generation
4. Add coins to locker reward tiers
5. Track coins in _scatteredLoot in index.js
6. Show coins in derelict HUD
7. Handle coin rewards in game.js updateDerelictState
8. Show coin count on main HUD

### Phase 2: Planet World Objects
**Files:** planets.js (new), game.js, crew.js, hud.js

1. Create `planets.js` with chunk generation, LRU cache, rendering
2. Implement all 4 planet type drawing functions
3. Add planet interaction checking
4. Integrate into game.js updatePlaying (update, draw, interaction check)
5. Add planet scanning to cartographer in crew.js
6. Add planets to minimap in hud.js

### Phase 3: Landing Mini-Game
**Files:** planet-minigame/terrain-generator.js (new), planet-minigame/landing-ship.js (new), planet-minigame/landing-hud.js (new), planet-minigame/index.js (new), game.js

1. Create terrain generator with heightmap and per-type visuals
2. Create landing ship physics and rendering
3. Create landing HUD (speed, altitude, angle indicators)
4. Create landing mini-game index.js (state machine, init/update/draw)
5. Add 'planet-landing' state to game.js
6. Wire success (→ market) and failure (→ space + damage)

### Phase 4: Market Screen
**Files:** planet-minigame/market.js (new), game.js, player.js

1. Create market UI with upgrade rows, coin display, specialization pricing
2. Implement purchase logic (deduct coins, increment marketUpgrades)
3. Add 'planet-market' state to game.js
4. Apply market upgrades in player.js applyPermanentUpgrades
5. Wire LAUNCH button to return to playing state

### Phase 5: Polish
1. Touch input for landing (joystick) and market (taps)
2. Balance tuning (coin drops, upgrade costs, landing difficulty)
3. Ensure planets don't overlap derelicts/asteroids (different seed offsets + chunk sizes)
4. Test cartographer planet discovery at various reveal radii

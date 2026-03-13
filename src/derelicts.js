// ---------------------------------------------------------------------------
// derelicts.js  --  chunk-based derelict spaceship wrecks with loot
// ---------------------------------------------------------------------------

import { WORLD_SIZE, distance } from './utils.js';
import { camera } from './camera.js';

// ---- seeded PRNG (mulberry32) ---------------------------------------------

function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashCoord(cx, cy) {
    let h = (cx * 374761393 + cy * 668265263 + 131071) | 0;
    h = Math.imul(h ^ (h >>> 13), 5);
    h = (h ^ (h >>> 17)) | 0;
    return h >>> 0;
}

// ---- constants ------------------------------------------------------------

const CHUNK_SIZE = 2000;
const MAX_CACHED_CHUNKS = 80;

const DERELICT_TYPES = [
    {
        name: 'smallWreck',
        weight: 5,
        radiusMin: 20,
        radiusMax: 30,
        color: 'rgba(200,200,210,0.8)',
        glowColor: 'rgba(220,220,230,0.5)',
        dimColor: 'rgba(80,80,85,0.4)',
        dimGlowColor: 'rgba(60,60,65,0.2)',
        xpMin: 0,
        xpMax: 0,
        powerups: 1,
        weaponUpgradeChance: 0,
    },
    {
        name: 'cargoShip',
        weight: 3,
        radiusMin: 35,
        radiusMax: 50,
        color: 'rgba(80,160,255,0.8)',
        glowColor: 'rgba(60,140,255,0.5)',
        dimColor: 'rgba(30,60,100,0.4)',
        dimGlowColor: 'rgba(20,40,80,0.2)',
        xpMin: 20,
        xpMax: 50,
        powerups: 1,
        weaponUpgradeChance: 0,
    },
    {
        name: 'militaryWreck',
        weight: 1,
        radiusMin: 45,
        radiusMax: 60,
        color: 'rgba(255,60,60,0.8)',
        glowColor: 'rgba(255,40,40,0.5)',
        dimColor: 'rgba(100,25,25,0.4)',
        dimGlowColor: 'rgba(80,20,20,0.2)',
        xpMin: 50,
        xpMax: 100,
        powerups: 2,
        weaponUpgradeChance: 0.4,
    },
];

const TOTAL_WEIGHT = DERELICT_TYPES.reduce((s, t) => s + t.weight, 0);

const WEAPON_UPGRADES = ['spreadShot', 'rapidFire', 'piercingRound', 'homingMissile'];

// ---- internal animation state ---------------------------------------------

let _time = 0; // accumulated time for pulsing effects

// ---- chunk cache (LRU) ----------------------------------------------------

/** @type {Map<string, object[]>} key -> derelict array */
const _chunkCache = new Map();

function _cacheKey(cx, cy) {
    return cx + ',' + cy;
}

function _getChunk(cx, cy) {
    const key = _cacheKey(cx, cy);
    if (_chunkCache.has(key)) {
        const val = _chunkCache.get(key);
        _chunkCache.delete(key);
        _chunkCache.set(key, val);
        return val;
    }
    const derelicts = _generateChunk(cx, cy);
    _chunkCache.set(key, derelicts);
    if (_chunkCache.size > MAX_CACHED_CHUNKS) {
        const oldest = _chunkCache.keys().next().value;
        _chunkCache.delete(oldest);
    }
    return derelicts;
}

// ---- chunk generation -----------------------------------------------------

function _generateChunk(cx, cy) {
    // Offset coordinates so seeds don't collide with asteroid chunks
    const seed = hashCoord(cx + 9999, cy + 7777);
    const rng = mulberry32(seed);

    // 10% chance per chunk to contain a derelict
    const count = rng() < 0.1 ? 1 : 0;

    const derelicts = [];

    for (let i = 0; i < count; i++) {
        // weighted type selection
        let typeRoll = rng() * TOTAL_WEIGHT;
        let type = DERELICT_TYPES[0];
        for (let t = 0; t < DERELICT_TYPES.length; t++) {
            typeRoll -= DERELICT_TYPES[t].weight;
            if (typeRoll <= 0) {
                type = DERELICT_TYPES[t];
                break;
            }
        }

        const radius = type.radiusMin + rng() * (type.radiusMax - type.radiusMin);
        const x = cx * CHUNK_SIZE + radius + rng() * (CHUNK_SIZE - radius * 2);
        const y = cy * CHUNK_SIZE + radius + rng() * (CHUNK_SIZE - radius * 2);

        // skip if outside world bounds
        if (x < radius || x > WORLD_SIZE - radius ||
            y < radius || y > WORLD_SIZE - radius) {
            continue;
        }

        const rotation = rng() * Math.PI * 2;
        const rotationSpeed = (rng() - 0.5) * 0.06; // very slow spin

        // pre-determine loot using the seeded RNG so it's deterministic
        const xp = type.xpMin > 0
            ? Math.floor(type.xpMin + rng() * (type.xpMax - type.xpMin + 1))
            : 0;
        const weaponUpgrade = rng() < type.weaponUpgradeChance
            ? WEAPON_UPGRADES[Math.floor(rng() * WEAPON_UPGRADES.length)]
            : null;
        // consume an rng call even if no upgrade, to keep sequence stable
        if (rng() < type.weaponUpgradeChance) { /* consumed above */ }

        // spark positions (pre-generated for visual sparks)
        const sparkCount = 2 + Math.floor(rng() * 3);
        const sparks = [];
        for (let s = 0; s < sparkCount; s++) {
            sparks.push({
                angle: rng() * Math.PI * 2,
                dist: radius * (0.5 + rng() * 0.5),
                phase: rng() * Math.PI * 2,
                speed: 1.5 + rng() * 2.5,
            });
        }

        derelicts.push({
            x,
            y,
            radius,
            type: type.name,
            color: type.color,
            glowColor: type.glowColor,
            dimColor: type.dimColor,
            dimGlowColor: type.dimGlowColor,
            looted: false,
            rotation,
            rotationSpeed,
            interactRadius: radius + 30,
            xp,
            powerups: type.powerups,
            weaponUpgrade,
            sparks,
            _chunkKey: _cacheKey(cx, cy),
        });
    }

    return derelicts;
}

// ---- ship silhouette drawing functions ------------------------------------

function _drawSmallWreck(ctx, radius) {
    // Small triangular fighter hull, broken
    ctx.beginPath();
    ctx.moveTo(radius * 0.9, 0);
    ctx.lineTo(-radius * 0.6, -radius * 0.55);
    ctx.lineTo(-radius * 0.3, -radius * 0.15);
    ctx.lineTo(-radius * 0.8, 0);
    ctx.lineTo(-radius * 0.3, radius * 0.15);
    ctx.lineTo(-radius * 0.6, radius * 0.55);
    ctx.closePath();
}

function _drawCargoShip(ctx, radius) {
    // Boxy cargo freighter with container sections
    const w = radius * 0.9;
    const h = radius * 0.5;
    ctx.beginPath();
    // main hull
    ctx.moveTo(w, -h * 0.3);
    ctx.lineTo(w * 0.6, -h);
    ctx.lineTo(-w * 0.5, -h);
    ctx.lineTo(-w, -h * 0.7);
    ctx.lineTo(-w, h * 0.7);
    ctx.lineTo(-w * 0.5, h);
    ctx.lineTo(w * 0.6, h);
    ctx.lineTo(w, h * 0.3);
    ctx.closePath();

    // cargo bay line (decorative)
    ctx.moveTo(-w * 0.1, -h);
    ctx.lineTo(-w * 0.1, h);
    ctx.moveTo(w * 0.3, -h);
    ctx.lineTo(w * 0.3, h);
}

function _drawMilitaryWreck(ctx, radius) {
    // Angular warship with weapon mounts
    const w = radius * 0.95;
    const h = radius * 0.6;
    ctx.beginPath();
    // aggressive pointed bow
    ctx.moveTo(w, 0);
    ctx.lineTo(w * 0.5, -h * 0.4);
    ctx.lineTo(w * 0.2, -h * 0.35);
    ctx.lineTo(w * 0.1, -h * 0.8);   // upper weapon mount
    ctx.lineTo(-w * 0.1, -h * 0.7);
    ctx.lineTo(-w * 0.15, -h * 0.45);
    ctx.lineTo(-w * 0.7, -h * 0.55);
    ctx.lineTo(-w, -h * 0.25);
    ctx.lineTo(-w * 0.85, 0);
    ctx.lineTo(-w, h * 0.25);
    ctx.lineTo(-w * 0.7, h * 0.55);
    ctx.lineTo(-w * 0.15, h * 0.45);
    ctx.lineTo(-w * 0.1, h * 0.7);
    ctx.lineTo(w * 0.1, h * 0.8);    // lower weapon mount
    ctx.lineTo(w * 0.2, h * 0.35);
    ctx.lineTo(w * 0.5, h * 0.4);
    ctx.closePath();
}

const _shipDrawers = {
    smallWreck: _drawSmallWreck,
    cargoShip: _drawCargoShip,
    militaryWreck: _drawMilitaryWreck,
};

// ---- public API -----------------------------------------------------------

/**
 * Return all derelicts in chunks overlapping the visible area.
 * @param {{ x: number, y: number }} cam
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @returns {object[]}
 */
export function getVisibleDerelicts(cam, canvasWidth, canvasHeight) {
    const margin = 200;
    const left = cam.x - margin;
    const top = cam.y - margin;
    const right = cam.x + canvasWidth + margin;
    const bottom = cam.y + canvasHeight + margin;

    const startCX = Math.max(0, Math.floor(left / CHUNK_SIZE));
    const startCY = Math.max(0, Math.floor(top / CHUNK_SIZE));
    const endCX = Math.min(
        Math.floor(WORLD_SIZE / CHUNK_SIZE),
        Math.floor(right / CHUNK_SIZE)
    );
    const endCY = Math.min(
        Math.floor(WORLD_SIZE / CHUNK_SIZE),
        Math.floor(bottom / CHUNK_SIZE)
    );

    const result = [];
    for (let cy = startCY; cy <= endCY; cy++) {
        for (let cx = startCX; cx <= endCX; cx++) {
            const chunk = _getChunk(cx, cy);
            for (let i = 0; i < chunk.length; i++) {
                const d = chunk[i];
                if (
                    d.x + d.interactRadius >= left &&
                    d.x - d.interactRadius <= right &&
                    d.y + d.interactRadius >= top &&
                    d.y - d.interactRadius <= bottom
                ) {
                    result.push(d);
                }
            }
        }
    }
    return result;
}

/**
 * Update derelict rotations and internal animation timer.
 * @param {number} dt  seconds since last frame
 */
export function updateDerelicts(dt) {
    _time += dt;
    for (const chunk of _chunkCache.values()) {
        for (let i = 0; i < chunk.length; i++) {
            chunk[i].rotation += chunk[i].rotationSpeed * dt;
        }
    }
}

/**
 * Draw all visible derelicts.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} cam
 */
export function drawDerelicts(ctx, cam) {
    const derelicts = getVisibleDerelicts(cam, ctx.canvas.width, ctx.canvas.height);

    for (let i = 0; i < derelicts.length; i++) {
        const d = derelicts[i];
        const sx = d.x - cam.x;
        const sy = d.y - cam.y;

        ctx.save();
        ctx.translate(sx, sy);

        // --- Pulsing interaction ring (unlooted only) ---
        if (!d.looted) {
            const pulse = 0.4 + 0.3 * Math.sin(_time * 2.5);
            ctx.beginPath();
            ctx.arc(0, 0, d.interactRadius, 0, Math.PI * 2);
            ctx.strokeStyle = d.glowColor.replace(/[\d.]+\)$/, pulse.toFixed(2) + ')');
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 6]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // --- Ship body ---
        ctx.rotate(d.rotation);

        const drawShip = _shipDrawers[d.type];
        if (drawShip) {
            // Neon glow
            const glowCol = d.looted ? d.dimGlowColor : d.glowColor;
            const strokeCol = d.looted ? d.dimColor : d.color;

            ctx.shadowColor = glowCol;
            ctx.shadowBlur = d.looted ? 4 : 12;

            // Fragmented / dashed outline
            ctx.setLineDash(d.looted ? [4, 8] : [6, 3]);

            drawShip(ctx, d.radius);

            // Semi-transparent dark fill
            ctx.fillStyle = d.looted
                ? 'rgba(20,20,25,0.3)'
                : 'rgba(15,15,20,0.5)';
            ctx.fill();

            ctx.strokeStyle = strokeCol;
            ctx.lineWidth = d.looted ? 1 : 2;
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }

        // --- Sparking particles (unlooted only) ---
        if (!d.looted) {
            for (let s = 0; s < d.sparks.length; s++) {
                const sp = d.sparks[s];
                const flicker = Math.sin(_time * sp.speed + sp.phase);
                if (flicker > 0.3) {
                    const sparkX = Math.cos(sp.angle) * sp.dist;
                    const sparkY = Math.sin(sp.angle) * sp.dist;
                    const sparkAlpha = (flicker - 0.3) * 1.4;
                    const sparkSize = 1.5 + flicker * 1.5;

                    ctx.beginPath();
                    ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,220,100,${sparkAlpha.toFixed(2)})`;
                    ctx.fill();

                    // tiny spark glow
                    ctx.beginPath();
                    ctx.arc(sparkX, sparkY, sparkSize * 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(255,180,50,${(sparkAlpha * 0.3).toFixed(2)})`;
                    ctx.fill();
                }
            }
        }

        ctx.restore();

        // --- "SALVAGE" label (unlooted, drawn in screen-space) ---
        if (!d.looted) {
            const labelPulse = 0.6 + 0.4 * Math.sin(_time * 2);
            ctx.save();
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `rgba(200,255,200,${labelPulse.toFixed(2)})`;
            ctx.shadowColor = 'rgba(100,255,100,0.4)';
            ctx.shadowBlur = 6;
            ctx.fillText('SALVAGE', sx, sy - d.radius - 16);

            // small loot icon (box outline)
            const iconY = sy + d.radius + 14;
            const iconSize = 6;
            ctx.strokeStyle = `rgba(200,255,200,${labelPulse.toFixed(2)})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(sx - iconSize, iconY - iconSize, iconSize * 2, iconSize * 2);
            // lid line
            ctx.beginPath();
            ctx.moveTo(sx - iconSize - 2, iconY - iconSize);
            ctx.lineTo(sx + iconSize + 2, iconY - iconSize);
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.restore();
        }
    }
}

/**
 * Check if the player is within interaction range of any unlooted derelict.
 * If so, loot it and return the rewards. The caller spawns power-ups and
 * awards XP based on the returned data.
 *
 * @param {{ x: number, y: number }} player
 * @returns {{ looted: boolean, xp: number, powerupPositions: {x:number,y:number}[], weaponUpgrade: string|null }}
 */
export function checkDerelictInteraction(player) {
    const result = { enterDerelict: null };

    // Check chunks around the player
    const pcx = Math.floor(player.x / CHUNK_SIZE);
    const pcy = Math.floor(player.y / CHUNK_SIZE);

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const cx = pcx + dx;
            const cy = pcy + dy;
            if (cx < 0 || cy < 0) continue;

            const key = _cacheKey(cx, cy);
            if (!_chunkCache.has(key)) continue;

            const chunk = _chunkCache.get(key);
            for (let i = 0; i < chunk.length; i++) {
                const d = chunk[i];
                if (d.looted) continue;

                const dist = distance(player, d);
                if (dist <= d.interactRadius) {
                    result.enterDerelict = {
                        x: d.x,
                        y: d.y,
                        type: d.type,
                        seed: hashCoord(Math.floor(d.x), Math.floor(d.y)),
                        derelictRef: d,
                    };
                    return result;
                }
            }
        }
    }

    return result;
}

export function markDerelictLooted(derelictRef) {
    derelictRef.looted = true;
}

export { hashCoord };

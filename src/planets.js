// ---------------------------------------------------------------------------
// planets.js  --  chunk-based procedural planet generation, rendering, interaction
// ---------------------------------------------------------------------------

import { WORLD_SIZE, distance } from './utils.js';

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

const CHUNK_SIZE = 5000;
const MAX_CACHED_CHUNKS = 40;
const SPAWN_CHANCE = 0.8; // TODO: revert to 0.025 after testing

const PLANET_TYPES = [
    { name: 'rocky',    weight: 4, radiusMin: 240, radiusMax: 330, color: '#c96', glowColor: '#a74', specialization: 'hull' },
    { name: 'gas',      weight: 3, radiusMin: 300, radiusMax: 450, color: '#6af', glowColor: '#48d', specialization: 'shield' },
    { name: 'ice',      weight: 3, radiusMin: 240, radiusMax: 360, color: '#aef', glowColor: '#8cf', specialization: 'engine' },
    { name: 'volcanic', weight: 2, radiusMin: 270, radiusMax: 390, color: '#f64', glowColor: '#d42', specialization: 'weapon' },
];

const TOTAL_WEIGHT = PLANET_TYPES.reduce((s, t) => s + t.weight, 0);

/** Convert any hex color (#rgb or #rrggbb) to an rgba() string. */
function hexToRgba(hex, alpha) {
    let r, g, b;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    return `rgba(${r},${g},${b},${alpha})`;
}

// ---- internal animation state ---------------------------------------------

let _time = 0;

// ---- chunk cache (LRU) ----------------------------------------------------

/** @type {Map<string, object[]>} */
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
    const planets = _generateChunk(cx, cy);
    _chunkCache.set(key, planets);
    if (_chunkCache.size > MAX_CACHED_CHUNKS) {
        const oldest = _chunkCache.keys().next().value;
        _chunkCache.delete(oldest);
    }
    return planets;
}

// ---- chunk generation -----------------------------------------------------

function _generateChunk(cx, cy) {
    // Different seed offset than derelicts to avoid collisions
    const seed = hashCoord(cx + 55555, cy + 33333);
    const rng = mulberry32(seed);

    const count = 5; // TODO: revert to `rng() < SPAWN_CHANCE ? 1 : 0` after testing
    const planets = [];

    for (let i = 0; i < count; i++) {
        // weighted type selection
        let typeRoll = rng() * TOTAL_WEIGHT;
        let type = PLANET_TYPES[0];
        for (let t = 0; t < PLANET_TYPES.length; t++) {
            typeRoll -= PLANET_TYPES[t].weight;
            if (typeRoll <= 0) {
                type = PLANET_TYPES[t];
                break;
            }
        }

        const radius = type.radiusMin + rng() * (type.radiusMax - type.radiusMin);
        const x = cx * CHUNK_SIZE + radius + rng() * (CHUNK_SIZE - radius * 2);
        const y = cy * CHUNK_SIZE + radius + rng() * (CHUNK_SIZE - radius * 2);

        if (x < radius || x > WORLD_SIZE - radius ||
            y < radius || y > WORLD_SIZE - radius) {
            continue;
        }

        const rotation = rng() * Math.PI * 2;
        const rotationSpeed = (rng() - 0.5) * 0.02;

        // Pre-generate ring data for gas and ice types
        const rings = [];
        if (type.name === 'gas' || type.name === 'ice') {
            const ringCount = type.name === 'gas' ? 1 + Math.floor(rng() * 2) : (rng() < 0.5 ? 1 : 0);
            for (let r = 0; r < ringCount; r++) {
                rings.push({
                    innerRadius: radius * (1.3 + rng() * 0.2),
                    outerRadius: radius * (1.5 + rng() * 0.3),
                    tilt: 0.15 + rng() * 0.25,
                    alpha: 0.3 + rng() * 0.3,
                });
            }
        }

        // Pre-generate surface details using the seeded RNG
        const detailSeed = Math.floor(rng() * 0xFFFFFF);

        planets.push({
            x,
            y,
            radius,
            type: type.name,
            color: type.color,
            glowColor: type.glowColor,
            specialization: type.specialization,
            rotation,
            rotationSpeed,
            interactRadius: radius + 50,
            rings,
            detailSeed,
            _chunkKey: _cacheKey(cx, cy),
        });
    }

    return planets;
}

// ---- planet type drawing functions ----------------------------------------

function _drawRockyPlanet(ctx, radius, rng) {
    // Brown/tan base
    const grad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, radius * 0.1, 0, 0, radius);
    grad.addColorStop(0, '#da7');
    grad.addColorStop(0.6, '#c96');
    grad.addColorStop(1, '#864');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Craters
    const craterCount = 4 + Math.floor(rng() * 5);
    for (let i = 0; i < craterCount; i++) {
        const a = rng() * Math.PI * 2;
        const d = rng() * radius * 0.7;
        const cr = 3 + rng() * (radius * 0.15);
        const cx = Math.cos(a) * d;
        const cy = Math.sin(a) * d;
        ctx.fillStyle = 'rgba(100,70,40,0.4)';
        ctx.beginPath();
        ctx.arc(cx, cy, cr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(150,110,70,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

function _drawGasPlanet(ctx, radius, rng) {
    // Blue/purple banded gradient
    const grad = ctx.createLinearGradient(0, -radius, 0, radius);
    grad.addColorStop(0, '#48d');
    grad.addColorStop(0.3, '#6af');
    grad.addColorStop(0.5, '#59c');
    grad.addColorStop(0.7, '#6af');
    grad.addColorStop(1, '#48d');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal bands
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    const bandCount = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < bandCount; i++) {
        const by = -radius + rng() * radius * 2;
        const bh = 2 + rng() * 6;
        ctx.fillStyle = `rgba(${rng() < 0.5 ? '100,140,220' : '80,120,200'},${(0.1 + rng() * 0.2).toFixed(2)})`;
        ctx.fillRect(-radius, by, radius * 2, bh);
    }
    ctx.restore();
}

function _drawIcePlanet(ctx, radius, rng) {
    // Pale blue/white gradient
    const grad = ctx.createRadialGradient(-radius * 0.15, -radius * 0.15, radius * 0.1, 0, 0, radius);
    grad.addColorStop(0, '#def');
    grad.addColorStop(0.5, '#aef');
    grad.addColorStop(1, '#8cf');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Crystal facets / bright highlights
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    const facetCount = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < facetCount; i++) {
        const a = rng() * Math.PI * 2;
        const d = rng() * radius * 0.7;
        const fx = Math.cos(a) * d;
        const fy = Math.sin(a) * d;
        const fSize = 4 + rng() * (radius * 0.15);
        ctx.fillStyle = `rgba(255,255,255,${(0.15 + rng() * 0.2).toFixed(2)})`;
        // Draw as small polygon (crystal facet)
        ctx.beginPath();
        const sides = 3 + Math.floor(rng() * 3);
        for (let s = 0; s < sides; s++) {
            const sa = (s / sides) * Math.PI * 2 + rng() * 0.5;
            const sx = fx + Math.cos(sa) * fSize;
            const sy = fy + Math.sin(sa) * fSize;
            if (s === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
    }
    ctx.restore();
}

function _drawVolcanicPlanet(ctx, radius, rng) {
    // Dark red/black base
    const grad = ctx.createRadialGradient(-radius * 0.2, -radius * 0.2, radius * 0.1, 0, 0, radius);
    grad.addColorStop(0, '#a32');
    grad.addColorStop(0.5, '#831');
    grad.addColorStop(1, '#421');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Lava crack lines
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    const crackCount = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < crackCount; i++) {
        ctx.beginPath();
        let cx = (rng() - 0.5) * radius * 1.2;
        let cy = (rng() - 0.5) * radius * 1.2;
        ctx.moveTo(cx, cy);
        const segs = 3 + Math.floor(rng() * 4);
        for (let s = 0; s < segs; s++) {
            cx += (rng() - 0.5) * radius * 0.4;
            cy += (rng() - 0.5) * radius * 0.4;
            ctx.lineTo(cx, cy);
        }
        ctx.strokeStyle = `rgba(255,${Math.floor(100 + rng() * 80)},0,${(0.4 + rng() * 0.3).toFixed(2)})`;
        ctx.lineWidth = 1 + rng() * 2;
        ctx.shadowColor = '#f80';
        ctx.shadowBlur = 4;
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
}

const _planetDrawers = {
    rocky: _drawRockyPlanet,
    gas: _drawGasPlanet,
    ice: _drawIcePlanet,
    volcanic: _drawVolcanicPlanet,
};

// ---- public API -----------------------------------------------------------

export function getVisiblePlanets(cam, canvasWidth, canvasHeight) {
    const margin = 300;
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
                const p = chunk[i];
                if (
                    p.x + p.interactRadius >= left &&
                    p.x - p.interactRadius <= right &&
                    p.y + p.interactRadius >= top &&
                    p.y - p.interactRadius <= bottom
                ) {
                    result.push(p);
                }
            }
        }
    }
    return result;
}

export function updatePlanets(dt) {
    _time += dt;
    for (const chunk of _chunkCache.values()) {
        for (let i = 0; i < chunk.length; i++) {
            chunk[i].rotation += chunk[i].rotationSpeed * dt;
        }
    }
}

export function drawPlanets(ctx, cam) {
    const planets = getVisiblePlanets(cam, ctx.canvas.width, ctx.canvas.height);

    for (let i = 0; i < planets.length; i++) {
        const p = planets[i];
        const sx = p.x - cam.x;
        const sy = p.y - cam.y;

        ctx.save();
        ctx.translate(sx, sy);

        // --- Atmosphere glow ---
        const atmosGrad = ctx.createRadialGradient(0, 0, p.radius * 0.8, 0, 0, p.radius * 1.4);
        atmosGrad.addColorStop(0, 'transparent');
        atmosGrad.addColorStop(0.5, hexToRgba(p.glowColor, 0.19));
        atmosGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = atmosGrad;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.4, 0, Math.PI * 2);
        ctx.fill();

        // --- Planet body ---
        ctx.save();
        ctx.rotate(p.rotation);
        const drawPlanet = _planetDrawers[p.type];
        if (drawPlanet) {
            const rng = mulberry32(p.detailSeed);
            drawPlanet(ctx, p.radius, rng);
        }
        ctx.restore();

        // --- Rings (gas/ice) ---
        for (let r = 0; r < p.rings.length; r++) {
            const ring = p.rings[r];
            ctx.save();
            ctx.scale(1, ring.tilt);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = ring.alpha;
            ctx.lineWidth = (ring.outerRadius - ring.innerRadius) * 0.5;
            ctx.beginPath();
            const avgRad = (ring.innerRadius + ring.outerRadius) / 2;
            ctx.arc(0, 0, avgRad, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.restore();
        }

        // --- Pulsing interaction ring ---
        const pulse = 0.3 + 0.25 * Math.sin(_time * 2);
        ctx.beginPath();
        ctx.arc(0, 0, p.interactRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200,255,200,${pulse.toFixed(2)})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([10, 8]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();

        // --- "LAND" label ---
        const labelPulse = 0.5 + 0.4 * Math.sin(_time * 2);
        ctx.save();
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = `rgba(200,255,200,${labelPulse.toFixed(2)})`;
        ctx.shadowColor = 'rgba(100,255,100,0.4)';
        ctx.shadowBlur = 6;
        ctx.fillText('LAND', sx, sy - p.radius - 20);
        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

export function checkPlanetInteraction(playerObj) {
    const result = { enterPlanet: null };

    const pcx = Math.floor(playerObj.x / CHUNK_SIZE);
    const pcy = Math.floor(playerObj.y / CHUNK_SIZE);

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            const cx = pcx + dx;
            const cy = pcy + dy;
            if (cx < 0 || cy < 0) continue;

            const key = _cacheKey(cx, cy);
            if (!_chunkCache.has(key)) continue;

            const chunk = _chunkCache.get(key);
            for (let i = 0; i < chunk.length; i++) {
                const p = chunk[i];
                const dist = distance(playerObj, p);
                if (dist <= p.interactRadius) {
                    result.enterPlanet = {
                        x: p.x,
                        y: p.y,
                        type: p.type,
                        seed: hashCoord(Math.floor(p.x), Math.floor(p.y)),
                        planetRef: p,
                    };
                    return result;
                }
            }
        }
    }

    return result;
}

export function getNearbyPlanets(playerX, playerY, radius) {
    const result = [];
    const startCX = Math.max(0, Math.floor((playerX - radius) / CHUNK_SIZE));
    const startCY = Math.max(0, Math.floor((playerY - radius) / CHUNK_SIZE));
    const endCX = Math.min(
        Math.floor(WORLD_SIZE / CHUNK_SIZE),
        Math.floor((playerX + radius) / CHUNK_SIZE)
    );
    const endCY = Math.min(
        Math.floor(WORLD_SIZE / CHUNK_SIZE),
        Math.floor((playerY + radius) / CHUNK_SIZE)
    );

    for (let cy = startCY; cy <= endCY; cy++) {
        for (let cx = startCX; cx <= endCX; cx++) {
            const chunk = _getChunk(cx, cy);
            for (let i = 0; i < chunk.length; i++) {
                const p = chunk[i];
                const dx = p.x - playerX;
                const dy = p.y - playerY;
                if (Math.sqrt(dx * dx + dy * dy) <= radius) {
                    result.push(p);
                }
            }
        }
    }
    return result;
}

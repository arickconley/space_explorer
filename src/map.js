// ---------------------------------------------------------------------------
// map.js  --  chunk-based asteroid field with seeded generation
// ---------------------------------------------------------------------------

import { WORLD_SIZE } from './utils.js';

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

const CHUNK_SIZE = 1000;
const MAX_CACHED_CHUNKS = 100;

// asteroid type definitions
const ASTEROID_TYPES = [
    {
        name: 'small',
        weight: 5,
        radiusMin: 15,
        radiusMax: 25,
        hp: 20,
        destructible: true,
        colors: ['#8B7355', '#7A6B52', '#6B5B45', '#9E8E78'],
        vertexMin: 7,
        vertexMax: 10,
    },
    {
        name: 'medium',
        weight: 3,
        radiusMin: 30,
        radiusMax: 50,
        hp: 60,
        destructible: true,
        colors: ['#6E6E6E', '#808080', '#737373', '#5C5C5C'],
        vertexMin: 8,
        vertexMax: 10,
    },
    {
        name: 'large',
        weight: 1,
        radiusMin: 60,
        radiusMax: 100,
        hp: Infinity,
        destructible: false,
        colors: ['#3D3D3D', '#4A4035', '#35302A', '#3A3530'],
        vertexMin: 6,
        vertexMax: 9,
    },
];

// pre-compute total weight for weighted selection
const TOTAL_WEIGHT = ASTEROID_TYPES.reduce((s, t) => s + t.weight, 0);

// ---- chunk cache (LRU) ----------------------------------------------------

/** @type {Map<string, object[]>} key -> asteroid array */
const _chunkCache = new Map();

function _cacheKey(cx, cy) {
    return cx + ',' + cy;
}

function _getChunk(cx, cy) {
    const key = _cacheKey(cx, cy);
    if (_chunkCache.has(key)) {
        // move to end (most recently used)
        const val = _chunkCache.get(key);
        _chunkCache.delete(key);
        _chunkCache.set(key, val);
        return val;
    }
    // generate
    const asteroids = _generateChunk(cx, cy);
    _chunkCache.set(key, asteroids);
    // evict oldest if over limit
    if (_chunkCache.size > MAX_CACHED_CHUNKS) {
        const oldest = _chunkCache.keys().next().value;
        _chunkCache.delete(oldest);
    }
    return asteroids;
}

// ---- chunk generation -----------------------------------------------------

function _generateChunk(cx, cy) {
    const seed = hashCoord(cx, cy);
    const rng = mulberry32(seed);

    const count = Math.floor(rng() * 6); // 0-5 asteroids
    const asteroids = [];

    for (let i = 0; i < count; i++) {
        // weighted type selection
        let roll = rng() * TOTAL_WEIGHT;
        let type = ASTEROID_TYPES[0];
        for (let t = 0; t < ASTEROID_TYPES.length; t++) {
            roll -= ASTEROID_TYPES[t].weight;
            if (roll <= 0) {
                type = ASTEROID_TYPES[t];
                break;
            }
        }

        const radius =
            type.radiusMin + rng() * (type.radiusMax - type.radiusMin);
        const x = cx * CHUNK_SIZE + radius + rng() * (CHUNK_SIZE - radius * 2);
        const y = cy * CHUNK_SIZE + radius + rng() * (CHUNK_SIZE - radius * 2);

        // skip if outside world bounds
        if (x < radius || x > WORLD_SIZE - radius ||
            y < radius || y > WORLD_SIZE - radius) {
            continue;
        }

        const color = type.colors[Math.floor(rng() * type.colors.length)];
        const numVerts =
            type.vertexMin +
            Math.floor(rng() * (type.vertexMax - type.vertexMin + 1));

        // generate irregular polygon vertices
        const vertices = [];
        for (let v = 0; v < numVerts; v++) {
            const angle = (v / numVerts) * Math.PI * 2;
            const jitter = 0.7 + rng() * 0.6; // 0.7 - 1.3 radius variation
            vertices.push({
                angle,
                dist: radius * jitter,
            });
        }

        asteroids.push({
            x,
            y,
            radius,
            hp: type.hp,
            maxHp: type.hp,
            destructible: type.destructible,
            color,
            rotation: rng() * Math.PI * 2,
            rotationSpeed: (rng() - 0.5) * 0.3, // -0.15 to 0.15 rad/s
            vertices,
            _chunkKey: _cacheKey(cx, cy),
            _type: type.name,
        });
    }

    return asteroids;
}

// ---- public API -----------------------------------------------------------

/**
 * Return all asteroids in chunks overlapping the visible area.
 * @param {{ x: number, y: number, width: number, height: number }} camera
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @returns {object[]}
 */
export function getVisibleAsteroids(camera, canvasWidth, canvasHeight) {
    const margin = 150; // render slightly beyond viewport
    const left = camera.x - margin;
    const top = camera.y - margin;
    const right = camera.x + canvasWidth + margin;
    const bottom = camera.y + canvasHeight + margin;

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
                const a = chunk[i];
                // fine-grained check: is the asteroid itself visible?
                if (
                    a.x + a.radius >= left &&
                    a.x - a.radius <= right &&
                    a.y + a.radius >= top &&
                    a.y - a.radius <= bottom
                ) {
                    result.push(a);
                }
            }
        }
    }
    return result;
}

/**
 * Apply damage to an asteroid.
 * @param {object} asteroid
 * @param {number} damage
 * @returns {boolean} true if destroyed
 */
export function damageAsteroid(asteroid, damage) {
    if (!asteroid.destructible) return false;
    asteroid.hp -= damage;
    if (asteroid.hp <= 0) {
        // remove from its cached chunk
        const cached = _chunkCache.get(asteroid._chunkKey);
        if (cached) {
            const idx = cached.indexOf(asteroid);
            if (idx !== -1) cached.splice(idx, 1);
        }
        return true;
    }
    return false;
}

/**
 * Rotate all cached asteroids. Call once per frame.
 * @param {number} dt  seconds since last frame
 */
export function updateAsteroids(dt) {
    for (const chunk of _chunkCache.values()) {
        for (let i = 0; i < chunk.length; i++) {
            chunk[i].rotation += chunk[i].rotationSpeed * dt;
        }
    }
}

/**
 * Draw visible asteroids.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, width: number, height: number }} camera
 */
export function drawAsteroids(ctx, camera) {
    const asteroids = getVisibleAsteroids(
        camera,
        ctx.canvas.width,
        ctx.canvas.height
    );

    for (let i = 0; i < asteroids.length; i++) {
        const a = asteroids[i];
        const sx = a.x - camera.x;
        const sy = a.y - camera.y;

        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(a.rotation);

        // build path from vertices
        ctx.beginPath();
        for (let v = 0; v < a.vertices.length; v++) {
            const vert = a.vertices[v];
            const vx = Math.cos(vert.angle) * vert.dist;
            const vy = Math.sin(vert.angle) * vert.dist;
            if (v === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
        }
        ctx.closePath();

        // fill
        ctx.fillStyle = a.color;
        if (!a.destructible) {
            // indestructible: darker fill, thicker outline
            ctx.globalAlpha = 0.9;
        }
        ctx.fill();

        // glow outline
        ctx.shadowColor = a.destructible
            ? 'rgba(180,160,120,0.4)'
            : 'rgba(80,70,60,0.3)';
        ctx.shadowBlur = a.destructible ? 8 : 4;
        ctx.strokeStyle = a.destructible
            ? 'rgba(200,180,140,0.6)'
            : 'rgba(100,90,80,0.5)';
        ctx.lineWidth = a.destructible ? 1.5 : 2.5;
        ctx.stroke();

        // reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        ctx.restore();

        // HP bar (only if damaged and destructible)
        if (a.destructible && a.hp < a.maxHp) {
            _drawHpBar(ctx, sx, sy, a);
        }
    }
}

function _drawHpBar(ctx, sx, sy, asteroid) {
    const barWidth = asteroid.radius * 1.6;
    const barHeight = 4;
    const bx = sx - barWidth / 2;
    const by = sy - asteroid.radius - 12;
    const ratio = Math.max(0, asteroid.hp / asteroid.maxHp);

    // background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);

    // health fill
    const r = Math.floor(255 * (1 - ratio));
    const g = Math.floor(255 * ratio);
    ctx.fillStyle = `rgb(${r},${g},60)`;
    ctx.fillRect(bx, by, barWidth * ratio, barHeight);

    // border
    ctx.strokeStyle = 'rgba(200,200,200,0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bx - 1, by - 1, barWidth + 2, barHeight + 2);
}

// ---------------------------------------------------------------------------
// background.js  --  parallax star/nebula background with chunk-based seeding
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

/** Simple hash combining two integers into a seed. */
function hashCoord(cx, cy, layer) {
    let h = (cx * 374761393 + cy * 668265263 + layer * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 5);
    h = (h ^ (h >>> 17)) | 0;
    return h >>> 0;
}

// ---- star layer configs ---------------------------------------------------

const STAR_CHUNK = 512; // chunk size in world pixels

const LAYERS = [
    {
        // far
        parallax: 0.1,
        countMin: 30,
        countMax: 50,
        sizeMin: 0.4,
        sizeMax: 1.0,
        alphaMin: 0.15,
        alphaMax: 0.4,
        colorChance: 0, // no colour tint
    },
    {
        // mid
        parallax: 0.3,
        countMin: 10,
        countMax: 20,
        sizeMin: 0.8,
        sizeMax: 1.8,
        alphaMin: 0.3,
        alphaMax: 0.7,
        colorChance: 0,
    },
    {
        // near
        parallax: 0.6,
        countMin: 4,
        countMax: 10,
        sizeMin: 1.2,
        sizeMax: 3.0,
        alphaMin: 0.6,
        alphaMax: 1.0,
        colorChance: 0.35,
    },
];

const STAR_TINTS = [
    'rgba(120,180,255,', // blue
    'rgba(255,200,120,', // warm yellow
    'rgba(255,140,140,', // red
    'rgba(180,140,255,', // purple
    'rgba(100,255,220,', // teal
];

// ---- nebula config --------------------------------------------------------

const NEBULA_CHUNK = 4000; // larger chunks for nebulae
const NEBULA_COLORS = [
    { r: 90, g: 40, b: 160 },   // purple
    { r: 30, g: 60, b: 180 },   // blue
    { r: 20, g: 130, b: 140 },  // teal
    { r: 60, g: 20, b: 120 },   // dark purple
    { r: 20, g: 80, b: 160 },   // mid-blue
];

// ---- public API -----------------------------------------------------------

let _initialized = false;

export function initBackground() {
    _initialized = true;
}

/**
 * Draw all background layers with parallax offset.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number, width: number, height: number }} camera
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 */
export function drawBackground(ctx, camera, canvasWidth, canvasHeight) {
    // solid black base
    ctx.fillStyle = '#050510';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // draw nebulae first (behind stars)
    _drawNebulae(ctx, camera, canvasWidth, canvasHeight);

    // draw each star layer
    for (let li = 0; li < LAYERS.length; li++) {
        _drawStarLayer(ctx, camera, canvasWidth, canvasHeight, li);
    }
}

// ---- internal: star rendering ---------------------------------------------

function _drawStarLayer(ctx, camera, cw, ch, layerIndex) {
    const layer = LAYERS[layerIndex];
    const px = layer.parallax;

    // effective camera position for this parallax layer
    const camX = camera.x * px;
    const camY = camera.y * px;

    // which chunks are visible?
    const startCX = Math.floor(camX / STAR_CHUNK);
    const startCY = Math.floor(camY / STAR_CHUNK);
    const endCX = Math.floor((camX + cw) / STAR_CHUNK);
    const endCY = Math.floor((camY + ch) / STAR_CHUNK);

    for (let cy = startCY; cy <= endCY; cy++) {
        for (let cx = startCX; cx <= endCX; cx++) {
            _drawStarChunk(ctx, camX, camY, cx, cy, layer, layerIndex);
        }
    }
}

function _drawStarChunk(ctx, camX, camY, cx, cy, layer, layerIndex) {
    const seed = hashCoord(cx, cy, layerIndex);
    const rng = mulberry32(seed);

    const count =
        layer.countMin +
        Math.floor(rng() * (layer.countMax - layer.countMin + 1));

    for (let i = 0; i < count; i++) {
        const sx = cx * STAR_CHUNK + rng() * STAR_CHUNK - camX;
        const sy = cy * STAR_CHUNK + rng() * STAR_CHUNK - camY;
        const size =
            layer.sizeMin + rng() * (layer.sizeMax - layer.sizeMin);
        const alpha =
            layer.alphaMin + rng() * (layer.alphaMax - layer.alphaMin);
        const tintRoll = rng();

        // skip if off-screen (with small margin)
        if (sx < -4 || sy < -4 || sx > ctx.canvas.width + 4 || sy > ctx.canvas.height + 4) {
            continue;
        }

        if (layer.colorChance > 0 && tintRoll < layer.colorChance) {
            const tIdx = Math.floor(rng() * STAR_TINTS.length);
            ctx.fillStyle = STAR_TINTS[tIdx] + alpha + ')';
        } else {
            ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
            // consume the rng call to keep determinism
            if (layer.colorChance > 0) rng();
        }

        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();

        // add glow for near-layer bright stars
        if (layerIndex === 2 && size > 2.0) {
            ctx.save();
            ctx.globalAlpha = alpha * 0.25;
            ctx.beginPath();
            ctx.arc(sx, sy, size * 3, 0, Math.PI * 2);
            ctx.fillStyle = ctx.fillStyle; // same colour
            ctx.fill();
            ctx.restore();
        }
    }
}

// ---- internal: nebula rendering -------------------------------------------

function _drawNebulae(ctx, camera, cw, ch) {
    const px = 0.05; // nebulae move very slowly
    const camX = camera.x * px;
    const camY = camera.y * px;

    const startCX = Math.floor(camX / NEBULA_CHUNK);
    const startCY = Math.floor(camY / NEBULA_CHUNK);
    const endCX = Math.floor((camX + cw) / NEBULA_CHUNK);
    const endCY = Math.floor((camY + ch) / NEBULA_CHUNK);

    for (let cy = startCY; cy <= endCY; cy++) {
        for (let cx = startCX; cx <= endCX; cx++) {
            _drawNebulaChunk(ctx, camX, camY, cx, cy, cw, ch);
        }
    }
}

function _drawNebulaChunk(ctx, camX, camY, cx, cy, cw, ch) {
    const seed = hashCoord(cx, cy, 999);
    const rng = mulberry32(seed);

    // 0-2 nebulae per chunk
    const count = Math.floor(rng() * 3);
    if (count === 0) return;

    for (let i = 0; i < count; i++) {
        const nx = cx * NEBULA_CHUNK + rng() * NEBULA_CHUNK - camX;
        const ny = cy * NEBULA_CHUNK + rng() * NEBULA_CHUNK - camY;
        const radius = 200 + rng() * 400;
        const cIdx = Math.floor(rng() * NEBULA_COLORS.length);
        const alpha = 0.03 + rng() * 0.06;

        // rough visibility check
        if (
            nx + radius < -100 ||
            ny + radius < -100 ||
            nx - radius > cw + 100 ||
            ny - radius > ch + 100
        ) {
            continue;
        }

        const col = NEBULA_COLORS[cIdx];
        const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, radius);
        grad.addColorStop(
            0,
            `rgba(${col.r},${col.g},${col.b},${alpha})`
        );
        grad.addColorStop(
            0.5,
            `rgba(${col.r},${col.g},${col.b},${alpha * 0.4})`
        );
        grad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(nx, ny, radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ---------------------------------------------------------------------------
// hud.js  --  heads-up display and minimap
// ---------------------------------------------------------------------------

import { player } from './player.js';
import { enemies } from './enemies.js';
import { getVisibleAsteroids } from './map.js';
import { getCartographerDiscoveries, getCartographerPlanetDiscoveries, crew } from './crew.js';

// ---- colour palette --------------------------------------------------------

const COL_HEALTH     = '#f33';
const COL_HEALTH_BG  = '#600';
const COL_SHIELD     = '#0af';
const COL_SHIELD_BG  = '#036';
const COL_XP         = '#fd0';
const COL_XP_BG      = '#540';
const COL_TEXT        = '#eee';
const COL_BAR_BORDER = 'rgba(255,255,255,0.35)';
const COL_PANEL_BG   = 'rgba(0,0,0,0.55)';

const EFFECT_COLORS = {
    rapidFire:  '#ff0',
    speedBoost: '#0f0',
    spreadShot: '#f80',
    damage:     '#c0f',
    shield:     '#0af',
    health:     '#f6a',
    spareParts: '#a86',
};

const EFFECT_LABELS = {
    rapidFire:  'RAPID',
    speedBoost: 'SPEED',
    spreadShot: 'SPREAD',
    damage:     'DMG x2',
    shield:     'SHIELD',
    health:     'HEAL',
    spareParts: 'PARTS',
};

// ---- bar dimensions --------------------------------------------------------

const BAR_X      = 16;
const BAR_W      = 200;
const BAR_H      = 16;
const BAR_GAP    = 6;
const LABEL_FONT = '12px "Courier New", Courier, monospace';
const SMALL_FONT = '10px "Courier New", Courier, monospace';

// ---- helpers ---------------------------------------------------------------

function drawBar(ctx, x, y, w, h, ratio, fillColor, bgColor, label, valueText) {
    // Background panel
    ctx.fillStyle = COL_PANEL_BG;
    ctx.fillRect(x - 4, y - 2, w + 8, h + 4);

    // Empty bar background
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);

    // Filled portion
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);

    // Glow on the fill
    ctx.shadowBlur  = 8;
    ctx.shadowColor = fillColor;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';

    // Border
    ctx.strokeStyle = COL_BAR_BORDER;
    ctx.lineWidth   = 1;
    ctx.strokeRect(x, y, w, h);

    // Label (left)
    ctx.fillStyle = COL_TEXT;
    ctx.shadowBlur  = 4;
    ctx.shadowColor = fillColor;
    ctx.font = LABEL_FONT;
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 4, y + h / 2);

    // Value (right)
    ctx.textAlign = 'right';
    ctx.fillText(valueText, x + w - 4, y + h / 2);

    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
}

// ---- public API ------------------------------------------------------------

/**
 * Draw the full HUD overlay (health, shield, XP, effects, difficulty, time).
 * All coordinates are in screen space -- no camera transform needed.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {number} gameTime    Elapsed game time in seconds
 * @param {number} difficulty  Current difficulty level
 */
export function drawHUD(ctx, canvasWidth, canvasHeight, gameTime, difficulty) {
    ctx.save();

    let curY = 16;

    // ---- 1. Health bar ----------------------------------------------------
    const hpRatio = player.health / player.maxHealth;
    drawBar(
        ctx, BAR_X, curY, BAR_W, BAR_H,
        hpRatio, COL_HEALTH, COL_HEALTH_BG,
        'HP', Math.ceil(player.health) + '/' + player.maxHealth,
    );
    curY += BAR_H + BAR_GAP;

    // ---- 2. Shield bar ----------------------------------------------------
    const shRatio = player.shield / player.maxShield;
    drawBar(
        ctx, BAR_X, curY, BAR_W, BAR_H,
        shRatio, COL_SHIELD, COL_SHIELD_BG,
        'SHIELD', Math.ceil(player.shield) + '/' + player.maxShield,
    );
    curY += BAR_H + BAR_GAP;

    // ---- 3. XP bar --------------------------------------------------------
    const xpRatio = player.xp / player.xpToNext;
    drawBar(
        ctx, BAR_X, curY, BAR_W, BAR_H,
        xpRatio, COL_XP, COL_XP_BG,
        'LVL ' + player.level, player.xp + '/' + player.xpToNext,
    );
    curY += BAR_H + 2;

    // Total XP indicator (spendable balance)
    ctx.font = SMALL_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fd0';
    ctx.globalAlpha = 0.7;
    ctx.fillText('Total XP: ' + player.totalXp, BAR_X, curY);
    ctx.globalAlpha = 1;
    curY += 14;

    // Coin count
    ctx.font = SMALL_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fd0';
    ctx.globalAlpha = 0.7;
    ctx.fillText('Coins: ' + player.coins, BAR_X, curY);
    ctx.globalAlpha = 1;
    curY += 14;

    // ---- 4. Active effects ------------------------------------------------
    if (player.activeEffects.length > 0) {
        ctx.font = SMALL_FONT;
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'top';

        for (let i = 0; i < player.activeEffects.length; i++) {
            const eff   = player.activeEffects[i];
            const color = EFFECT_COLORS[eff.type] || '#fff';
            const label = EFFECT_LABELS[eff.type] || eff.type;
            const secs  = Math.ceil(eff.remaining);

            // Small indicator: coloured dot + label + remaining time
            const ix = BAR_X;
            const iy = curY + i * 16;

            // Background
            ctx.fillStyle = COL_PANEL_BG;
            ctx.fillRect(ix - 2, iy - 1, 110, 14);

            // Coloured dot
            ctx.shadowBlur  = 6;
            ctx.shadowColor = color;
            ctx.fillStyle   = color;
            ctx.beginPath();
            ctx.arc(ix + 5, iy + 6, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur  = 0;
            ctx.shadowColor = 'transparent';

            // Label + time
            ctx.fillStyle = color;
            ctx.fillText(label + ' ' + secs + 's', ix + 14, iy);
        }
    }

    // ---- 5. Difficulty indicator (top-right) ------------------------------
    ctx.font         = LABEL_FONT;
    ctx.textAlign    = 'right';
    ctx.textBaseline = 'top';

    // Panel background
    const diffText = 'DIFF ' + difficulty;
    const diffW    = ctx.measureText(diffText).width + 16;
    ctx.fillStyle   = COL_PANEL_BG;
    ctx.fillRect(canvasWidth - diffW - 12, 12, diffW + 8, 20);

    // Glowing text
    const diffColor = difficulty >= 8 ? '#f33' : difficulty >= 5 ? '#fa0' : '#0f0';
    ctx.shadowBlur  = 6;
    ctx.shadowColor = diffColor;
    ctx.fillStyle   = diffColor;
    ctx.fillText(diffText, canvasWidth - 16, 16);
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';

    // ---- 6. Game time (top-right, below difficulty) -----------------------
    const timeText = formatTime(gameTime);
    const timeW    = ctx.measureText(timeText).width + 16;
    ctx.fillStyle   = COL_PANEL_BG;
    ctx.fillRect(canvasWidth - timeW - 12, 36, timeW + 8, 20);

    ctx.shadowBlur  = 4;
    ctx.shadowColor = '#fff';
    ctx.fillStyle   = COL_TEXT;
    ctx.fillText(timeText, canvasWidth - 16, 40);
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';

    ctx.restore();
}

// ---- minimap ---------------------------------------------------------------

const MINIMAP_SIZE   = 180;
const MINIMAP_RADIUS = 3000; // world units visible from centre

/**
 * Draw a minimap in the bottom-right corner.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {object} playerObj   Player object ({ x, y, ... })
 * @param {Array}  enemyList   Live enemy array
 * @param {object} cam         Camera object
 */
export function drawMinimap(ctx, canvasWidth, canvasHeight, playerObj, enemyList, cam) {
    ctx.save();

    const mapX = canvasWidth  - MINIMAP_SIZE - 16;
    const mapY = canvasHeight - MINIMAP_SIZE - 16;
    const cx   = mapX + MINIMAP_SIZE / 2;
    const cy   = mapY + MINIMAP_SIZE / 2;
    const scale = (MINIMAP_SIZE / 2) / MINIMAP_RADIUS;

    // ---- background with clipping -----------------------------------------
    ctx.beginPath();
    ctx.rect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);
    ctx.clip();

    // Dark semi-transparent background
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);

    // ---- asteroids (large only) -------------------------------------------
    // Build a pseudo-camera centred on player covering the minimap range
    const pseudoCam = {
        x:      playerObj.x - MINIMAP_RADIUS,
        y:      playerObj.y - MINIMAP_RADIUS,
        width:  MINIMAP_RADIUS * 2,
        height: MINIMAP_RADIUS * 2,
    };
    const asteroids = getVisibleAsteroids(pseudoCam, MINIMAP_RADIUS * 2, MINIMAP_RADIUS * 2);

    ctx.globalAlpha = 0.5;
    for (let i = 0; i < asteroids.length; i++) {
        const a = asteroids[i];
        if (a.radius < 40) continue; // only show large-ish asteroids
        const ax = cx + (a.x - playerObj.x) * scale;
        const ay = cy + (a.y - playerObj.y) * scale;
        const ar = Math.max(1.5, a.radius * scale);

        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(ax, ay, ar, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- enemies ----------------------------------------------------------
    for (let i = 0; i < enemyList.length; i++) {
        const e  = enemyList[i];
        const dx = e.x - playerObj.x;
        const dy = e.y - playerObj.y;

        // Skip if out of minimap range
        if (Math.abs(dx) > MINIMAP_RADIUS || Math.abs(dy) > MINIMAP_RADIUS) continue;

        const ex = cx + dx * scale;
        const ey = cy + dy * scale;

        ctx.fillStyle = e.color;
        ctx.shadowBlur  = 4;
        ctx.shadowColor = e.color;
        ctx.beginPath();
        ctx.arc(ex, ey, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';

    // ---- cartographer discoveries (derelicts) --------------------------------
    if (crew.cartographer.unlocked) {
        const discoveries = getCartographerDiscoveries();
        const derelictColors = {
            smallWreck:    '#ccd',
            cargoShip:     '#58f',
            militaryWreck: '#f44',
        };

        for (let i = 0; i < discoveries.length; i++) {
            const d = discoveries[i];
            const ddx = d.x - playerObj.x;
            const ddy = d.y - playerObj.y;
            if (Math.abs(ddx) > MINIMAP_RADIUS || Math.abs(ddy) > MINIMAP_RADIUS) continue;

            const dx2 = cx + ddx * scale;
            const dy2 = cy + ddy * scale;

            // Show type colors and looted status based on skill tree bonuses
            const showType = crew.cartographer.bonuses.showTypes;
            const showLooted = crew.cartographer.bonuses.showLooted;
            const col = showType ? (derelictColors[d.type] || '#aaa') : '#aaa';

            ctx.globalAlpha = d.looted && showLooted ? 0.3 : 0.8;
            ctx.fillStyle = col;
            ctx.shadowBlur = 4;
            ctx.shadowColor = col;

            // Draw as small square
            ctx.fillRect(dx2 - 2.5, dy2 - 2.5, 5, 5);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }

    // ---- cartographer planet discoveries ------------------------------------
    if (crew.cartographer.unlocked) {
        const planetDiscoveries = getCartographerPlanetDiscoveries();
        const planetColors = {
            rocky:    '#c96',
            gas:      '#6af',
            ice:      '#aef',
            volcanic: '#f64',
        };

        for (let i = 0; i < planetDiscoveries.length; i++) {
            const p = planetDiscoveries[i];
            const pdx = p.x - playerObj.x;
            const pdy = p.y - playerObj.y;
            if (Math.abs(pdx) > MINIMAP_RADIUS || Math.abs(pdy) > MINIMAP_RADIUS) continue;

            const px = cx + pdx * scale;
            const py = cy + pdy * scale;

            const showType = crew.cartographer.bonuses.showTypes;
            const col = showType ? (planetColors[p.type] || '#aaa') : '#aaa';

            ctx.globalAlpha = 0.8;
            ctx.fillStyle = col;
            ctx.shadowBlur = 5;
            ctx.shadowColor = col;

            // Draw as larger circle (planets are bigger than derelicts)
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }

    // ---- player dot (centre) ----------------------------------------------
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#0ff';
    ctx.fillStyle   = '#0ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';

    // ---- border with neon glow --------------------------------------------
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = '#0ff';
    ctx.strokeRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);

    // Second pass for extra glow
    ctx.globalAlpha = 0.3;
    ctx.lineWidth   = 3;
    ctx.strokeRect(mapX, mapY, MINIMAP_SIZE, MINIMAP_SIZE);
    ctx.globalAlpha = 1;

    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';

    ctx.restore();
}

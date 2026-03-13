// ---------------------------------------------------------------------------
// menu.js  --  main menu / title screen
// ---------------------------------------------------------------------------

import { permanentUpgradesList } from './upgrades.js';
import { input } from './input.js';

// ---- colour palette --------------------------------------------------------

const COL_NEON_CYAN   = '#0ff';
const COL_NEON_YELLOW = '#fd0';
const COL_TEXT        = '#eee';
const COL_DIM         = '#888';

const FONT_TITLE    = 'bold 56px "Courier New", Courier, monospace';
const FONT_SUBTITLE = 'bold 20px "Courier New", Courier, monospace';
const FONT_PROMPT   = '16px "Courier New", Courier, monospace';
const FONT_SMALL    = '11px "Courier New", Courier, monospace';

// ---- star field (generated once) -------------------------------------------

const STAR_COUNT = 200;
let stars = null;

function _initStars(canvasWidth, canvasHeight) {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight,
            size: 0.5 + Math.random() * 1.8,
            speed: 8 + Math.random() * 25,
            brightness: 0.3 + Math.random() * 0.7,
        });
    }
}

// ===========================================================================
//  PUBLIC API
// ===========================================================================

/**
 * Draw the main menu / title screen.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {number} gameTime         Total elapsed time (seconds) -- used for animations
 * @param {object} [permanentUpgrades]  Player's permanentUpgrades object (optional)
 */
export function drawMainMenu(ctx, canvasWidth, canvasHeight, gameTime, permanentUpgrades) {
    ctx.save();

    // ---- background -------------------------------------------------------
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // ---- drifting star field ----------------------------------------------
    if (!stars || stars._w !== canvasWidth || stars._h !== canvasHeight) {
        _initStars(canvasWidth, canvasHeight);
        stars._w = canvasWidth;
        stars._h = canvasHeight;
    }

    for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        // Drift downward slowly
        s.y += s.speed * 0.016; // assume ~60fps for visual drift
        if (s.y > canvasHeight) {
            s.y = -2;
            s.x = Math.random() * canvasWidth;
        }

        const twinkle = 0.5 + 0.5 * Math.sin(gameTime * 2 + i);
        const alpha   = s.brightness * twinkle;

        ctx.globalAlpha = alpha;
        ctx.fillStyle   = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    const cx = canvasWidth / 2;

    // ---- title: GAVIN'S GAME ---------------------------------------------
    const pulse     = 0.7 + 0.3 * Math.sin(gameTime * 2.5);
    const glowSize  = 20 + 15 * pulse;

    ctx.font         = FONT_TITLE;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Outer glow layer
    ctx.shadowBlur   = glowSize;
    ctx.shadowColor  = COL_NEON_CYAN;
    ctx.fillStyle    = COL_NEON_CYAN;
    ctx.globalAlpha  = 0.6 + 0.4 * pulse;
    ctx.fillText("GAVIN'S GAME", cx, canvasHeight * 0.30);

    // Solid core text
    ctx.globalAlpha  = 1;
    ctx.shadowBlur   = glowSize * 0.6;
    ctx.fillStyle    = '#fff';
    ctx.fillText("GAVIN'S GAME", cx, canvasHeight * 0.30);
    ctx.shadowBlur   = 0;

    // ---- subtitle: SPACE SHOOTER ------------------------------------------
    ctx.font        = FONT_SUBTITLE;
    ctx.fillStyle   = COL_NEON_YELLOW;
    ctx.shadowBlur  = 10;
    ctx.shadowColor = COL_NEON_YELLOW;
    ctx.globalAlpha = 0.8;
    ctx.fillText('SPACE SHOOTER', cx, canvasHeight * 0.30 + 50);
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    // ---- PRESS ENTER TO START (blinking) ----------------------------------
    const blink = Math.sin(gameTime * 3.5);
    if (blink > -0.3) {
        ctx.font        = FONT_PROMPT;
        ctx.fillStyle   = COL_TEXT;
        ctx.shadowBlur  = 8;
        ctx.shadowColor = COL_NEON_CYAN;
        ctx.globalAlpha = 0.6 + 0.4 * Math.max(0, blink);
        const startText = input.isTouchDevice ? 'TAP TO START' : 'PRESS ENTER TO START';
        ctx.fillText(startText, cx, canvasHeight * 0.55);
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
    }

    // ---- permanent upgrade summary ----------------------------------------
    if (permanentUpgrades) {
        const hasAny = Object.values(permanentUpgrades).some(v => v > 0);

        if (hasAny) {
            const summaryY = canvasHeight * 0.68;

            ctx.font      = FONT_SMALL;
            ctx.fillStyle = COL_DIM;
            ctx.fillText('UPGRADES', cx, summaryY - 16);

            // Horizontal list of owned upgrades
            const owned = [];
            for (let i = 0; i < permanentUpgradesList.length; i++) {
                const upg   = permanentUpgradesList[i];
                const level = permanentUpgrades[upg.id] || 0;
                if (level > 0) {
                    owned.push(upg.name + ' ' + level + '/' + upg.maxLevel);
                }
            }

            const line = owned.join('   ');
            ctx.fillStyle   = COL_NEON_CYAN;
            ctx.shadowBlur  = 4;
            ctx.shadowColor = COL_NEON_CYAN;
            ctx.globalAlpha = 0.85;
            ctx.fillText(line, cx, summaryY + 4);
            ctx.shadowBlur  = 0;
            ctx.globalAlpha = 1;
        }
    }

    // ---- decorative horizontal lines --------------------------------------
    const lineY1 = canvasHeight * 0.30 - 48;
    const lineY2 = canvasHeight * 0.30 + 78;
    const lineW  = 260;

    ctx.strokeStyle = COL_NEON_CYAN;
    ctx.lineWidth   = 1;
    ctx.globalAlpha = 0.25;
    ctx.shadowBlur  = 6;
    ctx.shadowColor = COL_NEON_CYAN;

    ctx.beginPath();
    ctx.moveTo(cx - lineW, lineY1);
    ctx.lineTo(cx + lineW, lineY1);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - lineW, lineY2);
    ctx.lineTo(cx + lineW, lineY2);
    ctx.stroke();

    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;

    ctx.restore();
}

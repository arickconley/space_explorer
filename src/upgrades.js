// ---------------------------------------------------------------------------
// upgrades.js  --  level-up choices & permanent upgrade shop
// ---------------------------------------------------------------------------

import { clamp } from './utils.js';
import { input } from './input.js';

// ---- colour palette --------------------------------------------------------

const COL_NEON_CYAN    = '#0ff';
const COL_NEON_YELLOW  = '#fd0';
const COL_NEON_MAGENTA = '#f0f';
const COL_NEON_GREEN   = '#0f0';
const COL_NEON_RED     = '#f33';
const COL_NEON_ORANGE  = '#fa0';
const COL_TEXT         = '#eee';
const COL_DIM          = '#888';
const COL_PANEL_BG     = 'rgba(0,0,0,0.75)';

const FONT_TITLE = 'bold 28px "Courier New", Courier, monospace';
const FONT_CARD  = 'bold 16px "Courier New", Courier, monospace';
const FONT_DESC  = '12px "Courier New", Courier, monospace';
const FONT_SMALL = '11px "Courier New", Courier, monospace';
const FONT_BIG   = 'bold 48px "Courier New", Courier, monospace';
const FONT_MED   = 'bold 20px "Courier New", Courier, monospace';

// ===========================================================================
//  PERMANENT UPGRADES  (meta-progression)
// ===========================================================================

/** List of permanent upgrades available in the death/shop screen. */
export const permanentUpgradesList = [
    {
        id: 'maxHealth',
        name: 'Hull Plating',
        description: '+10 max health per level',
        maxLevel: 10,
        cost(level) { return 50 * (level + 1); },
        statLabel(level) { return '+' + (level * 10) + ' HP'; },
    },
    {
        id: 'maxShield',
        name: 'Shield Capacitor',
        description: '+5 max shield per level',
        maxLevel: 10,
        cost(level) { return 40 * (level + 1); },
        statLabel(level) { return '+' + (level * 5) + ' SH'; },
    },
    {
        id: 'speed',
        name: 'Thruster',
        description: '+15 speed per level',
        maxLevel: 10,
        cost(level) { return 60 * (level + 1); },
        statLabel(level) { return '+' + (level * 15) + ' SPD'; },
    },
    {
        id: 'damage',
        name: 'Weapon Systems',
        description: '+3 damage per level',
        maxLevel: 10,
        cost(level) { return 45 * (level + 1); },
        statLabel(level) { return '+' + (level * 3) + ' DMG'; },
    },
    {
        id: 'fireRate',
        name: 'Cooling Systems',
        description: '-5% fire cooldown per level',
        maxLevel: 10,
        cost(level) { return 55 * (level + 1); },
        statLabel(level) { return '-' + (level * 5) + '% CD'; },
    },
];

/**
 * Draw the death / permanent-upgrade shop screen.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {object} player          Player object (needs permanentUpgrades, totalXp)
 * @param {number} selectedIndex   Currently highlighted row (0 .. upgrades.length = launch btn)
 * @param {object} runStats        { timeSurvived, enemiesKilled, levelReached }
 */
export function drawDeathScreen(ctx, canvasWidth, canvasHeight, player, selectedIndex, runStats) {
    ctx.save();

    // ---- background -------------------------------------------------------
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const cx = canvasWidth / 2;

    // ---- GAME OVER title --------------------------------------------------
    ctx.font         = FONT_BIG;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur   = 30;
    ctx.shadowColor  = COL_NEON_RED;
    ctx.fillStyle    = COL_NEON_RED;
    ctx.fillText('GAME OVER', cx, 60);
    ctx.shadowBlur = 0;

    // ---- run stats --------------------------------------------------------
    const stats = runStats || { timeSurvived: 0, enemiesKilled: 0, levelReached: 1 };
    ctx.font      = FONT_DESC;
    ctx.fillStyle = COL_DIM;

    const minutes = Math.floor(stats.timeSurvived / 60);
    const seconds = Math.floor(stats.timeSurvived % 60);
    const timeStr = (minutes < 10 ? '0' : '') + minutes + ':' + (seconds < 10 ? '0' : '') + seconds;

    const statLine = 'Time: ' + timeStr +
        '   |   Kills: ' + stats.enemiesKilled +
        '   |   Level: ' + stats.levelReached;
    ctx.fillText(statLine, cx, 105);

    // ---- total XP ---------------------------------------------------------
    ctx.font      = FONT_MED;
    ctx.shadowBlur  = 12;
    ctx.shadowColor = COL_NEON_YELLOW;
    ctx.fillStyle   = COL_NEON_YELLOW;
    ctx.fillText('XP: ' + player.totalXp, cx, 140);
    ctx.shadowBlur = 0;

    // ---- upgrade rows -----------------------------------------------------
    const rowH    = 50;
    const rowW    = 460;
    const startY  = 175;
    const rowX    = cx - rowW / 2;

    for (let i = 0; i < permanentUpgradesList.length; i++) {
        const upg      = permanentUpgradesList[i];
        const curLevel = player.permanentUpgrades[upg.id] || 0;
        const maxed    = curLevel >= upg.maxLevel;
        const cost     = maxed ? 0 : upg.cost(curLevel);
        const canBuy   = !maxed && player.totalXp >= cost;
        const selected = i === selectedIndex;
        const ry       = startY + i * (rowH + 6);

        // Row background
        ctx.fillStyle = selected ? 'rgba(0,40,60,0.9)' : COL_PANEL_BG;
        ctx.fillRect(rowX, ry, rowW, rowH);

        // Neon border
        const borderCol = selected ? COL_NEON_CYAN : 'rgba(0,255,255,0.15)';
        ctx.shadowBlur  = selected ? 14 : 0;
        ctx.shadowColor = COL_NEON_CYAN;
        ctx.strokeStyle = borderCol;
        ctx.lineWidth   = selected ? 2 : 1;
        ctx.strokeRect(rowX, ry, rowW, rowH);
        ctx.shadowBlur = 0;

        // Upgrade name
        ctx.font      = FONT_CARD;
        ctx.textAlign = 'left';
        ctx.fillStyle = selected ? '#fff' : COL_TEXT;
        ctx.fillText(upg.name, rowX + 12, ry + 20);

        // Description + stat
        ctx.font      = FONT_SMALL;
        ctx.fillStyle = COL_DIM;
        ctx.fillText(upg.description + '  ' + upg.statLabel(curLevel), rowX + 12, ry + 38);

        // Level pips
        const pipX = rowX + 280;
        const pipY = ry + 14;
        for (let p = 0; p < upg.maxLevel; p++) {
            const filled = p < curLevel;
            ctx.fillStyle   = filled ? COL_NEON_CYAN : 'rgba(255,255,255,0.15)';
            ctx.shadowBlur  = filled ? 4 : 0;
            ctx.shadowColor = COL_NEON_CYAN;
            ctx.fillRect(pipX + p * 10, pipY, 7, 7);
        }
        ctx.shadowBlur = 0;

        // Cost / maxed label (right side)
        ctx.textAlign = 'right';
        if (maxed) {
            ctx.font      = FONT_CARD;
            ctx.fillStyle = COL_NEON_GREEN;
            ctx.fillText('MAX', rowX + rowW - 12, ry + 28);
        } else {
            ctx.font      = FONT_CARD;
            ctx.fillStyle = canBuy ? COL_NEON_YELLOW : COL_NEON_RED;
            ctx.fillText(cost + ' XP', rowX + rowW - 12, ry + 28);
        }
    }

    // ---- LAUNCH button ----------------------------------------------------
    const launchIdx  = permanentUpgradesList.length;
    const launchY    = startY + permanentUpgradesList.length * (rowH + 6) + 16;
    const btnW       = 220;
    const btnH       = 44;
    const btnX       = cx - btnW / 2;
    const isLaunch   = selectedIndex === launchIdx;

    ctx.fillStyle = isLaunch ? 'rgba(0,60,30,0.9)' : COL_PANEL_BG;
    ctx.fillRect(btnX, launchY, btnW, btnH);

    ctx.shadowBlur  = isLaunch ? 20 : 0;
    ctx.shadowColor = COL_NEON_GREEN;
    ctx.strokeStyle = isLaunch ? COL_NEON_GREEN : 'rgba(0,255,0,0.25)';
    ctx.lineWidth   = isLaunch ? 2.5 : 1;
    ctx.strokeRect(btnX, launchY, btnW, btnH);

    if (isLaunch) {
        ctx.globalAlpha = 0.25;
        ctx.lineWidth   = 5;
        ctx.strokeRect(btnX, launchY, btnW, btnH);
        ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;

    ctx.font      = FONT_MED;
    ctx.textAlign = 'center';
    ctx.fillStyle = isLaunch ? COL_NEON_GREEN : COL_TEXT;
    ctx.shadowBlur  = isLaunch ? 10 : 0;
    ctx.shadowColor = COL_NEON_GREEN;
    ctx.fillText('LAUNCH', cx, launchY + btnH / 2 + 1);
    ctx.shadowBlur = 0;

    // ---- navigation hint --------------------------------------------------
    ctx.font      = FONT_SMALL;
    ctx.fillStyle = COL_DIM;
    const deathHint = input.isTouchDevice
        ? 'Tap to Buy / Launch'
        : '\u2191\u2193 Navigate   Enter: Buy / Launch';
    ctx.fillText(deathHint, cx, launchY + btnH + 24);

    ctx.restore();
}

// ===========================================================================
//  HELPERS
// ===========================================================================

/**
 * Simple word-wrap text drawing (centred).
 */
function _wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';

    for (let i = 0; i < words.length; i++) {
        const test = line + (line ? ' ' : '') + words[i];
        if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, y);
            line = words[i];
            y += lineHeight;
        } else {
            line = test;
        }
    }
    if (line) ctx.fillText(line, x, y);
}

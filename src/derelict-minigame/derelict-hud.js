// ---------------------------------------------------------------------------
// derelict-hud.js  --  mini-game HUD
// ---------------------------------------------------------------------------

import { TILE_SIZE } from './tilemap.js';

export function drawDerelictHUD(ctx, cw, ch, player, scatteredLoot, lockerOpened, time, levelWidthPx) {
    ctx.save();

    // ---- dark panel backgrounds -------------------------------------------
    const panelColor = 'rgba(0,0,0,0.5)';

    // ---- astronaut HP (top-left) ------------------------------------------
    const hpX = 16;
    const hpY = 16;
    ctx.fillStyle = panelColor;
    ctx.fillRect(hpX - 4, hpY - 4, 60, 24);

    for (let i = 0; i < player.maxHp; i++) {
        const heartX = hpX + i * 18;
        _drawHeart(ctx, heartX, hpY + 8, i < player.hp);
    }

    // ---- XP collected (top-left, below HP) --------------------------------
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(255,215,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#fd0';
    ctx.fillText(`XP: ${scatteredLoot.xp}`, hpX, hpY + 28);
    ctx.fillText(`Coins: ${scatteredLoot.coins}`, hpX + 80, hpY + 28);
    ctx.shadowBlur = 0;

    // ---- "EXPLORE THE DERELICT" (top-center, first 3 seconds) -------------
    if (time < 3) {
        const alpha = time < 2 ? 1 : 1 - (time - 2);
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0,255,255,0.6)';
        ctx.shadowBlur = 8;
        ctx.fillStyle = `rgba(0,255,255,${alpha})`;
        ctx.fillText('EXPLORE THE DERELICT', cw / 2, 20);
        ctx.shadowBlur = 0;
    }

    // ---- progress bar (top-right) -----------------------------------------
    const barW = 100;
    const barH = 6;
    const barX = cw - barW - 16;
    const barY = 20;
    const progress = levelWidthPx > 0 ? Math.min(1, player.x / levelWidthPx) : 0;

    ctx.fillStyle = panelColor;
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    ctx.fillStyle = 'rgba(0,255,255,0.2)';
    ctx.fillRect(barX, barY, barW, barH);

    ctx.fillStyle = 'rgba(0,255,255,0.7)';
    ctx.fillRect(barX, barY, barW * progress, barH);

    // ---- exit prompt (bottom-center) --------------------------------------
    const exitPulse = 0.4 + 0.3 * Math.sin(time * 2);
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = `rgba(200,200,200,${exitPulse})`;
    const exitText = '[WASD] FLOAT  |  [E] INTERACT / EXIT AT AIRLOCK';
    ctx.fillText(exitText, cw / 2, ch - 16);

    ctx.restore();
}

function _drawHeart(ctx, x, y, filled) {
    ctx.save();
    ctx.translate(x, y);

    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.bezierCurveTo(-1, -1, -6, -1, -6, 3);
    ctx.bezierCurveTo(-6, 7, 0, 10, 0, 12);
    ctx.bezierCurveTo(0, 10, 6, 7, 6, 3);
    ctx.bezierCurveTo(6, -1, 1, -1, 0, 2);
    ctx.closePath();

    if (filled) {
        ctx.fillStyle = '#0ff';
        ctx.shadowColor = '#0ff';
        ctx.shadowBlur = 4;
        ctx.fill();
    } else {
        ctx.strokeStyle = 'rgba(0,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.restore();
}

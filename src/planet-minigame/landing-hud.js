// ---------------------------------------------------------------------------
// landing-hud.js  --  HUD overlay for the landing mini-game
// ---------------------------------------------------------------------------

import { SAFE_LANDING_SPEED, SAFE_LANDING_ANGLE } from './landing-ship.js';

export function drawLandingHUD(ctx, cw, ch, ship, terrain, time) {
    ctx.save();

    // ---- vertical speed indicator (right side) ----------------------------
    const gaugeX = cw - 40;
    const gaugeY = ch * 0.2;
    const gaugeH = ch * 0.4;
    const gaugeW = 12;

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(gaugeX - 2, gaugeY - 2, gaugeW + 4, gaugeH + 4);

    // Speed ratio (0 = stopped, 1 = max)
    const speedRatio = Math.min(1, Math.abs(ship.vy) / 200);
    const safeRatio = SAFE_LANDING_SPEED / 200;

    // Safe zone (green)
    ctx.fillStyle = 'rgba(0,180,0,0.3)';
    ctx.fillRect(gaugeX, gaugeY + gaugeH * (1 - safeRatio), gaugeW, gaugeH * safeRatio);

    // Danger zone (red)
    ctx.fillStyle = 'rgba(180,0,0,0.3)';
    ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH * (1 - safeRatio));

    // Current speed marker
    const markerY = gaugeY + gaugeH * (1 - speedRatio);
    const isSafe = Math.abs(ship.vy) <= SAFE_LANDING_SPEED;
    ctx.fillStyle = isSafe ? '#0f0' : '#f33';
    ctx.fillRect(gaugeX - 4, markerY - 2, gaugeW + 8, 4);

    // Label
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#aaa';
    ctx.fillText('SPD', gaugeX + gaugeW / 2, gaugeY + gaugeH + 6);

    // Speed value
    ctx.fillStyle = isSafe ? '#0f0' : '#f33';
    ctx.fillText(Math.abs(Math.floor(ship.vy)), gaugeX + gaugeW / 2, gaugeY + gaugeH + 18);

    // ---- altitude indicator (left side) ------------------------------------
    const altX = 24;
    const alt = terrain.padY - (ship.y + 12); // distance to pad level
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(altX - 4, ch * 0.2 - 4, 80, 40);
    ctx.fillStyle = '#aaa';
    ctx.fillText('ALT', altX, ch * 0.2);
    ctx.fillStyle = alt > 50 ? '#0ff' : alt > 20 ? '#ff0' : '#f33';
    ctx.fillText(Math.max(0, Math.floor(alt)) + 'px', altX, ch * 0.2 + 16);

    // ---- angle indicator ---------------------------------------------------
    const angleOk = Math.abs(ship.angle) <= SAFE_LANDING_ANGLE;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(altX - 4, ch * 0.2 + 40, 80, 24);
    ctx.fillStyle = angleOk ? '#0f0' : '#f33';
    ctx.font = '10px monospace';
    ctx.fillText('ANG ' + (Math.abs(ship.angle) * (180 / Math.PI)).toFixed(0) + '\u00B0', altX, ch * 0.2 + 46);

    // ---- instruction text (top center, fades after 3s) --------------------
    if (time < 4) {
        const alpha = time < 3 ? 1 : 1 - (time - 3);
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = `rgba(200,255,200,${alpha})`;
        ctx.shadowColor = 'rgba(0,255,100,0.5)';
        ctx.shadowBlur = 6;
        ctx.fillText('LAND ON PAD', cw / 2, 16);
        ctx.shadowBlur = 0;
    }

    // ---- controls hint (bottom center) ------------------------------------
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(180,180,180,0.5)';
    ctx.fillText('[W] THRUST   [A/D] STEER', cw / 2, ch - 10);

    ctx.restore();
}

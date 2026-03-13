// ---------------------------------------------------------------------------
// index.js  --  landing mini-game public API, state management
// ---------------------------------------------------------------------------

import { generateLandingTerrain } from './terrain-generator.js';
import {
    createLandingShip, updateLandingShip, drawLandingShip,
    checkTerrainCollision,
} from './landing-ship.js';
import { drawLandingHUD } from './landing-hud.js';

// ---- module state ----------------------------------------------------------

let _active = false;
let _result = null;
let _time = 0;
let _ship = null;
let _terrain = null;
let _planetType = 'rocky';
let _phase = 'descending'; // 'descending' | 'landed' | 'crashed'
let _phaseTimer = 0;
let _crashDamage = 20;

// ---- public API ------------------------------------------------------------

export function initLanding(planetData, playerRef) {
    _planetType = planetData.type;
    _terrain = generateLandingTerrain(planetData.seed, planetData.type);

    // Start ship at top center
    _ship = createLandingShip(_terrain.width / 2, 30);

    _phase = 'descending';
    _phaseTimer = 0;
    _result = null;
    _time = 0;
    _active = true;
}

export function updateLanding(dt) {
    if (!_active) return { done: true, result: _result };

    _time += dt;

    if (_phase === 'descending') {
        updateLandingShip(dt, _ship);

        // Clamp horizontal position
        if (_ship.x < 10) { _ship.x = 10; _ship.vx = Math.abs(_ship.vx) * 0.5; }
        if (_ship.x > _terrain.width - 10) { _ship.x = _terrain.width - 10; _ship.vx = -Math.abs(_ship.vx) * 0.5; }

        // Check terrain collision
        const collision = checkTerrainCollision(_ship, _terrain);

        if (collision.aborted) {
            // Flew off the top -- return to space, no damage
            _active = false;
            _result = { done: true, success: false, aborted: true, damage: 0 };
            return { done: true, result: _result };
        }

        if (collision.collided) {
            if (collision.onPad && collision.speedSafe && collision.angleSafe) {
                _phase = 'landed';
                _phaseTimer = 0;
                _ship.vy = 0;
                _ship.vx = 0;
            } else {
                _phase = 'crashed';
                _phaseTimer = 0;
                _ship.vy = 0;
                _ship.vx = 0;
            }
        }

        return { done: false, result: null };
    }

    if (_phase === 'landed') {
        _phaseTimer += dt;
        if (_phaseTimer >= 1.5) {
            _active = false;
            _result = { done: true, success: true, damage: 0 };
            return { done: true, result: _result };
        }
        return { done: false, result: null };
    }

    if (_phase === 'crashed') {
        _phaseTimer += dt;
        if (_phaseTimer >= 1.5) {
            _active = false;
            _result = { done: true, success: false, damage: _crashDamage };
            return { done: true, result: _result };
        }
        return { done: false, result: null };
    }

    return { done: false, result: null };
}

export function drawLanding(ctx, cw, ch) {
    if (!_active && !(_phase === 'landed' || _phase === 'crashed')) return;

    const scaleX = cw / _terrain.width;
    const scaleY = ch / _terrain.height;

    // ---- Background: gradient sky (dark space -> atmosphere) ---------------
    const skyGrad = ctx.createLinearGradient(0, 0, 0, ch);
    skyGrad.addColorStop(0, '#000010');
    skyGrad.addColorStop(0.3, _terrain.bgColor);
    skyGrad.addColorStop(1, _terrain.bgColor);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, cw, ch);

    // ---- Distant terrain silhouette (parallax at 0.3x) --------------------
    ctx.fillStyle = 'rgba(40,40,60,0.4)';
    ctx.beginPath();
    ctx.moveTo(0, ch);
    for (let x = 0; x < _terrain.width; x += 4) {
        const h = _terrain.heights[x];
        const parallaxY = ch * 0.3 + (h * scaleY - ch * 0.3) * 0.3;
        ctx.lineTo(x * scaleX, parallaxY);
    }
    ctx.lineTo(cw, ch);
    ctx.closePath();
    ctx.fill();

    // ---- Main terrain foreground ------------------------------------------
    ctx.fillStyle = _terrain.groundColor;
    ctx.strokeStyle = _terrain.groundStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, ch);
    for (let x = 0; x < _terrain.width; x += 2) {
        ctx.lineTo(x * scaleX, _terrain.heights[x] * scaleY);
    }
    ctx.lineTo(cw, ch);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // ---- Landing pad with blinking lights ---------------------------------
    const padLeftPx = _terrain.padLeft * scaleX;
    const padRightPx = _terrain.padRight * scaleX;
    const padYPx = _terrain.padY * scaleY;
    const padW = padRightPx - padLeftPx;

    // Pad surface
    ctx.fillStyle = '#444';
    ctx.fillRect(padLeftPx, padYPx - 3, padW, 6);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(padLeftPx, padYPx - 3, padW, 6);

    // Blinking lights at pad edges
    const blink = Math.sin(_time * 5) > 0;
    ctx.fillStyle = blink ? '#0f0' : '#030';
    ctx.beginPath();
    ctx.arc(padLeftPx + 3, padYPx, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(padRightPx - 3, padYPx, 3, 0, Math.PI * 2);
    ctx.fill();

    // Center marker
    ctx.fillStyle = blink ? '#ff0' : '#440';
    ctx.beginPath();
    ctx.arc((padLeftPx + padRightPx) / 2, padYPx, 2, 0, Math.PI * 2);
    ctx.fill();

    // ---- Terrain features -------------------------------------------------
    for (const f of _terrain.features) {
        const fx = f.x * scaleX;
        const fy = f.y * scaleY;

        ctx.save();
        if (f.type === 'boulder') {
            ctx.fillStyle = '#8a7050';
            ctx.beginPath();
            ctx.arc(fx, fy - f.size / 2, f.size * scaleX * 0.5, 0, Math.PI * 2);
            ctx.fill();
        } else if (f.type === 'crystal') {
            ctx.fillStyle = 'rgba(180,220,255,0.6)';
            ctx.beginPath();
            ctx.moveTo(fx, fy - f.size * scaleY);
            ctx.lineTo(fx - 3 * scaleX, fy);
            ctx.lineTo(fx + 3 * scaleX, fy);
            ctx.closePath();
            ctx.fill();
        } else if (f.type === 'vent') {
            // Volcanic vent with glow
            const ventPulse = 0.3 + 0.3 * Math.sin(_time * 3 + f.seed);
            ctx.fillStyle = `rgba(255,80,0,${ventPulse})`;
            ctx.beginPath();
            ctx.arc(fx, fy, 4 * scaleX, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // ---- Ship -------------------------------------------------------------
    if (_ship) {
        drawLandingShip(ctx, _ship, scaleX, scaleY, _time);
    }

    // ---- HUD --------------------------------------------------------------
    drawLandingHUD(ctx, cw, ch, _ship, _terrain, _time);

    // ---- Phase overlay text -----------------------------------------------
    if (_phase === 'landed') {
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#0f0';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#0f0';
        ctx.fillText('LANDING SUCCESSFUL', cw / 2, ch / 2 - 40);
        ctx.shadowBlur = 0;
        ctx.font = '14px monospace';
        ctx.fillStyle = '#8f8';
        ctx.fillText('Entering market...', cw / 2, ch / 2);
    } else if (_phase === 'crashed') {
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#f00';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#f33';
        ctx.fillText('CRASH LANDING', cw / 2, ch / 2 - 40);
        ctx.shadowBlur = 0;
        ctx.font = '14px monospace';
        ctx.fillStyle = '#f88';
        ctx.fillText('-' + _crashDamage + ' HP', cw / 2, ch / 2);
    }
}

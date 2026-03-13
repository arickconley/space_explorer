// ---------------------------------------------------------------------------
// landing-ship.js  --  ship physics and rendering for the landing mini-game
// ---------------------------------------------------------------------------

import { input } from '../input.js';
import { clamp } from '../utils.js';

// ---- constants ------------------------------------------------------------

const GRAVITY = 60;           // px/s^2
const THRUST_POWER = 120;     // px/s^2 (upward, 2x gravity)
const STEER_POWER = 80;       // px/s^2 (horizontal)
const MAX_VSPEED = 200;       // px/s
const MAX_HSPEED = 120;       // px/s
export const SAFE_LANDING_SPEED = 50;  // px/s
export const SAFE_LANDING_ANGLE = 0.26; // ~15 degrees
const SHIP_WIDTH = 20;
const SHIP_HEIGHT = 24;

// ---- public API -----------------------------------------------------------

export function createLandingShip(startX, startY) {
    return {
        x: startX,
        y: startY,
        vx: 0,
        vy: 15,    // slight downward initial velocity
        angle: 0,  // radians, 0 = upright
        width: SHIP_WIDTH,
        height: SHIP_HEIGHT,
        thrusting: false,
    };
}

export function updateLandingShip(dt, ship) {
    // Apply gravity
    ship.vy += GRAVITY * dt;

    // Read input
    const move = input.moveStick;
    let thrustInput = false;
    let steerInput = 0;

    // Keyboard
    if (input.isDown('w') || input.isDown('arrowup')) {
        thrustInput = true;
    }
    if (input.isDown('a') || input.isDown('arrowleft')) {
        steerInput -= 1;
    }
    if (input.isDown('d') || input.isDown('arrowright')) {
        steerInput += 1;
    }

    // Joystick
    if (move.active && move.dist > 0.15) {
        // Up component = thrust
        const upComponent = -Math.sin(move.angle);
        if (upComponent > 0.3) thrustInput = true;
        // Horizontal component = steer
        const hComponent = Math.cos(move.angle) * move.dist;
        if (Math.abs(hComponent) > 0.2) steerInput += hComponent;
    }

    // Apply thrust (upward)
    if (thrustInput) {
        ship.vy -= THRUST_POWER * dt;
        ship.thrusting = true;
    } else {
        ship.thrusting = false;
    }

    // Apply horizontal steering
    if (steerInput !== 0) {
        ship.vx += STEER_POWER * clamp(steerInput, -1, 1) * dt;
    }

    // Visual angle based on horizontal velocity
    ship.angle = clamp(ship.vx / MAX_HSPEED * 0.3, -0.5, 0.5);

    // Clamp speeds
    ship.vy = clamp(ship.vy, -MAX_VSPEED, MAX_VSPEED);
    ship.vx = clamp(ship.vx, -MAX_HSPEED, MAX_HSPEED);

    // Apply horizontal friction
    ship.vx *= 0.98;

    // Update position
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    return { thrusting: ship.thrusting };
}

export function drawLandingShip(ctx, ship, scaleX, scaleY, time) {
    const sx = ship.x * scaleX;
    const sy = ship.y * scaleY;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ship.angle);

    // Thrust flame
    if (ship.thrusting) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#f80';
        ctx.fillStyle = 'rgba(255,140,0,0.7)';
        ctx.beginPath();
        const flicker = 1 + Math.random() * 0.4;
        const flameH = 12 * flicker * scaleY;
        ctx.moveTo(-5 * scaleX, SHIP_HEIGHT / 2 * scaleY);
        ctx.lineTo(0, SHIP_HEIGHT / 2 * scaleY + flameH);
        ctx.lineTo(5 * scaleX, SHIP_HEIGHT / 2 * scaleY);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    // Ship body (triangular, nose up)
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#0ff';
    ctx.fillStyle = '#0cc';
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, -SHIP_HEIGHT / 2 * scaleY);                        // nose (top)
    ctx.lineTo(-SHIP_WIDTH / 2 * scaleX, SHIP_HEIGHT / 2 * scaleY);  // bottom-left
    ctx.lineTo(SHIP_WIDTH / 2 * scaleX, SHIP_HEIGHT / 2 * scaleY);   // bottom-right
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.restore();
}

export function checkTerrainCollision(ship, terrain) {
    const { heights, padLeft, padRight, padY, width, height } = terrain;

    // Ship bottom Y
    const shipBottom = ship.y + SHIP_HEIGHT / 2;
    const shipX = Math.floor(ship.x);

    // Off screen left/right: wrap or clamp
    if (shipX < 0 || shipX >= width) {
        return { collided: false, onPad: false, speedSafe: false, angleSafe: false };
    }

    // Off top of screen: abort (return to space)
    if (ship.y < -30) {
        return { collided: false, onPad: false, speedSafe: false, angleSafe: false, aborted: true };
    }

    // Get terrain height at ship position (sample a few points for width)
    const halfW = SHIP_WIDTH / 2;
    for (let dx = -halfW; dx <= halfW; dx += 4) {
        const sampleX = Math.floor(clamp(ship.x + dx, 0, width - 1));
        const terrainY = heights[sampleX];

        if (shipBottom >= terrainY) {
            const onPad = ship.x >= padLeft && ship.x <= padRight;
            const speedSafe = Math.abs(ship.vy) <= SAFE_LANDING_SPEED;
            const angleSafe = Math.abs(ship.angle) <= SAFE_LANDING_ANGLE;
            return { collided: true, onPad, speedSafe, angleSafe };
        }
    }

    return { collided: false, onPad: false, speedSafe: false, angleSafe: false };
}

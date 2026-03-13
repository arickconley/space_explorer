// ---------------------------------------------------------------------------
// platformer-player.js  --  zero-gravity astronaut physics & rendering
// ---------------------------------------------------------------------------

import { TILE_SIZE, getTile, isSolid, TILE } from './tilemap.js';
import { input } from '../input.js';
import { clamp } from '../utils.js';

// ---- physics constants -----------------------------------------------------

const THRUST        = 280;    // px/s^2 acceleration from input
const MAX_SPEED     = 180;    // px/s cap
const DRAG          = 0.97;   // velocity multiplied per frame (zero-g drift)
const INVULN_TIME   = 1.0;
const PLAYER_R      = 10;     // collision radius

// ---- public API ------------------------------------------------------------

export function initPlatformerPlayer(spawnCol, spawnRow) {
    return {
        x: spawnCol * TILE_SIZE + TILE_SIZE / 2,
        y: spawnRow * TILE_SIZE + TILE_SIZE / 2,
        vx: 0,
        vy: 0,
        radius: PLAYER_R,
        width: PLAYER_R * 2,
        height: PLAYER_R * 2,
        hp: 3,
        maxHp: 3,
        facingAngle: 0,       // radians, direction astronaut faces
        invulnTimer: 0,
        thrustFrame: 0,       // animation counter for thruster
    };
}

export function updatePlatformerPlayer(dt, map, player) {
    if (!player) return { events: [] };
    const p = player;

    // ---- read input --------------------------------------------------------
    let ax = 0;
    let ay = 0;

    if (input.isDown('a') || input.isDown('arrowleft'))  ax -= 1;
    if (input.isDown('d') || input.isDown('arrowright')) ax += 1;
    if (input.isDown('w') || input.isDown('arrowup'))    ay -= 1;
    if (input.isDown('s') || input.isDown('arrowdown'))  ay += 1;

    // Joystick input (moveStick)
    if (input.moveStick.active) {
        ax += input.moveStick.dx / 60;  // normalize pixel offset
        ay += input.moveStick.dy / 60;
    }

    // Normalize diagonal input
    const inputLen = Math.sqrt(ax * ax + ay * ay);
    if (inputLen > 1) {
        ax /= inputLen;
        ay /= inputLen;
    }

    const thrusting = inputLen > 0.1;

    // ---- apply thrust ------------------------------------------------------
    p.vx += ax * THRUST * dt;
    p.vy += ay * THRUST * dt;

    // ---- apply drag (zero-g drift) -----------------------------------------
    p.vx *= DRAG;
    p.vy *= DRAG;

    // ---- clamp speed -------------------------------------------------------
    const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (speed > MAX_SPEED) {
        p.vx = (p.vx / speed) * MAX_SPEED;
        p.vy = (p.vy / speed) * MAX_SPEED;
    }

    // Stop tiny drift
    if (speed < 1 && !thrusting) {
        p.vx = 0;
        p.vy = 0;
    }

    // ---- facing angle ------------------------------------------------------
    if (thrusting) {
        const targetAngle = Math.atan2(ay, ax);
        // Smooth rotation toward thrust direction
        let diff = targetAngle - p.facingAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        p.facingAngle += diff * 0.15;
    }

    // ---- thruster animation ------------------------------------------------
    if (thrusting) {
        p.thrustFrame += dt * 12;
    }

    // ---- move + resolve wall collisions ------------------------------------
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    _resolveWallCollisions(p, map);

    // ---- invulnerability ---------------------------------------------------
    if (p.invulnTimer > 0) p.invulnTimer -= dt;

    return { events: [] };
}

export function damagePlatformerPlayer(player, amount) {
    if (player.invulnTimer > 0) return;
    player.hp -= amount;
    player.invulnTimer = INVULN_TIME;
    if (player.hp < 0) player.hp = 0;
}

// ---- collision resolution --------------------------------------------------

function _resolveWallCollisions(p, map) {
    // Check tiles around the player's position
    const margin = p.radius + 1;
    const startCol = Math.floor((p.x - margin) / TILE_SIZE);
    const endCol   = Math.floor((p.x + margin) / TILE_SIZE);
    const startRow = Math.floor((p.y - margin) / TILE_SIZE);
    const endRow   = Math.floor((p.y + margin) / TILE_SIZE);

    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            const t = getTile(map, col, row);
            if (!isSolid(t)) continue;

            // Find closest point on tile rect to player center
            const tileLeft   = col * TILE_SIZE;
            const tileRight  = tileLeft + TILE_SIZE;
            const tileTop    = row * TILE_SIZE;
            const tileBottom = tileTop + TILE_SIZE;

            const closestX = clamp(p.x, tileLeft, tileRight);
            const closestY = clamp(p.y, tileTop, tileBottom);

            const dx = p.x - closestX;
            const dy = p.y - closestY;
            const distSq = dx * dx + dy * dy;

            if (distSq < p.radius * p.radius && distSq > 0) {
                const dist = Math.sqrt(distSq);
                const overlap = p.radius - dist;
                const nx = dx / dist;
                const ny = dy / dist;

                // Push out
                p.x += nx * overlap;
                p.y += ny * overlap;

                // Bounce velocity (damped)
                const dot = p.vx * nx + p.vy * ny;
                if (dot < 0) {
                    p.vx -= dot * nx * 1.5;
                    p.vy -= dot * ny * 1.5;
                }
            } else if (distSq === 0) {
                // Player center is inside a tile — push to nearest edge
                const cx = p.x - (tileLeft + TILE_SIZE / 2);
                const cy = p.y - (tileTop + TILE_SIZE / 2);
                if (Math.abs(cx) > Math.abs(cy)) {
                    p.x = cx > 0 ? tileRight + p.radius : tileLeft - p.radius;
                    p.vx = 0;
                } else {
                    p.y = cy > 0 ? tileBottom + p.radius : tileTop - p.radius;
                    p.vy = 0;
                }
            }
        }
    }
}

// ---- rendering -------------------------------------------------------------

export function drawPlatformerPlayer(ctx, cam, player, time) {
    if (!player) return;
    const p = player;
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;

    // Blink when invulnerable
    if (p.invulnTimer > 0 && Math.sin(time * 20) > 0) return;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(p.facingAngle);

    // ---- thruster flame (behind astronaut) ----------------------------------
    if (p.vx * p.vx + p.vy * p.vy > 25) {
        const flicker = 0.6 + 0.4 * Math.sin(p.thrustFrame);
        const flameLen = 8 + flicker * 6;
        ctx.fillStyle = `rgba(100,180,255,${flicker * 0.5})`;
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-8 - flameLen, 0);
        ctx.lineTo(-8, 3);
        ctx.closePath();
        ctx.fill();
        // Inner flame
        ctx.fillStyle = `rgba(200,230,255,${flicker * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(-8, -1.5);
        ctx.lineTo(-8 - flameLen * 0.5, 0);
        ctx.lineTo(-8, 1.5);
        ctx.closePath();
        ctx.fill();
    }

    // ---- flashlight cone ---------------------------------------------------
    const grad = ctx.createRadialGradient(4, 0, 2, 60, 0, 120);
    grad.addColorStop(0, 'rgba(255,240,180,0.10)');
    grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(120, -35);
    ctx.lineTo(120, 35);
    ctx.closePath();
    ctx.fill();

    // ---- body (compact astronaut, oriented along facing) --------------------
    // Backpack (behind)
    ctx.fillStyle = 'rgba(80,80,100,0.8)';
    ctx.fillRect(-10, -5, 5, 10);

    // Suit body
    ctx.fillStyle = 'rgba(220,220,230,0.9)';
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Helmet (front)
    ctx.fillStyle = 'rgba(200,200,210,0.9)';
    ctx.beginPath();
    ctx.arc(6, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Visor
    ctx.fillStyle = 'rgba(0,220,255,0.7)';
    ctx.beginPath();
    ctx.arc(8, 0, 3.5, -0.8, 0.8);
    ctx.fill();

    // ---- limbs (floating pose) ---------------------------------------------
    ctx.strokeStyle = 'rgba(220,220,230,0.7)';
    ctx.lineWidth = 2;
    // Arms
    ctx.beginPath();
    ctx.moveTo(2, -5);
    ctx.lineTo(5, -9);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, 5);
    ctx.lineTo(5, 9);
    ctx.stroke();
    // Legs
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.lineTo(-9, -7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, 4);
    ctx.lineTo(-9, 7);
    ctx.stroke();

    ctx.restore();
}

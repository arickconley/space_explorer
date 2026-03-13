// ---------------------------------------------------------------------------
// player.js  --  player ship: state, update, rendering (thrust-based physics)
// ---------------------------------------------------------------------------

import { WORLD_SIZE, clamp } from './utils.js';
import { input } from './input.js';
import { camera } from './camera.js';
import { spawnProjectile } from './projectiles.js';

// ---- player singleton -----------------------------------------------------

export const player = {
    x: WORLD_SIZE / 2,
    y: WORLD_SIZE / 2,

    // Thrust-based physics
    rotation:      -Math.PI / 2,   // facing up
    vx:            0,
    vy:            0,
    thrust:        400,            // acceleration (px/s²) when W held
    rotationSpeed: 3.5,            // radians/s
    friction:      0.5,            // passive deceleration factor
    brakeForce:    3.0,            // extra deceleration when S held
    maxSpeed:      500,            // velocity magnitude cap

    speed:    300,                  // kept for permanent upgrade compatibility
    radius:   15,

    health:    100,
    maxHealth: 100,

    shield:           50,
    maxShield:        50,
    shieldRegenRate:  10,    // per second
    shieldRegenDelay: 3,     // seconds after last damage
    lastDamageTime:   0,

    fireRate:     0.25,      // seconds between shots
    lastFireTime: 0,
    damage:       10,
    bulletSpeed:  600,

    xp:       0,
    level:    1,
    xpToNext: 50,
    totalXp:  0,

    alive: true,

    weaponType: 'single',    // 'single' | 'spread' | 'laser' | 'missile'

    /** Temporary power-up effects: { type, duration, remaining } */
    activeEffects: [],

    /** Permanent meta-progression upgrade levels */
    permanentUpgrades: {
        maxHealth: 0,
        maxShield: 0,
        speed:     0,
        damage:    0,
        fireRate:  0,
    },

    /** Purchased crew skill tree nodes (persists across runs) */
    purchasedSkills: {},

    /** Coins currency (persists across runs, spent at planet markets) */
    coins: 0,

    /** Planet market upgrade levels (persist across runs) */
    marketUpgrades: {
        hull: 0, shield: 0, engine: 0, weapon: 0, cooling: 0,
    },
};

// ---- base stat values (before permanent upgrades) -------------------------

const BASE_STATS = {
    maxHealth:      100,
    maxShield:      50,
    speed:          300,
    damage:         10,
    fireRate:       0.25,
    thrust:         400,
    rotationSpeed:  3.5,
    friction:       0.5,
    brakeForce:     3.0,
    maxSpeed:       500,
};

// ---- public API -----------------------------------------------------------

/**
 * Reset the player for a new run.
 * Preserves permanentUpgrades and totalXp across runs.
 */
export function initPlayer() {
    player.x = WORLD_SIZE / 2;
    player.y = WORLD_SIZE / 2;

    player.rotation = -Math.PI / 2;   // facing up
    player.vx = 0;
    player.vy = 0;

    player.thrust        = BASE_STATS.thrust;
    player.rotationSpeed = BASE_STATS.rotationSpeed;
    player.friction      = BASE_STATS.friction;
    player.brakeForce    = BASE_STATS.brakeForce;
    player.maxSpeed      = BASE_STATS.maxSpeed;

    player.maxHealth = BASE_STATS.maxHealth;
    player.maxShield = BASE_STATS.maxShield;
    player.speed     = BASE_STATS.speed;
    player.damage    = BASE_STATS.damage;
    player.fireRate  = BASE_STATS.fireRate;

    applyPermanentUpgrades();

    player.health = player.maxHealth;
    player.shield = player.maxShield;

    player.radius          = 15;
    player.shieldRegenRate = 10;
    player.shieldRegenDelay = 3;
    player.lastDamageTime  = 0;
    player.lastFireTime    = 0;
    player.bulletSpeed     = 600;

    player.xp       = 0;
    player.level    = 1;
    player.xpToNext = 50;

    player.alive      = true;
    player.weaponType = 'single';
    player.activeEffects = [];
}

/**
 * Per-frame update: thrust physics, shooting, shield regen, effects.
 * Supports both keyboard (W/A/S/D + Space) and dual virtual joysticks.
 * @param {number} dt        Delta-time in seconds
 * @param {number} gameTime  Total elapsed game time in seconds
 */
export function updatePlayer(dt, gameTime) {
    if (!player.alive) return;

    const move = input.moveStick;
    const aim  = input.aimStick;

    // ========== MOVEMENT (keyboard + left joystick) ==========================

    // ---- rotation ---------------------------------------------------------
    if (move.active && move.dist > 0.15) {
        // Joystick: smoothly rotate toward the stick angle
        let target = move.angle;
        let diff = target - player.rotation;
        // Normalize to [-PI, PI]
        while (diff > Math.PI)  diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const turnAmount = player.rotationSpeed * 1.5 * dt;
        if (Math.abs(diff) < turnAmount) {
            player.rotation = target;
        } else {
            player.rotation += Math.sign(diff) * turnAmount;
        }
    }
    // Keyboard rotation
    if (input.isDown('a') || input.isDown('arrowleft')) {
        player.rotation -= player.rotationSpeed * dt;
    }
    if (input.isDown('d') || input.isDown('arrowright')) {
        player.rotation += player.rotationSpeed * dt;
    }

    // ---- thrust -----------------------------------------------------------
    let thrusting = false;

    if (move.active && move.dist > 0.15) {
        // Joystick: thrust proportional to stick distance
        const thrustPower = move.dist;
        player.vx += Math.cos(player.rotation) * player.thrust * thrustPower * dt;
        player.vy += Math.sin(player.rotation) * player.thrust * thrustPower * dt;
        thrusting = true;
    }
    if (input.isDown('w') || input.isDown('arrowup')) {
        player.vx += Math.cos(player.rotation) * player.thrust * dt;
        player.vy += Math.sin(player.rotation) * player.thrust * dt;
        thrusting = true;
    }
    // Store for draw
    player._thrusting = thrusting;

    // ---- brake (S = extra deceleration) -----------------------------------
    if (input.isDown('s') || input.isDown('arrowdown')) {
        const brakeMul = Math.max(0, 1 - player.brakeForce * dt);
        player.vx *= brakeMul;
        player.vy *= brakeMul;
    }

    // ---- passive friction -------------------------------------------------
    const frictionMul = Math.max(0, 1 - player.friction * dt);
    player.vx *= frictionMul;
    player.vy *= frictionMul;

    // ---- clamp speed to maxSpeed ------------------------------------------
    const speed = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    if (speed > player.maxSpeed) {
        const scale = player.maxSpeed / speed;
        player.vx *= scale;
        player.vy *= scale;
    }

    // ---- update position from velocity ------------------------------------
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // ---- clamp to world bounds (zero velocity on wall hit) ----------------
    const minB = player.radius;
    const maxB = WORLD_SIZE - player.radius;

    if (player.x < minB)  { player.x = minB; player.vx = 0; }
    if (player.x > maxB)  { player.x = maxB; player.vx = 0; }
    if (player.y < minB)  { player.y = minB; player.vy = 0; }
    if (player.y > maxB)  { player.y = maxB; player.vy = 0; }

    // ========== SHOOTING (disabled -- crew gunner handles combat) =============
    // Player shooting can be unlocked later as an upgrade.
    // const wantsFire = input.isDown(' ') || (aim.active && aim.dist > 0.2);
    //
    // if (wantsFire && gameTime - player.lastFireTime >= player.fireRate) {
    //     if (aim.active && aim.dist > 0.2) {
    //         _fireWeaponAtAngle(aim.angle, gameTime);
    //     } else {
    //         _fireWeapon(gameTime);
    //     }
    //     player.lastFireTime = gameTime;
    // }

    // ---- shield regeneration ----------------------------------------------
    if (gameTime - player.lastDamageTime >= player.shieldRegenDelay) {
        player.shield = Math.min(
            player.maxShield,
            player.shield + player.shieldRegenRate * dt,
        );
    }

    // ---- tick active effects ----------------------------------------------
    for (let i = player.activeEffects.length - 1; i >= 0; i--) {
        player.activeEffects[i].remaining -= dt;
        if (player.activeEffects[i].remaining <= 0) {
            player.activeEffects.splice(i, 1);
        }
    }
}

/**
 * Render the player ship and shield.
 * @param {CanvasRenderingContext2D} ctx
 * @param {typeof camera} cam
 */
export function drawPlayer(ctx, cam) {
    if (!player.alive) return;

    const scr = cam.worldToScreen(player.x, player.y);
    const ang = player.rotation;

    ctx.save();
    ctx.translate(scr.x, scr.y);
    ctx.rotate(ang);

    // ---- shield bubble ---------------------------------------------------
    if (player.shield > 0) {
        const shieldAlpha = 0.15 + 0.15 * (player.shield / player.maxShield);
        ctx.shadowBlur  = 18;
        ctx.shadowColor = '#0af';
        ctx.strokeStyle = `rgba(0,170,255,${shieldAlpha + 0.25})`;
        ctx.fillStyle   = `rgba(0,170,255,${shieldAlpha})`;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, player.radius + 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // ---- detailed spaceship --------------------------------------------------
    const r = player.radius;

    // ---- engine exhaust (when thrusting) --------------------------------
    if (player._thrusting) {
        const flicker = 1 + Math.random() * 0.4;
        const fl2 = 1 + Math.random() * 0.3;

        // Outer exhaust glow (orange)
        ctx.shadowBlur  = 14;
        ctx.shadowColor = '#f80';
        ctx.fillStyle   = 'rgba(255,120,0,0.35)';
        ctx.beginPath();
        ctx.moveTo(-r * 0.55, -r * 0.28);
        ctx.quadraticCurveTo(-r * (1.4 + 0.4 * flicker), 0, -r * 0.55, r * 0.28);
        ctx.closePath();
        ctx.fill();

        // Inner exhaust core (white-yellow)
        ctx.shadowBlur  = 8;
        ctx.shadowColor = '#ff0';
        ctx.fillStyle   = 'rgba(255,255,200,0.7)';
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.14);
        ctx.quadraticCurveTo(-r * (0.9 + 0.25 * fl2), 0, -r * 0.5, r * 0.14);
        ctx.closePath();
        ctx.fill();

        // Secondary engine pods (smaller flames on nacelles)
        for (const sign of [-1, 1]) {
            const ny = sign * r * 0.52;
            ctx.fillStyle = 'rgba(255,140,0,0.5)';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(-r * 0.7, ny - sign * r * 0.08);
            ctx.quadraticCurveTo(-r * (1.0 + 0.2 * fl2), ny, -r * 0.7, ny + sign * r * 0.08);
            ctx.closePath();
            ctx.fill();
        }
        ctx.shadowBlur = 0;
    }

    // ---- wing struts (behind main hull) ---------------------------------
    ctx.fillStyle   = '#066';
    ctx.strokeStyle = '#088';
    ctx.lineWidth   = 1;
    for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, sign * r * 0.15);
        ctx.lineTo(-r * 0.85, sign * r * 0.7);
        ctx.lineTo(-r * 0.75, sign * r * 0.55);
        ctx.lineTo(-r * 0.05, sign * r * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // ---- engine nacelles (pods on wing tips) ----------------------------
    ctx.fillStyle   = '#0aa';
    ctx.strokeStyle = '#0cc';
    ctx.lineWidth   = 1;
    for (const sign of [-1, 1]) {
        const ny = sign * r * 0.52;
        ctx.beginPath();
        ctx.moveTo(-r * 0.45, ny - r * 0.1);
        ctx.lineTo(-r * 0.7, ny - r * 0.08);
        ctx.lineTo(-r * 0.72, ny + r * 0.08);
        ctx.lineTo(-r * 0.45, ny + r * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // ---- main hull (central fuselage) -----------------------------------
    ctx.shadowBlur  = 12;
    ctx.shadowColor = '#0ff';

    // Dark hull base layer
    ctx.fillStyle = '#077';
    ctx.beginPath();
    ctx.moveTo(r * 1.3, 0);                       // nose tip
    ctx.lineTo(r * 0.3, -r * 0.32);               // upper nose slope
    ctx.lineTo(-r * 0.2, -r * 0.35);              // upper mid
    ctx.lineTo(-r * 0.55, -r * 0.28);             // upper rear
    ctx.lineTo(-r * 0.55, r * 0.28);              // lower rear
    ctx.lineTo(-r * 0.2, r * 0.35);               // lower mid
    ctx.lineTo(r * 0.3, r * 0.32);                // lower nose slope
    ctx.closePath();
    ctx.fill();

    // Light hull top layer (upper half highlight)
    ctx.fillStyle = '#0aa';
    ctx.beginPath();
    ctx.moveTo(r * 1.3, 0);
    ctx.lineTo(r * 0.3, -r * 0.32);
    ctx.lineTo(-r * 0.2, -r * 0.35);
    ctx.lineTo(-r * 0.55, -r * 0.28);
    ctx.lineTo(-r * 0.55, 0);
    ctx.lineTo(r * 1.3, 0);
    ctx.closePath();
    ctx.fill();

    // Hull outline
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(r * 1.3, 0);
    ctx.lineTo(r * 0.3, -r * 0.32);
    ctx.lineTo(-r * 0.2, -r * 0.35);
    ctx.lineTo(-r * 0.55, -r * 0.28);
    ctx.lineTo(-r * 0.55, r * 0.28);
    ctx.lineTo(-r * 0.2, r * 0.35);
    ctx.lineTo(r * 0.3, r * 0.32);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ---- wings (swept-back delta wings) ---------------------------------
    ctx.fillStyle   = '#088';
    ctx.strokeStyle = '#0cc';
    ctx.lineWidth   = 1;
    for (const sign of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(r * 0.15, sign * r * 0.3);       // wing root front
        ctx.lineTo(-r * 0.6, sign * r * 0.72);       // wing tip outer
        ctx.lineTo(-r * 0.85, sign * r * 0.7);       // wing tip back
        ctx.lineTo(-r * 0.45, sign * r * 0.28);      // wing root rear
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // ---- panel lines (hull detail) --------------------------------------
    ctx.strokeStyle = 'rgba(0,255,255,0.25)';
    ctx.lineWidth   = 0.5;
    // Center line
    ctx.beginPath();
    ctx.moveTo(r * 1.1, 0);
    ctx.lineTo(-r * 0.5, 0);
    ctx.stroke();
    // Cross panels
    ctx.beginPath();
    ctx.moveTo(r * 0.1, -r * 0.33);
    ctx.lineTo(r * 0.1, r * 0.33);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.3);
    ctx.lineTo(-r * 0.3, r * 0.3);
    ctx.stroke();

    // ---- cockpit canopy (glowing) ---------------------------------------
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#0ff';
    ctx.fillStyle   = 'rgba(0,255,255,0.35)';
    ctx.strokeStyle = '#0ff';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(r * 0.9, 0);
    ctx.lineTo(r * 0.35, -r * 0.15);
    ctx.lineTo(r * 0.15, -r * 0.12);
    ctx.lineTo(r * 0.15, r * 0.12);
    ctx.lineTo(r * 0.35, r * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cockpit glint
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(r * 0.75, -r * 0.02);
    ctx.lineTo(r * 0.45, -r * 0.1);
    ctx.lineTo(r * 0.4, -r * 0.06);
    ctx.lineTo(r * 0.7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // ---- running lights (wing tips + nose) ------------------------------
    const t = performance.now() * 0.003;
    const blink = Math.sin(t) > 0 ? 1 : 0.2;

    // Wing tip lights (red port, green starboard)
    ctx.globalAlpha = blink;
    ctx.fillStyle = '#f44';
    ctx.beginPath();
    ctx.arc(-r * 0.8, -r * 0.7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#4f4';
    ctx.beginPath();
    ctx.arc(-r * 0.8, r * 0.7, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Nose light (white, steady)
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 4;
    ctx.shadowColor = '#fff';
    ctx.beginPath();
    ctx.arc(r * 1.25, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Rear lights (amber, by engines)
    ctx.fillStyle = '#fa0';
    ctx.shadowColor = '#f80';
    ctx.beginPath();
    ctx.arc(-r * 0.55, -r * 0.15, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-r * 0.55, r * 0.15, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
}

/**
 * Apply damage to the player. Shield absorbs first, then health.
 * @param {number} amount    Damage points
 * @param {number} gameTime  Current game time (for regen delay)
 */
export function damagePlayer(amount, gameTime) {
    if (!player.alive) return;

    player.lastDamageTime = gameTime;

    if (player.shield > 0) {
        const absorbed = Math.min(player.shield, amount);
        player.shield -= absorbed;
        amount -= absorbed;
    }

    player.health -= amount;

    if (player.health <= 0) {
        player.health = 0;
        player.alive = false;
    }
}

/**
 * Award XP to the player and check for level-up.
 * @param {number} amount
 * @returns {boolean} true if the player levelled up
 */
export function addXp(amount) {
    player.xp      += amount;
    player.totalXp += amount;

    let levelled = false;
    while (player.xp >= player.xpToNext) {
        player.xp -= player.xpToNext;
        player.level += 1;
        // Each level requires progressively more XP
        player.xpToNext = Math.floor(50 * Math.pow(1.15, player.level - 1));
        levelled = true;
    }
    return levelled;
}

/**
 * Apply permanent upgrade bonuses to the player's base stats.
 * Each upgrade level provides a fixed bonus.
 */
export function applyPermanentUpgrades() {
    const u = player.permanentUpgrades;
    player.maxHealth += u.maxHealth * 10;      // +10 HP per level
    player.maxShield += u.maxShield * 5;       // +5 shield per level
    player.speed     += u.speed * 15;          // +15 speed per level
    player.damage    += u.damage * 2;          // +2 damage per level
    player.fireRate   = Math.max(0.05, player.fireRate - u.fireRate * 0.02); // slightly faster

    // Market upgrades (from planet shops)
    const m = player.marketUpgrades;
    player.maxHealth += m.hull * 10;
    player.maxShield += m.shield * 5;
    player.speed     += m.engine * 15;
    player.damage    += m.weapon * 3;
    player.fireRate   = Math.max(0.05, player.fireRate - m.cooling * 0.0125);
}

// ---- internal helpers -----------------------------------------------------

/**
 * Fire the current weapon in the direction the ship is facing.
 * @param {number} gameTime
 */
function _fireWeapon(gameTime) {
    const dirX = Math.cos(player.rotation);
    const dirY = Math.sin(player.rotation);
    const spawnDist = player.radius + 6;
    const ox = player.x + dirX * spawnDist;
    const oy = player.y + dirY * spawnDist;

    const baseOpts = {
        damage: player.damage,
        owner:  'player',
        color:  '#0ff',
    };

    switch (player.weaponType) {
        case 'spread': {
            const spreadAngle = 0.18; // ~10 degrees
            const base = player.rotation;
            for (let i = -1; i <= 1; i++) {
                const a = base + i * spreadAngle;
                spawnProjectile(
                    ox, oy,
                    Math.cos(a) * player.bulletSpeed,
                    Math.sin(a) * player.bulletSpeed,
                    { ...baseOpts, damage: Math.ceil(player.damage * 0.7) },
                );
            }
            break;
        }

        case 'laser':
            spawnProjectile(
                ox, oy,
                dirX * player.bulletSpeed * 1.6,
                dirY * player.bulletSpeed * 1.6,
                { ...baseOpts, radius: 2, color: '#f0f', maxLife: 1.5 },
            );
            break;

        case 'missile':
            spawnProjectile(
                ox, oy,
                dirX * player.bulletSpeed * 0.7,
                dirY * player.bulletSpeed * 0.7,
                { ...baseOpts, radius: 5, damage: player.damage * 2, color: '#fa0', maxLife: 4 },
            );
            break;

        case 'single':
        default:
            spawnProjectile(
                ox, oy,
                dirX * player.bulletSpeed,
                dirY * player.bulletSpeed,
                baseOpts,
            );
            break;
    }
}

/**
 * Fire the current weapon at a specific angle (used by right joystick).
 * @param {number} angle     Firing angle in radians
 * @param {number} gameTime
 */
function _fireWeaponAtAngle(angle, gameTime) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const spawnDist = player.radius + 6;
    const ox = player.x + dirX * spawnDist;
    const oy = player.y + dirY * spawnDist;

    const baseOpts = {
        damage: player.damage,
        owner:  'player',
        color:  '#0ff',
    };

    switch (player.weaponType) {
        case 'spread': {
            const spreadAngle = 0.18;
            for (let i = -1; i <= 1; i++) {
                const a = angle + i * spreadAngle;
                spawnProjectile(
                    ox, oy,
                    Math.cos(a) * player.bulletSpeed,
                    Math.sin(a) * player.bulletSpeed,
                    { ...baseOpts, damage: Math.ceil(player.damage * 0.7) },
                );
            }
            break;
        }
        case 'laser':
            spawnProjectile(
                ox, oy,
                dirX * player.bulletSpeed * 1.6,
                dirY * player.bulletSpeed * 1.6,
                { ...baseOpts, radius: 2, color: '#f0f', maxLife: 1.5 },
            );
            break;
        case 'missile':
            spawnProjectile(
                ox, oy,
                dirX * player.bulletSpeed * 0.7,
                dirY * player.bulletSpeed * 0.7,
                { ...baseOpts, radius: 5, damage: player.damage * 2, color: '#fa0', maxLife: 4 },
            );
            break;
        case 'single':
        default:
            spawnProjectile(
                ox, oy,
                dirX * player.bulletSpeed,
                dirY * player.bulletSpeed,
                baseOpts,
            );
            break;
    }
}

// ---------------------------------------------------------------------------
// powerups.js  --  power-up drop & collection system
// ---------------------------------------------------------------------------

import { randomRange, circleCollision } from './utils.js';
import { addSpareParts } from './crew.js';

/** Active power-ups on the map. */
export const powerups = [];

// ---- power-up type definitions --------------------------------------------

const POWERUP_TYPES = [
    { type: 'rapidFire',  color: '#ff0',  label: 'R' },
    { type: 'speedBoost', color: '#0f0',  label: 'S' },
    { type: 'shield',     color: '#0af',  label: 'H' },
    { type: 'health',     color: '#f6a',  label: '+' },
    { type: 'spreadShot', color: '#f80',  label: 'W' },
    { type: 'damage',     color: '#c0f',  label: 'D' },
    { type: 'spareParts', color: '#a86',  label: 'P' },
];

/** Maximum lifetime of a power-up before it despawns (seconds). */
const POWERUP_LIFESPAN = 30;

// ---- public API -----------------------------------------------------------

/**
 * Spawn a random power-up at the given world position.
 *
 * @param {number} x  World x
 * @param {number} y  World y
 */
export function spawnPowerup(x, y) {
    const def = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({
        x,
        y,
        type:      def.type,
        radius:    12,
        color:     def.color,
        label:     def.label,
        bobOffset: Math.random() * Math.PI * 2,
        spawnTime: 0, // will be set by caller or default to 0
    });
}

/**
 * Update all power-ups: bob animation and despawn timer.
 *
 * @param {number} dt        Delta-time in seconds
 * @param {number} gameTime  Total elapsed game time in seconds
 */
export function updatePowerups(dt, gameTime) {
    for (let i = powerups.length - 1; i >= 0; i--) {
        const p = powerups[i];

        // Initialize spawnTime on first update if not set
        if (p.spawnTime === 0) {
            p.spawnTime = gameTime;
        }

        // Remove if too old
        if (gameTime - p.spawnTime > POWERUP_LIFESPAN) {
            powerups.splice(i, 1);
        }
    }
}

/**
 * Draw all power-ups as glowing icons with pulsing effect.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./camera.js').camera} camera
 */
export function drawPowerups(ctx, camera) {
    const time = performance.now() / 1000;

    ctx.save();

    for (let i = 0; i < powerups.length; i++) {
        const p   = powerups[i];
        // Bob up and down
        const bob = Math.sin(time * 3 + p.bobOffset) * 4;
        const scr = camera.worldToScreen(p.x, p.y + bob);

        // Skip if off-screen
        if (
            scr.x < -30 || scr.x > camera.width + 30 ||
            scr.y < -30 || scr.y > camera.height + 30
        ) {
            continue;
        }

        // Pulsing glow intensity
        const pulse = 0.6 + 0.4 * Math.sin(time * 4 + p.bobOffset);

        // Outer glow ring
        ctx.shadowBlur  = 16 * pulse;
        ctx.shadowColor = p.color;
        ctx.strokeStyle = p.color;
        ctx.lineWidth   = 2;
        ctx.globalAlpha = 0.4 + 0.3 * pulse;

        ctx.beginPath();
        ctx.arc(scr.x, scr.y, p.radius + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Filled circle background
        ctx.globalAlpha = 0.15 + 0.1 * pulse;
        ctx.fillStyle   = p.color;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner circle border
        ctx.globalAlpha = 0.7 + 0.3 * pulse;
        ctx.lineWidth   = 1.5;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Draw type-specific icon shape
        ctx.globalAlpha = 0.9;
        ctx.fillStyle   = p.color;
        ctx.shadowBlur  = 10;
        _drawPowerupIcon(ctx, scr.x, scr.y, p);

        ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    ctx.restore();
}

/**
 * Apply a collected power-up's effect to the player.
 *
 * @param {object} powerup   The powerup object
 * @param {object} player    The player object (passed to avoid circular deps)
 * @param {number} gameTime  Current game time
 */
export function applyPowerup(powerup, player, gameTime) {
    switch (powerup.type) {
        case 'rapidFire':
            // Remove existing rapidFire effect before stacking
            _removeEffect(player, 'rapidFire');
            player.activeEffects.push({
                type:      'rapidFire',
                duration:  10,
                remaining: 10,
            });
            player.fireRate *= 0.5; // double fire rate (halve interval)
            break;

        case 'speedBoost':
            _removeEffect(player, 'speedBoost');
            player.activeEffects.push({
                type:      'speedBoost',
                duration:  8,
                remaining: 8,
            });
            player.speed *= 1.5;
            break;

        case 'shield':
            player.shield = player.maxShield;
            break;

        case 'health':
            player.health = Math.min(player.maxHealth, player.health + 25);
            break;

        case 'spreadShot':
            _removeEffect(player, 'spreadShot');
            player.activeEffects.push({
                type:      'spreadShot',
                duration:  12,
                remaining: 12,
                prevWeapon: player.weaponType,
            });
            player.weaponType = 'spread';
            break;

        case 'damage':
            _removeEffect(player, 'damage');
            player.activeEffects.push({
                type:      'damage',
                duration:  10,
                remaining: 10,
            });
            player.damage *= 2;
            break;

        case 'spareParts':
            addSpareParts(3);
            break;
    }
}

/**
 * Check if the player overlaps any power-up. Collect and apply overlapping
 * power-ups, removing them from the array.
 *
 * @param {object} player    The player object
 * @param {number} gameTime  Current game time
 * @returns {string[]}  Array of collected powerup type strings
 */
export function checkPowerupCollection(player, gameTime) {
    const collected = [];

    for (let i = powerups.length - 1; i >= 0; i--) {
        if (circleCollision(player, powerups[i])) {
            const pu = powerups[i];
            applyPowerup(pu, player, gameTime);
            collected.push(pu.type);
            powerups.splice(i, 1);
        }
    }

    return collected;
}

// ---- internal helpers -----------------------------------------------------

/**
 * Remove an existing active effect of the given type from the player,
 * reverting its stat change so it can be cleanly re-applied.
 */
function _removeEffect(player, type) {
    for (let i = player.activeEffects.length - 1; i >= 0; i--) {
        const eff = player.activeEffects[i];
        if (eff.type !== type) continue;

        // Revert the stat change
        switch (type) {
            case 'rapidFire':
                player.fireRate /= 0.5;
                break;
            case 'speedBoost':
                player.speed /= 1.5;
                break;
            case 'spreadShot':
                player.weaponType = eff.prevWeapon || 'single';
                break;
            case 'damage':
                player.damage /= 2;
                break;
        }

        player.activeEffects.splice(i, 1);
    }
}

/**
 * Draw a small icon/shape inside the power-up circle based on its type.
 */
function _drawPowerupIcon(ctx, sx, sy, powerup) {
    const r = powerup.radius * 0.5;

    switch (powerup.type) {
        case 'rapidFire':
            // Double arrows (fast-forward style)
            ctx.strokeStyle = powerup.color;
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.moveTo(sx - r * 0.6, sy - r * 0.6);
            ctx.lineTo(sx + r * 0.2, sy);
            ctx.lineTo(sx - r * 0.6, sy + r * 0.6);
            ctx.moveTo(sx - r * 0.1, sy - r * 0.6);
            ctx.lineTo(sx + r * 0.7, sy);
            ctx.lineTo(sx - r * 0.1, sy + r * 0.6);
            ctx.stroke();
            break;

        case 'speedBoost':
            // Lightning bolt
            ctx.beginPath();
            ctx.moveTo(sx + r * 0.1, sy - r);
            ctx.lineTo(sx - r * 0.4, sy + r * 0.1);
            ctx.lineTo(sx + r * 0.1, sy + r * 0.1);
            ctx.lineTo(sx - r * 0.1, sy + r);
            ctx.lineTo(sx + r * 0.4, sy - r * 0.1);
            ctx.lineTo(sx - r * 0.1, sy - r * 0.1);
            ctx.closePath();
            ctx.fill();
            break;

        case 'shield':
            // Small shield shape
            ctx.strokeStyle = powerup.color;
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.moveTo(sx, sy - r);
            ctx.lineTo(sx + r * 0.8, sy - r * 0.4);
            ctx.lineTo(sx + r * 0.6, sy + r * 0.5);
            ctx.lineTo(sx, sy + r);
            ctx.lineTo(sx - r * 0.6, sy + r * 0.5);
            ctx.lineTo(sx - r * 0.8, sy - r * 0.4);
            ctx.closePath();
            ctx.stroke();
            break;

        case 'health':
            // Plus / cross
            ctx.fillStyle = powerup.color;
            ctx.fillRect(sx - r * 0.2, sy - r * 0.7, r * 0.4, r * 1.4);
            ctx.fillRect(sx - r * 0.7, sy - r * 0.2, r * 1.4, r * 0.4);
            break;

        case 'spreadShot':
            // Three diverging lines (spread pattern)
            ctx.strokeStyle = powerup.color;
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.moveTo(sx - r * 0.5, sy);
            ctx.lineTo(sx + r * 0.7, sy - r * 0.7);
            ctx.moveTo(sx - r * 0.5, sy);
            ctx.lineTo(sx + r * 0.7, sy);
            ctx.moveTo(sx - r * 0.5, sy);
            ctx.lineTo(sx + r * 0.7, sy + r * 0.7);
            ctx.stroke();
            break;

        case 'damage':
            // Star / burst
            ctx.beginPath();
            for (let j = 0; j < 5; j++) {
                const a1 = (j / 5) * Math.PI * 2 - Math.PI / 2;
                const a2 = ((j + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
                const outerR = r * 0.9;
                const innerR = r * 0.35;
                if (j === 0) {
                    ctx.moveTo(sx + Math.cos(a1) * outerR, sy + Math.sin(a1) * outerR);
                } else {
                    ctx.lineTo(sx + Math.cos(a1) * outerR, sy + Math.sin(a1) * outerR);
                }
                ctx.lineTo(sx + Math.cos(a2) * innerR, sy + Math.sin(a2) * innerR);
            }
            ctx.closePath();
            ctx.fill();
            break;

        case 'spareParts':
            // Wrench / gear shape
            ctx.strokeStyle = powerup.color;
            ctx.lineWidth   = 2;
            ctx.beginPath();
            // Simple wrench icon
            ctx.moveTo(sx - r * 0.6, sy + r * 0.6);
            ctx.lineTo(sx + r * 0.2, sy - r * 0.2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(sx + r * 0.35, sy - r * 0.35, r * 0.35, 0, Math.PI * 2);
            ctx.stroke();
            break;
    }
}

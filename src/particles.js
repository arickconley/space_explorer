// ---------------------------------------------------------------------------
// particles.js  --  neon glow particle effects system
// ---------------------------------------------------------------------------

import { randomRange } from './utils.js';

/** Active particles. */
export const particles = [];

/**
 * Spawn an explosion burst of particles outward from a point.
 * Used for enemy death, asteroid destruction, etc.
 *
 * @param {number} x       World x
 * @param {number} y       World y
 * @param {string} color   CSS color for the particles
 * @param {number} count   Number of particles to spawn
 * @param {number} speed   Max outward speed (pixels/sec)
 */
export function spawnExplosion(x, y, color, count = 20, speed = 200) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd   = randomRange(speed * 0.3, speed);
        const life  = randomRange(0.4, 1.0);
        particles.push({
            x,
            y,
            vx:      Math.cos(angle) * spd,
            vy:      Math.sin(angle) * spd,
            life,
            maxLife: life,
            radius:  randomRange(1.5, 4),
            color,
            alpha:   1,
        });
    }
}

/**
 * Spawn a small burst of sparks for bullet impacts.
 *
 * @param {number} x       World x
 * @param {number} y       World y
 * @param {string} color   CSS color
 * @param {number} count   Number of sparks
 */
export function spawnHitSparks(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd   = randomRange(40, 120);
        const life  = randomRange(0.15, 0.4);
        particles.push({
            x,
            y,
            vx:      Math.cos(angle) * spd,
            vy:      Math.sin(angle) * spd,
            life,
            maxLife: life,
            radius:  randomRange(0.8, 2),
            color,
            alpha:   1,
        });
    }
}

/**
 * Spawn a single small particle for engine / thruster trails.
 *
 * @param {number} x       World x
 * @param {number} y       World y
 * @param {string} color   CSS color
 */
export function spawnTrail(x, y, color) {
    const life = randomRange(0.15, 0.35);
    particles.push({
        x:       x + randomRange(-2, 2),
        y:       y + randomRange(-2, 2),
        vx:      randomRange(-15, 15),
        vy:      randomRange(-15, 15),
        life,
        maxLife: life,
        radius:  randomRange(1, 2.5),
        color,
        alpha:   0.8,
    });
}

/**
 * Update all particles: move, age, and remove dead ones.
 *
 * @param {number} dt  Delta-time in seconds
 */
export function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x    += p.vx * dt;
        p.y    += p.vy * dt;
        p.life -= dt;

        // Fade alpha proportionally to remaining life
        p.alpha = Math.max(0, p.life / p.maxLife);

        // Slow down over time (drag)
        p.vx *= 1 - 2 * dt;
        p.vy *= 1 - 2 * dt;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

/**
 * Draw all particles as glowing dots that fade out.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('./camera.js').camera} camera
 */
export function drawParticles(ctx, camera) {
    ctx.save();

    for (let i = 0; i < particles.length; i++) {
        const p   = particles[i];
        const scr = camera.worldToScreen(p.x, p.y);

        // Skip particles outside the viewport (with margin)
        if (
            scr.x < -20 || scr.x > camera.width + 20 ||
            scr.y < -20 || scr.y > camera.height + 20
        ) {
            continue;
        }

        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur  = 8 + p.radius * 2;
        ctx.shadowColor = p.color;
        ctx.fillStyle   = p.color;

        ctx.beginPath();
        ctx.arc(scr.x, scr.y, p.radius * p.alpha, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.restore();
}

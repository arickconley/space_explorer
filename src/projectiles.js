// ---------------------------------------------------------------------------
// projectiles.js  --  projectile system for players and enemies
// ---------------------------------------------------------------------------

import { camera } from './camera.js';

/** All active projectiles in the world. */
export const projectiles = [];

/**
 * Create a new projectile and add it to the active list.
 *
 * @param {number} x       World x spawn position
 * @param {number} y       World y spawn position
 * @param {number} vx      Velocity x (pixels / second)
 * @param {number} vy      Velocity y (pixels / second)
 * @param {object} [opts]  Optional overrides
 * @param {number}  [opts.damage=10]
 * @param {number}  [opts.radius=3]
 * @param {string}  [opts.color='#0ff']
 * @param {string}  [opts.owner='player']  'player' | 'enemy'
 * @param {number}  [opts.maxLife=3]        Lifetime in seconds
 * @returns {object} The newly created projectile
 */
export function spawnProjectile(x, y, vx, vy, opts = {}) {
    const p = {
        x,
        y,
        vx,
        vy,
        radius:  opts.radius  ?? 3,
        damage:  opts.damage  ?? 10,
        owner:   opts.owner   ?? 'player',
        color:   opts.color   ?? '#0ff',
        life:    opts.maxLife  ?? 3,
        maxLife: opts.maxLife  ?? 3,
    };
    projectiles.push(p);
    return p;
}

/**
 * Advance every projectile, decrement lifetime, and cull dead ones.
 * @param {number} dt  Delta-time in seconds
 */
export function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;

        if (p.life <= 0) {
            projectiles.splice(i, 1);
        }
    }
}

/**
 * Render every projectile as a glowing neon dot with a short motion trail.
 * @param {CanvasRenderingContext2D} ctx
 * @param {typeof camera} cam
 */
export function drawProjectiles(ctx, cam) {
    ctx.save();

    for (let i = 0; i < projectiles.length; i++) {
        const p = projectiles[i];

        // Skip projectiles that are off-screen (with a small margin)
        if (!cam.isVisible(p.x, p.y, 40)) continue;

        const scr = cam.worldToScreen(p.x, p.y);

        // Fade out as the projectile nears end-of-life
        const alpha = Math.min(1, p.life / 0.3);

        // --- motion trail (short line opposite to velocity) ---------------
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 0) {
            const trailLen = Math.min(speed * 0.04, 20); // proportional trail
            const tx = scr.x - (p.vx / speed) * trailLen;
            const ty = scr.y - (p.vy / speed) * trailLen;

            ctx.shadowBlur  = 8;
            ctx.shadowColor = p.color;
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = alpha * 0.6;
            ctx.lineWidth   = p.radius * 0.8;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(scr.x, scr.y);
            ctx.stroke();
        }

        // --- bright core dot ----------------------------------------------
        ctx.shadowBlur  = 14;
        ctx.shadowColor = p.color;
        ctx.globalAlpha = alpha;
        ctx.fillStyle   = '#fff';
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // Coloured outer ring
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath();
        ctx.arc(scr.x, scr.y, p.radius * 1.6, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

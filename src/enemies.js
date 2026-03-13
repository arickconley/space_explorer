// ---------------------------------------------------------------------------
// enemies.js  --  enemy spawning, AI, and rendering
// ---------------------------------------------------------------------------

import {
    distance, angle, randomRange, randomInt,
    WORLD_SIZE, circleCollision, normalize,
} from './utils.js';
import { camera }         from './camera.js';
import { spawnProjectile } from './projectiles.js';

// ── constants ───────────────────────────────────────────────────────────────

const ENEMY_DEFS = {
    chaser: {
        speed:          120,
        hp:             20,
        radius:         12,
        xpReward:       5,
        color:          '#0ef',       // cyan
        glowColor:      '#0cf',
        fireRate:       Infinity,
        detectionRange: 500,
        minDifficulty:  0,
    },
    shooter: {
        speed:          80,
        hp:             30,
        radius:         14,
        xpReward:       10,
        color:          '#f90',       // orange
        glowColor:      '#fa0',
        fireRate:       2,            // seconds between shots
        detectionRange: 600,
        minDifficulty:  2,
    },
    tank: {
        speed:          50,
        hp:             100,
        radius:         25,
        xpReward:       20,
        color:          '#f22',       // red
        glowColor:      '#f44',
        fireRate:       Infinity,
        detectionRange: 450,
        minDifficulty:  4,
    },
    swarm: {
        speed:          200,
        hp:             10,
        radius:         8,
        xpReward:       2,
        color:          '#0f4',       // green
        glowColor:      '#0f6',
        fireRate:       Infinity,
        detectionRange: 400,
        minDifficulty:  3,  // spawned in groups at difficulty 3+
    },
};

const TWO_PI = Math.PI * 2;

// ── live enemy list ─────────────────────────────────────────────────────────

/** @type {Array<object>} */
export const enemies = [];

// ── helpers ─────────────────────────────────────────────────────────────────

function randomPatrolTarget(cx, cy) {
    return {
        x: Math.max(100, Math.min(WORLD_SIZE - 100, cx + randomRange(-400, 400))),
        y: Math.max(100, Math.min(WORLD_SIZE - 100, cy + randomRange(-400, 400))),
    };
}

// ── spawning ────────────────────────────────────────────────────────────────

/**
 * Create a single enemy and push it into the live list.
 *
 * @param {'chaser'|'shooter'|'tank'|'swarm'} type
 * @param {number} x        World x
 * @param {number} y        World y
 * @param {number} difficulty  Current game difficulty (scales HP)
 */
export function spawnEnemy(type, x, y, difficulty) {
    const def   = ENEMY_DEFS[type];
    const scale = 1 + difficulty * 0.1;

    const e = {
        x,
        y,
        vx:            0,
        vy:            0,
        type,
        hp:            Math.round(def.hp * scale),
        maxHp:         Math.round(def.hp * scale),
        radius:        def.radius,
        speed:         def.speed,
        color:         def.color,
        glowColor:     def.glowColor,
        xpReward:      def.xpReward,
        fireRate:      def.fireRate,
        lastFireTime:  0,
        state:         'patrol',
        patrolTarget:  randomPatrolTarget(x, y),
        detectionRange: def.detectionRange,
    };

    enemies.push(e);
    return e;
}

// ── update ──────────────────────────────────────────────────────────────────

/**
 * Tick every enemy.
 *
 * @param {number} dt        Delta-time in seconds
 * @param {number} playerX   Player world x
 * @param {number} playerY   Player world y
 * @param {number} gameTime  Elapsed game time in seconds
 * @param {number} difficulty
 */
export function updateEnemies(dt, playerX, playerY, gameTime, difficulty) {
    const player = { x: playerX, y: playerY };

    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];

        // --- remove dead enemies -------------------------------------------
        if (e.hp <= 0) {
            enemies.splice(i, 1);
            continue;
        }

        const dist = distance(e, player);

        // --- state transition -----------------------------------------------
        if (dist <= e.detectionRange) {
            e.state = 'chase';
        } else if (e.state === 'chase' && dist > e.detectionRange * 1.4) {
            // hysteresis so they don't flicker
            e.state = 'patrol';
        }

        // --- movement -------------------------------------------------------
        if (e.state === 'chase') {
            if (e.type === 'shooter') {
                updateShooter(e, player, dt, gameTime, difficulty);
            } else {
                // chase directly toward player
                const dir = normalize(playerX - e.x, playerY - e.y);
                e.vx = dir.x * e.speed;
                e.vy = dir.y * e.speed;
            }
        } else {
            // patrol toward random target
            const pd = distance(e, e.patrolTarget);
            if (pd < 20) {
                e.patrolTarget = randomPatrolTarget(e.x, e.y);
            }
            const dir = normalize(e.patrolTarget.x - e.x, e.patrolTarget.y - e.y);
            e.vx = dir.x * e.speed * 0.5;
            e.vy = dir.y * e.speed * 0.5;
        }

        e.x += e.vx * dt;
        e.y += e.vy * dt;

        // --- clamp to world bounds ------------------------------------------
        e.x = Math.max(e.radius, Math.min(WORLD_SIZE - e.radius, e.x));
        e.y = Math.max(e.radius, Math.min(WORLD_SIZE - e.radius, e.y));
    }
}

/**
 * Shooter-specific AI: keep distance, strafe, and fire.
 */
function updateShooter(e, player, dt, gameTime, difficulty) {
    const dist = distance(e, player);
    const ang  = angle(e, player);

    // Desired range band: 200-350
    let radialSpeed = 0;
    if (dist < 200) {
        radialSpeed = -e.speed;        // back away
    } else if (dist > 350) {
        radialSpeed = e.speed;         // close in
    }

    // Strafe perpendicular
    const strafeSpeed = e.speed * 0.7;

    e.vx = Math.cos(ang) * radialSpeed + Math.cos(ang + Math.PI / 2) * strafeSpeed;
    e.vy = Math.sin(ang) * radialSpeed + Math.sin(ang + Math.PI / 2) * strafeSpeed;

    // Fire at player
    if (gameTime - e.lastFireTime >= e.fireRate) {
        e.lastFireTime = gameTime;
        const bulletSpeed = 350;
        const bvx = Math.cos(ang) * bulletSpeed;
        const bvy = Math.sin(ang) * bulletSpeed;
        const dmg = Math.round(8 * (1 + difficulty * 0.1));

        spawnProjectile(e.x, e.y, bvx, bvy, {
            damage:  dmg,
            radius:  4,
            color:   '#fa0',
            owner:   'enemy',
            maxLife: 2.5,
        });
    }
}

// ── drawing helpers ─────────────────────────────────────────────────────────

function drawDiamond(ctx, sx, sy, r) {
    ctx.beginPath();
    ctx.moveTo(sx,     sy - r);
    ctx.lineTo(sx + r, sy);
    ctx.lineTo(sx,     sy + r);
    ctx.lineTo(sx - r, sy);
    ctx.closePath();
}

function drawHexagon(ctx, sx, sy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = TWO_PI * i / 6 - Math.PI / 6;
        const px = sx + Math.cos(a) * r;
        const py = sy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else         ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function drawPentagon(ctx, sx, sy, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a = TWO_PI * i / 5 - Math.PI / 2;
        const px = sx + Math.cos(a) * r;
        const py = sy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else         ctx.lineTo(px, py);
    }
    ctx.closePath();
}

function drawTriangle(ctx, sx, sy, r) {
    ctx.beginPath();
    ctx.moveTo(sx,           sy - r);
    ctx.lineTo(sx + r * 0.9, sy + r * 0.7);
    ctx.lineTo(sx - r * 0.9, sy + r * 0.7);
    ctx.closePath();
}

// ── main draw ───────────────────────────────────────────────────────────────

/**
 * Render every visible enemy with neon glow.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {typeof camera} cam
 */
export function drawEnemies(ctx, cam) {
    ctx.save();

    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];

        // cull off-screen
        if (!cam.isVisible(e.x, e.y, e.radius + 30)) continue;

        const scr = cam.worldToScreen(e.x, e.y);
        const sx  = scr.x;
        const sy  = scr.y;

        // --- glow setup ----------------------------------------------------
        ctx.shadowBlur  = 18;
        ctx.shadowColor = e.glowColor;
        ctx.globalAlpha = 1;

        // --- shape ---------------------------------------------------------
        switch (e.type) {
            case 'chaser':
                drawDiamond(ctx, sx, sy, e.radius);
                ctx.fillStyle   = e.color;
                ctx.fill();
                ctx.shadowBlur  = 10;
                ctx.strokeStyle = '#fff';
                ctx.lineWidth   = 1.5;
                ctx.stroke();
                break;

            case 'shooter':
                drawHexagon(ctx, sx, sy, e.radius);
                ctx.fillStyle   = e.color;
                ctx.fill();
                ctx.shadowBlur  = 12;
                ctx.strokeStyle = '#ffe0a0';
                ctx.lineWidth   = 1.5;
                ctx.stroke();
                // inner dot (cannon indicator)
                ctx.beginPath();
                ctx.arc(sx, sy, 3, 0, TWO_PI);
                ctx.fillStyle = '#fff';
                ctx.fill();
                break;

            case 'tank':
                drawPentagon(ctx, sx, sy, e.radius);
                ctx.fillStyle   = e.color;
                ctx.fill();
                ctx.shadowBlur  = 20;
                ctx.strokeStyle = '#f88';
                ctx.lineWidth   = 3;
                ctx.stroke();
                // inner ring
                ctx.beginPath();
                ctx.arc(sx, sy, e.radius * 0.45, 0, TWO_PI);
                ctx.strokeStyle = '#faa';
                ctx.lineWidth   = 2;
                ctx.stroke();
                break;

            case 'swarm':
                drawTriangle(ctx, sx, sy, e.radius);
                ctx.fillStyle   = e.color;
                ctx.fill();
                ctx.shadowBlur  = 8;
                ctx.strokeStyle = '#afa';
                ctx.lineWidth   = 1;
                ctx.stroke();
                break;
        }

        // --- HP bar (only when damaged) ------------------------------------
        if (e.hp < e.maxHp) {
            const barW = e.radius * 2.4;
            const barH = 3;
            const barX = sx - barW / 2;
            const barY = sy - e.radius - 10;
            const ratio = e.hp / e.maxHp;

            ctx.shadowBlur  = 0;
            ctx.globalAlpha = 0.5;
            ctx.fillStyle   = '#333';
            ctx.fillRect(barX, barY, barW, barH);

            ctx.globalAlpha = 0.9;
            ctx.fillStyle   = ratio > 0.5 ? '#0f0' : ratio > 0.25 ? '#ff0' : '#f00';
            ctx.fillRect(barX, barY, barW * ratio, barH);
        }
    }

    ctx.restore();
}

// ── wave spawning ───────────────────────────────────────────────────────────

/**
 * Seconds between spawn waves (decreases with difficulty).
 * @param {number} difficulty
 * @returns {number}
 */
export function getSpawnRate(difficulty) {
    return Math.max(1.5, 6 - difficulty * 0.4);
}

/**
 * Spawn a wave of enemies around the player.
 *
 * @param {number} playerX
 * @param {number} playerY
 * @param {number} difficulty
 * @param {number} gameTime
 */
export function spawnWave(playerX, playerY, difficulty, gameTime) {
    // Build list of types available at this difficulty
    const available = ['chaser'];
    if (difficulty >= 2) available.push('shooter');
    if (difficulty >= 3) available.push('swarm');
    if (difficulty >= 4) available.push('tank');

    // How many enemies this wave
    const count = randomInt(1, 2 + Math.floor(difficulty * 0.4));

    for (let i = 0; i < count; i++) {
        const type = available[randomInt(0, available.length - 1)];

        // Spawn in a ring 500-1500 units away from the player
        const spawnAngle = randomRange(0, TWO_PI);
        const spawnDist  = randomRange(500, 1500);
        let sx = playerX + Math.cos(spawnAngle) * spawnDist;
        let sy = playerY + Math.sin(spawnAngle) * spawnDist;

        // Clamp to world
        sx = Math.max(50, Math.min(WORLD_SIZE - 50, sx));
        sy = Math.max(50, Math.min(WORLD_SIZE - 50, sy));

        // Swarm spawns extra friends in a tight cluster
        if (type === 'swarm') {
            const groupSize = randomInt(3, 5);
            for (let g = 0; g < groupSize; g++) {
                const ox = randomRange(-40, 40);
                const oy = randomRange(-40, 40);
                const gx = Math.max(50, Math.min(WORLD_SIZE - 50, sx + ox));
                const gy = Math.max(50, Math.min(WORLD_SIZE - 50, sy + oy));
                spawnEnemy('swarm', gx, gy, difficulty);
            }
        } else {
            spawnEnemy(type, sx, sy, difficulty);
        }
    }
}

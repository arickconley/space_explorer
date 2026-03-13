// ---------------------------------------------------------------------------
// collision.js  --  collision detection system
// ---------------------------------------------------------------------------

import { projectiles } from './projectiles.js';
import { enemies } from './enemies.js';
import { player, damagePlayer, addXp } from './player.js';
import { spawnExplosion, spawnHitSparks } from './particles.js';
import { spawnPowerup } from './powerups.js';
import { circleCollision, distance } from './utils.js';
import { onPlayerDamaged } from './crew.js';
import { getVisibleAsteroids, damageAsteroid } from './map.js';
import { camera } from './camera.js';

// ---- cooldown tracking for player-asteroid contact -------------------------

let _lastAsteroidDamageTime = 0;

// ---- public API ------------------------------------------------------------

/**
 * Run all collision checks for the current frame.
 *
 * @param {number} gameTime  Elapsed game time in seconds
 * @returns {{ leveledUp: boolean }}
 */
export function checkCollisions(gameTime) {
    let leveledUp = false;

    // ------------------------------------------------------------------
    // 1. Player projectiles vs enemies
    // ------------------------------------------------------------------
    for (let pi = projectiles.length - 1; pi >= 0; pi--) {
        const proj = projectiles[pi];
        if (proj.owner !== 'player') continue;

        for (let ei = enemies.length - 1; ei >= 0; ei--) {
            const enemy = enemies[ei];

            if (!circleCollision(proj, enemy)) continue;

            // Apply damage to enemy
            enemy.hp -= proj.damage;
            spawnHitSparks(proj.x, proj.y, proj.color);

            // Remove projectile
            projectiles.splice(pi, 1);

            // Check if enemy died
            if (enemy.hp <= 0) {
                spawnExplosion(enemy.x, enemy.y, enemy.color, 24, 220);

                // Award XP
                if (addXp(enemy.xpReward)) {
                    leveledUp = true;
                }

                // 30% chance to drop a power-up
                if (Math.random() < 0.3) {
                    spawnPowerup(enemy.x, enemy.y);
                }

                // Enemy will be removed by updateEnemies (hp <= 0)
            }

            break; // projectile is consumed, move to next
        }
    }

    // ------------------------------------------------------------------
    // 2. Enemy projectiles vs player
    // ------------------------------------------------------------------
    if (player.alive) {
        for (let pi = projectiles.length - 1; pi >= 0; pi--) {
            const proj = projectiles[pi];
            if (proj.owner !== 'enemy') continue;

            if (!circleCollision(proj, player)) continue;

            damagePlayer(proj.damage, gameTime);
            onPlayerDamaged(gameTime);
            spawnHitSparks(proj.x, proj.y, proj.color);
            projectiles.splice(pi, 1);
        }
    }

    // ------------------------------------------------------------------
    // 3. Player vs enemies (contact damage)
    // ------------------------------------------------------------------
    if (player.alive) {
        for (let ei = 0; ei < enemies.length; ei++) {
            const enemy = enemies[ei];

            if (!circleCollision(player, enemy)) continue;

            // Cooldown: 0.5 s between contact-damage ticks per enemy
            if (enemy.lastContactDamageTime === undefined) {
                enemy.lastContactDamageTime = 0;
            }
            if (gameTime - enemy.lastContactDamageTime < 0.5) continue;

            enemy.lastContactDamageTime = gameTime;
            damagePlayer(10, gameTime);
            onPlayerDamaged(gameTime);
        }
    }

    // ------------------------------------------------------------------
    // 4. Projectiles vs asteroids
    // ------------------------------------------------------------------
    const asteroids = getVisibleAsteroids(
        camera,
        camera.width,
        camera.height,
    );

    for (let pi = projectiles.length - 1; pi >= 0; pi--) {
        const proj = projectiles[pi];

        for (let ai = 0; ai < asteroids.length; ai++) {
            const ast = asteroids[ai];

            if (!circleCollision(proj, ast)) continue;

            spawnHitSparks(proj.x, proj.y, '#bba');

            if (ast.destructible) {
                const destroyed = damageAsteroid(ast, proj.damage);
                if (destroyed) {
                    spawnExplosion(ast.x, ast.y, ast.color, 16, 150);
                }
            }

            // Remove projectile regardless of asteroid type
            projectiles.splice(pi, 1);
            break;
        }
    }

    // ------------------------------------------------------------------
    // 5. Player vs asteroids
    // ------------------------------------------------------------------
    if (player.alive) {
        for (let ai = 0; ai < asteroids.length; ai++) {
            const ast = asteroids[ai];

            if (!circleCollision(player, ast)) continue;

            // Push the player out of the asteroid
            const dx = player.x - ast.x;
            const dy = player.y - ast.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const overlap = (player.radius + ast.radius) - dist;

            if (overlap > 0) {
                player.x += (dx / dist) * overlap;
                player.y += (dy / dist) * overlap;
            }

            // Contact damage with 1-second cooldown
            if (gameTime - _lastAsteroidDamageTime >= 1) {
                _lastAsteroidDamageTime = gameTime;
                damagePlayer(5, gameTime);
            }
        }
    }

    return { leveledUp };
}

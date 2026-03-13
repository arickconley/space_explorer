// ---------------------------------------------------------------------------
// crew.js  --  crew member system: gunner, mechanic, cartographer
// ---------------------------------------------------------------------------

import { player } from './player.js';
import { enemies } from './enemies.js';
import { spawnProjectile } from './projectiles.js';
import { distance, angle } from './utils.js';

// ---- crew singleton -------------------------------------------------------

export const crew = {
    gunner: {
        unlocked: false,
        lastAutoFireTime: 0,
        targetEnemy: null,
        _burstCount: 0,
        _burstTimer: 0,
        _burstTarget: null,
        bonuses: {
            aimErrorMult: 1.0,
            fireRateMult: 1.0,
            damageRatioBonus: 0,
            rangeMult: 1.0,
            dualTarget: false,
            burstFire: false,
            piercing: false,
            burn: false,
        },
    },
    mechanic: {
        unlocked: false,
        spareParts: 0,
        isRepairing: false,
        _partTimer: 0,
        bonuses: {
            hpRateMult: 1.0,
            shieldRateMult: 1.0,
            partSaveChance: 0,
            partIntervalMult: 1.0,
            combatRepair: false,
            passiveHpRegen: 0,
            passiveShieldRegen: 0,
            reactiveShield: false,
            shieldMaxBonus: 0,
        },
    },
    cartographer: {
        unlocked: false,
        discoveredDerelicts: [],
        discoveredPlanets: [],
        visitedChunks: null,
        revealRadius: 1500,
        _scanTimer: 0,
        bonuses: {
            revealRadiusMult: 1.0,
            minimapZoomMult: 1.0,
            showTypes: false,
            showLooted: false,
            showBeacons: false,
            enemyRangeMult: 1.0,
            enemyTypeColors: false,
            threatWarning: false,
        },
    },
};

// ---- constants ------------------------------------------------------------

// Gunner base values
const GUNNER_BASE_FIRE_INTERVAL = 0.5;
const GUNNER_MIN_FIRE_INTERVAL = 0.1;
const GUNNER_BASE_AIM_ERROR = 0.175;
const GUNNER_BASE_DETECT_RANGE = 400;
const GUNNER_BASE_DAMAGE_RATIO = 0.5;
const GUNNER_BURST_DELAY = 0.08;

// Mechanic base values
const MECHANIC_SAFE_RADIUS = 600;
const MECHANIC_COMBAT_SAFE_RADIUS = 200;
const MECHANIC_BASE_HP_RATE = 2;
const MECHANIC_BASE_SHIELD_RATE = 1;
const MECHANIC_BASE_PART_INTERVAL = 10;

// Cartographer
const CARTOGRAPHER_SCAN_INTERVAL = 0.5;
const CARTOGRAPHER_CHUNK_SIZE = 2000;

// ---- public API -----------------------------------------------------------

/**
 * Reset crew state for a new run. Unlocked status and bonuses are set by
 * applyAllSkillEffects() called after this.
 */
export function initCrew() {
    const g = crew.gunner;
    g.lastAutoFireTime = 0;
    g.targetEnemy = null;
    g._burstCount = 0;
    g._burstTimer = 0;
    g._burstTarget = null;

    const m = crew.mechanic;
    m.spareParts = 3;
    m.isRepairing = false;
    m._partTimer = 0;

    const c = crew.cartographer;
    c.discoveredDerelicts = [];
    c.discoveredPlanets = [];
    c.visitedChunks = new Set();
    c._scanTimer = 0;
}

/**
 * Update all crew members.
 */
export function updateCrew(dt, gameTime) {
    if (!player.alive) return;
    if (crew.gunner.unlocked)       updateGunner(dt, gameTime);
    if (crew.mechanic.unlocked)     updateMechanic(dt, gameTime);
    if (crew.cartographer.unlocked) updateCartographer(dt, gameTime);
}

/**
 * Add spare parts to the mechanic's inventory.
 */
export function addSpareParts(amount) {
    crew.mechanic.spareParts += amount;
}

/**
 * Get discovered derelict locations for minimap rendering.
 */
export function getCartographerDiscoveries() {
    return crew.cartographer.discoveredDerelicts;
}

/**
 * Scan nearby derelicts and add to discoveries.
 */
export function scanDerelicts(nearbyDerelicts) {
    const c = crew.cartographer;
    if (!c.unlocked) return;

    const revealRadius = c.revealRadius;

    for (let i = 0; i < nearbyDerelicts.length; i++) {
        const d = nearbyDerelicts[i];
        const dist = distance(player, d);
        if (dist > revealRadius) continue;

        let found = false;
        for (let j = 0; j < c.discoveredDerelicts.length; j++) {
            const dd = c.discoveredDerelicts[j];
            if (Math.abs(dd.x - d.x) < 10 && Math.abs(dd.y - d.y) < 10) {
                dd.looted = d.looted;
                found = true;
                break;
            }
        }

        if (!found) {
            c.discoveredDerelicts.push({
                x: d.x, y: d.y, type: d.type, looted: d.looted,
            });
        }
    }
}

/**
 * Scan nearby planets and add to discoveries.
 */
export function scanPlanets(nearbyPlanets) {
    const c = crew.cartographer;
    if (!c.unlocked) return;

    const revealRadius = c.revealRadius;

    for (let i = 0; i < nearbyPlanets.length; i++) {
        const p = nearbyPlanets[i];
        const dist = distance(player, p);
        if (dist > revealRadius) continue;

        let found = false;
        for (let j = 0; j < c.discoveredPlanets.length; j++) {
            const dp = c.discoveredPlanets[j];
            if (Math.abs(dp.x - p.x) < 10 && Math.abs(dp.y - p.y) < 10) {
                found = true;
                break;
            }
        }

        if (!found) {
            c.discoveredPlanets.push({
                x: p.x, y: p.y, type: p.type, radius: p.radius, color: p.color,
            });
        }
    }
}

/**
 * Get discovered planet locations for minimap rendering.
 */
export function getCartographerPlanetDiscoveries() {
    return crew.cartographer.discoveredPlanets;
}

/**
 * Called when player takes damage. Mechanic reactive shields check.
 */
export function onPlayerDamaged(gameTime) {
    const m = crew.mechanic;
    if (m.unlocked && m.bonuses.reactiveShield) {
        const restore = Math.floor(player.maxShield * 0.25);
        player.shield = Math.min(player.maxShield, player.shield + restore);
    }
}

// ---- gunner ---------------------------------------------------------------

function updateGunner(dt, gameTime) {
    const g = crew.gunner;
    const b = g.bonuses;

    // Handle burst fire continuation
    if (b.burstFire && g._burstCount > 0) {
        g._burstTimer -= dt;
        if (g._burstTimer <= 0 && g._burstTarget) {
            g._burstTimer = GUNNER_BURST_DELAY;
            g._burstCount--;
            _fireAtEnemy(g._burstTarget, b);
        }
        if (g._burstCount <= 0) g._burstTarget = null;
        return; // don't do normal targeting during burst
    }

    // Detection range
    const detectRange = GUNNER_BASE_DETECT_RANGE * b.rangeMult;

    // Find nearest enemy
    let nearest = null;
    let nearestDist = Infinity;
    for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const d = distance(player, e);
        if (d <= detectRange && d < nearestDist) {
            nearest = e;
            nearestDist = d;
        }
    }

    g.targetEnemy = nearest;
    if (!nearest) return;

    // Fire rate
    const fireInterval = Math.max(
        GUNNER_MIN_FIRE_INTERVAL,
        GUNNER_BASE_FIRE_INTERVAL * b.fireRateMult,
    );

    if (gameTime - g.lastAutoFireTime < fireInterval) return;
    g.lastAutoFireTime = gameTime;

    // Fire at primary target
    if (b.burstFire) {
        g._burstCount = 2; // 2 more after the first shot = 3 total
        g._burstTimer = GUNNER_BURST_DELAY;
        g._burstTarget = nearest;
    }
    _fireAtEnemy(nearest, b);

    // Dual target
    if (b.dualTarget) {
        let secondNearest = null;
        let secondDist = Infinity;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (e === nearest) continue;
            const d = distance(player, e);
            if (d <= detectRange && d < secondDist) {
                secondNearest = e;
                secondDist = d;
            }
        }
        if (secondNearest) {
            _fireAtEnemy(secondNearest, b);
        }
    }
}

function _fireAtEnemy(enemy, bonuses) {
    const aimError = GUNNER_BASE_AIM_ERROR * bonuses.aimErrorMult;
    const baseAngle = angle(player, enemy);
    const fireAngle = baseAngle + (Math.random() - 0.5) * 2 * aimError;

    const damageRatio = GUNNER_BASE_DAMAGE_RATIO + bonuses.damageRatioBonus;
    const damage = Math.max(1, Math.floor(player.damage * damageRatio));

    const spawnDist = player.radius + 8;
    const ox = player.x + Math.cos(fireAngle) * spawnDist;
    const oy = player.y + Math.sin(fireAngle) * spawnDist;

    spawnProjectile(ox, oy,
        Math.cos(fireAngle) * player.bulletSpeed * 0.85,
        Math.sin(fireAngle) * player.bulletSpeed * 0.85,
        {
            damage,
            owner: 'player',
            color: bonuses.burn ? '#f80' : '#ff0',
            radius: 2.5,
            maxLife: 2.5,
            firedBy: 'gunner',
            piercing: bonuses.piercing,
            burn: bonuses.burn,
        },
    );
}

// ---- mechanic -------------------------------------------------------------

function updateMechanic(dt, gameTime) {
    const m = crew.mechanic;
    const b = m.bonuses;

    // Passive HP regen (nanobots skill, no parts needed)
    if (b.passiveHpRegen > 0) {
        player.health = Math.min(player.maxHealth, player.health + b.passiveHpRegen * dt);
    }

    // Determine if safe
    const safeRadius = b.combatRepair ? MECHANIC_COMBAT_SAFE_RADIUS : MECHANIC_SAFE_RADIUS;
    let isSafe = true;
    if (!b.combatRepair) {
        for (let i = 0; i < enemies.length; i++) {
            if (distance(player, enemies[i]) < safeRadius) {
                isSafe = false;
                break;
            }
        }
    }

    const needsRepair = player.health < player.maxHealth || player.shield < player.maxShield;

    if (!isSafe || !needsRepair || m.spareParts <= 0) {
        m.isRepairing = false;
        return;
    }

    m.isRepairing = true;

    // Repair rates (modified by skill bonuses)
    const hpRate = MECHANIC_BASE_HP_RATE * b.hpRateMult;
    const shieldRate = MECHANIC_BASE_SHIELD_RATE * b.shieldRateMult;

    // Repair health first, then shield
    if (player.health < player.maxHealth) {
        const hpRepair = Math.min(hpRate * dt, player.maxHealth - player.health);
        player.health += hpRepair;
    }

    if (player.shield < player.maxShield) {
        const shieldRepair = Math.min(shieldRate * dt, player.maxShield - player.shield);
        player.shield += shieldRepair;
    }

    // Consume spare parts over time
    const partInterval = MECHANIC_BASE_PART_INTERVAL * b.partIntervalMult;
    m._partTimer += dt;
    if (m._partTimer >= partInterval) {
        m._partTimer -= partInterval;
        if (Math.random() >= b.partSaveChance) {
            m.spareParts = Math.max(0, m.spareParts - 1);
        }
    }
}

// ---- cartographer ---------------------------------------------------------

function updateCartographer(dt, gameTime) {
    const c = crew.cartographer;

    // Track visited chunks
    const chunkX = Math.floor(player.x / CARTOGRAPHER_CHUNK_SIZE);
    const chunkY = Math.floor(player.y / CARTOGRAPHER_CHUNK_SIZE);
    const chunkKey = chunkX + ',' + chunkY;
    if (!c.visitedChunks.has(chunkKey)) {
        c.visitedChunks.add(chunkKey);
    }

    c._scanTimer += dt;
    if (c._scanTimer < CARTOGRAPHER_SCAN_INTERVAL) return;
    c._scanTimer -= CARTOGRAPHER_SCAN_INTERVAL;
}

// ---- HUD drawing ----------------------------------------------------------

const CREW_BAR_W = 160;
const CREW_BAR_H = 12;
const CREW_BAR_GAP = 4;
const CREW_FONT = '10px "Courier New", Courier, monospace';

const CREW_COLORS = {
    gunner:       { fill: '#ff0', bg: '#550' },
    mechanic:     { fill: '#f80', bg: '#530' },
    cartographer: { fill: '#8f8', bg: '#052' },
};

/**
 * Draw crew member status indicators on the HUD.
 */
export function drawCrewHUD(ctx, cw, ch) {
    ctx.save();

    let curY = 90 + player.activeEffects.length * 16;

    // "CREW" header
    ctx.font = CREW_FONT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('CREW', 16, curY);
    curY += 14;

    const roles = ['gunner', 'mechanic', 'cartographer'];
    const labels = { gunner: 'GUN', mechanic: 'MEC', cartographer: 'NAV' };

    for (let i = 0; i < roles.length; i++) {
        const role = roles[i];
        const member = crew[role];
        if (!member.unlocked) continue;

        const colors = CREW_COLORS[role];

        // Background panel
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(12, curY - 1, CREW_BAR_W + 8, CREW_BAR_H + 2);

        // Solid bar in crew color (no XP, just an indicator)
        ctx.fillStyle = colors.bg;
        ctx.fillRect(16, curY, CREW_BAR_W, CREW_BAR_H);
        ctx.fillStyle = colors.fill;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(16, curY, CREW_BAR_W, CREW_BAR_H);
        ctx.globalAlpha = 1;

        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(16, curY, CREW_BAR_W, CREW_BAR_H);

        // Label
        ctx.font = CREW_FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#eee';
        ctx.shadowBlur = 3;
        ctx.shadowColor = colors.fill;
        ctx.fillText(labels[role], 20, curY + CREW_BAR_H / 2);

        // Right side: status info
        ctx.textAlign = 'right';
        let info = '';
        if (role === 'mechanic') {
            info = member.isRepairing ? 'FIX ' + member.spareParts + 'P' : member.spareParts + 'P';
        } else if (role === 'gunner' && crew.gunner.targetEnemy) {
            info = 'TGT';
        } else if (role === 'cartographer') {
            info = member.discoveredDerelicts.length + ' found';
        }
        ctx.fillText(info, 16 + CREW_BAR_W - 4, curY + CREW_BAR_H / 2);

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        curY += CREW_BAR_H + CREW_BAR_GAP;
    }

    ctx.restore();
}

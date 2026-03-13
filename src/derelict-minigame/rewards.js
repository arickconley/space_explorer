// ---------------------------------------------------------------------------
// rewards.js  --  scattered pickups and end locker rewards
// ---------------------------------------------------------------------------

import { TILE_SIZE } from './tilemap.js';

// ---- pickup definitions ----------------------------------------------------

const PICKUP_DEFS = {
    xpOrb: {
        radius: 6,
        color: '#fd0',
        glowColor: '#fa0',
        xpValue: 5,
    },
    healthPickup: {
        radius: 8,
        color: '#f6a',
        glowColor: '#f48',
        healValue: 1,
    },
    coinPickup: {
        radius: 7,
        color: '#fd0',
        glowColor: '#da0',
        coinValue: 1,
    },
};

// ---- locker reward tiers ---------------------------------------------------

const WEAPON_UPGRADES = ['spreadShot', 'rapidFire', 'piercingRound', 'homingMissile'];

const LOCKER_TIERS = [
    { name: 'empty',     weight: 30, label: 'ALREADY LOOTED',  xp: 0,   powerups: 0, weaponUpgrade: false, permanentBoost: null, coins: 0 },
    { name: 'small',     weight: 35, label: 'MINOR SALVAGE',   xp: 30,  powerups: 1, weaponUpgrade: false, permanentBoost: null, coins: 5 },
    { name: 'medium',    weight: 20, label: 'VALUABLE CARGO',  xp: 75,  powerups: 2, weaponUpgrade: false, permanentBoost: null, coins: 15 },
    { name: 'large',     weight: 10, label: 'RARE FIND',       xp: 150, powerups: 3, weaponUpgrade: true,  permanentBoost: { maxHealth: 5 }, coins: 30 },
    { name: 'legendary', weight: 5,  label: 'JACKPOT!',        xp: 300, powerups: 4, weaponUpgrade: true,  permanentBoost: { maxHealth: 10, maxShield: 5 }, coins: 60 },
];

const TOTAL_TIER_WEIGHT = LOCKER_TIERS.reduce((s, t) => s + t.weight, 0);

// ---- seeded PRNG (local copy) ----------------------------------------------

function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---- public API ------------------------------------------------------------

export function determineLockerReward(seed, derelictType) {
    const rng = mulberry32(seed + 12345); // offset to not overlap level gen

    // Roll tier
    let roll = rng() * TOTAL_TIER_WEIGHT;
    let tier = LOCKER_TIERS[0];
    for (const t of LOCKER_TIERS) {
        roll -= t.weight;
        if (roll <= 0) {
            tier = t;
            break;
        }
    }

    // Better derelicts bias toward better tiers
    if (derelictType === 'militaryWreck' && tier.name === 'empty') {
        // Re-roll once for military wrecks
        roll = rng() * TOTAL_TIER_WEIGHT;
        for (const t of LOCKER_TIERS) {
            roll -= t.weight;
            if (roll <= 0) {
                tier = t;
                break;
            }
        }
    }

    const weaponUpgrade = tier.weaponUpgrade
        ? WEAPON_UPGRADES[Math.floor(rng() * WEAPON_UPGRADES.length)]
        : null;

    return {
        tier: tier.name,
        label: tier.label,
        xp: tier.xp,
        powerupCount: tier.powerups,
        weaponUpgrade,
        permanentBoost: tier.permanentBoost,
        coins: tier.coins,
    };
}

export function createPickups(pickupDefs) {
    return pickupDefs.map(def => {
        const pDef = PICKUP_DEFS[def.type];
        return {
            type: def.type,
            x: def.col * TILE_SIZE + TILE_SIZE / 2,
            y: def.row * TILE_SIZE + TILE_SIZE / 2,
            radius: pDef.radius,
            color: pDef.color,
            glowColor: pDef.glowColor,
            xpValue: pDef.xpValue || 0,
            healValue: pDef.healValue || 0,
            coinValue: pDef.coinValue || 0,
            collected: false,
            bobOffset: Math.random() * Math.PI * 2,
        };
    });
}

export function updatePickups(player, pickups, scatteredLoot) {
    for (const p of pickups) {
        if (p.collected) continue;

        const dx = player.x - p.x;
        const dy = (player.y - player.height / 2) - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < p.radius + 12) {
            p.collected = true;
            if (p.xpValue > 0) {
                scatteredLoot.xp += p.xpValue;
            }
            if (p.healValue > 0) {
                scatteredLoot.healthRestored += p.healValue;
            }
            if (p.coinValue > 0) {
                scatteredLoot.coins += p.coinValue;
            }
        }
    }
}

export function drawPickups(ctx, cam, pickups, time) {
    for (const p of pickups) {
        if (p.collected) continue;

        const bob = Math.sin(time * 3 + p.bobOffset) * 3;
        const sx = p.x - cam.x;
        const sy = p.y - cam.y + bob;

        ctx.save();

        if (p.type === 'coinPickup') {
            // Gold coin (hexagonal shape)
            ctx.shadowColor = p.glowColor;
            ctx.shadowBlur = 8;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            for (let v = 0; v < 6; v++) {
                const a = (v / 6) * Math.PI * 2 - Math.PI / 2;
                const px = sx + Math.cos(a) * p.radius;
                const py = sy + Math.sin(a) * p.radius;
                if (v === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();

            // "C" letter in center
            ctx.fillStyle = '#a80';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('C', sx, sy);
        } else if (p.type === 'xpOrb') {
            // Gold orb with glow
            ctx.shadowColor = p.glowColor;
            ctx.shadowBlur = 6;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
            ctx.fill();

            // Inner bright spot
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sx - 1, sy - 1, p.radius * 0.3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Health pickup: cross shape
            ctx.shadowColor = p.glowColor;
            ctx.shadowBlur = 6;
            ctx.fillStyle = p.color;
            const s = p.radius;
            ctx.fillRect(sx - s * 0.3, sy - s, s * 0.6, s * 2);
            ctx.fillRect(sx - s, sy - s * 0.3, s * 2, s * 0.6);
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }
}

export function drawLockerRewardPopup(ctx, cw, ch, reward, time) {
    if (!reward) return;

    // Dim background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, cw, ch);

    const cx = cw / 2;
    const cy = ch / 2;
    const boxW = 320;
    const boxH = 200;

    // Border color based on tier
    const isLegendary = reward.tier === 'legendary';
    const isLarge = reward.tier === 'large';
    const borderColor = isLegendary ? '#ffd700'
                      : isLarge ? '#ff8800'
                      : '#0ff';

    // Box background
    ctx.fillStyle = 'rgba(10,10,20,0.95)';
    ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);

    // Border
    ctx.save();
    if (isLegendary) {
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 15;
    }
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Label
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = borderColor;
    ctx.fillText(reward.label, cx, cy - 60);

    // Details
    ctx.font = '14px monospace';
    ctx.fillStyle = '#aaa';
    let y = cy - 25;

    if (reward.xp > 0) {
        ctx.fillStyle = '#fd0';
        ctx.fillText(`+${reward.xp} XP`, cx, y);
        y += 22;
    }
    if (reward.coins > 0) {
        ctx.fillStyle = '#fd0';
        ctx.fillText(`+${reward.coins} Coins`, cx, y);
        y += 22;
    }
    if (reward.powerupCount > 0) {
        ctx.fillStyle = '#0ff';
        ctx.fillText(`${reward.powerupCount} Power-up${reward.powerupCount > 1 ? 's' : ''}`, cx, y);
        y += 22;
    }
    if (reward.weaponUpgrade) {
        ctx.fillStyle = '#f80';
        ctx.fillText(`Weapon: ${reward.weaponUpgrade}`, cx, y);
        y += 22;
    }
    if (reward.permanentBoost) {
        ctx.fillStyle = '#ff4';
        const boosts = [];
        if (reward.permanentBoost.maxHealth) boosts.push(`+${reward.permanentBoost.maxHealth} Max HP`);
        if (reward.permanentBoost.maxShield) boosts.push(`+${reward.permanentBoost.maxShield} Max Shield`);
        ctx.fillText(boosts.join(', '), cx, y);
        y += 22;
    }

    // Dismiss prompt
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    ctx.fillStyle = `rgba(200,200,200,${pulse})`;
    ctx.font = '12px monospace';
    ctx.fillText('Press any key to continue', cx, cy + boxH / 2 - 20);
}

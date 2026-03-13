// ---------------------------------------------------------------------------
// skilltree.js  --  crew skill tree: data, rendering, interaction
// ---------------------------------------------------------------------------

import { player } from './player.js';
import { crew } from './crew.js';
import { input } from './input.js';

// ---- skill definitions ----------------------------------------------------

// branch positions: 0=left, 1=center, 2=right
// tier: 0=root, 1/2/3=branch depth

export const SKILL_TREE = [
    // ===================== GUNNER =====================
    {
        id: 'gunner_root', crewRole: 'gunner', branch: -1, tier: 0,
        name: 'Weapons Training', cost: 0, prereqs: [],
        description: 'Unlock the Gunner crew member',
        startsOwned: true,
    },
    // Accuracy branch (left)
    {
        id: 'gunner_acc_1', crewRole: 'gunner', branch: 0, tier: 1,
        name: 'Steady Aim', cost: 30, prereqs: ['gunner_root'],
        description: '-30% aim error',
    },
    {
        id: 'gunner_acc_2', crewRole: 'gunner', branch: 0, tier: 2,
        name: 'Eagle Eye', cost: 60, prereqs: ['gunner_acc_1'],
        description: '-50% aim error, +20% range',
    },
    {
        id: 'gunner_acc_3', crewRole: 'gunner', branch: 0, tier: 3,
        name: 'Twin Target', cost: 100, prereqs: ['gunner_acc_2'],
        description: 'Shoot 2 enemies at once',
    },
    // Speed branch (center)
    {
        id: 'gunner_spd_1', crewRole: 'gunner', branch: 1, tier: 1,
        name: 'Fast Hands', cost: 30, prereqs: ['gunner_root'],
        description: '-25% fire interval',
    },
    {
        id: 'gunner_spd_2', crewRole: 'gunner', branch: 1, tier: 2,
        name: 'Trigger Happy', cost: 60, prereqs: ['gunner_spd_1'],
        description: '-25% fire interval',
    },
    {
        id: 'gunner_spd_3', crewRole: 'gunner', branch: 1, tier: 3,
        name: 'Burst Fire', cost: 100, prereqs: ['gunner_spd_2'],
        description: '3-round burst per trigger',
    },
    // Power branch (right)
    {
        id: 'gunner_pow_1', crewRole: 'gunner', branch: 2, tier: 1,
        name: 'Bigger Rounds', cost: 30, prereqs: ['gunner_root'],
        description: '+30% gunner damage',
    },
    {
        id: 'gunner_pow_2', crewRole: 'gunner', branch: 2, tier: 2,
        name: 'Incendiary Rounds', cost: 60, prereqs: ['gunner_pow_1'],
        description: '+burn DoT (2 dmg/s, 3s)',
    },
    {
        id: 'gunner_pow_3', crewRole: 'gunner', branch: 2, tier: 3,
        name: 'Piercing Shot', cost: 100, prereqs: ['gunner_pow_2'],
        description: 'Shots pass through 1 extra enemy',
    },

    // ===================== MECHANIC =====================
    {
        id: 'mechanic_root', crewRole: 'mechanic', branch: -1, tier: 0,
        name: 'Engineering 101', cost: 50, prereqs: [],
        description: 'Unlock the Mechanic crew member',
    },
    // Hull branch (left)
    {
        id: 'mech_hull_1', crewRole: 'mechanic', branch: 0, tier: 1,
        name: 'Hull Repair', cost: 30, prereqs: ['mechanic_root'],
        description: '+50% HP repair rate',
    },
    {
        id: 'mech_hull_2', crewRole: 'mechanic', branch: 0, tier: 2,
        name: 'Rapid Repair', cost: 60, prereqs: ['mech_hull_1'],
        description: '+50% more HP repair rate',
    },
    {
        id: 'mech_hull_3', crewRole: 'mechanic', branch: 0, tier: 3,
        name: 'Combat Medic', cost: 100, prereqs: ['mech_hull_2'],
        description: 'Can repair in combat',
    },
    // Shield branch (center)
    {
        id: 'mech_shield_1', crewRole: 'mechanic', branch: 1, tier: 1,
        name: 'Shield Tech', cost: 30, prereqs: ['mechanic_root'],
        description: '+50% shield repair rate',
    },
    {
        id: 'mech_shield_2', crewRole: 'mechanic', branch: 1, tier: 2,
        name: 'Overcharge', cost: 60, prereqs: ['mech_shield_1'],
        description: '+50% shield repair, +10% max shield',
    },
    {
        id: 'mech_shield_3', crewRole: 'mechanic', branch: 1, tier: 3,
        name: 'Reactive Shields', cost: 100, prereqs: ['mech_shield_2'],
        description: 'Restore 25% shield when hit',
    },
    // Efficiency branch (right)
    {
        id: 'mech_eff_1', crewRole: 'mechanic', branch: 2, tier: 1,
        name: 'Parts Salvage', cost: 30, prereqs: ['mechanic_root'],
        description: 'Parts last 50% longer',
    },
    {
        id: 'mech_eff_2', crewRole: 'mechanic', branch: 2, tier: 2,
        name: 'Scavenger', cost: 60, prereqs: ['mech_eff_1'],
        description: '20% chance to save parts',
    },
    {
        id: 'mech_eff_3', crewRole: 'mechanic', branch: 2, tier: 3,
        name: 'Nanobots', cost: 100, prereqs: ['mech_eff_2'],
        description: 'Passive 1 HP/s, no parts needed',
    },

    // ===================== CARTOGRAPHER =====================
    {
        id: 'cartographer_root', crewRole: 'cartographer', branch: -1, tier: 0,
        name: 'Star Charts', cost: 50, prereqs: [],
        description: 'Unlock the Cartographer crew member',
    },
    // Range branch (left)
    {
        id: 'cart_range_1', crewRole: 'cartographer', branch: 0, tier: 1,
        name: 'Long Range Scanners', cost: 30, prereqs: ['cartographer_root'],
        description: '+50% reveal radius',
    },
    {
        id: 'cart_range_2', crewRole: 'cartographer', branch: 0, tier: 2,
        name: 'Deep Space Survey', cost: 60, prereqs: ['cart_range_1'],
        description: '+50% more reveal radius',
    },
    {
        id: 'cart_range_3', crewRole: 'cartographer', branch: 0, tier: 3,
        name: 'Warp Cartography', cost: 100, prereqs: ['cart_range_2'],
        description: '2x minimap zoom radius',
    },
    // Combat Intel branch (center)
    {
        id: 'cart_intel_1', crewRole: 'cartographer', branch: 1, tier: 1,
        name: 'Threat Detection', cost: 30, prereqs: ['cartographer_root'],
        description: 'Enemies visible on minimap at 2x range',
    },
    {
        id: 'cart_intel_2', crewRole: 'cartographer', branch: 1, tier: 2,
        name: 'Danger Sense', cost: 60, prereqs: ['cart_intel_1'],
        description: 'Enemy types color-coded on minimap',
    },
    {
        id: 'cart_intel_3', crewRole: 'cartographer', branch: 1, tier: 3,
        name: 'Threat Warning', cost: 100, prereqs: ['cart_intel_2'],
        description: 'HUD warning when enemies approach',
    },
    // Loot Finding branch (right)
    {
        id: 'cart_loot_1', crewRole: 'cartographer', branch: 2, tier: 1,
        name: 'Salvage Instinct', cost: 30, prereqs: ['cartographer_root'],
        description: 'Derelict type shown on minimap',
    },
    {
        id: 'cart_loot_2', crewRole: 'cartographer', branch: 2, tier: 2,
        name: 'Treasure Hunter', cost: 60, prereqs: ['cart_loot_1'],
        description: 'Show looted vs unlooted derelicts',
    },
    {
        id: 'cart_loot_3', crewRole: 'cartographer', branch: 2, tier: 3,
        name: 'Beacon', cost: 100, prereqs: ['cart_loot_2'],
        description: 'Directional arrows to off-screen derelicts',
    },
];

// Build lookup map
const _skillMap = {};
for (let i = 0; i < SKILL_TREE.length; i++) {
    _skillMap[SKILL_TREE[i].id] = SKILL_TREE[i];
}

export function getSkillById(id) {
    return _skillMap[id] || null;
}

// ---- purchase logic -------------------------------------------------------

export function hasSkill(skillId) {
    return !!player.purchasedSkills[skillId];
}

export function canPurchaseSkill(skillId) {
    if (hasSkill(skillId)) return false;
    const skill = _skillMap[skillId];
    if (!skill) return false;
    if (player.totalXp < skill.cost) return false;
    for (let i = 0; i < skill.prereqs.length; i++) {
        if (!hasSkill(skill.prereqs[i])) return false;
    }
    return true;
}

export function purchaseSkill(skillId) {
    if (!canPurchaseSkill(skillId)) return false;
    const skill = _skillMap[skillId];
    player.totalXp -= skill.cost;
    player.purchasedSkills[skillId] = true;
    applyAllSkillEffects();
    return true;
}

// ---- skill effect application ---------------------------------------------

export function applyAllSkillEffects() {
    // Auto-grant skills marked as startsOwned
    for (let i = 0; i < SKILL_TREE.length; i++) {
        if (SKILL_TREE[i].startsOwned && !player.purchasedSkills[SKILL_TREE[i].id]) {
            player.purchasedSkills[SKILL_TREE[i].id] = true;
        }
    }

    const ps = player.purchasedSkills;

    // ---- Gunner ----
    const g = crew.gunner;
    g.unlocked = !!ps.gunner_root;
    g.bonuses = {
        aimErrorMult: 1.0,
        fireRateMult: 1.0,
        damageRatioBonus: 0,
        rangeMult: 1.0,
        dualTarget: false,
        burstFire: false,
        piercing: false,
        burn: false,
    };
    if (ps.gunner_acc_1) g.bonuses.aimErrorMult *= 0.7;
    if (ps.gunner_acc_2) { g.bonuses.aimErrorMult *= 0.5; g.bonuses.rangeMult *= 1.2; }
    if (ps.gunner_acc_3) g.bonuses.dualTarget = true;
    if (ps.gunner_spd_1) g.bonuses.fireRateMult *= 0.75;
    if (ps.gunner_spd_2) g.bonuses.fireRateMult *= 0.75;
    if (ps.gunner_spd_3) g.bonuses.burstFire = true;
    if (ps.gunner_pow_1) g.bonuses.damageRatioBonus += 0.3;
    if (ps.gunner_pow_2) g.bonuses.burn = true;
    if (ps.gunner_pow_3) g.bonuses.piercing = true;

    // ---- Mechanic ----
    const m = crew.mechanic;
    m.unlocked = !!ps.mechanic_root;
    m.bonuses = {
        hpRateMult: 1.0,
        shieldRateMult: 1.0,
        partSaveChance: 0,
        partIntervalMult: 1.0,
        combatRepair: false,
        passiveHpRegen: 0,
        passiveShieldRegen: 0,
        reactiveShield: false,
        shieldMaxBonus: 0,
    };
    if (ps.mech_hull_1) m.bonuses.hpRateMult *= 1.5;
    if (ps.mech_hull_2) m.bonuses.hpRateMult *= 1.5;
    if (ps.mech_hull_3) m.bonuses.combatRepair = true;
    if (ps.mech_shield_1) m.bonuses.shieldRateMult *= 1.5;
    if (ps.mech_shield_2) { m.bonuses.shieldRateMult *= 1.5; m.bonuses.shieldMaxBonus = 0.1; }
    if (ps.mech_shield_3) m.bonuses.reactiveShield = true;
    if (ps.mech_eff_1) m.bonuses.partIntervalMult *= 1.5;
    if (ps.mech_eff_2) m.bonuses.partSaveChance = 0.2;
    if (ps.mech_eff_3) m.bonuses.passiveHpRegen = 1;

    // Apply shield max bonus
    if (m.bonuses.shieldMaxBonus > 0) {
        player.maxShield = Math.round(player.maxShield * (1 + m.bonuses.shieldMaxBonus));
    }

    // ---- Cartographer ----
    const c = crew.cartographer;
    c.unlocked = !!ps.cartographer_root;
    c.bonuses = {
        revealRadiusMult: 1.0,
        minimapZoomMult: 1.0,
        showTypes: false,
        showLooted: false,
        showBeacons: false,
        enemyRangeMult: 1.0,
        enemyTypeColors: false,
        threatWarning: false,
    };
    if (ps.cart_range_1) c.bonuses.revealRadiusMult *= 1.5;
    if (ps.cart_range_2) c.bonuses.revealRadiusMult *= 1.5;
    if (ps.cart_range_3) c.bonuses.minimapZoomMult = 2.0;
    if (ps.cart_intel_1) c.bonuses.enemyRangeMult = 2.0;
    if (ps.cart_intel_2) c.bonuses.enemyTypeColors = true;
    if (ps.cart_intel_3) c.bonuses.threatWarning = true;
    if (ps.cart_loot_1) c.bonuses.showTypes = true;
    if (ps.cart_loot_2) c.bonuses.showLooted = true;
    if (ps.cart_loot_3) c.bonuses.showBeacons = true;

    // Apply reveal radius
    c.revealRadius = 1500 * c.bonuses.revealRadiusMult;
}

// ---- count purchased skills per role --------------------------------------

function _countSkills(role) {
    let count = 0;
    for (let i = 0; i < SKILL_TREE.length; i++) {
        if (SKILL_TREE[i].crewRole === role && hasSkill(SKILL_TREE[i].id)) count++;
    }
    return count;
}

function _totalSkills(role) {
    let count = 0;
    for (let i = 0; i < SKILL_TREE.length; i++) {
        if (SKILL_TREE[i].crewRole === role) count++;
    }
    return count;
}

// ---- rendering constants --------------------------------------------------

const FONT_TITLE = 'bold 24px "Courier New", Courier, monospace';
const FONT_NODE  = 'bold 9px "Courier New", Courier, monospace';
const FONT_NODE_SM = '8px "Courier New", Courier, monospace';
const FONT_DESC  = '11px "Courier New", Courier, monospace';
const FONT_HINT  = '11px "Courier New", Courier, monospace';
const FONT_COST  = 'bold 12px "Courier New", Courier, monospace';

const ROLE_COLORS = {
    gunner:       '#ff0',
    mechanic:     '#f80',
    cartographer: '#8f8',
};

const ROLE_LABELS = {
    gunner:       'GUNNER',
    mechanic:     'MECHANIC',
    cartographer: 'CARTOGRAPHER',
};

const NODE_W = 64;
const NODE_H = 38;
const TIER_SPACING = 62;
const BRANCH_SPACING = 72;

// ---- node position computation --------------------------------------------

/**
 * Compute screen positions for all nodes given canvas dimensions.
 * Returns array of { id, x, y, skill } objects.
 */
function _computeNodePositions(cw, ch) {
    const positions = [];
    const roles = ['gunner', 'mechanic', 'cartographer'];
    const colW = cw / 3;

    for (let ri = 0; ri < roles.length; ri++) {
        const role = roles[ri];
        const colCenterX = colW * ri + colW / 2;
        const topY = ch * 0.22;

        const roleSkills = SKILL_TREE.filter(s => s.crewRole === role);

        for (let si = 0; si < roleSkills.length; si++) {
            const skill = roleSkills[si];
            let nx, ny;

            if (skill.tier === 0) {
                // Root node: centered
                nx = colCenterX;
                ny = topY;
            } else {
                // Branch nodes: 3 columns within the role column
                const branchOffset = (skill.branch - 1) * BRANCH_SPACING;
                nx = colCenterX + branchOffset;
                ny = topY + skill.tier * TIER_SPACING;
            }

            positions.push({ id: skill.id, x: nx, y: ny, skill });
        }
    }

    return positions;
}

// ---- navigation -----------------------------------------------------------

// Navigation order: flatten the tree into a navigable list grouped by role
const _navOrder = [];
const _roles = ['gunner', 'mechanic', 'cartographer'];
for (let ri = 0; ri < _roles.length; ri++) {
    const role = _roles[ri];
    // Root first, then tier 1 left-to-right, tier 2, tier 3
    for (let tier = 0; tier <= 3; tier++) {
        for (let branch = -1; branch <= 2; branch++) {
            const skill = SKILL_TREE.find(s =>
                s.crewRole === role && s.tier === tier && s.branch === branch
            );
            if (skill) _navOrder.push(skill.id);
        }
    }
}

/**
 * Given a selected node ID, find the next node in the given direction.
 */
export function navigateSkillTree(currentId, direction, cw, ch) {
    const positions = _computeNodePositions(cw, ch);
    const current = positions.find(p => p.id === currentId);
    if (!current) return _navOrder[0];

    const cx = current.x;
    const cy = current.y;

    // Find the best candidate in the given direction
    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        if (p.id === currentId) continue;

        const dx = p.x - cx;
        const dy = p.y - cy;

        let valid = false;
        let dist = 0;

        switch (direction) {
            case 'up':
                if (dy < -10) { valid = true; dist = Math.abs(dy) + Math.abs(dx) * 0.5; }
                break;
            case 'down':
                if (dy > 10) { valid = true; dist = Math.abs(dy) + Math.abs(dx) * 0.5; }
                break;
            case 'left':
                if (dx < -10) { valid = true; dist = Math.abs(dx) + Math.abs(dy) * 0.5; }
                break;
            case 'right':
                if (dx > 10) { valid = true; dist = Math.abs(dx) + Math.abs(dy) * 0.5; }
                break;
        }

        if (valid && dist < bestScore) {
            bestScore = dist;
            best = p.id;
        }
    }

    return best || currentId;
}

/**
 * Hit-test: find which skill node is at the given screen position.
 */
export function getSkillNodeAtPosition(tapX, tapY, cw, ch) {
    const positions = _computeNodePositions(cw, ch);
    const hw = NODE_W / 2 + 4;
    const hh = NODE_H / 2 + 4;

    for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        if (Math.abs(tapX - p.x) <= hw && Math.abs(tapY - p.y) <= hh) {
            return p.id;
        }
    }
    return null;
}

/**
 * Get the "DONE" button bounds for hit testing.
 */
function _getDoneButtonBounds(cw, ch) {
    const btnW = 160;
    const btnH = 36;
    return {
        x: cw / 2 - btnW / 2,
        y: ch - 60,
        w: btnW,
        h: btnH,
    };
}

export function isDoneButtonHit(tapX, tapY, cw, ch) {
    const b = _getDoneButtonBounds(cw, ch);
    return tapX >= b.x && tapX <= b.x + b.w && tapY >= b.y && tapY <= b.y + b.h;
}

// ---- drawing --------------------------------------------------------------

/**
 * Draw the skill tree overlay screen.
 */
export function drawSkillTreeScreen(ctx, cw, ch, selectedNodeId) {
    ctx.save();

    // ---- dim overlay
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, cw, ch);

    // ---- title
    ctx.font = FONT_TITLE;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#fd0';
    ctx.fillStyle = '#fd0';
    ctx.fillText('CREW SKILL TREE', cw / 2, ch * 0.06);
    ctx.shadowBlur = 0;

    // ---- XP balance
    ctx.font = 'bold 14px "Courier New", Courier, monospace';
    ctx.fillStyle = '#fd0';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#fd0';
    ctx.fillText('XP: ' + player.totalXp, cw / 2, ch * 0.11);
    ctx.shadowBlur = 0;

    // ---- role headers
    const colW = cw / 3;
    for (let ri = 0; ri < _roles.length; ri++) {
        const role = _roles[ri];
        const colCX = colW * ri + colW / 2;
        const color = ROLE_COLORS[role];

        ctx.font = 'bold 13px "Courier New", Courier, monospace';
        ctx.fillStyle = color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
        ctx.fillText(ROLE_LABELS[role], colCX, ch * 0.16);
        ctx.shadowBlur = 0;

        // Skill count
        ctx.font = FONT_DESC;
        ctx.fillStyle = '#888';
        ctx.fillText(_countSkills(role) + '/' + _totalSkills(role), colCX, ch * 0.16 + 14);

        // Vertical dividers
        if (ri > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(colW * ri, ch * 0.14);
            ctx.lineTo(colW * ri, ch - 80);
            ctx.stroke();
        }
    }

    // ---- compute positions
    const positions = _computeNodePositions(cw, ch);
    const posMap = {};
    for (let i = 0; i < positions.length; i++) {
        posMap[positions[i].id] = positions[i];
    }

    // ---- draw connection lines
    ctx.lineWidth = 2;
    for (let i = 0; i < SKILL_TREE.length; i++) {
        const skill = SKILL_TREE[i];
        const pos = posMap[skill.id];
        if (!pos) continue;

        for (let pi = 0; pi < skill.prereqs.length; pi++) {
            const parentPos = posMap[skill.prereqs[pi]];
            if (!parentPos) continue;

            const bothOwned = hasSkill(skill.id) && hasSkill(skill.prereqs[pi]);
            const parentOwned = hasSkill(skill.prereqs[pi]);

            if (bothOwned) {
                ctx.strokeStyle = ROLE_COLORS[skill.crewRole];
                ctx.shadowBlur = 4;
                ctx.shadowColor = ROLE_COLORS[skill.crewRole];
            } else if (parentOwned) {
                ctx.strokeStyle = 'rgba(255,255,255,0.3)';
                ctx.shadowBlur = 0;
            } else {
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.shadowBlur = 0;
            }

            ctx.beginPath();
            ctx.moveTo(parentPos.x, parentPos.y + NODE_H / 2);
            ctx.lineTo(pos.x, pos.y - NODE_H / 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }
    }

    // ---- draw nodes
    for (let i = 0; i < positions.length; i++) {
        const p = positions[i];
        const skill = p.skill;
        const owned = hasSkill(skill.id);
        const available = canPurchaseSkill(skill.id);
        const selected = skill.id === selectedNodeId;
        const color = ROLE_COLORS[skill.crewRole];

        const hw = NODE_W / 2;
        const hh = NODE_H / 2;

        // Node background
        if (owned) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
        } else if (available) {
            ctx.fillStyle = 'rgba(0,40,60,0.8)';
        } else {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
        }
        ctx.fillRect(p.x - hw, p.y - hh, NODE_W, NODE_H);

        // Border
        if (owned) {
            ctx.strokeStyle = color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = color;
            ctx.lineWidth = 2;
        } else if (available) {
            ctx.strokeStyle = '#fff';
            ctx.shadowBlur = selected ? 10 : 4;
            ctx.shadowColor = '#fff';
            ctx.lineWidth = selected ? 2.5 : 1.5;
        } else {
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.shadowBlur = 0;
            ctx.lineWidth = 1;
        }
        ctx.strokeRect(p.x - hw, p.y - hh, NODE_W, NODE_H);

        // Selection highlight
        if (selected) {
            ctx.strokeStyle = '#0ff';
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#0ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x - hw - 3, p.y - hh - 3, NODE_W + 6, NODE_H + 6);
        }
        ctx.shadowBlur = 0;

        // Node label — wrap into up to 2 lines within the box
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = owned ? color : available ? '#ddd' : '#666';

        const words = skill.name.split(' ');
        if (words.length <= 2) {
            ctx.font = FONT_NODE;
            ctx.fillText(skill.name, p.x, p.y);
        } else {
            // Split into 2 lines roughly evenly
            const mid = Math.ceil(words.length / 2);
            const line1 = words.slice(0, mid).join(' ');
            const line2 = words.slice(mid).join(' ');
            ctx.font = FONT_NODE_SM;
            ctx.fillText(line1, p.x, p.y - 5);
            ctx.fillText(line2, p.x, p.y + 6);
        }

        // Cost below node (if not owned)
        if (!owned) {
            ctx.font = FONT_NODE_SM;
            ctx.fillStyle = player.totalXp >= skill.cost ? '#fd0' : '#f33';
            ctx.fillText(skill.cost + ' XP', p.x, p.y + hh + 8);
        }
    }

    // ---- selected node detail panel
    if (selectedNodeId) {
        const skill = _skillMap[selectedNodeId];
        const pos = posMap[selectedNodeId];
        if (skill && pos) {
            const owned = hasSkill(selectedNodeId);
            const available = canPurchaseSkill(selectedNodeId);
            const color = ROLE_COLORS[skill.crewRole];

            // Detail panel at bottom center
            const panelW = 360;
            const panelH = 66;
            const panelX = cw / 2 - panelW / 2;
            const panelY = ch - 136;

            ctx.fillStyle = 'rgba(5,5,15,0.92)';
            ctx.fillRect(panelX, panelY, panelW, panelH);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 8;
            ctx.shadowColor = color;
            ctx.strokeRect(panelX, panelY, panelW, panelH);
            ctx.shadowBlur = 0;

            // Name
            ctx.font = 'bold 14px "Courier New", Courier, monospace';
            ctx.textAlign = 'left';
            ctx.fillStyle = color;
            ctx.fillText(skill.name, panelX + 12, panelY + 20);

            // Description — 11px, bright white for contrast
            ctx.font = FONT_DESC;
            ctx.fillStyle = '#fff';
            ctx.fillText(skill.description, panelX + 12, panelY + 42);

            // Status
            ctx.textAlign = 'right';
            ctx.font = FONT_COST;
            if (owned) {
                ctx.fillStyle = '#0f0';
                ctx.shadowBlur = 4;
                ctx.shadowColor = '#0f0';
                ctx.fillText('OWNED', panelX + panelW - 12, panelY + 20);
                ctx.shadowBlur = 0;
            } else if (available) {
                ctx.fillStyle = '#fd0';
                ctx.shadowBlur = 4;
                ctx.shadowColor = '#fd0';
                ctx.fillText(skill.cost + ' XP', panelX + panelW - 12, panelY + 20);
                ctx.shadowBlur = 0;
                ctx.font = FONT_DESC;
                ctx.fillStyle = '#0ff';
                ctx.fillText('ENTER to buy', panelX + panelW - 12, panelY + 42);
            } else {
                ctx.fillStyle = '#f44';
                ctx.fillText(skill.cost + ' XP', panelX + panelW - 12, panelY + 20);
                // Show what's missing
                ctx.font = FONT_DESC;
                const missingPrereqs = skill.prereqs.filter(p => !hasSkill(p));
                if (missingPrereqs.length > 0) {
                    ctx.fillStyle = '#aaa';
                    ctx.fillText('Requires: ' + missingPrereqs.map(p => _skillMap[p]?.name || p).join(', '), panelX + panelW - 12, panelY + 42);
                } else {
                    ctx.fillStyle = '#f44';
                    ctx.fillText('Not enough XP', panelX + panelW - 12, panelY + 42);
                }
            }
        }
    }

    // ---- DONE button
    const btn = _getDoneButtonBounds(cw, ch);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
    ctx.strokeStyle = '#0f0';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#0f0';
    ctx.strokeRect(btn.x, btn.y, btn.w, btn.h);
    ctx.shadowBlur = 0;

    ctx.font = 'bold 16px "Courier New", Courier, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f0';
    ctx.fillText('DONE', cw / 2, btn.y + btn.h / 2);

    // ---- hint
    ctx.font = FONT_HINT;
    ctx.fillStyle = '#666';
    const hint = input.isTouchDevice
        ? 'Tap a skill to buy, tap DONE to continue'
        : 'Arrow keys to navigate, Enter to buy, Escape to close';
    ctx.fillText(hint, cw / 2, ch - 18);

    ctx.restore();
}

export function getDefaultSelectedNode() {
    return _navOrder[0];
}

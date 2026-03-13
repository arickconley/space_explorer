// ---------------------------------------------------------------------------
// market.js  --  planet market/shop screen UI
// ---------------------------------------------------------------------------

import { input } from '../input.js';
import { player } from '../player.js';

// ---- market upgrades -------------------------------------------------------

const MARKET_UPGRADES = [
    { id: 'hull',    label: 'HULL PLATING',   desc: '+10 Max HP',       baseCost: 20, max: 10 },
    { id: 'shield',  label: 'SHIELD ARRAY',   desc: '+5 Max Shield',    baseCost: 15, max: 10 },
    { id: 'engine',  label: 'ENGINE BOOST',   desc: '+15 Max Speed',    baseCost: 25, max: 10 },
    { id: 'weapon',  label: 'WEAPON SYSTEMS', desc: '+3 Damage',        baseCost: 20, max: 10 },
    { id: 'cooling', label: 'HEAT SINKS',     desc: '-5% Fire Cooldown', baseCost: 22, max: 10 },
];

// Specialization mapping: planet type -> upgrade id that gets discount
const SPECIALIZATION_MAP = {
    rocky: 'hull',
    gas: 'shield',
    ice: 'engine',
    volcanic: 'weapon',
};

// ---- module state ----------------------------------------------------------

let _planetType = 'rocky';
let _selectedIndex = 0;
let _done = false;

// Previous key state for detecting presses
let _prevKeys = new Set();

function _keyPressed(key) {
    return input.keys.has(key) && !_prevKeys.has(key);
}

function _snapshotKeys() {
    _prevKeys = new Set(input.keys);
}

// ---- public API ------------------------------------------------------------

export function initMarket(planetType) {
    _planetType = planetType;
    _selectedIndex = 0;
    _done = false;
    _prevKeys = new Set(input.keys);
}

export function updateMarket(dt) {
    if (_done) return { done: true };

    // Navigation
    if (_keyPressed('arrowup') || _keyPressed('w')) {
        _selectedIndex = Math.max(0, _selectedIndex - 1);
    }
    if (_keyPressed('arrowdown') || _keyPressed('s')) {
        _selectedIndex = Math.min(MARKET_UPGRADES.length, _selectedIndex + 1);
    }

    // Purchase or launch
    if (_keyPressed('enter') || _keyPressed(' ')) {
        if (_selectedIndex === MARKET_UPGRADES.length) {
            // LAUNCH button
            _done = true;
            _snapshotKeys();
            return { done: true };
        } else {
            _tryPurchase(_selectedIndex);
        }
    }

    // Escape to launch
    if (_keyPressed('escape')) {
        _done = true;
        _snapshotKeys();
        return { done: true };
    }

    _snapshotKeys();
    return { done: false };
}

export function drawMarket(ctx, cw, ch) {
    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, cw, ch);

    const centerX = cw / 2;
    const startY = 60;
    const rowH = 56;
    const rowW = Math.min(480, cw - 40);
    const rowX = centerX - rowW / 2;

    const specialUpgradeId = SPECIALIZATION_MAP[_planetType] || null;

    // ---- Title in planet-type color ----------------------------------------
    const planetColors = { rocky: '#c96', gas: '#6af', ice: '#aef', volcanic: '#f64' };
    const titleColor = planetColors[_planetType] || '#fff';

    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = titleColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = titleColor;
    ctx.fillText('PLANET MARKET', centerX, startY - 20);
    ctx.shadowBlur = 0;

    // Planet type subtitle
    ctx.font = '12px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText(_planetType.toUpperCase() + ' WORLD', centerX, startY + 2);

    // ---- Coin balance (top right of panel) ---------------------------------
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fd0';
    ctx.shadowColor = '#fa0';
    ctx.shadowBlur = 4;
    ctx.fillText('COINS: ' + player.coins, rowX + rowW, startY - 20);
    ctx.shadowBlur = 0;

    // ---- Upgrade rows ------------------------------------------------------
    const listY = startY + 24;

    for (let i = 0; i < MARKET_UPGRADES.length; i++) {
        const upg = MARKET_UPGRADES[i];
        const curLevel = player.marketUpgrades[upg.id] || 0;
        const maxed = curLevel >= upg.max;
        const isSpecialized = upg.id === specialUpgradeId;
        const cost = _getCost(upg.baseCost, curLevel, isSpecialized);
        const canAfford = player.coins >= cost;
        const isSelected = _selectedIndex === i;
        const ry = listY + i * (rowH + 4);

        // Row background
        ctx.fillStyle = isSelected ? 'rgba(0,255,255,0.1)' : 'rgba(20,20,30,0.8)';
        ctx.fillRect(rowX, ry, rowW, rowH);

        // Selection border
        if (isSelected) {
            ctx.strokeStyle = '#0ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(rowX, ry, rowW, rowH);
        }

        // Specialized highlight (green left border + star)
        if (isSpecialized) {
            ctx.fillStyle = 'rgba(0,200,0,0.15)';
            ctx.fillRect(rowX, ry, rowW, rowH);
            ctx.fillStyle = '#0c0';
            ctx.font = '12px monospace';
            ctx.textAlign = 'left';
            ctx.fillText('\u2605 -25%', rowX + 4, ry + rowH - 6);
        }

        // Upgrade name
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = maxed ? '#666' : '#eee';
        ctx.fillText(upg.label, rowX + 10, ry + 16);

        // Description
        ctx.font = '10px monospace';
        ctx.fillStyle = '#888';
        ctx.fillText(upg.desc, rowX + 10, ry + 32);

        // Level pips
        const pipX = rowX + rowW - 160;
        const pipY = ry + 14;
        for (let p = 0; p < upg.max; p++) {
            const px = pipX + p * 12;
            ctx.fillStyle = p < curLevel ? '#0ff' : '#333';
            ctx.fillRect(px, pipY, 8, 8);
            if (p < curLevel) {
                ctx.shadowColor = '#0ff';
                ctx.shadowBlur = 3;
                ctx.fillRect(px, pipY, 8, 8);
                ctx.shadowBlur = 0;
            }
        }

        // Cost
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        if (maxed) {
            ctx.fillStyle = '#666';
            ctx.fillText('MAXED', rowX + rowW - 10, ry + 38);
        } else {
            ctx.fillStyle = canAfford ? '#fd0' : '#f33';
            ctx.fillText(cost + ' coins', rowX + rowW - 10, ry + 38);
        }
    }

    // ---- LAUNCH button -----------------------------------------------------
    const launchY = listY + MARKET_UPGRADES.length * (rowH + 4) + 12;
    const btnW = 200;
    const btnH = 44;
    const btnX = centerX - btnW / 2;
    const isLaunchSelected = _selectedIndex === MARKET_UPGRADES.length;

    ctx.fillStyle = isLaunchSelected ? 'rgba(0,255,100,0.2)' : 'rgba(20,40,20,0.8)';
    ctx.fillRect(btnX, launchY, btnW, btnH);

    if (isLaunchSelected) {
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 2;
        ctx.strokeRect(btnX, launchY, btnW, btnH);
    }

    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0f0';
    ctx.shadowColor = '#0f0';
    ctx.shadowBlur = isLaunchSelected ? 10 : 0;
    ctx.fillText('LAUNCH', centerX, launchY + btnH / 2);
    ctx.shadowBlur = 0;
}

export function handleMarketTap(tapX, tapY, cw, ch) {
    const centerX = cw / 2;
    const rowW = Math.min(480, cw - 40);
    const rowX = centerX - rowW / 2;
    const rowH = 56;
    const listY = 84;

    // Check upgrade rows
    for (let i = 0; i < MARKET_UPGRADES.length; i++) {
        const ry = listY + i * (rowH + 4);
        if (tapX >= rowX && tapX <= rowX + rowW && tapY >= ry && tapY <= ry + rowH) {
            if (_selectedIndex === i) {
                _tryPurchase(i);
            } else {
                _selectedIndex = i;
            }
            return;
        }
    }

    // Check LAUNCH button
    const launchY = listY + MARKET_UPGRADES.length * (rowH + 4) + 12;
    const btnW = 200;
    const btnX = centerX - btnW / 2;
    if (tapX >= btnX && tapX <= btnX + btnW && tapY >= launchY && tapY <= launchY + 44) {
        _done = true;
    }
}

// ---- internal helpers ------------------------------------------------------

function _getCost(baseCost, currentLevel, isSpecialized) {
    const cost = baseCost * (currentLevel + 1);
    return isSpecialized ? Math.floor(cost * 0.75) : cost;
}

function _tryPurchase(index) {
    const upg = MARKET_UPGRADES[index];
    const curLevel = player.marketUpgrades[upg.id] || 0;
    if (curLevel >= upg.max) return;

    const isSpecialized = upg.id === (SPECIALIZATION_MAP[_planetType] || null);
    const cost = _getCost(upg.baseCost, curLevel, isSpecialized);

    if (player.coins >= cost) {
        player.coins -= cost;
        player.marketUpgrades[upg.id] = curLevel + 1;
    }
}

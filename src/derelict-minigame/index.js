// ---------------------------------------------------------------------------
// index.js  --  derelict mini-game public API, camera, state management
// ---------------------------------------------------------------------------

import { input, drawJoysticks } from '../input.js';
import { clamp } from '../utils.js';
import { TILE_SIZE, drawTilemap, getTile, setTile, TILE } from './tilemap.js';
import { generateDerelictLevel } from './level-generator.js';
import {
    initPlatformerPlayer, updatePlatformerPlayer,
    drawPlatformerPlayer, damagePlatformerPlayer,
} from './platformer-player.js';
import { createHazards, updateHazards, drawHazards } from './hazards.js';
import {
    createPickups, updatePickups, drawPickups,
    determineLockerReward, drawLockerRewardPopup,
} from './rewards.js';
import { drawDerelictHUD } from './derelict-hud.js';

// ---- module state ----------------------------------------------------------

let _active = false;
let _map = null;
let _hazards = [];
let _pickups = [];
let _player = null;
let _lockerOpened = false;
let _lockerReward = null;
let _showingRewardPopup = false;
let _rewardPopupTimer = 0;
let _result = null;
let _time = 0;
let _scatteredLoot = { xp: 0, healthRestored: 0, coins: 0 };
let _exitCol = 0;
let _exitRow = 0;
let _levelWidthPx = 0;
let _levelHeightPx = 0;
let _lockerCol = 0;
let _lockerRow = 0;
let _prevInteract = false;

// ---- mini-game camera (separate from main game) ----------------------------

const _cam = {
    x: 0, y: 0,
    width: 0, height: 0,

    update(playerX, playerY, cw, ch) {
        this.width = cw;
        this.height = ch;
        // Center on player
        const targetX = playerX - cw / 2;
        const targetY = playerY - ch / 2;
        this.x += (targetX - this.x) * 0.08;
        this.y += (targetY - this.y) * 0.08;
        this.x = clamp(this.x, 0, Math.max(0, _levelWidthPx - cw));
        this.y = clamp(this.y, 0, Math.max(0, _levelHeightPx - ch));
    },
};

// ---- public API ------------------------------------------------------------

export function initDerelict(derelictData, playerRef) {
    const { seed, type } = derelictData;

    const level = generateDerelictLevel(seed, type);
    _map = level.map;
    _levelWidthPx = _map.cols * TILE_SIZE;
    _levelHeightPx = _map.rows * TILE_SIZE;

    _player = initPlatformerPlayer(level.spawnCol, level.spawnRow);
    _hazards = createHazards(level.hazards, _map, level.rooms);
    _pickups = createPickups(level.pickups);
    _lockerReward = determineLockerReward(seed, type);

    _lockerCol = level.lockerCol;
    _lockerRow = level.lockerRow;
    _exitCol = level.exitCol;
    _exitRow = level.exitRow;

    _lockerOpened = false;
    _showingRewardPopup = false;
    _rewardPopupTimer = 0;
    _result = null;
    _time = 0;
    _scatteredLoot = { xp: 0, healthRestored: 0, coins: 0 };
    _prevInteract = false;
    _active = true;

    // Snap camera to player initially
    _cam.x = _player.x - 200;
    _cam.y = (_levelHeightPx - 600) / 2;
}

export function updateDerelict(dt) {
    if (!_active) return { done: true, result: _result };

    _time += dt;

    // ---- reward popup mode -------------------------------------------------
    if (_showingRewardPopup) {
        _rewardPopupTimer += dt;
        // Dismiss after minimum time with any input
        if (_rewardPopupTimer > 1.5) {
            const anyKey = input.keys.size > 0 || input.moveStick.active || input.aimStick.active;
            if (anyKey || _rewardPopupTimer > 8) {
                _showingRewardPopup = false;
            }
        }
        return { done: false, result: null };
    }

    // ---- update player -----------------------------------------------------
    const { events } = updatePlatformerPlayer(dt, _map, _player);

    // ---- update hazards ----------------------------------------------------
    updateHazards(dt, _time, _hazards, _player, _map);

    // ---- update pickups ----------------------------------------------------
    updatePickups(_player, _pickups, _scatteredLoot);

    // ---- handle interact events --------------------------------------------
    // Use E / Enter / Space for interact (not S/Down which conflict with movement)
    // On touch: tap the right joystick area (aimStick)
    const interactNow = input.isDown('e') || input.isDown('enter') ||
        input.isDown('f') || input.aimStick.active;
    const interactPressed = interactNow && !_prevInteract;
    _prevInteract = interactNow;

    if (interactPressed) {
        // Check sealed doors near player
        _tryOpenDoors();

        // Check locker interaction
        if (!_lockerOpened) {
            const lockerX = _lockerCol * TILE_SIZE + TILE_SIZE / 2;
            const lockerY = _lockerRow * TILE_SIZE + TILE_SIZE / 2;
            const dxL = _player.x - lockerX;
            const dyL = _player.y - lockerY;
            if (dxL * dxL + dyL * dyL < (TILE_SIZE * 2) * (TILE_SIZE * 2)) {
                _lockerOpened = true;
                _showingRewardPopup = true;
                _rewardPopupTimer = 0;
            }
        }
    }

    // ---- check exit (interact near the exit/spawn tile) -------------------
    if (interactPressed && _time > 2.0) {
        const exitX = _exitCol * TILE_SIZE + TILE_SIZE / 2;
        const exitY = _exitRow * TILE_SIZE + TILE_SIZE / 2;
        const dxExit = _player.x - exitX;
        const dyExit = _player.y - exitY;
        if (dxExit * dxExit + dyExit * dyExit < (TILE_SIZE * 2) * (TILE_SIZE * 2)) {
            _finishMinigame(true);
            return { done: true, result: _result };
        }
    }

    // ---- check death -------------------------------------------------------
    if (_player.hp <= 0) {
        _finishMinigame(false);
        return { done: true, result: _result };
    }

    // ---- update camera -----------------------------------------------------
    // (done here so draw uses updated cam)

    return { done: false, result: null };
}

export function drawDerelict(ctx, canvasWidth, canvasHeight) {
    if (!_active && !_showingRewardPopup) return;

    _cam.update(_player.x, _player.y, canvasWidth, canvasHeight);

    // Background
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Tilemap
    drawTilemap(ctx, _map, _cam, _time);

    // Hazards
    drawHazards(ctx, _cam, _hazards, _time);

    // Pickups
    drawPickups(ctx, _cam, _pickups, _time);

    // Player
    drawPlatformerPlayer(ctx, _cam, _player, _time);

    // HUD
    drawDerelictHUD(ctx, canvasWidth, canvasHeight, _player, _scatteredLoot, _lockerOpened, _time, _levelWidthPx);

    // Joysticks
    drawJoysticks(ctx);

    // Reward popup
    if (_showingRewardPopup) {
        drawLockerRewardPopup(ctx, canvasWidth, canvasHeight, _lockerReward, _time);
    }
}

// ---- internal helpers ------------------------------------------------------

function _tryOpenDoors() {
    const pCol = Math.floor(_player.x / TILE_SIZE);
    const pRow = Math.floor(_player.y / TILE_SIZE);

    // Check adjacent tiles for sealed doors
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const c = pCol + dc;
            const r = pRow + dr;
            if (getTile(_map, c, r) === TILE.DOOR_SEALED) {
                setTile(_map, c, r, TILE.DOOR_OPEN);
            }
        }
    }
}

function _finishMinigame(completed) {
    _active = false;
    _result = {
        xp: _scatteredLoot.xp,
        healthRestored: _scatteredLoot.healthRestored,
        coins: _scatteredLoot.coins,
        lockerReward: _lockerOpened ? _lockerReward : null,
        completed: completed && _lockerOpened,
    };
}

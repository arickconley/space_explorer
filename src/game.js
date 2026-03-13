// ---------------------------------------------------------------------------
// game.js  --  main game state machine and loop
// ---------------------------------------------------------------------------

import { input, drawJoysticks } from './input.js';
import { camera } from './camera.js';
import {
    player, initPlayer, updatePlayer, drawPlayer,
    damagePlayer, applyPermanentUpgrades,
} from './player.js';
import { projectiles, updateProjectiles, drawProjectiles } from './projectiles.js';
import {
    enemies, updateEnemies, drawEnemies, spawnWave, getSpawnRate,
} from './enemies.js';
import { initBackground, drawBackground } from './background.js';
import { getVisibleAsteroids, updateAsteroids, drawAsteroids } from './map.js';
import {
    getVisibleDerelicts, drawDerelicts, checkDerelictInteraction, updateDerelicts,
    markDerelictLooted,
} from './derelicts.js';
import { initDerelict, updateDerelict, drawDerelict } from './derelict-minigame/index.js';
import { particles, updateParticles, drawParticles } from './particles.js';
import {
    powerups, updatePowerups, drawPowerups, checkPowerupCollection, spawnPowerup,
} from './powerups.js';
import { addXp } from './player.js';
import { checkCollisions } from './collision.js';
import { drawHUD, drawMinimap } from './hud.js';
import { initCrew, updateCrew, drawCrewHUD, scanDerelicts, scanPlanets, addSpareParts } from './crew.js';
import {
    drawSkillTreeScreen, navigateSkillTree, purchaseSkill,
    getSkillNodeAtPosition, isDoneButtonHit, getDefaultSelectedNode,
    applyAllSkillEffects,
} from './skilltree.js';
import { drawDeathScreen, permanentUpgradesList } from './upgrades.js';
import { drawMainMenu } from './menu.js';
import {
    updatePlanets, drawPlanets, checkPlanetInteraction,
    getNearbyPlanets,
} from './planets.js';
import { initLanding, updateLanding, drawLanding } from './planet-minigame/index.js';
import { initMarket, updateMarket, drawMarket, handleMarketTap } from './planet-minigame/market.js';

// ---- game state -----------------------------------------------------------

let state         = 'menu';   // 'menu' | 'playing' | 'skilltree' | 'dead' | 'derelict' | 'planet-landing' | 'planet-market'
let gameTime      = 0;
let difficulty    = 1;
let lastSpawnTime = 0;
let selectedIndex = 0;
let selectedSkillNode = null;
let runStats      = { timeSurvived: 0, enemiesKilled: 0, levelReached: 1 };
let enemiesKilled = 0;

// Canvas / context references (set in initGame)
let _canvas = null;
let _ctx    = null;

// Active derelict being explored
let _activeDerelict = null;

// Active planet being visited
let _activePlanet = null;
let _planetCooldown = 0; // seconds until planet interaction re-enabled

// Previous frame key state for detecting presses (not holds)
let prevKeys = new Set();

// Timestamp of previous frame (for delta-time calculation)
let _lastTimestamp = 0;

// Touch-tap tracking for UI interactions
let _tapDetected = false;
let _tapX = 0;
let _tapY = 0;

// ---- helpers --------------------------------------------------------------

function keyPressed(key) {
    return input.keys.has(key) && !prevKeys.has(key);
}

function tapPressed() {
    return _tapDetected;
}

function snapshotKeys() {
    prevKeys = new Set(input.keys);
    _tapDetected = false;
}

function resizeCanvas() {
    _canvas.width  = window.innerWidth;
    _canvas.height = window.innerHeight;
}

function clearArrays() {
    projectiles.length = 0;
    enemies.length     = 0;
    particles.length   = 0;
    powerups.length    = 0;
}

function resetRun() {
    gameTime      = 0;
    difficulty    = 1;
    lastSpawnTime = 0;
    enemiesKilled = 0;
    selectedIndex = 0;
    selectedSkillNode = null;
    runStats = { timeSurvived: 0, enemiesKilled: 0, levelReached: 1 };

    clearArrays();
    initPlayer();
    applyPermanentUpgrades();
    initCrew();
    applyAllSkillEffects();
    _planetCooldown = 3;
}

// ---- state handlers -------------------------------------------------------

function updateMenu() {
    const cw = _canvas.width;
    const ch = _canvas.height;

    const menuTime = performance.now() / 1000;
    drawMainMenu(_ctx, cw, ch, menuTime, player.permanentUpgrades);

    if (keyPressed('enter') || tapPressed()) {
        resetRun();
        state = 'playing';
    }
}

function updatePlaying(dt) {
    const cw = _canvas.width;
    const ch = _canvas.height;

    // ---- advance game time & difficulty
    gameTime += dt;
    difficulty = 1 + Math.floor(gameTime / 60);

    // ---- update systems
    updatePlayer(dt, gameTime);
    updateEnemies(dt, player.x, player.y, gameTime, difficulty);
    updateCrew(dt, gameTime);

    // Spawn waves
    if (gameTime - lastSpawnTime > getSpawnRate(difficulty)) {
        spawnWave(player.x, player.y, difficulty, gameTime);
        lastSpawnTime = gameTime;
    }

    updateProjectiles(dt);
    updateAsteroids(dt);
    updateDerelicts(dt);
    updatePlanets(dt);
    updateParticles(dt);
    updatePowerups(dt, gameTime);

    // ---- power-up collection
    checkPowerupCollection(player, gameTime);

    // ---- cartographer scan for derelicts and planets
    {
        const pseudoCam = {
            x: player.x - 4000,
            y: player.y - 4000,
        };
        const nearbyDerelicts = getVisibleDerelicts(pseudoCam, 8000, 8000);
        scanDerelicts(nearbyDerelicts);

        const nearbyPlanets = getNearbyPlanets(player.x, player.y, 4000);
        scanPlanets(nearbyPlanets);
    }

    // ---- derelict interaction
    const interaction = checkDerelictInteraction(player);
    if (interaction.enterDerelict) {
        _activeDerelict = interaction.enterDerelict;
        initDerelict(interaction.enterDerelict, player);
        state = 'derelict';
    }

    // ---- planet interaction (with cooldown to prevent immediate re-entry)
    if (state === 'playing') {
        if (_planetCooldown > 0) {
            _planetCooldown -= dt;
        } else {
            const planetInteraction = checkPlanetInteraction(player);
            if (planetInteraction.enterPlanet) {
                _activePlanet = planetInteraction.enterPlanet;
                initLanding(planetInteraction.enterPlanet, player);
                state = 'planet-landing';
            }
        }
    }

    // ---- collisions
    const prevEnemyCount = enemies.length;
    const { leveledUp } = checkCollisions(gameTime);
    const killed = prevEnemyCount - enemies.length;
    if (killed > 0) enemiesKilled += killed;

    if (leveledUp) {
        selectedSkillNode = getDefaultSelectedNode();
        state = 'skilltree';
    }

    // ---- camera
    camera.update(player.x, player.y, cw, ch);

    // ---- check death
    if (!player.alive) {
        runStats = {
            timeSurvived:  gameTime,
            enemiesKilled: enemiesKilled,
            levelReached:  player.level,
        };
        selectedIndex = 0;
        state = 'dead';
    }

    // ---- render
    drawBackground(_ctx, camera, cw, ch);
    drawAsteroids(_ctx, camera);
    drawDerelicts(_ctx, camera);
    drawPlanets(_ctx, camera);
    drawPowerups(_ctx, camera);
    drawEnemies(_ctx, camera);
    drawPlayer(_ctx, camera);
    drawProjectiles(_ctx, camera);
    drawParticles(_ctx, camera);
    drawHUD(_ctx, cw, ch, gameTime, difficulty);
    drawCrewHUD(_ctx, cw, ch);
    drawMinimap(_ctx, cw, ch, player, enemies, camera);
    drawJoysticks(_ctx);
}

function updateSkillTree() {
    const cw = _canvas.width;
    const ch = _canvas.height;

    // Draw the frozen game scene underneath
    drawBackground(_ctx, camera, cw, ch);
    drawAsteroids(_ctx, camera);
    drawDerelicts(_ctx, camera);
    drawPowerups(_ctx, camera);
    drawEnemies(_ctx, camera);
    drawPlayer(_ctx, camera);
    drawProjectiles(_ctx, camera);
    drawParticles(_ctx, camera);
    drawHUD(_ctx, cw, ch, gameTime, difficulty);
    drawMinimap(_ctx, cw, ch, player, enemies, camera);

    // Draw skill tree overlay
    drawSkillTreeScreen(_ctx, cw, ch, selectedSkillNode);

    // ---- keyboard navigation
    if (keyPressed('arrowup')) {
        selectedSkillNode = navigateSkillTree(selectedSkillNode, 'up', cw, ch);
    }
    if (keyPressed('arrowdown')) {
        selectedSkillNode = navigateSkillTree(selectedSkillNode, 'down', cw, ch);
    }
    if (keyPressed('arrowleft')) {
        selectedSkillNode = navigateSkillTree(selectedSkillNode, 'left', cw, ch);
    }
    if (keyPressed('arrowright')) {
        selectedSkillNode = navigateSkillTree(selectedSkillNode, 'right', cw, ch);
    }

    // ---- purchase with Enter
    if (keyPressed('enter') && selectedSkillNode) {
        purchaseSkill(selectedSkillNode);
    }

    // ---- close with Escape
    if (keyPressed('escape')) {
        state = 'playing';
        return;
    }

    // ---- touch interaction
    if (tapPressed()) {
        // Check DONE button
        if (isDoneButtonHit(_tapX, _tapY, cw, ch)) {
            state = 'playing';
            return;
        }

        // Check skill nodes
        const hitNode = getSkillNodeAtPosition(_tapX, _tapY, cw, ch);
        if (hitNode) {
            if (hitNode === selectedSkillNode) {
                // Tap again to purchase
                purchaseSkill(hitNode);
            } else {
                selectedSkillNode = hitNode;
            }
        }
    }
}

function updateDerelictState(dt) {
    const cw = _canvas.width;
    const ch = _canvas.height;

    const { done, result } = updateDerelict(dt);
    drawDerelict(_ctx, cw, ch);

    if (done && result) {
        // Apply scattered coins
        if (result.coins > 0) {
            player.coins += result.coins;
        }

        // Apply scattered XP from orbs
        if (result.xp > 0 && addXp(result.xp)) {
            selectedSkillNode = getDefaultSelectedNode();
            markDerelictLooted(_activeDerelict.derelictRef);
            _activeDerelict = null;
            state = 'skilltree';
            return;
        }

        // Apply health restoration
        if (result.healthRestored > 0) {
            player.health = Math.min(player.maxHealth, player.health + result.healthRestored * 10);
        }

        // Apply locker rewards
        if (result.lockerReward) {
            const lr = result.lockerReward;
            if (lr.xp > 0 && addXp(lr.xp)) {
                selectedSkillNode = getDefaultSelectedNode();
                markDerelictLooted(_activeDerelict.derelictRef);
                _activeDerelict = null;
                state = 'skilltree';
                return;
            }
            for (let i = 0; i < lr.powerupCount; i++) {
                const angle = (i / lr.powerupCount) * Math.PI * 2;
                spawnPowerup(
                    _activeDerelict.x + Math.cos(angle) * 60,
                    _activeDerelict.y + Math.sin(angle) * 60,
                );
            }
            if (lr.weaponUpgrade) {
                player.weaponType = lr.weaponUpgrade;
            }
            if (lr.permanentBoost) {
                if (lr.permanentBoost.maxHealth) player.maxHealth += lr.permanentBoost.maxHealth;
                if (lr.permanentBoost.maxShield) player.maxShield += lr.permanentBoost.maxShield;
            }
            if (lr.coins > 0) {
                player.coins += lr.coins;
            }
        }

        // Award spare parts from derelict salvage
        const partsMin = _activeDerelict.type === 'militaryWreck' ? 2 : 1;
        const partsMax = _activeDerelict.type === 'militaryWreck' ? 5 : 3;
        addSpareParts(partsMin + Math.floor(Math.random() * (partsMax - partsMin + 1)));

        // Mark derelict as looted and return to main game
        markDerelictLooted(_activeDerelict.derelictRef);
        _activeDerelict = null;
        state = 'playing';
    }
}

function updatePlanetLanding(dt) {
    const cw = _canvas.width;
    const ch = _canvas.height;

    const { done, result } = updateLanding(dt);
    drawLanding(_ctx, cw, ch);

    if (done && result) {
        if (result.aborted) {
            // Player flew off top — return to space, no damage
            _activePlanet = null;
            _planetCooldown = 3;
            state = 'playing';
        } else if (result.success) {
            // Successful landing — open market
            initMarket(_activePlanet.type);
            state = 'planet-market';
        } else {
            // Crash — damage player and return to space
            damagePlayer(result.damage, gameTime);
            _activePlanet = null;
            _planetCooldown = 3;
            state = 'playing';
        }
    }
}

function updatePlanetMarket() {
    const cw = _canvas.width;
    const ch = _canvas.height;

    drawMarket(_ctx, cw, ch);
    const { done } = updateMarket(0);

    // Handle touch taps
    if (tapPressed()) {
        handleMarketTap(_tapX, _tapY, cw, ch);
    }

    if (done) {
        _activePlanet = null;
        _planetCooldown = 3;
        state = 'playing';
    }
}

function updateDead() {
    const cw = _canvas.width;
    const ch = _canvas.height;
    const launchIdx = permanentUpgradesList.length;

    drawDeathScreen(_ctx, cw, ch, player, selectedIndex, runStats);

    // ---- input: navigate with arrow keys
    if (keyPressed('arrowup')) {
        selectedIndex = Math.max(0, selectedIndex - 1);
    }
    if (keyPressed('arrowdown')) {
        selectedIndex = Math.min(launchIdx, selectedIndex + 1);
    }

    let activateIndex = -1;
    if (keyPressed('enter')) {
        activateIndex = selectedIndex;
    }

    if (tapPressed()) {
        const rowH = 50;
        const rowW = 460;
        const startY = 175;
        const rowX = cw / 2 - rowW / 2;

        for (let i = 0; i < permanentUpgradesList.length; i++) {
            const ry = startY + i * (rowH + 6);
            if (_tapX >= rowX && _tapX <= rowX + rowW && _tapY >= ry && _tapY <= ry + rowH) {
                activateIndex = i;
                selectedIndex = i;
                break;
            }
        }

        const launchY = startY + permanentUpgradesList.length * (rowH + 6) + 16;
        const btnW = 220;
        const btnH = 44;
        const btnX = cw / 2 - btnW / 2;
        if (_tapX >= btnX && _tapX <= btnX + btnW && _tapY >= launchY && _tapY <= launchY + btnH) {
            activateIndex = launchIdx;
            selectedIndex = launchIdx;
        }
    }

    if (activateIndex >= 0) {
        if (activateIndex === launchIdx) {
            resetRun();
            state = 'playing';
        } else {
            const upg      = permanentUpgradesList[activateIndex];
            const curLevel  = player.permanentUpgrades[upg.id] || 0;
            const maxed     = curLevel >= upg.maxLevel;

            if (!maxed) {
                const cost = upg.cost(curLevel);
                if (player.totalXp >= cost) {
                    player.totalXp -= cost;
                    player.permanentUpgrades[upg.id] = curLevel + 1;
                }
            }
        }
    }
}

// ---- main loop ------------------------------------------------------------

function gameLoop(timestamp) {
    requestAnimationFrame(gameLoop);

    if (_lastTimestamp === 0) _lastTimestamp = timestamp;
    let dt = (timestamp - _lastTimestamp) / 1000;
    _lastTimestamp = timestamp;

    if (dt > 0.05) dt = 0.05;

    _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

    switch (state) {
        case 'menu':
            updateMenu();
            break;
        case 'playing':
            updatePlaying(dt);
            break;
        case 'skilltree':
            updateSkillTree();
            break;
        case 'derelict':
            updateDerelictState(dt);
            break;
        case 'planet-landing':
            updatePlanetLanding(dt);
            break;
        case 'planet-market':
            updatePlanetMarket();
            break;
        case 'dead':
            updateDead();
            break;
    }

    snapshotKeys();
}

// ---- public API -----------------------------------------------------------

export function initGame(canvas, ctx) {
    _canvas = canvas;
    _ctx    = ctx;

    input.init(canvas);

    let _touchStartTime = 0;
    let _touchStartPos = { x: 0, y: 0 };
    canvas.addEventListener('touchstart', (e) => {
        if (state !== 'playing' && state !== 'derelict' && state !== 'planet-landing') {
            const t = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            _touchStartTime = performance.now();
            _touchStartPos.x = t.clientX - rect.left;
            _touchStartPos.y = t.clientY - rect.top;
        }
    });
    canvas.addEventListener('touchend', (e) => {
        if (state !== 'playing' && state !== 'derelict' && state !== 'planet-landing') {
            const elapsed = performance.now() - _touchStartTime;
            if (elapsed < 400) {
                const t = e.changedTouches[0];
                const rect = canvas.getBoundingClientRect();
                _tapDetected = true;
                _tapX = t.clientX - rect.left;
                _tapY = t.clientY - rect.top;
            }
        }
    });

    initBackground();

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    _lastTimestamp = 0;
    requestAnimationFrame(gameLoop);
}

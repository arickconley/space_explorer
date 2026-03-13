// ---------------------------------------------------------------------------
// level-generator.js  --  procedural derelict interior (zero-gravity, open)
// ---------------------------------------------------------------------------

import { createTilemap, setTile, TILE, TILE_SIZE } from './tilemap.js';

// ---- seeded PRNG -----------------------------------------------------------

function mulberry32(seed) {
    return function () {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ---- level parameters by type (3x larger, open) ----------------------------

const LEVEL_PARAMS = {
    smallWreck:    { roomCount: [3, 4],  width: 90,  height: 36,  hazardDensity: 'low' },
    cargoShip:     { roomCount: [5, 7],  width: 150, height: 48,  hazardDensity: 'medium' },
    militaryWreck: { roomCount: [7, 10], width: 210, height: 60,  hazardDensity: 'high' },
};

// ---- helpers ---------------------------------------------------------------

function _carveRect(map, col, row, w, h, tileType) {
    for (let r = row; r < row + h; r++) {
        for (let c = col; c < col + w; c++) {
            setTile(map, c, r, tileType);
        }
    }
}

function _rngInt(rng, min, max) {
    return min + Math.floor(rng() * (max - min + 1));
}

// ---- main generator --------------------------------------------------------

export function generateDerelictLevel(seed, derelictType) {
    const rng = mulberry32(seed);
    const params = LEVEL_PARAMS[derelictType] || LEVEL_PARAMS.smallWreck;

    const cols = params.width;
    const rows = params.height;
    const roomCount = _rngInt(rng, params.roomCount[0], params.roomCount[1]);

    // Step 1: Create tilemap filled with WALL
    const map = createTilemap(cols, rows);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            setTile(map, c, r, TILE.WALL);
        }
    }

    // Step 2: Generate large open rooms left to right
    const rooms = [];
    const segmentWidth = Math.floor((cols - 2) / roomCount);

    for (let i = 0; i < roomCount; i++) {
        const roomW = Math.min(_rngInt(rng, 10, 20), segmentWidth - 2);
        const roomH = _rngInt(rng, 10, Math.min(20, rows - 4));
        const roomCol = 1 + i * segmentWidth + Math.floor((segmentWidth - roomW) / 2);
        const maxRow = rows - roomH - 1;
        const roomRow = _rngInt(rng, 1, Math.max(1, maxRow));

        // Carve room interior to EMPTY (big open space)
        _carveRect(map, roomCol, roomRow, roomW, roomH, TILE.EMPTY);

        // Add some interior wall fragments for cover / interest (not blocking)
        const fragmentCount = _rngInt(rng, 0, 3);
        for (let f = 0; f < fragmentCount; f++) {
            const fCol = roomCol + _rngInt(rng, 3, roomW - 4);
            const fRow = roomRow + _rngInt(rng, 3, roomH - 4);
            const fW = _rngInt(rng, 1, 3);
            const fH = _rngInt(rng, 1, 2);
            _carveRect(map, fCol, fRow, fW, fH, TILE.WALL);
        }

        // Add some vent decorations on walls
        const ventCount = _rngInt(rng, 1, 3);
        for (let v = 0; v < ventCount; v++) {
            const side = rng() < 0.5 ? roomCol - 1 : roomCol + roomW;
            const vRow = roomRow + _rngInt(rng, 1, roomH - 2);
            if (side >= 0 && side < cols) {
                setTile(map, side, vRow, TILE.VENT);
            }
        }

        rooms.push({ col: roomCol, row: roomRow, w: roomW, h: roomH });
    }

    // Step 3: Connect rooms with wide corridors (L-shaped when needed)
    for (let i = 0; i < rooms.length - 1; i++) {
        const a = rooms[i];
        const b = rooms[i + 1];

        const aRight = a.col + a.w;
        const bLeft  = b.col;

        // Corridor height: wide enough to float through comfortably
        const corridorH = _rngInt(rng, 4, 7);
        const halfH = Math.floor(corridorH / 2);

        // Vertical centers of each room
        const aMid = a.row + Math.floor(a.h / 2);
        const bMid = b.row + Math.floor(b.h / 2);

        // Clamp corridor exits to within each room's vertical bounds
        const aExitMid = Math.max(a.row + halfH + 1, Math.min(a.row + a.h - halfH - 1, aMid));
        const bExitMid = Math.max(b.row + halfH + 1, Math.min(b.row + b.h - halfH - 1, bMid));

        const aExitTop = Math.max(1, aExitMid - halfH);
        const bExitTop = Math.max(1, bExitMid - halfH);

        // Horizontal midpoint for the vertical segment of the L-shape
        const midCol = Math.floor((aRight + bLeft) / 2);

        // Carve horizontal from room A exit to midpoint
        for (let c = aRight - 1; c <= midCol; c++) {
            for (let r = aExitTop; r < aExitTop + corridorH; r++) {
                if (c >= 0 && c < cols && r >= 0 && r < rows) {
                    setTile(map, c, r, TILE.EMPTY);
                }
            }
        }

        // Carve horizontal from midpoint to room B entrance
        for (let c = midCol; c <= bLeft; c++) {
            for (let r = bExitTop; r < bExitTop + corridorH; r++) {
                if (c >= 0 && c < cols && r >= 0 && r < rows) {
                    setTile(map, c, r, TILE.EMPTY);
                }
            }
        }

        // Carve vertical segment at midpoint connecting the two horizontal runs
        const vTop = Math.min(aExitTop, bExitTop);
        const vBot = Math.max(aExitTop + corridorH, bExitTop + corridorH);
        for (let r = vTop; r < vBot; r++) {
            for (let c = midCol - 1; c <= midCol + 1; c++) {
                if (c >= 0 && c < cols && r >= 0 && r < rows) {
                    setTile(map, c, r, TILE.EMPTY);
                }
            }
        }

        // Ensure openings extend into both rooms (carve 2 tiles deep)
        for (let r = aExitTop; r < aExitTop + corridorH; r++) {
            for (let c = aRight - 2; c <= aRight; c++) {
                if (c >= a.col && c < cols && r >= 0 && r < rows) {
                    setTile(map, c, r, TILE.EMPTY);
                }
            }
        }
        for (let r = bExitTop; r < bExitTop + corridorH; r++) {
            for (let c = bLeft - 1; c <= bLeft + 1; c++) {
                if (c >= 0 && c < cols && r >= 0 && r < rows) {
                    setTile(map, c, r, TILE.EMPTY);
                }
            }
        }
    }

    // Step 4: Place sealed doors in corridors
    if (derelictType === 'cargoShip' || derelictType === 'militaryWreck') {
        for (let i = 0; i < rooms.length - 1; i++) {
            if (rng() < 0.3) {
                const a = rooms[i];
                const b = rooms[i + 1];
                const aRight = a.col + a.w;
                const bLeft  = b.col;
                const doorCol = aRight + Math.floor((bLeft - aRight) / 2);

                // Find an EMPTY tile in the corridor at doorCol to place the door
                const aMid = a.row + Math.floor(a.h / 2);
                const bMid = b.row + Math.floor(b.h / 2);
                const searchMid = Math.floor((aMid + bMid) / 2);

                // Scan for empty tiles near the expected midpoint
                let doorRow = -1;
                for (let offset = 0; offset < rows; offset++) {
                    const tryUp = searchMid - offset;
                    const tryDown = searchMid + offset;
                    if (tryUp >= 1 && tryUp < rows - 1 && map.data[tryUp * cols + doorCol] === TILE.EMPTY) {
                        doorRow = tryUp;
                        break;
                    }
                    if (tryDown >= 1 && tryDown < rows - 1 && map.data[tryDown * cols + doorCol] === TILE.EMPTY) {
                        doorRow = tryDown;
                        break;
                    }
                }

                if (doorRow >= 1) {
                    for (let dr = -1; dr <= 1; dr++) {
                        const r = doorRow + dr;
                        if (r >= 0 && r < rows && map.data[r * cols + doorCol] === TILE.EMPTY) {
                            setTile(map, doorCol, r, TILE.DOOR_SEALED);
                        }
                    }
                }
            }
        }
    }

    // Step 5: Place hazards (broken wires on walls, floating debris)
    const hazards = [];
    for (let i = 1; i < rooms.length; i++) {
        const room = rooms[i];
        const density = params.hazardDensity === 'low' ? 2
                      : params.hazardDensity === 'medium' ? 4
                      : 6;
        const hazardCount = _rngInt(rng, Math.floor(density / 2), density);

        for (let h = 0; h < hazardCount; h++) {
            const roll = rng();
            if (roll < 0.5) {
                // Broken wires — sparking from walls
                // Find a wall-adjacent empty tile
                const side = rng() < 0.25 ? 'left' : rng() < 0.5 ? 'right' : rng() < 0.75 ? 'top' : 'bottom';
                let wCol, wRow;
                if (side === 'left') {
                    wCol = room.col;
                    wRow = room.row + _rngInt(rng, 1, room.h - 2);
                } else if (side === 'right') {
                    wCol = room.col + room.w - 1;
                    wRow = room.row + _rngInt(rng, 1, room.h - 2);
                } else if (side === 'top') {
                    wCol = room.col + _rngInt(rng, 1, room.w - 2);
                    wRow = room.row;
                } else {
                    wCol = room.col + _rngInt(rng, 1, room.w - 2);
                    wRow = room.row + room.h - 1;
                }
                hazards.push({
                    type: 'wire',
                    col: wCol,
                    row: wRow,
                    side: side,
                    period: 1.5 + rng() * 2.5,
                    damageRadius: 28,
                });
            } else if (roll < 0.8) {
                // Floating debris — drifts through the room
                const dCol = room.col + _rngInt(rng, 2, room.w - 3);
                const dRow = room.row + _rngInt(rng, 2, room.h - 3);
                hazards.push({
                    type: 'floatingDebris',
                    col: dCol,
                    row: dRow,
                    vx: (rng() - 0.5) * 40,
                    vy: (rng() - 0.5) * 40,
                    size: 4 + rng() * 6,
                    damageRadius: 12,
                    roomIdx: i,
                });
            } else if (derelictType === 'militaryWreck') {
                // Laser grid
                const dir = rng() < 0.5 ? 'horizontal' : 'vertical';
                const lCol = room.col + _rngInt(rng, 2, room.w - 3);
                const lRow = room.row + _rngInt(rng, 2, room.h - 3);
                hazards.push({
                    type: 'laser',
                    col: lCol,
                    row: lRow,
                    direction: dir,
                    period: 2.5 + rng() * 2,
                    beamLength: _rngInt(rng, 4, 8),
                });
            }
        }
    }

    // Step 6: Place pickups scattered throughout rooms
    const pickups = [];
    for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const pickupCount = i === 0 ? _rngInt(rng, 1, 2) : _rngInt(rng, 2, 4);

        for (let p = 0; p < pickupCount; p++) {
            pickups.push({
                type: 'xpOrb',
                col: room.col + _rngInt(rng, 2, room.w - 3),
                row: room.row + _rngInt(rng, 2, room.h - 3),
            });
        }

        if (i > 0 && rng() < 0.3) {
            pickups.push({
                type: 'healthPickup',
                col: room.col + _rngInt(rng, 2, room.w - 3),
                row: room.row + _rngInt(rng, 2, room.h - 3),
            });
        }

        // Coin pickups (40% chance per room)
        if (rng() < 0.4) {
            const coinMin = derelictType === 'militaryWreck' ? 2 : 1;
            const coinMax = derelictType === 'militaryWreck' ? 4
                          : derelictType === 'cargoShip' ? 3 : 2;
            const coinCount = _rngInt(rng, coinMin, coinMax);
            for (let c = 0; c < coinCount; c++) {
                pickups.push({
                    type: 'coinPickup',
                    col: room.col + _rngInt(rng, 2, room.w - 3),
                    row: room.row + _rngInt(rng, 2, room.h - 3),
                });
            }
        }
    }

    // Step 7: Place entry/exit airlock (leftmost room, left wall)
    const spawnRoom = rooms[0];
    const spawnCol = spawnRoom.col;
    const spawnRow = spawnRoom.row + Math.floor(spawnRoom.h / 2);
    const exitCol = spawnCol;
    const exitRow = spawnRow;
    setTile(map, spawnCol, spawnRow, TILE.AIRLOCK);

    // Step 8: Place end locker (rightmost room, right side)
    const lastRoom = rooms[rooms.length - 1];
    const lockerCol = lastRoom.col + lastRoom.w - 2;
    const lockerRow = lastRoom.row + Math.floor(lastRoom.h / 2);
    setTile(map, lockerCol, lockerRow, TILE.LOCKER);

    return {
        map,
        hazards,
        pickups,
        lockerCol,
        lockerRow,
        spawnCol,
        spawnRow,
        exitCol,
        exitRow,
        rooms,
    };
}

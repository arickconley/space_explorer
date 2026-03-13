// ---------------------------------------------------------------------------
// tilemap.js  --  tile constants, grid storage, collision queries, rendering
// ---------------------------------------------------------------------------

export const TILE_SIZE = 32;

export const TILE = {
    EMPTY:        0,
    WALL:         1,
    FLOOR:        2,
    BROKEN_FLOOR: 3,
    PLATFORM:     4,
    DOOR_SEALED:  5,
    DOOR_OPEN:    6,
    VENT:         7,
    LOCKER:       8,
    AIRLOCK:      9,
};

// ---- tilemap data structure ------------------------------------------------

export function createTilemap(cols, rows) {
    return {
        cols,
        rows,
        data: new Uint8Array(cols * rows),
    };
}

export function getTile(map, col, row) {
    if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return TILE.WALL;
    return map.data[row * map.cols + col];
}

export function setTile(map, col, row, type) {
    if (col < 0 || col >= map.cols || row < 0 || row >= map.rows) return;
    map.data[row * map.cols + col] = type;
}

// ---- collision helpers -----------------------------------------------------

export function isSolid(tileType) {
    return tileType === TILE.WALL ||
           tileType === TILE.DOOR_SEALED;
}

export function isOneWay(tileType) {
    return tileType === TILE.PLATFORM ||
           tileType === TILE.FLOOR ||
           tileType === TILE.BROKEN_FLOOR;
}

export function worldToTile(px, py) {
    return {
        col: Math.floor(px / TILE_SIZE),
        row: Math.floor(py / TILE_SIZE),
    };
}

export function tileToWorld(col, row) {
    return {
        x: col * TILE_SIZE,
        y: row * TILE_SIZE,
    };
}

/**
 * Given an AABB in pixel space, returns collision info against the tilemap.
 * @param {object} map   Tilemap
 * @param {number} x     left edge
 * @param {number} y     top edge
 * @param {number} w     width
 * @param {number} h     height
 * @returns {{ left: boolean, right: boolean, top: boolean, bottom: boolean, tiles: {col:number,row:number,type:number}[] }}
 */
export function collideRect(map, x, y, w, h) {
    const result = { left: false, right: false, top: false, bottom: false, tiles: [] };

    const startCol = Math.floor(x / TILE_SIZE);
    const endCol   = Math.floor((x + w - 0.01) / TILE_SIZE);
    const startRow = Math.floor(y / TILE_SIZE);
    const endRow   = Math.floor((y + h - 0.01) / TILE_SIZE);

    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            const t = getTile(map, col, row);
            if (isSolid(t)) {
                result.tiles.push({ col, row, type: t });

                const tileLeft   = col * TILE_SIZE;
                const tileRight  = tileLeft + TILE_SIZE;
                const tileTop    = row * TILE_SIZE;
                const tileBottom = tileTop + TILE_SIZE;

                // Determine which edge the overlap is on
                const overlapLeft   = (x + w) - tileLeft;
                const overlapRight  = tileRight - x;
                const overlapTop    = (y + h) - tileTop;
                const overlapBottom = tileBottom - y;

                if (overlapLeft < overlapRight && overlapLeft < overlapTop && overlapLeft < overlapBottom) {
                    result.right = true;
                } else if (overlapRight < overlapLeft && overlapRight < overlapTop && overlapRight < overlapBottom) {
                    result.left = true;
                } else if (overlapTop < overlapBottom) {
                    result.bottom = true;
                } else {
                    result.top = true;
                }
            }
        }
    }

    return result;
}

// ---- tile rendering --------------------------------------------------------

export function drawTilemap(ctx, map, cam, time) {
    const startCol = Math.max(0, Math.floor(cam.x / TILE_SIZE) - 1);
    const endCol   = Math.min(map.cols - 1, Math.floor((cam.x + cam.width) / TILE_SIZE) + 1);
    const startRow = Math.max(0, Math.floor(cam.y / TILE_SIZE) - 1);
    const endRow   = Math.min(map.rows - 1, Math.floor((cam.y + cam.height) / TILE_SIZE) + 1);

    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            const t = map.data[row * map.cols + col];
            if (t === TILE.EMPTY) continue;

            const sx = col * TILE_SIZE - cam.x;
            const sy = row * TILE_SIZE - cam.y;

            switch (t) {
                case TILE.WALL:
                    _drawWall(ctx, sx, sy, col, row);
                    break;
                case TILE.FLOOR:
                    _drawFloor(ctx, sx, sy);
                    break;
                case TILE.BROKEN_FLOOR:
                    _drawBrokenFloor(ctx, sx, sy, time);
                    break;
                case TILE.PLATFORM:
                    _drawPlatform(ctx, sx, sy);
                    break;
                case TILE.DOOR_SEALED:
                    _drawSealedDoor(ctx, sx, sy, time);
                    break;
                case TILE.DOOR_OPEN:
                    _drawOpenDoor(ctx, sx, sy);
                    break;
                case TILE.VENT:
                    _drawVent(ctx, sx, sy);
                    break;
                case TILE.LOCKER:
                    _drawLocker(ctx, sx, sy, time);
                    break;
                case TILE.AIRLOCK:
                    _drawAirlock(ctx, sx, sy, time);
                    break;
            }
        }
    }
}

function _drawWall(ctx, sx, sy, col, row) {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = 'rgba(0,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

    // Occasional rivet dots
    if ((col * 7 + row * 13) % 5 === 0) {
        ctx.fillStyle = 'rgba(0,255,255,0.2)';
        ctx.beginPath();
        ctx.arc(sx + 8, sy + 8, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
    if ((col * 11 + row * 3) % 7 === 0) {
        ctx.fillStyle = 'rgba(0,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(sx + TILE_SIZE - 8, sy + TILE_SIZE - 8, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

function _drawFloor(ctx, sx, sy) {
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(sx, sy, TILE_SIZE, 6);
    ctx.fillStyle = 'rgba(0,255,255,0.3)';
    ctx.fillRect(sx, sy, TILE_SIZE, 1);
}

function _drawBrokenFloor(ctx, sx, sy, time) {
    ctx.strokeStyle = 'rgba(255,180,50,0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(sx + 1, sy + 1, TILE_SIZE - 2, 4);
    ctx.setLineDash([]);

    // Crack lines
    ctx.strokeStyle = 'rgba(255,140,40,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + 6, sy + 1);
    ctx.lineTo(sx + 10, sy + 5);
    ctx.moveTo(sx + 18, sy + 2);
    ctx.lineTo(sx + 22, sy + 5);
    ctx.moveTo(sx + 26, sy + 1);
    ctx.lineTo(sx + 28, sy + 4);
    ctx.stroke();
}

function _drawPlatform(ctx, sx, sy) {
    ctx.strokeStyle = 'rgba(0,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, sy + 2);
    ctx.lineTo(sx + TILE_SIZE, sy + 2);
    ctx.stroke();
    ctx.setLineDash([]);
}

function _drawSealedDoor(ctx, sx, sy, time) {
    const pulse = 0.5 + 0.3 * Math.sin(time * 3);
    ctx.save();
    ctx.shadowColor = `rgba(255,80,30,${pulse})`;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(255,80,30,${0.6 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    // X pattern
    ctx.beginPath();
    ctx.moveTo(sx + 4, sy + 4);
    ctx.lineTo(sx + TILE_SIZE - 4, sy + TILE_SIZE - 4);
    ctx.moveTo(sx + TILE_SIZE - 4, sy + 4);
    ctx.lineTo(sx + 4, sy + TILE_SIZE - 4);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
}

function _drawOpenDoor(ctx, sx, sy) {
    ctx.strokeStyle = 'rgba(50,255,100,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    // Gap in center
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(sx + 6, sy + 8, TILE_SIZE - 12, TILE_SIZE - 16);
}

function _drawVent(ctx, sx, sy) {
    ctx.fillStyle = 'rgba(15,15,25,0.6)';
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = 'rgba(0,255,255,0.08)';
    ctx.lineWidth = 1;
    // Grid lines
    for (let i = 8; i < TILE_SIZE; i += 8) {
        ctx.beginPath();
        ctx.moveTo(sx + i, sy);
        ctx.lineTo(sx + i, sy + TILE_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx, sy + i);
        ctx.lineTo(sx + TILE_SIZE, sy + i);
        ctx.stroke();
    }
}

function _drawLocker(ctx, sx, sy, time) {
    const pulse = 0.5 + 0.4 * Math.sin(time * 2.5);
    ctx.save();
    ctx.shadowColor = `rgba(255,215,0,${pulse})`;
    ctx.shadowBlur = 12;
    // Box body
    ctx.fillStyle = 'rgba(40,35,10,0.8)';
    ctx.fillRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    ctx.strokeStyle = `rgba(255,215,0,${0.6 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 4, sy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    // Handle/lock icon
    ctx.fillStyle = `rgba(255,215,0,${0.7 + pulse * 0.2})`;
    ctx.fillRect(sx + 13, sy + 14, 6, 4);
    ctx.shadowBlur = 0;
    ctx.restore();
}

function _drawAirlock(ctx, sx, sy, time) {
    const pulse = 0.5 + 0.4 * Math.sin(time * 2);
    ctx.save();
    // Door frame
    ctx.fillStyle = 'rgba(20,25,35,0.9)';
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    // Thick border
    ctx.shadowColor = `rgba(0,255,200,${pulse * 0.6})`;
    ctx.shadowBlur = 8;
    ctx.strokeStyle = `rgba(0,255,200,${0.5 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    // Horizontal split line (double door)
    ctx.beginPath();
    ctx.moveTo(sx + TILE_SIZE / 2, sy + 4);
    ctx.lineTo(sx + TILE_SIZE / 2, sy + TILE_SIZE - 4);
    ctx.stroke();
    // EXIT label
    ctx.shadowBlur = 0;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(0,255,200,${0.6 + pulse * 0.3})`;
    ctx.fillText('EXIT', sx + TILE_SIZE / 2, sy + TILE_SIZE / 2);
    ctx.restore();
}

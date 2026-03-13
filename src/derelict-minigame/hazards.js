// ---------------------------------------------------------------------------
// hazards.js  --  zero-gravity hazards: broken wires, floating debris, lasers
// ---------------------------------------------------------------------------

import { TILE_SIZE, getTile, setTile, TILE } from './tilemap.js';
import { damagePlatformerPlayer } from './platformer-player.js';

// ---- creation --------------------------------------------------------------

export function createHazards(hazardDefs, map, rooms) {
    const instances = [];

    for (const def of hazardDefs) {
        const x = def.col * TILE_SIZE + TILE_SIZE / 2;
        const y = def.row * TILE_SIZE + TILE_SIZE / 2;

        switch (def.type) {
            case 'wire':
                instances.push({
                    type: 'wire',
                    x, y,
                    col: def.col,
                    row: def.row,
                    side: def.side,
                    timer: 0,
                    period: def.period || 2,
                    active: false,
                    burstDuration: 0.4,
                    damageRadius: def.damageRadius || 28,
                });
                break;

            case 'floatingDebris': {
                // Find room bounds for bouncing
                const room = rooms && rooms[def.roomIdx] ? rooms[def.roomIdx] : null;
                instances.push({
                    type: 'floatingDebris',
                    x, y,
                    vx: def.vx || 0,
                    vy: def.vy || 0,
                    size: def.size || 6,
                    damageRadius: def.damageRadius || 12,
                    rotation: 0,
                    rotSpeed: (Math.random() - 0.5) * 3,
                    // Bounds for bouncing
                    boundsLeft:   room ? room.col * TILE_SIZE + TILE_SIZE : x - 200,
                    boundsRight:  room ? (room.col + room.w) * TILE_SIZE - TILE_SIZE : x + 200,
                    boundsTop:    room ? room.row * TILE_SIZE + TILE_SIZE : y - 200,
                    boundsBottom: room ? (room.row + room.h) * TILE_SIZE - TILE_SIZE : y + 200,
                    // Random polygon shape (4-6 vertices)
                    vertices: _genDebrisShape(def.size || 6),
                });
                break;
            }

            case 'laser':
                instances.push({
                    type: 'laser',
                    x, y,
                    col: def.col,
                    row: def.row,
                    direction: def.direction || 'horizontal',
                    period: def.period || 3,
                    timer: 0,
                    active: false,
                    warming: false,
                    onDuration: 1.5,
                    warmupTime: 0.5,
                    beamLength: def.beamLength || 5,
                });
                break;
        }
    }

    return instances;
}

function _genDebrisShape(size) {
    const count = 4 + Math.floor(Math.random() * 3);
    const verts = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const r = size * (0.5 + Math.random() * 0.5);
        verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }
    return verts;
}

// ---- update ----------------------------------------------------------------

export function updateHazards(dt, time, hazards, player, map) {
    for (const h of hazards) {
        switch (h.type) {
            case 'wire':
                _updateWire(h, dt, player);
                break;
            case 'floatingDebris':
                _updateFloatingDebris(h, dt, player);
                break;
            case 'laser':
                _updateLaser(h, dt, player);
                break;
        }
    }
}

function _updateWire(h, dt, player) {
    h.timer += dt;
    const cyclePos = h.timer % h.period;
    h.active = cyclePos < h.burstDuration;

    if (h.active) {
        const dx = player.x - h.x;
        const dy = player.y - h.y;
        if (dx * dx + dy * dy < h.damageRadius * h.damageRadius) {
            damagePlatformerPlayer(player, 1);
        }
    }
}

function _updateFloatingDebris(h, dt, player) {
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.rotation += h.rotSpeed * dt;

    // Bounce off room bounds
    if (h.x - h.size < h.boundsLeft)  { h.x = h.boundsLeft + h.size;  h.vx = Math.abs(h.vx); }
    if (h.x + h.size > h.boundsRight) { h.x = h.boundsRight - h.size; h.vx = -Math.abs(h.vx); }
    if (h.y - h.size < h.boundsTop)    { h.y = h.boundsTop + h.size;    h.vy = Math.abs(h.vy); }
    if (h.y + h.size > h.boundsBottom) { h.y = h.boundsBottom - h.size; h.vy = -Math.abs(h.vy); }

    // Player collision
    const dx = player.x - h.x;
    const dy = player.y - h.y;
    if (dx * dx + dy * dy < (h.damageRadius + player.radius) * (h.damageRadius + player.radius)) {
        damagePlatformerPlayer(player, 1);
    }
}

function _updateLaser(h, dt, player) {
    h.timer += dt;
    const cyclePos = h.timer % h.period;
    const offTime = h.period - h.onDuration - h.warmupTime;

    h.active = false;
    h.warming = false;

    if (cyclePos > offTime + h.warmupTime) {
        h.active = true;
    } else if (cyclePos > offTime) {
        h.warming = true;
    }

    if (h.active) {
        const beamPx = h.beamLength * TILE_SIZE;
        if (h.direction === 'horizontal') {
            if (player.x > h.x && player.x < h.x + beamPx &&
                Math.abs(player.y - h.y) < 12) {
                damagePlatformerPlayer(player, 1);
            }
        } else {
            if (player.y > h.y && player.y < h.y + beamPx &&
                Math.abs(player.x - h.x) < 12) {
                damagePlatformerPlayer(player, 1);
            }
        }
    }
}

// ---- rendering -------------------------------------------------------------

export function drawHazards(ctx, cam, hazards, time) {
    for (const h of hazards) {
        switch (h.type) {
            case 'wire':
                _drawWire(ctx, cam, h, time);
                break;
            case 'floatingDebris':
                _drawFloatingDebris(ctx, cam, h, time);
                break;
            case 'laser':
                _drawLaser(ctx, cam, h, time);
                break;
        }
    }
}

function _drawWire(ctx, cam, h, time) {
    const sx = h.x - cam.x;
    const sy = h.y - cam.y;

    // Wire dangling from wall
    ctx.save();
    ctx.strokeStyle = 'rgba(120,120,140,0.7)';
    ctx.lineWidth = 2;

    const wireLen = 18;
    const wobble = Math.sin(time * 2 + h.col) * 3;
    let endX = sx, endY = sy;

    if (h.side === 'left' || h.side === 'right') {
        const dir = h.side === 'left' ? 1 : -1;
        endX = sx + dir * wireLen;
        endY = sy + wobble;
    } else {
        const dir = h.side === 'top' ? 1 : -1;
        endX = sx + wobble;
        endY = sy + dir * wireLen;
    }

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    // Slight curve
    ctx.quadraticCurveTo(
        (sx + endX) / 2 + wobble * 0.5,
        (sy + endY) / 2 + wobble * 0.5,
        endX, endY
    );
    ctx.stroke();

    // Spark tip
    ctx.fillStyle = h.active ? 'rgba(255,220,50,0.9)' : 'rgba(255,200,50,0.4)';
    ctx.beginPath();
    ctx.arc(endX, endY, h.active ? 4 : 2, 0, Math.PI * 2);
    ctx.fill();

    if (h.active) {
        // Spark burst at wire end
        ctx.shadowColor = 'rgba(255,180,50,0.8)';
        ctx.shadowBlur = 12;
        for (let i = 0; i < 5; i++) {
            const angle = (time * 8 + i * 1.3) % (Math.PI * 2);
            const dist = 4 + Math.random() * 14;
            const px = endX + Math.cos(angle) * dist;
            const py = endY + Math.sin(angle) * dist;
            ctx.fillStyle = `rgba(255,${200 + Math.floor(Math.random() * 55)},50,${0.5 + Math.random() * 0.5})`;
            ctx.beginPath();
            ctx.arc(px, py, 1 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        // Electric arc line
        ctx.strokeStyle = 'rgba(255,255,100,0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        for (let s = 1; s <= 3; s++) {
            ctx.lineTo(
                endX + (Math.random() - 0.5) * h.damageRadius,
                endY + (Math.random() - 0.5) * h.damageRadius
            );
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    ctx.restore();
}

function _drawFloatingDebris(ctx, cam, h, time) {
    const sx = h.x - cam.x;
    const sy = h.y - cam.y;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(h.rotation);

    ctx.fillStyle = 'rgba(70,70,85,0.9)';
    ctx.strokeStyle = 'rgba(140,140,160,0.5)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    if (h.vertices && h.vertices.length > 0) {
        ctx.moveTo(h.vertices[0].x, h.vertices[0].y);
        for (let i = 1; i < h.vertices.length; i++) {
            ctx.lineTo(h.vertices[i].x, h.vertices[i].y);
        }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
}

function _drawLaser(ctx, cam, h, time) {
    const sx = h.x - cam.x;
    const sy = h.y - cam.y;
    const beamPx = h.beamLength * TILE_SIZE;

    ctx.save();

    if (h.active) {
        ctx.shadowColor = 'rgba(255,30,30,0.8)';
        ctx.shadowBlur = 8;
        ctx.strokeStyle = 'rgba(255,50,50,0.9)';
        ctx.lineWidth = 4;
    } else if (h.warming) {
        const flicker = Math.sin(time * 30) > 0 ? 0.5 : 0.15;
        ctx.strokeStyle = `rgba(255,50,50,${flicker})`;
        ctx.lineWidth = 2;
    } else {
        ctx.strokeStyle = 'rgba(255,30,30,0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
    }

    ctx.beginPath();
    if (h.direction === 'horizontal') {
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + beamPx, sy);
    } else {
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + beamPx);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.restore();
}

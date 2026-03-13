// ---------------------------------------------------------------------------
// utils.js  --  math helpers & constants for a 2-D space-shooter
// ---------------------------------------------------------------------------

/** The world is a square of this size (pixels). */
export const WORLD_SIZE = 50000;

/**
 * Euclidean distance between two points.
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {number}
 */
export function distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Angle (radians) from point a to point b.
 * 0 = right, PI/2 = down (canvas convention).
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @returns {number}
 */
export function angle(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * Linear interpolation between a and b by factor t (0-1).
 */
export function lerp(a, b, t) {
    return a + (b - a) * t;
}

/**
 * Clamp val to the inclusive range [min, max].
 */
export function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
}

/**
 * Random floating-point number in [min, max).
 */
export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

/**
 * Random integer in [min, max] (inclusive).
 */
export function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
}

/**
 * Returns true when two circles overlap.
 * Each object must have { x, y, radius }.
 */
export function circleCollision(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distSq = dx * dx + dy * dy;
    const radii = a.radius + b.radius;
    return distSq <= radii * radii;
}

/**
 * Returns true if the point (px, py) lies inside the rectangle
 * defined by top-left (rx, ry) and dimensions (rw, rh).
 */
export function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

/**
 * Normalize a 2-D vector.  Returns { x, y } with length 1,
 * or { x: 0, y: 0 } when the input length is 0.
 */
export function normalize(x, y) {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
}

// ---------------------------------------------------------------------------
// camera.js  --  viewport that follows the player (singleton)
// ---------------------------------------------------------------------------

const camera = {
    /** Top-left corner of the viewport in world coordinates. */
    x: 0,
    y: 0,

    /** Viewport dimensions (set each frame via update). */
    width: 0,
    height: 0,

    /**
     * Centre the camera on the player.
     * Call once per frame before any rendering.
     *
     * @param {number} playerX  Player world-x
     * @param {number} playerY  Player world-y
     * @param {number} canvasWidth   Canvas pixel width
     * @param {number} canvasHeight  Canvas pixel height
     */
    update(playerX, playerY, canvasWidth, canvasHeight) {
        this.width  = canvasWidth;
        this.height = canvasHeight;
        this.x = playerX - canvasWidth  / 2;
        this.y = playerY - canvasHeight / 2;
    },

    /**
     * Convert a world-space position to screen (canvas) pixels.
     * @param {number} wx  World x
     * @param {number} wy  World y
     * @returns {{x:number, y:number}}
     */
    worldToScreen(wx, wy) {
        return {
            x: wx - this.x,
            y: wy - this.y,
        };
    },

    /**
     * Convert a screen (canvas-pixel) position to world coordinates.
     * @param {number} sx  Screen x
     * @param {number} sy  Screen y
     * @returns {{x:number, y:number}}
     */
    screenToWorld(sx, sy) {
        return {
            x: sx + this.x,
            y: sy + this.y,
        };
    },

    /**
     * Returns true when a world-space point would be visible on screen
     * (optionally expanded by `margin` pixels on every side).
     *
     * @param {number} wx      World x
     * @param {number} wy      World y
     * @param {number} [margin=0]  Extra padding around the viewport
     * @returns {boolean}
     */
    isVisible(wx, wy, margin = 0) {
        return (
            wx >= this.x - margin &&
            wx <= this.x + this.width  + margin &&
            wy >= this.y - margin &&
            wy <= this.y + this.height + margin
        );
    },
};

export { camera };

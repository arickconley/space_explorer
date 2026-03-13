// ---------------------------------------------------------------------------
// input.js  --  unified keyboard + dual virtual-joystick input
// ---------------------------------------------------------------------------

const TWO_PI = Math.PI * 2;

/**
 * A virtual joystick state object.
 * active  – finger is currently touching
 * originX/Y – center of the joystick (where the touch started)
 * x, y   – current touch position
 * dx, dy – offset from origin (pixels)
 * dist   – distance from origin (0-1, clamped to maxRadius)
 * angle  – angle of the offset in radians
 */
function createStick() {
    return {
        active: false,
        touchId: null,
        originX: 0, originY: 0,
        x: 0, y: 0,
        dx: 0, dy: 0,
        dist: 0,
        angle: 0,
    };
}

const JOYSTICK_MAX_RADIUS = 60; // px – the "leash" range of the virtual stick

const input = {
    // ---- keyboard state -----------------------------------------------------
    keys: new Set(),

    mouse: { x: 0, y: 0 },

    isDown(key) {
        return this.keys.has(key.toLowerCase());
    },

    // ---- joystick state -----------------------------------------------------
    /** Left stick – movement (thrust + rotation) */
    moveStick: createStick(),

    /** Right stick – aim / fire */
    aimStick: createStick(),

    /** True if a touch device has been detected (hides keyboard prompts) */
    isTouchDevice: false,

    /** Canvas reference, stored for coordinate conversion */
    _canvas: null,

    // ---- public API ---------------------------------------------------------

    /**
     * Attach all input listeners to the canvas / window.
     * @param {HTMLCanvasElement} canvas
     */
    init(canvas) {
        this._canvas = canvas;

        // ---- keyboard -------------------------------------------------------
        window.addEventListener('keydown', (e) => {
            this.keys.add(e.key.toLowerCase());
        });
        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.key.toLowerCase());
        });

        // ---- mouse ----------------------------------------------------------
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // ---- touch (dual virtual joysticks) ---------------------------------
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.isTouchDevice = true;
            this._handleTouches(e.changedTouches, 'start');
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this._handleTouches(e.changedTouches, 'move');
        }, { passive: false });

        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this._handleTouches(e.changedTouches, 'end');
        }, { passive: false });

        canvas.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            this._handleTouches(e.changedTouches, 'end');
        }, { passive: false });
    },

    // ---- internal touch handling --------------------------------------------

    _handleTouches(changedTouches, phase) {
        const canvas = this._canvas;
        const rect = canvas.getBoundingClientRect();
        const halfW = canvas.width / 2;

        for (let i = 0; i < changedTouches.length; i++) {
            const t = changedTouches[i];
            const tx = t.clientX - rect.left;
            const ty = t.clientY - rect.top;

            if (phase === 'start') {
                // Decide which stick this touch belongs to based on screen half
                const stick = tx < halfW ? this.moveStick : this.aimStick;

                // Only assign if this stick doesn't already have a touch
                if (!stick.active) {
                    stick.active = true;
                    stick.touchId = t.identifier;
                    stick.originX = tx;
                    stick.originY = ty;
                    stick.x = tx;
                    stick.y = ty;
                    stick.dx = 0;
                    stick.dy = 0;
                    stick.dist = 0;
                    stick.angle = 0;
                }
            } else if (phase === 'move') {
                const stick = this._stickForTouch(t.identifier);
                if (!stick) continue;

                stick.x = tx;
                stick.y = ty;
                stick.dx = tx - stick.originX;
                stick.dy = ty - stick.originY;

                const rawDist = Math.sqrt(stick.dx * stick.dx + stick.dy * stick.dy);
                stick.dist = Math.min(1, rawDist / JOYSTICK_MAX_RADIUS);
                stick.angle = Math.atan2(stick.dy, stick.dx);

                // Clamp the visual position to max radius
                if (rawDist > JOYSTICK_MAX_RADIUS) {
                    stick.x = stick.originX + Math.cos(stick.angle) * JOYSTICK_MAX_RADIUS;
                    stick.y = stick.originY + Math.sin(stick.angle) * JOYSTICK_MAX_RADIUS;
                }
            } else if (phase === 'end') {
                const stick = this._stickForTouch(t.identifier);
                if (!stick) continue;

                stick.active = false;
                stick.touchId = null;
                stick.dx = 0;
                stick.dy = 0;
                stick.dist = 0;
            }
        }
    },

    _stickForTouch(id) {
        if (this.moveStick.touchId === id) return this.moveStick;
        if (this.aimStick.touchId === id) return this.aimStick;
        return null;
    },
};

// ---- joystick rendering (drawn on top of everything) ----------------------

/**
 * Draw both virtual joysticks if touch input is active.
 * Call this after all other HUD drawing.
 *
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawJoysticks(ctx) {
    if (!input.isTouchDevice) return;

    _drawStick(ctx, input.moveStick, '#0ff');
    _drawStick(ctx, input.aimStick, '#f80');
}

function _drawStick(ctx, stick, color) {
    if (!stick.active) return;

    ctx.save();
    ctx.globalAlpha = 0.3;

    // Outer ring (origin)
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.arc(stick.originX, stick.originY, JOYSTICK_MAX_RADIUS, 0, TWO_PI);
    ctx.stroke();

    // Inner filled circle (thumb position)
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(stick.x, stick.y, 22, 0, TWO_PI);
    ctx.fill();

    // Bright center dot
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.arc(stick.x, stick.y, 8, 0, TWO_PI);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
}

export { input };

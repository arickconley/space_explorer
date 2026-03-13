// ---------------------------------------------------------------------------
// terrain-generator.js  --  procedural terrain for the landing sequence
// ---------------------------------------------------------------------------

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

// ---- terrain parameters by planet type ------------------------------------

const TERRAIN_PARAMS = {
    rocky: {
        amplitude: [80, 40, 20],
        frequency: [0.008, 0.02, 0.05],
        baseY: 420,
        bgColor: '#1a0f0a',
        groundColor: '#8a6530',
        groundStroke: '#a0753a',
    },
    gas: {
        amplitude: [30, 15, 8],
        frequency: [0.005, 0.015, 0.03],
        baseY: 460,
        bgColor: '#0a0f2a',
        groundColor: '#3060a0',
        groundStroke: '#4080c0',
    },
    ice: {
        amplitude: [90, 50, 25],
        frequency: [0.01, 0.025, 0.06],
        baseY: 400,
        bgColor: '#0a1520',
        groundColor: '#6090b0',
        groundStroke: '#80b0d0',
    },
    volcanic: {
        amplitude: [70, 35, 18],
        frequency: [0.009, 0.022, 0.045],
        baseY: 430,
        bgColor: '#1a0a05',
        groundColor: '#603020',
        groundStroke: '#804030',
    },
};

// ---- public API ------------------------------------------------------------

export function generateLandingTerrain(seed, planetType) {
    const rng = mulberry32(seed + 77777);
    const params = TERRAIN_PARAMS[planetType] || TERRAIN_PARAMS.rocky;

    const width = 800;
    const height = 600;
    const heights = new Array(width);

    // Phase offsets for each octave
    const phases = params.amplitude.map(() => rng() * 1000);

    // Generate heightmap using layered sine waves
    for (let x = 0; x < width; x++) {
        let h = params.baseY;
        for (let oct = 0; oct < params.amplitude.length; oct++) {
            h -= params.amplitude[oct] * Math.sin(x * params.frequency[oct] + phases[oct]);
        }
        heights[x] = h;
    }

    // Carve a flat landing pad in the middle 60%
    const padWidth = 60 + Math.floor(rng() * 20);
    const padCenter = Math.floor(width * 0.2 + rng() * width * 0.6);
    const padLeft = padCenter - Math.floor(padWidth / 2);
    const padRight = padLeft + padWidth;

    // Find the average height at pad location to place it
    let padH = 0;
    for (let x = padLeft; x <= padRight; x++) {
        padH += heights[Math.min(x, width - 1)];
    }
    padH /= (padRight - padLeft + 1);
    const padY = padH;

    // Flatten the terrain at the pad
    for (let x = padLeft; x <= padRight; x++) {
        if (x >= 0 && x < width) {
            heights[x] = padY;
        }
    }

    // Smooth transitions around pad edges
    const smoothWidth = 15;
    for (let i = 0; i < smoothWidth; i++) {
        const t = i / smoothWidth;
        const leftIdx = padLeft - smoothWidth + i;
        const rightIdx = padRight + 1 + i;
        if (leftIdx >= 0 && leftIdx < width) {
            heights[leftIdx] = heights[leftIdx] * (1 - t) + padY * t;
        }
        if (rightIdx >= 0 && rightIdx < width) {
            heights[rightIdx] = padY * (1 - t) + heights[Math.min(rightIdx + smoothWidth, width - 1)] * t;
        }
    }

    // Generate decorative features
    const features = [];
    const featureCount = 5 + Math.floor(rng() * 8);
    for (let i = 0; i < featureCount; i++) {
        const fx = Math.floor(rng() * width);
        // Skip features near the landing pad
        if (fx >= padLeft - 20 && fx <= padRight + 20) continue;
        const fh = heights[fx];
        let featureType;
        if (planetType === 'rocky') featureType = 'boulder';
        else if (planetType === 'ice') featureType = 'crystal';
        else if (planetType === 'volcanic') featureType = 'vent';
        else featureType = 'cloud';

        features.push({
            type: featureType,
            x: fx,
            y: fh,
            size: 5 + rng() * 10,
            seed: Math.floor(rng() * 99999),
        });
    }

    return {
        heights,
        padLeft,
        padRight,
        padY,
        features,
        bgColor: params.bgColor,
        groundColor: params.groundColor,
        groundStroke: params.groundStroke,
        width,
        height,
    };
}

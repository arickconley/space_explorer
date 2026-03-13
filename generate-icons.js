// ---------------------------------------------------------------------------
// generate-icons.js  --  generate PWA icon PNGs from inline SVG using resvg
//                        Run: node generate-icons.js
//                        Or just use the SVG fallbacks directly.
// ---------------------------------------------------------------------------

import { writeFileSync } from 'fs';

// Ship-shaped icon as SVG
function makeSVG(size) {
    const pad = size * 0.1;
    const cx = size / 2;
    const cy = size / 2;
    const s = (size - pad * 2) / 2;

    // Simple spaceship silhouette pointing right, centered
    const nose = `${cx + s * 0.9},${cy}`;
    const topWing = `${cx - s * 0.7},${cy - s * 0.65}`;
    const notch = `${cx - s * 0.3},${cy}`;
    const botWing = `${cx - s * 0.7},${cy + s * 0.65}`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#000"/>
  <polygon points="${nose} ${topWing} ${notch} ${botWing}" fill="#0cc" stroke="#0ff" stroke-width="${size * 0.015}"/>
  <polygon points="${cx + s * 0.5},${cy} ${cx + s * 0.05},${cy - s * 0.2} ${cx + s * 0.05},${cy + s * 0.2}" fill="rgba(0,255,255,0.35)" stroke="#0ff" stroke-width="${size * 0.008}"/>
  <text x="${cx}" y="${cy + s * 0.95}" text-anchor="middle" font-family="monospace" font-weight="bold" font-size="${size * 0.1}" fill="#0ff">GAVIN'S GAME</text>
</svg>`;
}

function makeMaskableSVG(size) {
    const pad = size * 0.2; // maskable needs safe area
    const cx = size / 2;
    const cy = size / 2 - size * 0.05;
    const s = (size - pad * 2) / 2;

    const nose = `${cx + s * 0.9},${cy}`;
    const topWing = `${cx - s * 0.7},${cy - s * 0.65}`;
    const notch = `${cx - s * 0.3},${cy}`;
    const botWing = `${cx - s * 0.7},${cy + s * 0.65}`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#001820"/>
  <polygon points="${nose} ${topWing} ${notch} ${botWing}" fill="#0cc" stroke="#0ff" stroke-width="${size * 0.015}"/>
  <polygon points="${cx + s * 0.5},${cy} ${cx + s * 0.05},${cy - s * 0.2} ${cx + s * 0.05},${cy + s * 0.2}" fill="rgba(0,255,255,0.35)" stroke="#0ff" stroke-width="${size * 0.008}"/>
</svg>`;
}

// Write SVGs (these work as fallback icons directly)
writeFileSync('public/icons/icon-192.svg', makeSVG(192));
writeFileSync('public/icons/icon-512.svg', makeSVG(512));
writeFileSync('public/icons/icon-maskable-512.svg', makeMaskableSVG(512));

console.log('SVG icons written to public/icons/');
console.log('To convert to PNG, use any SVG→PNG tool or browser dev tools.');

import { initGame } from './game.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
initGame(canvas, ctx);

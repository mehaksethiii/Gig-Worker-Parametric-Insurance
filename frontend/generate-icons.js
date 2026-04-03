/**
 * Run with: node generate-icons.js
 * Generates logo192.png and logo512.png for PWA
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const s = size / 512;

  // Background
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
  ctx.fill();

  // Shield
  ctx.fillStyle = '#2c5282';
  ctx.strokeStyle = '#4facfe';
  ctx.lineWidth = 8*s;
  ctx.beginPath();
  ctx.moveTo(256*s, 80*s);
  ctx.lineTo(380*s, 130*s);
  ctx.lineTo(380*s, 270*s);
  ctx.quadraticCurveTo(380*s, 360*s, 256*s, 420*s);
  ctx.quadraticCurveTo(132*s, 360*s, 132*s, 270*s);
  ctx.lineTo(132*s, 130*s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Lightning bolt
  ctx.fillStyle = '#4facfe';
  ctx.beginPath();
  ctx.moveTo(220*s, 200*s);
  ctx.lineTo(270*s, 200*s);
  ctx.lineTo(245*s, 255*s);
  ctx.lineTo(295*s, 255*s);
  ctx.lineTo(235*s, 340*s);
  ctx.lineTo(255*s, 280*s);
  ctx.lineTo(205*s, 280*s);
  ctx.closePath();
  ctx.fill();

  return canvas.toBuffer('image/png');
}

try {
  const { createCanvas } = require('canvas');
  fs.writeFileSync(path.join(__dirname, 'public', 'logo192.png'), drawIcon(192));
  fs.writeFileSync(path.join(__dirname, 'public', 'logo512.png'), drawIcon(512));
  console.log('✅ Icons generated: logo192.png and logo512.png');
} catch (e) {
  console.log('canvas not available, skipping icon generation');
}

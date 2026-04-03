// Generates logo192.png and logo512.png using pure Node.js (no dependencies)
// Uses a minimal PNG encoder to create solid color icons with text

const fs = require('fs');
const path = require('path');

// Create a simple PNG with the RideShield shield using raw PNG bytes
// We'll use a data URL approach - embed the SVG as a PNG via sharp if available,
// otherwise create a simple colored PNG

function createSimplePNG(size) {
  // Use the Jimp-free approach: create PNG header + IDAT manually
  // For simplicity, create a solid dark blue square PNG
  const { PNG } = (() => {
    try { return require('pngjs'); } catch { return null; }
  })() || {};

  if (PNG) {
    const png = new PNG({ width: size, height: size });
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (size * y + x) * 4;
        const cx = size / 2, cy = size / 2, r = size / 2;
        const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        
        if (dist > r) {
          // Transparent outside circle
          png.data[idx] = 0; png.data[idx+1] = 0; png.data[idx+2] = 0; png.data[idx+3] = 0;
        } else {
          // Dark blue background
          const nx = (x - cx) / r, ny = (y - cy) / r;
          const s = size / 512;
          
          // Shield check
          const sx = x / s, sy = y / s;
          const inShield = sx >= 132 && sx <= 380 && sy >= 80 && sy <= 420 &&
            !(sy < 130 && (sx < 132 + (sy - 80) * (256 - 132) / 50 || sx > 380 - (sy - 80) * (380 - 256) / 50));
          
          // Lightning bolt check  
          const inBolt = (sx >= 205 && sx <= 295 && sy >= 200 && sy <= 340) &&
            ((sy <= 255 && sx >= 220 && sx <= 270) ||
             (sy >= 255 && sx >= 205 && sx <= 255) ||
             (sy >= 200 && sy <= 280 && sx >= 235 && sx <= 295));

          if (inBolt) {
            png.data[idx] = 79; png.data[idx+1] = 172; png.data[idx+2] = 254; png.data[idx+3] = 255;
          } else if (inShield) {
            png.data[idx] = 44; png.data[idx+1] = 82; png.data[idx+2] = 130; png.data[idx+3] = 255;
          } else {
            png.data[idx] = 30; png.data[idx+1] = 58; png.data[idx+2] = 95; png.data[idx+3] = 255;
          }
        }
      }
    }
    return PNG.sync.write(png);
  }
  return null;
}

// Try pngjs first
try {
  require('pngjs');
  const buf192 = createSimplePNG(192);
  const buf512 = createSimplePNG(512);
  if (buf192) fs.writeFileSync(path.join(__dirname, 'public', 'logo192.png'), buf192);
  if (buf512) fs.writeFileSync(path.join(__dirname, 'public', 'logo512.png'), buf512);
  console.log('✅ Icons generated with pngjs');
} catch (e) {
  console.log('pngjs not available, installing...');
  const { execSync } = require('child_process');
  try {
    execSync('npm install pngjs --no-save', { stdio: 'inherit' });
    const buf192 = createSimplePNG(192);
    const buf512 = createSimplePNG(512);
    if (buf192) fs.writeFileSync(path.join(__dirname, 'public', 'logo192.png'), buf192);
    if (buf512) fs.writeFileSync(path.join(__dirname, 'public', 'logo512.png'), buf512);
    console.log('✅ Icons generated');
  } catch (e2) {
    console.log('Could not generate icons:', e2.message);
  }
}

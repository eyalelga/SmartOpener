const Jimp = require('jimp');
const path = require('path');

const INPUT  = path.join(__dirname, 'slides', '1 עדיין נותנים לכל עובד גישה . (Instagram Story).PNG');
const OUTPUT = path.join(__dirname, 'slides', 'cta-cutout.png');
const TOLERANCE = 38; // how close to background color to remove

async function floodFill(bitmap, startX, startY, tol) {
  const w = bitmap.width, h = bitmap.height;
  const d = bitmap.data;
  const idx0 = (startY * w + startX) * 4;
  const bgR = d[idx0], bgG = d[idx0+1], bgB = d[idx0+2];

  const visited = new Uint8Array(w * h);
  const queue = [startY * w + startX];

  while (queue.length) {
    const pos = queue.pop();
    if (visited[pos]) continue;
    visited[pos] = 1;

    const x = pos % w, y = (pos / w) | 0;
    const i = pos * 4;
    const dr = d[i] - bgR, dg = d[i+1] - bgG, db = d[i+2] - bgB;
    const dist = Math.sqrt(dr*dr + dg*dg + db*db);

    if (dist <= tol) {
      d[i+3] = 0; // transparent
      if (x > 0)   queue.push(pos - 1);
      if (x < w-1) queue.push(pos + 1);
      if (y > 0)   queue.push(pos - w);
      if (y < h-1) queue.push(pos + w);
    }
  }
}

(async () => {
  console.log('טוען תמונה...');
  const img = await Jimp.read(INPUT);

  const { width: w, height: h } = img.bitmap;
  console.log(`גודל: ${w}x${h}`);

  // Flood fill from all 4 corners
  await floodFill(img.bitmap, 0,     0,     TOLERANCE);
  await floodFill(img.bitmap, w-1,   0,     TOLERANCE);
  await floodFill(img.bitmap, 0,     h-1,   TOLERANCE);
  await floodFill(img.bitmap, w-1,   h-1,   TOLERANCE);

  await img.writeAsync(OUTPUT);
  console.log('נשמר:', OUTPUT);
})();

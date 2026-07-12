import { Point } from '../types';

/**
 * Calculates the color distance between two RGBA pixels.
 */
export function getColorDistance(
  r1: number, g1: number, b1: number, a1: number,
  r2: number, g2: number, b2: number, a2: number
): number {
  // If one of them is already transparent, treat it as distinct or similar depending on needs.
  // For standard magic wand, transparency is a state.
  if (a1 === 0 && a2 === 0) return 0;
  if ((a1 === 0) !== (a2 === 0)) return 255; // High distance

  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Smart edge gradient at pixel (x, y) on ImageData.
 */
export function getPixelGradient(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): number {
  if (x <= 0 || x >= width - 1 || y <= 0 || y >= height - 1) {
    return 0;
  }

  const idx = (y * width + x) * 4;
  
  // Left and Right pixels
  const leftIdx = idx - 4;
  const rightIdx = idx + 4;
  
  // Top and Bottom pixels
  const topIdx = idx - width * 4;
  const bottomIdx = idx + width * 4;

  // Horizontal luminance difference
  const rX = pixels[rightIdx] - pixels[leftIdx];
  const gX = pixels[rightIdx + 1] - pixels[leftIdx + 1];
  const bX = pixels[rightIdx + 2] - pixels[leftIdx + 2];
  const gradX = Math.sqrt(rX * rX + gX * gX + bX * bX);

  // Vertical luminance difference
  const rY = pixels[bottomIdx] - pixels[topIdx];
  const gY = pixels[bottomIdx + 1] - pixels[topIdx + 1];
  const bY = pixels[bottomIdx + 2] - pixels[topIdx + 2];
  const gradY = Math.sqrt(rY * rY + gY * gY + bY * bY);

  return gradX + gradY;
}

/**
 * Searches the local neighborhood of point and finds the pixel with the highest gradient,
 * weighted by proximity to the target point, to simulate a magnetic snap.
 */
export function findMagneticSnapPoint(
  ctx: CanvasRenderingContext2D,
  point: Point,
  radius: number
): Point {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;

  const targetX = Math.round(point.x);
  const targetY = Math.round(point.y);

  if (targetX < 0 || targetX >= width || targetY < 0 || targetY >= height) {
    return point;
  }

  // Define bounding box of search area
  const xStart = Math.max(1, targetX - radius);
  const xEnd = Math.min(width - 2, targetX + radius);
  const yStart = Math.max(1, targetY - radius);
  const yEnd = Math.min(height - 2, targetY + radius);

  const rectW = xEnd - xStart + 1;
  const rectH = yEnd - yStart + 1;

  if (rectW <= 0 || rectH <= 0) return point;

  // Fetch only the local patch to maintain 60FPS
  const imgData = ctx.getImageData(xStart - 1, yStart - 1, rectW + 2, rectH + 2);
  const pixels = imgData.data;
  const patchW = rectW + 2;
  const patchH = rectH + 2;

  let bestPoint = { ...point };
  let maxScore = -1;

  for (let py = 1; py < patchH - 1; py++) {
    for (let px = 1; px < patchW - 1; px++) {
      // Local gradient in patch
      const idx = (py * patchW + px) * 4;
      
      const leftIdx = idx - 4;
      const rightIdx = idx + 4;
      const topIdx = idx - patchW * 4;
      const bottomIdx = idx + patchW * 4;

      const rX = pixels[rightIdx] - pixels[leftIdx];
      const gX = pixels[rightIdx + 1] - pixels[leftIdx + 1];
      const bX = pixels[rightIdx + 2] - pixels[leftIdx + 2];
      const gradX = Math.sqrt(rX * rX + gX * gX + bX * bX);

      const rY = pixels[bottomIdx] - pixels[topIdx];
      const gY = pixels[bottomIdx + 1] - pixels[topIdx + 1];
      const bY = pixels[bottomIdx + 2] - pixels[topIdx + 2];
      const gradY = Math.sqrt(rY * rY + gY * gY + bY * bY);

      const gradient = gradX + gradY;

      // Absolute canvas coordinate corresponding to (px, py)
      const absX = xStart - 1 + px;
      const absY = yStart - 1 + py;

      // Distance to original target point
      const dx = absX - targetX;
      const dy = absY - targetY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Weighted score: higher gradient is better, closer is better
      const weight = Math.max(0.01, 1 - distance / (radius * 1.5));
      const score = gradient * weight;

      if (score > maxScore) {
        maxScore = score;
        bestPoint = { x: absX, y: absY };
      }
    }
  }

  // If gradient is too small, don't snap (just return original cursor position)
  if (maxScore < 15) {
    return point;
  }

  return bestPoint;
}

/**
 * Flood fill color selection (Magic Wand tool).
 * Clears contiguous pixels with colors similar to the clicked pixel.
 */
export function performMagicWand(
  canvas: HTMLCanvasElement,
  startPoint: Point,
  tolerance: number
): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;
  const startX = Math.floor(startPoint.x);
  const startY = Math.floor(startPoint.y);

  if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const pixels = imgData.data;

  // Find target pixel color
  const targetIdx = (startY * width + startX) * 4;
  const targetR = pixels[targetIdx];
  const targetG = pixels[targetIdx + 1];
  const targetB = pixels[targetIdx + 2];
  const targetA = pixels[targetIdx + 3];

  // If clicked on an already transparent pixel, do nothing or find boundary
  if (targetA === 0 && tolerance === 0) return;

  const visited = new Uint8Array(width * height);
  const queue: number[] = [];

  // Helper to push index
  function pushCoord(x: number, y: number) {
    const idx = y * width + x;
    if (visited[idx] === 0) {
      visited[idx] = 1;
      queue.push(x, y);
    }
  }

  pushCoord(startX, startY);

  while (queue.length > 0) {
    const y = queue.pop()!;
    const x = queue.pop()!;

    const pixelIdx = (y * width + x) * 4;
    const r = pixels[pixelIdx];
    const g = pixels[pixelIdx + 1];
    const b = pixels[pixelIdx + 2];
    const a = pixels[pixelIdx + 3];

    // Check similarity
    const dist = getColorDistance(targetR, targetG, targetB, targetA, r, g, b, a);

    if (dist <= tolerance) {
      // Make it transparent
      pixels[pixelIdx] = 0;
      pixels[pixelIdx + 1] = 0;
      pixels[pixelIdx + 2] = 0;
      pixels[pixelIdx + 3] = 0;

      // Add 4-way neighbors
      if (x > 0) pushCoord(x - 1, y);
      if (x < width - 1) pushCoord(x + 1, y);
      if (y > 0) pushCoord(x, y - 1);
      if (y < height - 1) pushCoord(x, y + 1);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Cuts a lasso selection from the canvas.
 * Makes everything INSIDE or OUTSIDE the lasso path transparent.
 * @param insideIfTrue if true, clears the selection. If false, clears everything EXCEPT selection.
 */
export function applyLassoCut(
  canvas: HTMLCanvasElement,
  points: Point[],
  insideIfTrue: boolean
): void {
  if (points.length < 3) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Create temporary offscreen canvas to act as a mask
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const mctx = maskCanvas.getContext('2d');
  if (!mctx) return;

  // Draw mask
  mctx.fillStyle = 'black';
  mctx.beginPath();
  mctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    mctx.lineTo(points[i].x, points[i].y);
  }
  mctx.closePath();
  mctx.fill();

  // Get imageData from current canvas
  const imgData = ctx.getImageData(0, 0, width, height);
  const maskData = mctx.getImageData(0, 0, width, height);

  const pixels = imgData.data;
  const maskPixels = maskData.data;

  for (let i = 0; i < pixels.length; i += 4) {
    // If mask has pixel (non-zero alpha)
    const isInMask = maskPixels[i + 3] > 0;

    if (insideIfTrue) {
      // Clear inside lasso
      if (isInMask) {
        pixels[i] = 0;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = 0;
      }
    } else {
      // Clear outside lasso (keep subject)
      if (!isInMask) {
        pixels[i] = 0;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = 0;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Applies solid color as canvas background and returns a composite image dataURL.
 */
export function applyBgColorToDataUrl(
  canvas: HTMLCanvasElement,
  bgColor: string
): string {
  const resultCanvas = document.createElement('canvas');
  resultCanvas.width = canvas.width;
  resultCanvas.height = canvas.height;
  const rctx = resultCanvas.getContext('2d');
  if (!rctx) return canvas.toDataURL();

  // Draw bg color if it's not transparent (e.g., color picker value or clear)
  if (bgColor !== 'transparent' && bgColor !== '') {
    rctx.fillStyle = bgColor;
    rctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
  }

  // Draw current canvas (which has transparent background)
  rctx.drawImage(canvas, 0, 0);

  return resultCanvas.toDataURL('image/png');
}

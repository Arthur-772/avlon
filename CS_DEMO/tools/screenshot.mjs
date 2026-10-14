import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

const canvasInfo = await page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  if (!canvas) return { exists: false };
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  return {
    exists: true,
    width: canvas.width,
    height: canvas.height,
    hasWebGL: Boolean(gl),
  };
});

await page.screenshot({ path: 'verification/before.png', fullPage: true });

await page.mouse.click(640, 360);
await page.waitForFunction(() => document.pointerLockElement !== null, null, { timeout: 5000 });
await page.keyboard.down('KeyW');
await page.waitForTimeout(400);
await page.keyboard.down('Space');
await page.waitForTimeout(150);
await page.keyboard.up('Space');
await page.keyboard.up('KeyW');
await page.mouse.move(640, 300, { steps: 10 });
await page.mouse.down();
await page.waitForTimeout(100);
await page.mouse.up();
await page.waitForTimeout(400);

const interactionInfo = await page.evaluate(() => ({
  pointerLocked: document.pointerLockElement !== null,
}));

await page.screenshot({ path: 'verification/after.png', fullPage: true });
console.log(JSON.stringify({ canvasInfo, interactionInfo, errors }, null, 2));

await browser.close();

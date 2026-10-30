import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

// Read body background-color from base.css, fallback #0b0b0f
function readBgColor() {
  const fallback = "#0b0b0f";
  try {
    const css = readFileSync(
      resolve(root, "src/styles/base.css"),
      "utf8",
    );
    const m = css.match(/background-color\s*:\s*([^;]+);/);
    if (!m) return fallback;
    const val = m[1].trim();
    if (!val || val === "transparent") return fallback;
    return val;
  } catch {
    return fallback;
  }
}

const BG = readBgColor();
const LOGO = resolve(root, "public/Logo.png");
const ASSETS = resolve(root, "assets");
const PUBLIC = resolve(root, "public");

async function ensureDir(dir) {
  await sharp({ create: { w: 1, h: 1, channels: 4, background: BG } })
    .png()
    .toBuffer();
  const { mkdir } = await import("fs/promises");
  await mkdir(dir, { recursive: true });
}

async function main() {
  await ensureDir(ASSETS);

  const logo = sharp(LOGO).png();

  // 1. icon-only.png — 1024x1024, BG fill, logo contained at ~70%, centered
  await logo
    .resize({ width: Math.round(1024 * 0.7), withoutExtension: true })
    .max()
    .toBuffer()
    .then((buf) =>
      sharp({
        create: { w: 1024, h: 1024, channels: 4, background: BG },
      })
        .composite([{ input: buf, gravity: "center" }])
        .png()
        .toFile(resolve(ASSETS, "icon-only.png")),
    );

  // 2. icon-foreground.png — 1024x1024 transparent, logo within central 55%
  await logo
    .resize({ width: Math.round(1024 * 0.55), withoutExtension: true })
    .max()
    .toBuffer()
    .then((buf) =>
      sharp({
        create: { w: 1024, h: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
      })
        .composite([{ input: buf, gravity: "center" }])
        .png()
        .toFile(resolve(ASSETS, "icon-foreground.png")),
    );

  // 3. icon-background.png — 1024x1024 solid BG
  await sharp({
    create: { w: 1024, h: 1024, channels: 4, background: BG },
  })
    .png()
    .toFile(resolve(ASSETS, "icon-background.png"));

  // 4. splash.png & splash-dark.png — 2732x2732, BG fill, logo ~800px wide, centered
  const splashLogo = await logo.resize({ width: 800 }).toBuffer();
  for (const name of ["splash.png", "splash-dark.png"]) {
    await sharp({
      create: { w: 2732, h: 2732, channels: 4, background: BG },
    })
      .composite([{ input: splashLogo, gravity: "center" }])
      .png()
      .toFile(resolve(ASSETS, name));
  }

  // 5. public/logo-192.webp — 192x192 transparent, quality 80
  await logo
    .resize({ width: 192 })
    .webp({ quality: 80 })
    .toFile(resolve(PUBLIC, "logo-192.webp"));

  console.log(`[make-assets] BG color used: ${BG}`);
  console.log("[make-assets] Done.");
}

main().catch((err) => {
  console.error("[make-assets] Failed:", err);
  process.exit(1);
});
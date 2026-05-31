import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const chromeDist = path.join(distDir, 'chrome');
const firefoxDist = path.join(distDir, 'firefox');

// Helper to copy directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  console.log('Post-processing builds for Chrome and Firefox...');

  // Create target directories
  fs.mkdirSync(chromeDist, { recursive: true });
  fs.mkdirSync(firefoxDist, { recursive: true });

  // 1. Copy compiled assets
  const assetsSrc = path.join(distDir, 'assets');
  if (fs.existsSync(assetsSrc)) {
    copyDir(assetsSrc, path.join(chromeDist, 'assets'));
    copyDir(assetsSrc, path.join(firefoxDist, 'assets'));
  }

  // 2. Copy common public files
  const commonFiles = ['background.js', 'favicon.svg', 'icons.svg', 'index.html'];
  for (const file of commonFiles) {
    const srcPath = path.join(distDir, file);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, path.join(chromeDist, file));
      fs.copyFileSync(srcPath, path.join(firefoxDist, file));
    }
  }

  // 3. Copy and rename correct manifest files
  const manifestChromeSrc = path.join(rootDir, 'manifest.chrome.json');
  const manifestFirefoxSrc = path.join(rootDir, 'manifest.firefox.json');

  if (fs.existsSync(manifestChromeSrc)) {
    fs.copyFileSync(manifestChromeSrc, path.join(chromeDist, 'manifest.json'));
  } else {
    // fallback if not found in root, look in dist/manifest.json (if present)
    const defaultManifest = path.join(distDir, 'manifest.json');
    if (fs.existsSync(defaultManifest)) {
      fs.copyFileSync(defaultManifest, path.join(chromeDist, 'manifest.json'));
    }
  }

  if (fs.existsSync(manifestFirefoxSrc)) {
    fs.copyFileSync(manifestFirefoxSrc, path.join(firefoxDist, 'manifest.json'));
  }

  // 4. Clean up root dist files that are now copied to subdirectories
  const rootFilesToClean = [
    'assets',
    'background.js',
    'favicon.svg',
    'icons.svg',
    'index.html',
    'manifest.json'
  ];

  for (const item of rootFilesToClean) {
    const itemPath = path.join(distDir, item);
    if (fs.existsSync(itemPath)) {
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(itemPath);
      }
    }
  }

  console.log('Successfully generated Chrome and Firefox builds!');
  console.log('  - Chrome build: dist/chrome/');
  console.log('  - Firefox build: dist/firefox/');
} catch (error) {
  console.error('Failed to post-process builds:', error);
  process.exit(1);
}

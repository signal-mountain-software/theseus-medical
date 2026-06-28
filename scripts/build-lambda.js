/**
 * scripts/build-lambda.js
 *
 * Usage:  npm run build:lambda -- <lambda-folder-name>
 * Example: npm run build:lambda -- build-form-data-dictionary
 *
 * What it does:
 *   1. npm install --omit=dev  inside  lambda/<name>/
 *   2. Zips the folder contents to  lambda/<name>.zip
 *      (the zip contains the files at the root, not a nested folder,
 *       which is what AWS Lambda expects)
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const lambdaName = process.argv[2];
if (!lambdaName) {
  console.error('Usage: npm run build:lambda -- <lambda-folder-name>');
  process.exit(1);
}

const root       = path.resolve(__dirname, '..');
const lambdaDir  = path.join(root, 'lambda', lambdaName);
const outputZip  = path.join(root, 'lambda', `${lambdaName}.zip`);

if (!fs.existsSync(lambdaDir)) {
  console.error(`Lambda folder not found: ${lambdaDir}`);
  process.exit(1);
}

// ── Step 1: install production dependencies ──────────────────────────────────
console.log(`\n[1/2] Installing dependencies in ${lambdaDir} …`);
execSync('npm install --omit=dev', { cwd: lambdaDir, stdio: 'inherit' });

// ── Step 2: zip contents ──────────────────────────────────────────────────────
console.log(`\n[2/2] Creating ${outputZip} …`);

// Remove existing zip so Compress-Archive / zip don't complain
if (fs.existsSync(outputZip)) { fs.unlinkSync(outputZip); }

if (process.platform === 'win32') {
  // PowerShell — available on all modern Windows
  const src = path.join(lambdaDir, '*');
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${src}' -DestinationPath '${outputZip}'"`,
    { stdio: 'inherit' }
  );
} else {
  // macOS / Linux
  execSync(`zip -r "${outputZip}" .`, { cwd: lambdaDir, stdio: 'inherit' });
}

console.log(`\nDone!  Deploy ${path.relative(root, outputZip)} to AWS Lambda (runtime: nodejs24.x)\n`);

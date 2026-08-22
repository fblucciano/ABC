#!/usr/bin/env node
/** Mac ZIP: Dr-Phuoc.html app only — double-click to open in browser */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = path.join(__dirname, '../..');
const APP = path.join(WORKSPACE, 'Dr-Phuoc.html');
const FOLDER = 'Dr-Phuoc-Mac';

if (!fs.existsSync(APP)) {
  console.error('Run npm run build:dr-phuoc first');
  process.exit(1);
}

const readme = `Dr. Phuoc — VenusP Planning Report (HTML)
==========================================

NO INSTALLATION. NO EXTRA SOFTWARE.

HOW TO OPEN
-----------
1. Unzip this folder
2. Double-click "Dr-Phuoc.html"
   OR double-click "Open-Dr-Phuoc.command"

3. Password: venus2026

4. Fill in the case → Export PDF

WORKS OFFLINE in Safari, Chrome, or any browser.

FILES
-----
Dr-Phuoc.html           The app (double-click this)
Open-Dr-Phuoc.command   Opens the app in your browser (Mac)

Keep both files in the same folder.
`;

const tmp = path.join('/tmp', FOLDER);
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

fs.copyFileSync(APP, path.join(tmp, 'Dr-Phuoc.html'));
fs.writeFileSync(path.join(tmp, 'README.txt'), readme);

const launcher = [
  '#!/bin/bash',
  'cd "$(dirname "$0")"',
  'open "$(pwd)/Dr-Phuoc.html"'
].join('\n') + '\n';

fs.writeFileSync(path.join(tmp, 'Open-Dr-Phuoc.command'), launcher);
fs.chmodSync(path.join(tmp, 'Open-Dr-Phuoc.command'), 0o755);

const out = path.join(WORKSPACE, FOLDER + '.zip');
if (fs.existsSync(out)) fs.unlinkSync(out);
execSync('zip -r -X "' + out + '" "' + FOLDER + '"', { cwd: '/tmp', stdio: 'inherit' });
console.log('Created', out);

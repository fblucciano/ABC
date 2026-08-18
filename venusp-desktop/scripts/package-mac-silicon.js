#!/usr/bin/env node
/** Build Mac Apple Silicon distribution ZIP only (English docs). */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = path.join(__dirname, '../..');
const DIST = path.join(WORKSPACE, 'VenusP-Desktop', 'dist', 'VenusP-Planning');
const DOC = path.join(WORKSPACE, 'INSTALL-MAC.md');
const README = path.join(WORKSPACE, 'README.txt');
const BIN = 'VenusP-Planning-mac_arm64';
const FOLDER = 'VenusP-Desktop-Mac-AppleSilicon';

if (!fs.existsSync(path.join(DIST, BIN))) {
  console.error('Run npm run build:desktop first —', BIN, 'not found in dist');
  process.exit(1);
}

const tmp = path.join('/tmp', FOLDER);
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

fs.copyFileSync(path.join(DIST, BIN), path.join(tmp, BIN));
fs.copyFileSync(path.join(DIST, 'resources.neu'), path.join(tmp, 'resources.neu'));
fs.copyFileSync(DOC, path.join(tmp, 'INSTALL-MAC.md'));
if (fs.existsSync(README)) fs.copyFileSync(README, path.join(tmp, 'README.txt'));

const launcher = [
  '#!/bin/bash',
  'cd "$(dirname "$0")"',
  'chmod +x VenusP-Planning-mac_arm64 2>/dev/null',
  './VenusP-Planning-mac_arm64'
].join('\n') + '\n';

fs.writeFileSync(path.join(tmp, 'Open-VenusP.command'), launcher);
fs.chmodSync(path.join(tmp, 'Open-VenusP.command'), 0o755);
fs.chmodSync(path.join(tmp, BIN), 0o755);

const out = path.join(WORKSPACE, FOLDER + '.zip');
if (fs.existsSync(out)) fs.unlinkSync(out);
execSync('zip -r -X "' + out + '" "' + FOLDER + '"', { cwd: '/tmp', stdio: 'inherit' });
console.log('Created', out);

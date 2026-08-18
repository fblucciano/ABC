#!/usr/bin/env node
/** Recria os ZIPs de distribuição Windows / Mac a partir de dist/VenusP-Planning */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE = path.join(__dirname, '../..');
const DIST = path.join(WORKSPACE, 'VenusP-Desktop', 'dist', 'VenusP-Planning');
const DOC = path.join(WORKSPACE, 'LEIA-ME-DESKTOP.md');

if (!fs.existsSync(path.join(DIST, 'VenusP-Planning-win_x64.exe'))) {
  console.error('Run npm run build:desktop first — dist not found');
  process.exit(1);
}

function zipFolder(folderName, files, extra) {
  const tmp = path.join('/tmp', folderName);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  files.forEach(function (f) {
    fs.copyFileSync(path.join(DIST, f.src), path.join(tmp, f.dest || f.src));
  });
  if (extra) extra(tmp);
  fs.copyFileSync(DOC, path.join(tmp, 'LEIA-ME-DESKTOP.md'));
  const out = path.join(WORKSPACE, folderName + '.zip');
  execSync('zip -r -X "' + out + '" "' + folderName + '"', { cwd: '/tmp', stdio: 'inherit' });
  console.log('Created', out);
}

zipFolder('VenusP-Desktop-Windows', [
  { src: 'VenusP-Planning-win_x64.exe' },
  { src: 'resources.neu' }
]);

zipFolder('VenusP-Desktop-Mac-AppleSilicon', [
  { src: 'VenusP-Planning-mac_arm64' },
  { src: 'resources.neu' }
], function (tmp) {
  fs.writeFileSync(path.join(tmp, 'Abrir-VenusP-Mac.command'),
    '#!/bin/bash\ncd "$(dirname "$0")"\nchmod +x VenusP-Planning-mac_arm64 2>/dev/null\n./VenusP-Planning-mac_arm64\n');
  fs.chmodSync(path.join(tmp, 'Abrir-VenusP-Mac.command'), 0o755);
});

zipFolder('VenusP-Desktop-Mac-Intel', [
  { src: 'VenusP-Planning-mac_x64' },
  { src: 'resources.neu' }
], function (tmp) {
  fs.writeFileSync(path.join(tmp, 'Abrir-VenusP-Mac.command'),
    '#!/bin/bash\ncd "$(dirname "$0")"\nchmod +x VenusP-Planning-mac_x64 2>/dev/null\n./VenusP-Planning-mac_x64\n');
  fs.chmodSync(path.join(tmp, 'Abrir-VenusP-Mac.command'), 0o755);
});

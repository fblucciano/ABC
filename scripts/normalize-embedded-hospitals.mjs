#!/usr/bin/env node
/** Patch embedded implant JSON + re-inline index.html with normalized Chile INT hospital names. */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INT = 'Instituto Nacional del Tórax (INT)';

function cleanStr(str) {
    return str ? String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
}

function isChileTorax(name, country) {
    if (country !== 'Chile') return false;
    const h = cleanStr(name);
    if (!h || h.includes('cardiolog') || h.includes('pediatr')) return false;
    return h.includes('torax') || h.includes('troax') || h.includes('(int)') || h === 'int'
        || (h.includes('instituto nacional') && h.includes('torax'));
}

function patchFile(filePath, constName) {
    let src = fs.readFileSync(filePath, 'utf8');
    const marker = `const ${constName} = `;
    const start = src.indexOf(marker);
    if (start < 0) return 0;
    const arr = JSON.parse(src.slice(start + marker.length).split(';\n')[0].replace(/;\s*if/, ';//'));
    let n = 0;
    arr.forEach(c => {
        if (isChileTorax(c.hospital, c.country)) {
            if (c.hospital !== INT) { c.hospital = INT; n++; }
        }
    });
    const js = src.replace(
        new RegExp(`const ${constName} = \\[[\\s\\S]*?\\];`),
        `const ${constName} = ${JSON.stringify(arr, null, 2)};`
    );
    fs.writeFileSync(filePath, js, 'utf8');
    return n;
}

let total = 0;
for (const [file, name] of [
    ['latam-builtin-implants-2025.js', 'BUILTIN_IMPLANTS_2025'],
    ['latam-builtin-implants-2026.js', 'BUILTIN_IMPLANTS_2026']
]) {
    const n = patchFile(path.join(root, file), name);
    console.log(`${file}: normalized ${n} Chile INT hospitals`);
    total += n;
}

spawnSync('node', [path.join(root, 'scripts/inline-builtin-implants.mjs')], { stdio: 'inherit' });
console.log(`Total patched: ${total}`);

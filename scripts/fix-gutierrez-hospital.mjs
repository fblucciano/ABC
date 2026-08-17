#!/usr/bin/env node
/** Unify Hospital De Niños Dr. Gutierrez → Ricardo Gutiérrez in embedded data */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const CANONICAL = 'Hospital de Niños Dr. Ricardo Gutiérrez';
const VARIANTS = [
    /Hospital\s+De\s+Niños\s+Dr\.?\s+Gutierrez/gi,
    /Hospital\s+de\s+Niños\s+Dr\.?\s+Gutierrez/gi,
    /Hospital\s+Ricardo\s+Gutierrez/gi,
    /Hospital\s+De\s+Niños\s+Dr\.?\s+Ricardo\s+Gutiérrez/gi
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
    'latam-builtin-implants-2025.js',
    'latam-builtin-implants-2026.js',
    'latam-builtin-problems.js',
    'index.html'
];

for (const file of files) {
    const fp = path.join(root, file);
    let src = fs.readFileSync(fp, 'utf8');
    let n = 0;
    for (const re of VARIANTS) {
        const matches = src.match(re);
        if (matches) n += matches.length;
        src = src.replace(re, CANONICAL);
    }
    if (n) {
        fs.writeFileSync(fp, src, 'utf8');
        console.log(`${file}: ${n} hospital name fixes`);
    }
}

spawnSync('node', [path.join(root, 'scripts/inline-builtin-implants.mjs')], { stdio: 'inherit' });

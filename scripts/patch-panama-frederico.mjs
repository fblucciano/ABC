#!/usr/bin/env node
/**
 * Panama 2025: local Panamanian implanters + Venus clinical specialists.
 * Jorge Baccaro (Corrientes, Argentina) is NOT involved in Panama cases.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const PANAMA_SPECIALISTS = 'Fabio Silva, Job Huiskamp';

const PANAMA_BY_SERIAL = {
    '26A00000242120': {
        implanter: 'Humberto Juárez',
        proctor: 'False',
        specialist: PANAMA_SPECIALISTS
    },
    '23A00000241065': {
        implanter: 'Pedro Echeverria',
        proctor: 'False',
        specialist: PANAMA_SPECIALISTS
    },
    '26A00000240303': {
        implanter: 'Pedro Echeverria',
        proctor: 'False',
        specialist: PANAMA_SPECIALISTS
    }
};

function patchPanamaCase(c) {
    if (c.country !== 'Panama') return false;
    const rule = PANAMA_BY_SERIAL[c.serial];
    if (!rule) return false;
    c.implanter = rule.implanter;
    c.proctor = rule.proctor;
    c.specialist = rule.specialist;
    return true;
}

function normalizeFredericoSpecialist(c) {
    if (!c.specialist || c.specialist === 'N/A') return false;
    const parts = String(c.specialist).split(/[,;/]+/).map(s => s.trim()).filter(Boolean);
    let changed = false;
    const out = parts.map(p => {
        const low = p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        if (low === 'frederico' || low === 'frederico blanco') {
            changed = true;
            return 'Frederico Blanco';
        }
        return p;
    });
    if (changed) c.specialist = [...new Set(out)].join(', ');
    return changed;
}

function readArrayFromFile(filePath, constName) {
    const src = fs.readFileSync(filePath, 'utf8');
    const marker = `const ${constName} = `;
    const start = src.indexOf(marker);
    const arrStart = start + marker.length;
    let depth = 0, inStr = false, strChar = '', esc = false;
    for (let i = arrStart; i < src.length; i++) {
        const ch = src[i];
        if (inStr) {
            if (esc) esc = false;
            else if (ch === '\\') esc = true;
            else if (ch === strChar) inStr = false;
            continue;
        }
        if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
        if (ch === '[') depth++;
        if (ch === ']') { depth--; if (depth === 0) return { arr: JSON.parse(src.slice(arrStart, i + 1)), src, marker, end: i + 1 }; }
    }
    throw new Error('array not found in ' + filePath);
}

function writeArrayToFile(filePath, constName, arr) {
    const { src, marker, end } = readArrayFromFile(filePath, constName);
    const arrStart = src.indexOf(marker) + marker.length;
    const js = src.slice(0, arrStart) + JSON.stringify(arr, null, 2) + src.slice(end);
    fs.writeFileSync(filePath, js, 'utf8');
}

function patchArrayFile(file, constName, onCase) {
    const fp = path.join(root, file);
    const { arr } = readArrayFromFile(fp, constName);
    let n = 0;
    arr.forEach(c => { if (onCase(c)) n++; });
    writeArrayToFile(fp, constName, arr);
    console.log(`Patched ${file}: ${n} case updates`);
}

patchArrayFile('latam-builtin-implants-2025.js', 'BUILTIN_IMPLANTS_2025', c => {
    let changed = patchPanamaCase(c);
    if (normalizeFredericoSpecialist(c)) changed = true;
    return changed;
});

patchArrayFile('latam-builtin-implants-2026.js', 'BUILTIN_IMPLANTS_2026', c => normalizeFredericoSpecialist(c));

// Problem cases in latam-builtin-problems.js
patchArrayFile('latam-builtin-problems.js', 'BUILTIN_PROBLEM_CASES', c => {
    let changed = false;
    if (c.id === 'PANAMA-2025-01' || (c.country === 'Panama' && c.serial === '26A00000242120')) {
        c.hospital = 'Ciudad de la Salud';
        c.dist = 'GPM Medical';
        c.implanter = 'Jaime Dutary, Pedro Echeverria';
        c.proctor = 'False';
        c.specialist = 'Fabio Silva, Job Huiskamp';
        changed = true;
    }
    if (normalizeFredericoSpecialist(c)) changed = true;
    return changed;
});

// BUILTIN_PROBLEM_CASES inside index.html
const indexPath = path.join(root, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
const probMarker = 'const BUILTIN_PROBLEM_CASES = ';
const pStart = html.indexOf(probMarker);
if (pStart >= 0) {
    const arrStart = pStart + probMarker.length;
    let depth = 0, inStr = false, strChar = '', esc = false;
    for (let i = arrStart; i < html.length; i++) {
        const ch = html[i];
        if (inStr) {
            if (esc) esc = false;
            else if (ch === '\\') esc = true;
            else if (ch === strChar) inStr = false;
            continue;
        }
        if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
        if (ch === '[') depth++;
        if (ch === ']') {
            depth--;
            if (depth === 0) {
                const arr = JSON.parse(html.slice(arrStart, i + 1));
                arr.forEach(c => {
                    if (c.id === 'PANAMA-2025-01' || (c.country === 'Panama' && c.serial === '26A00000242120')) {
                        c.hospital = 'Ciudad de la Salud';
                        c.dist = 'GPM Medical';
                        c.implanter = 'Jaime Dutary, Pedro Echeverria';
                        c.proctor = 'False';
                        c.specialist = 'Fabio Silva, Job Huiskamp';
                    }
                    normalizeFredericoSpecialist(c);
                });
                html = html.slice(0, arrStart) + JSON.stringify(arr, null, 2) + html.slice(i + 1);
                fs.writeFileSync(indexPath, html, 'utf8');
                console.log('Patched BUILTIN_PROBLEM_CASES in index.html');
                break;
            }
        }
    }
}

spawnSync('node', [path.join(root, 'scripts/inline-builtin-implants.mjs')], { stdio: 'inherit' });

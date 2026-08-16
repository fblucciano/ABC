#!/usr/bin/env node
/**
 * Fix mojibake + canonical hospital/person names in all embedded datasets, then re-inline.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHILE_INT = 'Instituto Nacional del Tórax (INT)';

function fixMojibake(str) {
    if (!str || !/[ÃÂ]/.test(String(str))) return str;
    try { return Buffer.from(String(str), 'latin1').toString('utf8'); } catch { return str; }
}

function cleanStr(s) {
    return s ? String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
}

const HOSPITAL_ALIASES = {
    'instituto nacional del torax (int)': CHILE_INT, 'instituto nacional del torax': CHILE_INT,
    'hospital del torax': CHILE_INT, 'hospital el torax': CHILE_INT, 'del torax': CHILE_INT, 'el torax': CHILE_INT,
    'funcacorr': 'Instituto Cardiológico de Corrientes (FUNCACORR)',
    'instituto cardiologico de corrientes': 'Instituto Cardiológico de Corrientes (FUNCACORR)',
    'instituto nacional de cardiologia ignacio chavez': 'Instituto Nacional de Cardiología Ignacio Chávez',
    'sanatorio san geronimo': 'Sanatorio San Gerónimo',
    'hospital gutierrez': 'Hospital de Niños Dr. Ricardo Gutiérrez',
    'hospital de ninos ricardo gutierrez': 'Hospital de Niños Dr. Ricardo Gutiérrez',
    'clinica suizo argentina': 'Clinica Suizo Argentina', 'clinica swizo': 'Clinica Suizo Argentina',
    'centro medico nacional de occidente': 'Centro Médico Nacional de Occidente',
    'fundacion favaloro': 'Fundación Favaloro',
    'sao francisco': 'Hospital São Francisco (Hapvida)', 'sao bernardo': 'Hospital São Bernardo (Hapvida)',
    'sao bernardo hapvida': 'Hospital São Bernardo (Hapvida)',
    'sao jose': 'São José Hospital', 'sao francisco de paula': 'São Francisco de Paula',
    'instituto nacional de pediatria': 'Instituto Nacional de Pediatría', 'inp': 'Instituto Nacional de Pediatría',
    'panama case 01': 'Ciudad de la Salud', 'panama case': 'Ciudad de la Salud',
    'hospital espanol de la plata': 'Hospital Español de La Plata',
    'clinica milenium': 'Clinica MILENIUM',
    'sanatorio de la mujer': 'Sanatorio de la Mujer',
    'sanatorio san jose': 'Sanatorio San José',
    'clinica alemana': 'Clínica Alemana',
    'agamenom magalhaes': 'Hospital Agamenom Magalhães',
    'clinica modelo de lanus': 'Clínica Modelo Lanús', 'clinica modelo lanus': 'Clínica Modelo Lanús',
    'clinica isamedica': 'Clínica Isamédica',
    'clinica sagrada familia': 'Clínica Sagrada Familia',
    'fundacion medica de rio negro': 'Fundación Médica de Río Negro',
    'clinica bazterrica': 'Centro Médico Bazterrica',
    'hospital maceio': 'Hospital Maceió - Hapvida', 'maceio': 'Hospital Maceió - Hapvida',
    'incor': 'InCor SP', 'fundacion cardiovascular de colombia': 'Fundación Cardiovascular de Colombia',
    'instituto diagnostico de la plata': 'Instituto Diagnóstico de La Plata',
    'smh petropolis': 'SMH Petrópolis'
};
const HOSPITAL_KEYS = Object.keys(HOSPITAL_ALIASES).sort((a, b) => b.length - a.length);

function stdHosp(raw) {
    if (!raw) return 'Unknown Hospital';
    raw = fixMojibake(String(raw)).trim();
    let c = cleanStr(raw);
    if (c.includes('incor') || c.includes('in cor')) return c.includes('natal') ? 'InCor Natal' : 'InCor SP';
    if ((c.includes('torax') || c.includes('troax')) && !c.includes('cardiolog') && !c.includes('pediatr')) return CHILE_INT;
    for (const k of HOSPITAL_KEYS) if (c.includes(k)) return HOSPITAL_ALIASES[k];
    return raw.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function fixPersonField(val) {
    if (!val || val === 'N/A') return val;
    return String(val).split(', ').map(p => {
        p = fixMojibake(p.trim());
        return p.replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase());
    }).join(', ');
}

function patchCase(c) {
    if (c.hospital) c.hospital = stdHosp(c.hospital);
    for (const f of ['implanter', 'specialist', 'proctor']) {
        if (c[f]) c[f] = fixPersonField(c[f]);
    }
    for (const f of ['comment', 'commentOriginal', 'commentEn']) {
        if (c[f] && /[ÃÂ]/.test(c[f])) c[f] = fixMojibake(c[f]);
    }
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

let total = 0;
for (const [file, name] of [
    ['latam-builtin-implants-2025.js', 'BUILTIN_IMPLANTS_2025'],
    ['latam-builtin-implants-2026.js', 'BUILTIN_IMPLANTS_2026']
]) {
    const fp = path.join(root, file);
    const { arr } = readArrayFromFile(fp, name);
    arr.forEach(c => { patchCase(c); total++; });
    writeArrayToFile(fp, name, arr);
    console.log(`Patched ${file}: ${arr.length} cases`);
}

// Patch BUILTIN_PROBLEM_CASES inside index.html
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
                arr.forEach(c => { patchCase(c); total++; });
                html = html.slice(0, arrStart) + JSON.stringify(arr, null, 2) + html.slice(i + 1);
                fs.writeFileSync(indexPath, html, 'utf8');
                console.log(`Patched BUILTIN_PROBLEM_CASES: ${arr.length} cases`);
                break;
            }
        }
    }
}

spawnSync('node', [path.join(root, 'scripts/inline-builtin-implants.mjs')], { stdio: 'inherit' });

// Verify no mojibake left in hospitals
const check = fs.readFileSync(indexPath, 'utf8');
const badHosp = [...check.matchAll(/"hospital": "([^"]*Ã[^"]*)"/g)].map(m => m[1]);
const badPerson = [...check.matchAll(/"(implanter|specialist|proctor)": "([^"]*Ã[^"]*)"/g)].map(m => m[2]);
console.log(`Done. Remaining mojibake hospitals: ${badHosp.length}, persons: ${badPerson.length}`);
if (badHosp.length) console.log(badHosp.slice(0, 5));

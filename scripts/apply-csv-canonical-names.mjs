#!/usr/bin/env node
/**
 * Normalize hospital and person names from authoritative CSV exports,
 * patch embedded datasets, and merge aliases into index.html.
 *
 * Usage:
 *   node scripts/apply-csv-canonical-names.mjs \
 *     path/to/Cases_Latam.csv path/to/Implant_Data_LATAM.csv
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const casesCsv = process.argv[2] || '/home/ubuntu/.cursor/projects/workspace/uploads/Cases_Latam__3__732a.csv';
const implantCsv = process.argv[3] || '/home/ubuntu/.cursor/projects/workspace/uploads/Implant_Data_LATAM__24__594a.csv';

const CHILE_INT = 'Instituto Nacional del Tórax (INT)';

const HOSPITAL_ALIASES = {
    'instituto nacional del torax (int)': CHILE_INT,
    'instituto nacional del torax': CHILE_INT,
    'instituto nacional del tórax (int)': CHILE_INT,
    'instituto nacional del tórax': CHILE_INT,
    'hospital del torax': CHILE_INT, 'hospital del tórax': CHILE_INT,
    'hospital el torax': CHILE_INT, 'hospital el tórax': CHILE_INT,
    'el torax': CHILE_INT, 'el tórax': CHILE_INT, 'del torax': CHILE_INT,
    'funcacorr': 'Instituto Cardiológico de Corrientes (FUNCACORR)',
    'funcacoor': 'Instituto Cardiológico de Corrientes (FUNCACORR)',
    'instituto cardiologico de corrientes': 'Instituto Cardiológico de Corrientes (FUNCACORR)',
    'instituto de cardiologia de corrientes': 'Instituto Cardiológico de Corrientes (FUNCACORR)',
    'hospital gutierrez': 'Hospital de Niños Dr. Ricardo Gutiérrez',
    'hospital de ninos ricardo gutierrez': 'Hospital de Niños Dr. Ricardo Gutiérrez',
    'hospital ricardo gutierrez': 'Hospital de Niños Dr. Ricardo Gutiérrez',
    'fundacion favaloro': 'Fundación Favaloro',
    'hospital espanol de la plata': 'Hospital Español de La Plata',
    'centro medico nacional de occidente': 'Centro Médico Nacional de Occidente',
    'centro medico naciona de occidente': 'Centro Médico Nacional de Occidente',
    'centro medico nacional e occidente': 'Centro Médico Nacional de Occidente',
    'clinica milenium': 'Clinica MILENIUM',
    'clinica modelo de lanus': 'Clínica Modelo Lanús', 'clinica modelo lanus': 'Clínica Modelo Lanús',
    'clinica sagrada familia': 'Clínica Sagrada Familia',
    'clinica sagrado corazon': 'Clínica Sagrado Corazón',
    'clinica suizo argentina': 'Clinica Suizo Argentina', 'clinica swizo': 'Clinica Suizo Argentina',
    'sanatorio guemes': 'Sanatorio Güemes', 'sanatorio guemes': 'Sanatorio Güemes',
    'sanatorio mit': 'Sanatorio MIT', 'sanatório mit': 'Sanatorio MIT',
    'austral': 'Hospital Universitario Austral', 'hospital austral': 'Hospital Universitario Austral',
    'icba': 'ICBA Instituto Cardiovascular',
    'universidad catolica de chile': 'Hospital Clínico Universidad Católica',
    'hemodinamica sao lucas': 'Hemodinâmica São Lucas',
    'hospital do coracao alagoano': 'Hospital do Coração Alagoano',
    'hospital do coração alagoano': 'Hospital do Coração Alagoano',
    'hospital ribeirao preto': 'Hospital Ribeirão Preto',
    'hospital ribeirão preto': 'Hospital Ribeirão Preto',
    'hospital geral de palmas': 'Hospital Geral de Palmas',
    'hospital maceio': 'Hospital Maceió - Hapvida', 'hospital maceió / hapvida': 'Hospital Maceió - Hapvida',
    'incor': 'InCor SP', 'icfuc': 'ICFUC',
    'cinecors': 'Hospital Ernesto Dornelles',
    'socor': 'Hospital Socor', 'prontocor': 'Prontocor',
    'salvalus': 'Hospital Salvalus', 'honpar': 'Honpar', 'luxemburgo': 'Luxemburgo',
    'lacic': 'LACIC', 'humaniza': 'Humaniza', 'hspm': 'HSPM',
    'santa tereza': 'Santa Tereza', 'santa martha': 'Santa Martha',
    'ciudad de la salud': 'Ciudad de la Salud',
    'instituto nacional de cardiologia': 'Instituto Nacional de Cardiología',
    'instituto nacional de pediatria': 'Instituto Nacional de Pediatría',
    'san rafael': 'San Rafael', 'clinica valle del lili': 'Clínica Valle del Lili',
    'clinica shaio': 'Clínica Shaio', 'clinica somer': 'Clínica Somer',
    'fundacion cardiovascular': 'Fundación Cardiovascular de Colombia',
    'clinica santa ana de dios': 'Clínica Santa Ana de Dios',
    'clinica imbanaco': 'Clínica Imbanaco', 'clinica cardiovid': 'Clínica Cardiovid',
    'clinica dime': 'Clínica Dime', 'clinica isamedica': 'Clínica Isamédica', 'isamedica': 'Clínica Isamédica',
    'ciudad de la salud': 'Ciudad de la Salud',
};
const HOSPITAL_KEYS = Object.keys(HOSPITAL_ALIASES).sort((a, b) => b.length - a.length);

const PERSON_ALIASES = {
    'fabio luciano da silva': 'Fabio Silva', 'fabio da silva': 'Fabio Silva', 'fábio da silva': 'Fabio Silva',
    'fabio silva': 'Fabio Silva', 'fábio silva': 'Fabio Silva', 'fabio': 'Fabio Silva', 'fábio': 'Fabio Silva',
    'laura zemp': 'Laura Zemp', 'laura': 'Laura Zemp',
    'stephanie bugueño': 'Stephanie Bugeño Apablaza', 'stephanie bugeno': 'Stephanie Bugeño Apablaza', 'stephanie': 'Stephanie Bugeño Apablaza',
    'sonia grosso': 'Sonia Grosso', 'sonia': 'Sonia Grosso',
    'mariana martinez': 'Mariana Martinez', 'mariana martínez': 'Mariana Martinez', 'mariana': 'Mariana Martinez',
    'michelle altamirano': 'Michelle Altamirano', 'michelle': 'Michelle Altamirano',
    'francisco navarro': 'Francisco Navarro',
    'cesar roberto pintos': 'Cesar Roberto Pintos', 'cesar pintos': 'Cesar Roberto Pintos', 'cesar': 'Cesar Roberto Pintos',
    'jorge baccaro': 'Jorge Baccaro', 'baccaro jorge': 'Jorge Baccaro', 'baccaro': 'Jorge Baccaro',
    'marcelo rivarola': 'Marcelo Rivarola', 'rivarola marcelo': 'Marcelo Rivarola', 'rivarola': 'Marcelo Rivarola',
    'juan pablo de brahi': 'Juan Pablo De Brahi', 'juan pablo de barhi': 'Juan Pablo De Brahi',
    'pablo spaletra': 'Pablo Spaletra', 'spaletra pablo': 'Pablo Spaletra',
    'martin hermida': 'Martín Hermida', 'martín hermida': 'Martín Hermida',
    'edgard quintella': 'Edgard Quintella', 'edigar quitela': 'Edgard Quintella', 'edgar quitela': 'Edgard Quintella',
    'adriano augusto truffa': 'Adriano Truffa', 'adriano truffa': 'Adriano Truffa',
    'marcio montenegro': 'Marcio Montenegro', 'márcio montenegro': 'Marcio Montenegro',
    'alexis vasiluk knebel': 'Alexis Vasiluk Knebel', 'alexis knebel': 'Alexis Vasiluk Knebel',
    'henrique ribeiro': 'Henrique Ribeiro',
    'ricardo lisboa cardozo': 'Ricardo Lisboa Cardozo', 'ricardo lisboa': 'Ricardo Lisboa Cardozo', 'ricardo': 'Ricardo Lisboa Cardozo',
    'leonardo andrade de godoy': 'Leonardo Godoy', 'leonardo godoy': 'Leonardo Godoy',
    'jose antonio garcía montes': 'Jose Antonio García Montes', 'jose antonio garcia montes': 'Jose Antonio García Montes',
    'garcia montes': 'Jose Antonio García Montes', 'gm': 'Jose Antonio García Montes',
    'adeyanira hernandez': 'Adeyanira Hernandez', 'adeyanira hernández': 'Adeyanira Hernandez', 'adeyanira': 'Adeyanira Hernandez',
    'fernanda cisneros': 'Fernanda Cisneros', 'fernanda': 'Fernanda Cisneros',
    'luis gabriel loaiza': 'Luis Gabriel Loaiza',
    'gian manuel jimenez': 'Gian Manuel Jimenez', 'gian manuel jimenez rodriguez': 'Gian Manuel Jimenez',
    'carlos zabal': 'Carlos Zabal', 'zabal': 'Carlos Zabal',
    'fernando pineda': 'Fernando Pineda',
    'jorge sandoval': 'Jorge Sandoval',
    'francisco garay': 'Francisco Garay',
    'daniel springmuller': 'Daniel Springmuller', 'daniel spingmüller': 'Daniel Springmuller',
    'frederico blanco': 'Frederico Blanco', 'frederico': 'Frederico Blanco',
    'job huiskamp': 'Job Huiskamp', 'huiskamp': 'Job Huiskamp',
    'facundo peñaloza': 'Facundo Peñaloza', 'facundo peñolazo': 'Facundo Peñaloza', 'peñaloza facundo': 'Facundo Peñaloza',
    'juan pablo de brahi': 'Juan Pablo De Brahi',
    'jian wang': 'Jian Wang', 'jian': 'Jian Wang',
    'alice moraes': 'Alice Moraes', 'alice maciel': 'Alice Moraes', 'alice souza de moraes maciel': 'Alice Moraes',
    'eudes figueredo': 'Eudes Figueredo', 'eudes': 'Eudes Figueredo',
    'igor salles': 'Igor Salles',
    'kleberth tenório': 'José Kleberth Tenório', 'kleberth tenorio': 'José Kleberth Tenório', 'kleberth': 'José Kleberth Tenório',
    'jose kleberth tenorio': 'José Kleberth Tenório',
    'cristian dauvergne': 'Christian Dauvergne', 'cristhian dauvergne': 'Christian Dauvergne',
    'christian dauvergne': 'Christian Dauvergne',
    'diego villar': 'Diego Villar',
    'victorio lucini': 'Victorio Lucini',
    'luis cressa': 'Luis Cressa'
};
const PERSON_KEYS = Object.keys(PERSON_ALIASES).sort((a, b) => b.length - a.length);

const KEEP_UPPER = new Set(['INT', 'ICBA', 'ICR', 'ICFUC', 'IECAC', 'HCI', 'HSPM', 'SMH', 'MIT', 'INP', 'HONPAR', 'HEMOCOR', 'HRS', 'LACIC', 'HUSE', 'IECAC', 'DDM', 'HOMAC']);

function cleanStr(s) {
    return s ? String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
}

function fixMojibake(str) {
    if (!str) return str;
    let s = String(str);
    if (/[ÃÂ]/.test(s)) {
        try { s = Buffer.from(s, 'latin1').toString('utf8'); } catch { /* keep */ }
    }
    return s.replace(/\uFFFD/g, '');
}

function stdHosp(raw) {
    if (!raw) return 'Unknown Hospital';
    raw = fixMojibake(String(raw)).trim();
    const c = cleanStr(raw);
    if ((c.includes('torax') || c.includes('tórax')) && !c.includes('cardiolog') && !c.includes('pediatr')) return CHILE_INT;
    if (c.includes('incor') && c.includes('natal')) return 'InCor Natal';
    if (c.includes('incor') || c === 'in cor') return 'InCor SP';
    for (const k of HOSPITAL_KEYS) if (c.includes(k)) return HOSPITAL_ALIASES[k];
    return formatHospitalTitle(raw);
}

function formatHospitalTitle(name) {
    return String(name).split(/(\s+)/).map(part => {
        if (!part.trim()) return part;
        const bare = part.replace(/[().,]/g, '');
        if (KEEP_UPPER.has(bare.toUpperCase())) return bare.toUpperCase();
        if (/^[A-ZÁÉÍÓÚÃÕÂÊÔÇ]{2,}$/.test(bare) && bare.length <= 6) return bare;
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    }).join('').replace(/\s+/g, ' ').trim();
}

function stdName(raw) {
    if (!raw) return '';
    raw = fixMojibake(String(raw)).trim();
    if (!raw || /^n\/?a$/i.test(raw) || /^false$/i.test(raw) || /^none reported$/i.test(raw) || /^personal venus$/i.test(raw)) return '';
    let clean = cleanStr(raw.replace(/^(dr\.?|dra\.?|prof\.?|ing\.?|enf\.?)\s+/i, ''));
    for (const k of PERSON_KEYS) if (clean.includes(k)) return PERSON_ALIASES[k];
    // Reversed "Surname Name" when both parts look like names
    const tokens = raw.replace(/^(dr\.?|dra\.?)\s*/i, '').trim().split(/\s+/);
    if (tokens.length === 2) {
        const rev = `${tokens[1]} ${tokens[0]}`;
        const revClean = cleanStr(rev);
        for (const k of PERSON_KEYS) if (revClean.includes(k)) return PERSON_ALIASES[k];
        if (/^[A-ZÁÉÍÓÚ]/.test(tokens[1])) return `${tokens[1]} ${tokens[0]}`;
    }
    return raw.replace(/^(Dr\.?|Dra\.?|Prof\.?|Ing\.?)\s*/i, '')
        .replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

function expandSpecialists(raw) {
    if (!raw || /^n\/?a$/i.test(String(raw).trim())) return 'N/A';
    const parts = String(raw)
        .split(/[,;/+]|(?:\s+-\s+)|(?:\s+\/\s+)/)
        .map(s => s.trim())
        .filter(s => s && !/^n\/?a$/i.test(s) && !/^load$/i.test(s));
    const names = [];
    for (let p of parts) {
        p = p.replace(/\b(load)\b/gi, '').trim();
        // "Fabio + Cesar" fragments
        if (/^fabio$/i.test(p)) p = 'Fabio Silva';
        if (/^cesar$/i.test(p)) p = 'Cesar Roberto Pintos';
        if (/^alice$/i.test(p)) p = 'Alice Moraes';
        if (/^ariane$/i.test(p)) p = 'Ariane Sanchez';
        if (/^stephanie$/i.test(p)) p = 'Stephanie Bugeño Apablaza';
        if (/^mariana$/i.test(p)) p = 'Mariana Martinez';
        if (/^ricardo$/i.test(p)) p = 'Ricardo Lisboa Cardozo';
        if (/^eudes$/i.test(p)) p = 'Eudes Figueredo';
        if (/^luciano$/i.test(p)) p = 'Luciano';
        const n = stdName(p);
        if (n && !names.includes(n)) names.push(n);
    }
    return names.length ? names.join(', ') : 'N/A';
}

function formatImplanter(raw) {
    const n = stdName(raw);
    return n || 'N/A';
}

function formatProctor(raw) {
    if (!raw || /^false$/i.test(String(raw).trim()) || /^n\/?a$/i.test(String(raw).trim())) return 'False';
    const n = stdName(raw);
    return n || 'False';
}

function loadCsv(filePath) {
    const wb = XLSX.readFile(filePath);
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
}

function pick(row, names) {
    const keys = Object.keys(row);
    for (const name of names) {
        const target = cleanStr(name);
        for (const k of keys) {
            const ck = cleanStr(k).replace(/[:;]+$/, '');
            if (ck === target || ck.includes(target)) {
                const v = row[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
            }
        }
    }
    return '';
}

function normSerial(s) {
    return String(s || '').trim().toUpperCase().replace(/\s+/g, '');
}

function scoreHospitalName(name) {
    if (!name) return 0;
    let score = name.length;
    if (/[áéíóúãõâêôçÁÉÍÓÚÃÕÂÊÔÇ]/.test(name)) score += 20;
    if (name !== name.toUpperCase()) score += 10;
    if (name.includes('(')) score += 5;
    return score;
}

function upsertCanonical(map, serial, patch) {
    if (!serial) return;
    const key = normSerial(serial);
    if (!key || /^N\/?A$/.test(key)) return;
    const cur = map.get(key) || {};
    if (patch.hospital && scoreHospitalName(patch.hospital) >= scoreHospitalName(cur.hospital || '')) {
        cur.hospital = patch.hospital;
    }
    for (const f of ['implanter', 'proctor', 'specialist']) {
        if (patch[f] && patch[f] !== 'N/A' && patch[f] !== 'False') cur[f] = patch[f];
    }
    if (patch.year) cur.year = patch.year;
    map.set(key, cur);
}

// Build canonical map from CSVs
const canonical = new Map();

for (const row of loadCsv(casesCsv)) {
    const serial = pick(row, ['valve serial number', 'serial']);
    const year = parseInt(String(pick(row, ['caseid', 'case id']) || '').match(/20\d{2}/)?.[0] || pick(row, ['proceduredate']).split('/').pop(), 10);
    const y = year >= 100 ? year : (year >= 50 ? 1900 + year : 2000 + year);
    upsertCanonical(canonical, serial, {
        hospital: stdHosp(pick(row, ['hospital', 'centro'])),
        implanter: formatImplanter(pick(row, ['first operator', 'implanter'])),
        proctor: formatProctor(pick(row, ['proctor name', 'proctor', 'had proctor'])),
        year: y
    });
}

for (const row of loadCsv(implantCsv)) {
    const serial = pick(row, ['serial n°', 'serial', 'valve serial number']);
    const dateParts = pick(row, ['date']).split('/');
    let y = parseInt(dateParts[2] || '2026', 10);
    if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y;
    upsertCanonical(canonical, serial, {
        hospital: stdHosp(pick(row, ['hospital', 'centro'])),
        implanter: formatImplanter(pick(row, ['implanter', 'first operator'])),
        proctor: formatProctor(pick(row, ['proctor', '1 case proctoring'])),
        specialist: expandSpecialists(pick(row, ['clinical specialist', 'specialist'])),
        year: y
    });
}

// Panama overrides (business rules from prior turn)
const PANAMA = {
    '26A00000242120': { implanter: 'Jorge Baccaro', proctor: 'Jorge Baccaro', specialist: 'Fabio Silva' },
    '23A00000241065': { implanter: 'Jorge Baccaro', proctor: 'Jorge Baccaro', specialist: 'Job Huiskamp' },
    '26A00000240303': { implanter: 'Jorge Baccaro', proctor: 'Jorge Baccaro', specialist: 'Frederico Blanco' }
};
for (const [serial, patch] of Object.entries(PANAMA)) {
    const cur = canonical.get(serial) || {};
    canonical.set(serial, { ...cur, ...patch, hospital: cur.hospital || 'Ciudad de la Salud' });
}

// Collect alias candidates
const hospitalAliasCandidates = new Map();
const personAliasCandidates = new Map();

function noteAlias(map, raw, canonicalName) {
    if (!raw || !canonicalName) return;
    const k = cleanStr(raw);
    const c = cleanStr(canonicalName);
    if (!k || k === c || k.length < 3) return;
    if (!map.has(k)) map.set(k, canonicalName);
}

function patchCase(c) {
    const serial = normSerial(c.serial);
    const rule = canonical.get(serial);
    if (!rule) return false;
    let changed = false;
    if (rule.hospital && c.hospital !== rule.hospital) {
        noteAlias(hospitalAliasCandidates, c.hospital, rule.hospital);
        c.hospital = rule.hospital;
        changed = true;
    }
    if (rule.implanter && rule.implanter !== 'N/A' && c.implanter !== rule.implanter) {
        noteAlias(personAliasCandidates, c.implanter, rule.implanter);
        c.implanter = rule.implanter;
        changed = true;
    }
    if (rule.proctor && c.proctor !== rule.proctor) {
        noteAlias(personAliasCandidates, c.proctor, rule.proctor);
        c.proctor = rule.proctor;
        changed = true;
    }
    if (rule.specialist && rule.specialist !== 'N/A' && c.specialist !== rule.specialist) {
        noteAlias(personAliasCandidates, c.specialist, rule.specialist);
        c.specialist = rule.specialist;
        changed = true;
    }
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

let totalPatched = 0;
for (const [file, name] of [
    ['latam-builtin-implants-2025.js', 'BUILTIN_IMPLANTS_2025'],
    ['latam-builtin-implants-2026.js', 'BUILTIN_IMPLANTS_2026'],
    ['latam-builtin-problems.js', 'BUILTIN_PROBLEM_CASES']
]) {
    const fp = path.join(root, file);
    const { arr } = readArrayFromFile(fp, name);
    let n = 0;
    arr.forEach(c => { if (patchCase(c)) n++; });
    writeArrayToFile(fp, name, arr);
    totalPatched += n;
    console.log(`Patched ${file}: ${n}/${arr.length} cases`);
}

// Patch problem cases in index.html
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
                let n = 0;
                arr.forEach(c => { if (patchCase(c)) n++; });
                html = html.slice(0, arrStart) + JSON.stringify(arr, null, 2) + html.slice(i + 1);
                fs.writeFileSync(indexPath, html, 'utf8');
                console.log(`Patched BUILTIN_PROBLEM_CASES in index.html: ${n} cases`);
                break;
            }
        }
    }
}

// Merge new aliases into index.html PERSON_ALIASES / HOSPITAL_ALIASES
html = fs.readFileSync(indexPath, 'utf8');

function mergeAliasesIntoIndex(constName, candidates, existingFromScript) {
    const marker = `const ${constName} = {`;
    const start = html.indexOf(marker);
    if (start < 0) return 0;
    const end = html.indexOf('};', start);
    const block = html.slice(start, end + 2);
    let added = 0;
    const merged = { ...existingFromScript };
    for (const [k, v] of candidates) {
        const key = k.replace(/"/g, '\\"');
        if (merged[k]) continue;
        merged[k] = v;
        added++;
    }
    // Rebuild is risky; instead append missing entries before closing };
    let insert = '';
    for (const [k, v] of candidates) {
        if (block.includes(`"${k.replace(/"/g, '')}"`)) continue;
        const escK = k.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        const escV = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        if (html.includes(`"${escK}":`)) continue;
        insert += `        "${escK}": "${escV}",\n`;
        added++;
    }
    if (insert) {
        html = html.slice(0, end) + '\n' + insert + html.slice(end);
    }
    return added;
}

// Add high-value aliases discovered from CSV
const extraHospital = {
    'granados': 'Granados',
    'sanatorio parque': 'Sanatorio Parque',
    'hospital naval': 'Hospital Naval',
    'hospital san bernardo': 'Hospital San Bernardo',
    'sanatorio general sarmiento': 'Sanatorio General Sarmiento',
    'sanatorio santa fe': 'Sanatorio Santa Fe',
    'hospital italiano de la plata': 'Hospital Italiano de La Plata',
    'hospital italiano santa fe': 'Hospital Italiano Santa Fé',
    'hospital sor de maria ludovica': 'Hospital Sor de María Ludovica',
    'nuestra senora del pilar': 'Nuestra Señora del Pilar',
    'sanatorio chivilcoy': 'Sanatorio Chivilcoy',
    'hospital bom clima': 'Hospital Bom Clima',
    'hci - pouso alegre': 'HCI - Pouso Alegre',
    'ipensa la plata': 'Sanatorio IPENSA La Plata',
    'imms t1 - leon': 'IMMS T1 - León',
    'santa cruz': 'Hospital Santa Cruz',
    'antonio prudente': 'Hospital Hapvida Antonio Prudente',
    'hospital metropolitano djmp': 'Hospital Metropolitano DJMP',
    'hospital vaz monteiro': 'Hospital Vaz Monteiro',
    'real hospital portugues': 'Real Hospital Português',
    'hospital universitario austral': 'Hospital Universitario Austral',
    'imac': 'IMAC',
    'ipensa': 'Sanatorio IPENSA La Plata',
    'hospital general de chihuahua': 'Hospital General de Chihuahua',
    'hospital infantil de mexico': 'Hospital Infantil de México',
    'imms t1 - leon': 'IMMS T1 - León',
    'hospital militar': 'Hospital Militar',
    'clinica santa sofia': 'Clínica Santa Sofía',
    'ascardio': 'ASCARDIO',
    'hospital privado de cordoba': 'Hospital Privado de Córdoba',
    'hospital privado de vicente lopez': 'Hospital Privado de Vicente López',
    'hospital el cruce': 'Hospital El Cruce',
    'hospital britanico': 'Hospital Británico',
    'hospital onix': 'Hospital Onix',
    'hospital incor de natal': 'InCor Natal',
    'hospital santa rita': 'Hospital Santa Rita',
    'meridional praia da costa': 'Meridional Praia da Costa'
};

const extraPerson = {
    'cristian barbosa': 'Cristian Barbosa',
    'walter mosquera': 'Walter Mosquera',
    'justo santiago': 'Justo Santiago',
    'diana nuñez': 'Diana Núñez',
    'jorge andrade': 'Jorge Andrade',
    'cassiano moraes': 'Cassiano Moraes',
    'cassiano ferri': 'Cassiano Ferri',
    'joão slaviero': 'João Slaviero',
    'joao slaviero': 'João Slaviero',
    'pabla cataldo': 'Pabla Cataldo',
    'kozak fernando': 'Kozak Fernando',
    'betiana martín': 'Betiana Martín',
    'andres pascua': 'Andres Pascua',
    'rodrigo egue': 'Rodrigo Egue',
    'rodrigo eugue': 'Rodrigo Eugue',
    'sebastian peralta': 'Sebastian Peralta',
    'peralta sebastian': 'Sebastian Peralta',
    'oscar mendiz': 'Oscar Mendiz',
    'maffeo horacio': 'Maffeo Horacio',
    'moles gustavo': 'Moles Gustavo',
    'farah alejandro': 'Farah Alejandro',
    'marcio alvarado': 'Marcio Alvarado',
    'daniel frias': 'Daniel Frias',
    'jorge villatoro': 'Jorge Villatoro',
    'gerardo delgado': 'Gerardo Delgado',
    'honorio palma': 'Honorio Palma',
    'francisco ayres': 'Francisco Ayres',
    'jorge luiz lorena': 'Jorge Luiz Lorena',
    'antonio fernando': 'Antonio Fernando',
    'kleberth tenorio': 'José Kleberth Tenório',
    'humberto juárez': 'Humberto Juárez',
    'humberto juarez': 'Humberto Juárez',
    'pedro echeverria': 'Pedro Echeverria',
    'jaime dutary': 'Jaime Dutary'
};

for (const [k, v] of Object.entries(extraHospital)) {
    if (!HOSPITAL_ALIASES[k]) hospitalAliasCandidates.set(k, v);
}
for (const [k, v] of Object.entries(extraPerson)) {
    if (!PERSON_ALIASES[k]) personAliasCandidates.set(k, v);
}

mergeAliasesIntoIndex('HOSPITAL_ALIASES', hospitalAliasCandidates, HOSPITAL_ALIASES);
mergeAliasesIntoIndex('PERSON_ALIASES', personAliasCandidates, PERSON_ALIASES);
fs.writeFileSync(indexPath, html, 'utf8');
console.log(`Canonical serials loaded: ${canonical.size}, total case patches: ${totalPatched}`);
console.log(`New hospital alias candidates: ${hospitalAliasCandidates.size}, person: ${personAliasCandidates.size}`);

spawnSync('node', [path.join(root, 'scripts/inline-builtin-implants.mjs')], { stdio: 'inherit' });

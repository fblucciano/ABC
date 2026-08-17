#!/usr/bin/env node
/**
 * Fix mojibake, hospital names, and distributor rules in all embedded datasets, then re-inline.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHILE_INT = 'Instituto Nacional del Tórax (INT)';

function fixMojibake(str) {
    if (!str) return str;
    let s = String(str);
    if (/[ÃÂ]/.test(s)) {
        try { s = Buffer.from(s, 'latin1').toString('utf8'); } catch { /* keep */ }
    }
    return fixBrokenHospitalChars(s);
}

function fixBrokenHospitalChars(str) {
    if (!str) return str;
    return String(str)
        .replace(/\uFFFD/g, '')
        .replace(/Hospital\s+Do\s+Cora.{0,3}o\s+Alagoano/gi, 'Hospital do Coração Alagoano')
        .replace(/Hospital\s+Do\s+Cora[cç]ao/gi, 'Hospital do Coração')
        .replace(/Hospital\s+Ribeir.{0,3}o\s+Preto/gi, 'Hospital Ribeirão Preto')
        .replace(/Hemodin.{0,3}mica\s+S.{0,3}o\s+Lucas/gi, 'Hemodinâmica São Lucas');
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
    'hospital de ninos dr gutierrez': 'Hospital de Niños Dr. Ricardo Gutiérrez',
    'hospital de niños dr. gutierrez': 'Hospital de Niños Dr. Ricardo Gutiérrez',
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
    'incor': 'InCor Natal', 'incor sp': 'InCor SP', 'fundacion cardiovascular de colombia': 'Fundación Cardiovascular de Colombia',
    'instituto diagnostico de la plata': 'Instituto Diagnóstico de La Plata',
    'smh petropolis': 'SMH Petrópolis',
    'hemodinamica sao lucas': 'Hemodinâmica São Lucas',
    'hospital do coracao alagoano': 'Hospital do Coração Alagoano',
    'hospital do coracao': 'Hospital do Coração',
    'hospital ribeirao preto': 'Hospital Ribeirão Preto'
};
const HOSPITAL_KEYS = Object.keys(HOSPITAL_ALIASES).sort((a, b) => b.length - a.length);

const HOSPITAL_CITY_MAP = {
    'Hospital Hapvida São Bernardo': 'São Bernardo do Campo', 'Hospital Paulo Sacramento': 'Jundiaí',
    'Hospital Salvalus': 'São Paulo', 'Hospital São Francisco': 'Ribeirão Preto', 'InCor SP': 'São Paulo',
    'Instituto Dante Pazzanese': 'São Paulo', 'Hospital Albert Einstein': 'São Paulo', 'Hospital Sírio-Libanês': 'São Paulo',
    'IECAC': 'Rio de Janeiro', 'Hospital Badim': 'Rio de Janeiro', 'Hospital Memorial': 'Rio de Janeiro',
    'SMH Petrópolis': 'Petrópolis', 'Santa Tereza': 'Guarapuava', 'Hospital São José': 'Rio de Janeiro',
    'ICFUC': 'Porto Alegre', 'Hospital Ernesto Dornelles': 'Porto Alegre', 'Hospital São Francisco de Paula': 'Pelotas',
    'HCI': 'Ijuí', 'Hospital Santa Cruz': 'Santa Cruz do Sul',
    'Hospital Belo Horizonte': 'Belo Horizonte', 'Hospital Socor': 'Belo Horizonte', 'Prontocor': 'Belo Horizonte',
    'Hospital Hapvida Ilha do Leite': 'Recife', 'Hospital Agamenom Magalhães': 'Recife',
    'Hospital Angiocor': 'Aracaju', 'HUSE': 'Aracaju', 'Hospital Hapvida Rio Negro': 'Manaus', 'Hospital Hapvida Maceió': 'Maceió',
    'Hospital Hapvida Antonio Prudente': 'Fortaleza', 'InCor Natal': 'Natal', 'Hospital Onco Center': 'Teresina',
    'LUXEMBURGO': 'Belo Horizonte', 'HOSPITAL ONIX': 'Curitiba', 'HONPAR': 'Arapongas',
    'HOSPITAL RIBEIRÃO PRETO': 'Ribeirão Preto', 'Hospital Ribeirão Preto': 'Ribeirão Preto',
    'HOSPITAL BOM CLIMA': 'Guarulhos', 'SALVALUS': 'São Paulo', 'PAULO SACRAMENTO': 'Jundiaí', 'INCOR': 'São Paulo',
    'HOSPITAL DO CORAÇAO': 'São Paulo', 'Hospital do Coração': 'São Paulo',
    'Ana Costa': 'Santos', 'MERIDIONAL PRAIA DA COSTA': 'Vila Velha', 'HOSPITAL GERAL DE PALMAS': 'Palmas',
    'Hospital Geral de Palmas': 'Palmas', 'HOSPITAL LESTE MINEIRO': 'Ipatinga', 'HCI - POUSO ALEGRE': 'Pouso Alegre',
    'Hospital Unimed GV': 'Governador Valadares', 'UNIMED VALADARES': 'Governador Valadares',
    'HOSP AROLDO TOURINHO': 'Montes Claros', 'HOSPITAL VAZ MONTEIRO': 'Lavras',
    'HOSPITAL UNIMED RECIFE III': 'Recife', 'REAL HOSPITAL PORTUGUÊS': 'Recife', 'Hospital Rio Grande': 'Natal',
    'HOSPITAL DO CORAÇÃO ALAGOANO': 'Maceió', 'Hospital do Coração Alagoano': 'Maceió',
    'HOSPITAL RIO NEGRO (HAPVIDA)': 'Manaus', 'HOSPITAL AMECOR': 'Cuiabá',
    'SANTA CASA DE MISERICORDIA DE ITABUNA': 'Itabuna', 'HEMOCOR': 'Rio de Janeiro', 'Cinecors': 'Porto Alegre',
    'HUMANIZA': 'Porto Alegre', 'HRS': 'São José', 'SANTA MARTHA': 'Niterói',
    'HEMODINÂMICA SÃO LUCAS': 'Aracaju', 'Hemodinâmica São Lucas': 'Aracaju',
    'HOSPITAL METROPOLITANO DJMP': 'Belém', 'LACIC': 'Vitória da Conquista', 'HOSPITAL SANTA RITA': 'Vitória',
    'Honpar': 'Arapongas', 'Salvalus': 'São Paulo', 'Paulo Sacramento': 'Jundiaí', 'Lacic': 'Vitória da Conquista',
    'Humaniza': 'Porto Alegre'
};

const CITY_STATE_MAP = {
    'São Paulo': 'SP', 'Ribeirão Preto': 'SP', 'Jundiaí': 'SP', 'São Bernardo do Campo': 'SP', 'Guarulhos': 'SP', 'Santos': 'SP',
    'Rio de Janeiro': 'RJ', 'Petrópolis': 'RJ', 'Niterói': 'RJ',
    'Guarapuava': 'PR', 'Curitiba': 'PR', 'Arapongas': 'PR',
    'Criciúma': 'SC', 'São José': 'SC',
    'Porto Alegre': 'RS', 'Pelotas': 'RS', 'Ijuí': 'RS', 'Santa Cruz do Sul': 'RS',
    'Belo Horizonte': 'MG', 'Ipatinga': 'MG', 'Pouso Alegre': 'MG', 'Governador Valadares': 'MG', 'Montes Claros': 'MG', 'Lavras': 'MG',
    'Recife': 'PE', 'Aracaju': 'SE', 'Manaus': 'AM', 'Maceió': 'AL', 'Fortaleza': 'CE', 'Natal': 'RN', 'Teresina': 'PI',
    'Vila Velha': 'ES', 'Vitória': 'ES', 'Palmas': 'TO', 'Cuiabá': 'MT', 'Itabuna': 'BA', 'Vitória da Conquista': 'BA', 'Belém': 'PA'
};

const BR_TERRITORIES = {
    PR: 'MKS', SC: 'MKS', RS: 'MKS',
    MG: 'VIP Medical', RJ: 'VIP Medical', ES: 'VIP Medical',
    SP: 'Sellmed', MS: 'Sellmed', MT: 'Sellmed', GO: 'Sellmed', DF: 'Sellmed',
    BA: 'Sellmed', SE: 'Sellmed', AL: 'Sellmed', PE: 'Sellmed', PB: 'Sellmed', RN: 'Sellmed',
    CE: 'Sellmed', PI: 'Sellmed', MA: 'Sellmed', TO: 'Sellmed', PA: 'Sellmed', AP: 'Sellmed',
    RR: 'Sellmed', AM: 'Sellmed', AC: 'Sellmed', RO: 'Sellmed'
};

const DISTRIBUTOR_BY_COUNTRY = {
    Mexico: 'DDM',
    Argentina: 'Medical World AS',
    Ecuador: 'Meixomed',
    Colombia: 'Medinistros',
    Venezuela: 'GPM Medical',
    Panama: 'GPM Medical',
    Chile: 'Camir',
    'Dominican Republic': 'Venus Medtech'
};

function normalizeYear(y) {
    if (y === null || Number.isNaN(y)) return null;
    y = parseInt(y, 10);
    if (y >= 100) return y;
    return y >= 50 ? 1900 + y : 2000 + y;
}

function getCaseYear(caseObj) {
    if (!caseObj?.date) return null;
    const parts = String(caseObj.date).split('/');
    if (parts.length === 3) {
        const y = normalizeYear(parseInt(parts[2], 10));
        if (y !== null) return y;
    }
    return null;
}

function getBrazilStateFromCase(caseObj) {
    if (!caseObj?.hospital) return null;
    const hosp = caseObj.hospital;
    let city = HOSPITAL_CITY_MAP[hosp];
    if (!city) {
        const h = cleanStr(hosp);
        for (const [k, v] of Object.entries(HOSPITAL_CITY_MAP)) {
            if (cleanStr(k) === h || h.includes(cleanStr(k))) { city = v; break; }
        }
    }
    return city ? CITY_STATE_MAP[city] : null;
}

function stdDist(caseObj) {
    if (!caseObj) return 'Venus Medtech';
    const country = caseObj.country;
    const year = getCaseYear(caseObj);

    if (country === 'Brazil') {
        if (year === 2025) return 'HOMAC';
        const state = getBrazilStateFromCase(caseObj);
        if (state && BR_TERRITORIES[state]) return BR_TERRITORIES[state];
        return 'Sellmed';
    }
    if (DISTRIBUTOR_BY_COUNTRY[country]) return DISTRIBUTOR_BY_COUNTRY[country];

    const raw = fixMojibake(caseObj.dist || '');
    const c = cleanStr(raw);
    if (c.includes('ddm')) return 'DDM';
    if (c.includes('homac')) return 'HOMAC';
    if (c.includes('mks')) return 'MKS';
    if (c.includes('sellmed')) return 'Sellmed';
    if (c.includes('vip')) return 'VIP Medical';
    if (c.includes('medical world')) return 'Medical World AS';
    if (c.includes('meixomed')) return 'Meixomed';
    if (c.includes('medinst')) return 'Medinistros';
    if (c.includes('gpm')) return 'GPM Medical';
    if (c.includes('camir')) return 'Camir';
    if (c.includes('sanyfico')) return 'SANYFICO';
    if (c.includes('emedical')) return 'EMEDICAL';
    if (c.includes('venus') || c.includes('no partner') || c.includes('medtech')) return 'Venus Medtech';
    return raw || 'Venus Medtech';
}

function stdHosp(raw) {
    if (!raw) return 'Unknown Hospital';
    raw = fixBrokenHospitalChars(fixMojibake(String(raw))).trim();
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
        if (c[f]) c[f] = fixMojibake(c[f]);
    }
    c.dist = stdDist(c);
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

const check = fs.readFileSync(indexPath, 'utf8');
const badHosp = [...check.matchAll(/"hospital": "([^"]*[\uFFFD][^"]*)"/g)].map(m => m[1]);
const badPerson = [...check.matchAll(/"(implanter|specialist|proctor)": "([^"]*Ã[^"]*)"/g)].map(m => m[2]);
const distCounts = {};
for (const m of check.matchAll(/"dist": "([^"]+)"/g)) distCounts[m[1]] = (distCounts[m[1]] || 0) + 1;
console.log(`Done. Remaining broken hospitals: ${badHosp.length}, mojibake persons: ${badPerson.length}`);
console.log('Distributor counts:', JSON.stringify(distCounts, null, 2));
if (badHosp.length) console.log('Bad:', badHosp);

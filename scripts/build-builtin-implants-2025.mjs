#!/usr/bin/env node
/**
 * Build latam-builtin-implants-2025.js from Cases_Latam CSV export.
 * Usage: node scripts/build-builtin-implants-2025.mjs path/to/Cases_Latam.csv
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const csvPath = process.argv[2];
if (!csvPath) {
    console.error('Usage: node scripts/build-builtin-implants-2025.mjs <Cases_Latam.csv>');
    process.exit(1);
}

const abs = path.resolve(csvPath);
if (!fs.existsSync(abs)) {
    console.error('File not found:', abs);
    process.exit(1);
}

const wb = XLSX.readFile(abs, { type: 'file', cellDates: true });
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

function cleanStr(s) {
    return s ? String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';
}

function pick(row, names) {
    const keys = Object.keys(row);
    for (const name of names) {
        const target = cleanStr(name);
        for (const k of keys) {
            const ck = cleanStr(k).replace(/[:;]+$/, '');
            if (ck.includes(target) || ck === target) {
                const v = row[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
            }
        }
    }
    return '';
}

function excelSerialToDate(n) {
    if (typeof n !== 'number' || isNaN(n)) return null;
    const utc = Math.round((n - 25569) * 86400 * 1000);
    return new Date(utc);
}

function parseDateParts(dateVal) {
    if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
        return {
            day: dateVal.getDate(),
            month: dateVal.getMonth() + 1,
            year: dateVal.getFullYear(),
            display: String(dateVal.getDate()).padStart(2, '0') + '/' + String(dateVal.getMonth() + 1).padStart(2, '0') + '/' + dateVal.getFullYear()
        };
    }
    if (typeof dateVal === 'number') {
        const d = excelSerialToDate(dateVal);
        if (d) return parseDateParts(d);
    }
    const raw = String(dateVal ?? '').trim();
    if (!raw) return null;
    const parts = raw.split(/[\/\-]/);
    if (parts.length !== 3) return null;
    let p0 = parseInt(parts[0], 10);
    let p1 = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);
    if (y < 100) y = y >= 50 ? 1900 + y : 2000 + y;
    let day, month;
    if (p0 > 12 && p1 <= 12) { day = p0; month = p1; }
    else if (p1 > 12 && p0 <= 12) { day = p1; month = p0; }
    else { month = p0; day = p1; }
    return {
        day, month, year: y,
        display: String(day).padStart(2, '0') + '/' + String(month).padStart(2, '0') + '/' + y
    };
}

function parseCountry(raw) {
    const c = cleanStr(raw);
    if (c.includes('brasil') || c.includes('brazil')) return 'Brazil';
    if (c.includes('argentin')) return 'Argentina';
    if (c.includes('chile')) return 'Chile';
    if (c.includes('colomb')) return 'Colombia';
    if (c.includes('mexic')) return 'Mexico';
    if (c.includes('venezuel')) return 'Venezuela';
    if (c.includes('ecuador') || c.includes('equador')) return 'Ecuador';
    if (c.includes('peru')) return 'Peru';
    if (c.includes('uruguay') || c.includes('uruguai')) return 'Uruguay';
    if (c.includes('paraguay') || c.includes('paraguai')) return 'Paraguay';
    if (c.includes('panam')) return 'Panama';
    if (c.includes('dominic')) return 'Dominican Republic';
    if (c.includes('boliv')) return 'Bolivia';
    return raw || 'Unknown';
}

function titleCase(s) {
    return String(s).replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.substr(1).toLowerCase());
}

function parseValve(row) {
    const valveRaw = pick(row, ['valve']);
    const sizeRaw = pick(row, ['valve size', 'size']);
    const u = (valveRaw + ' ' + sizeRaw).toUpperCase().replace(/_/g, ' ');
    let base = 'Vitae';
    if (u.includes('POWERX') || u.includes('POWER X')) base = 'PowerX';
    else if (u.includes('VENUS P') || u.includes('VENUSP')) base = 'Venus P';
    else if (u.includes('VENUS A') || u.includes('VENUSA')) base = 'Venus A';
    const valve = [valveRaw.replace(/_/g, ' '), sizeRaw].filter(Boolean).join(' ').trim() || base;
    return { valve, valveBase: base };
}

function formatPerson(raw) {
    if (!raw || /^na$/i.test(String(raw).trim())) return 'N/A';
    return titleCase(String(raw).trim());
}

const baseline = [];
const seen = new Set();

for (const row of rows) {
    const dateRaw = pick(row, ['proceduredate', 'procedure date', 'date implant', 'date']);
    const parts = parseDateParts(row.ProcedureDate ?? dateRaw);
    if (!parts || parts.year !== 2025) continue;

    const serial = pick(row, ['valve serial number', 'serial', 'lot']);
    const caseId = pick(row, ['caseid', 'case id', 'latam case']);
    let key;
    if (serial && !/^n\/?a$/i.test(serial)) {
        key = cleanStr(serial) + '|' + parts.display;
    } else if (caseId) {
        key = 'cid:' + cleanStr(caseId);
    } else {
        key = cleanStr(pick(row, ['hospital'])) + '|' + parts.display;
    }
    if (seen.has(key)) continue;
    seen.add(key);

    const country = parseCountry(pick(row, ['country', 'pais', 'territory']));
    if (country === 'Unknown') continue;

    const { valve, valveBase } = parseValve(row);
    const implanter = formatPerson(pick(row, ['first operator', 'implanter']));
    const proctor = formatPerson(pick(row, ['proctor name', 'proctor']));

    baseline.push({
        date: parts.display,
        hospital: pick(row, ['hospital', 'centro']) || 'Unknown Hospital',
        country,
        dist: pick(row, ['distributor', 'dist']) || 'Venus Direct (No Partner)',
        valve,
        valveBase,
        serial: serial || 'N/A',
        implanter,
        specialist: 'N/A',
        proctor
    });
}

baseline.sort((a, b) => cleanStr(a.date).localeCompare(cleanStr(b.date)));

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const target = path.join(repoRoot, 'latam-builtin-implants-2025.js');

const js = `// Auto-generated by scripts/build-builtin-implants-2025.mjs — do not edit by hand
// Source: ${path.basename(abs)} | ${baseline.length} master implant cases for 2025 (reconciliation target: 253)
const BUILTIN_IMPLANTS_2025 = ${JSON.stringify(baseline, null, 2)};
if (typeof window !== 'undefined') window.BUILTIN_IMPLANTS_2025 = BUILTIN_IMPLANTS_2025;
`;

fs.writeFileSync(target, js, 'utf8');
console.log(`Wrote ${baseline.length} cases to ${target}`);
if (baseline.length !== 253) {
    console.warn(`Warning: expected 253 cases, got ${baseline.length}`);
    process.exit(baseline.length === 0 ? 1 : 0);
}

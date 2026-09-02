import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const indexPath = path.join(rootDir, 'index.html');
const html = await readFile(indexPath, 'utf8');
const sha256 = value => createHash('sha256').update(value).digest('hex');

const literalExpectedCaseKeys = [...html.matchAll(/expectedCaseKey\s*:\s*['"]([^'"]+)['"]/g)].map(match => match[1]);
assert.ok(literalExpectedCaseKeys.length >= 2, 'matching self-test must retain synthetic expected-case coverage');
assert.ok(literalExpectedCaseKeys.every(key => key.startsWith('synthetic:')), 'matching self-test expected-case keys must be synthetic');

const literalProbeNames = [...html.matchAll(/v15PatientProbeRecords\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map(match => match[1]);
assert.ok(literalProbeNames.length >= 2, 'matching self-test must retain synthetic patient-probe coverage');
assert.ok(literalProbeNames.every(name => /^Sample Patient [A-Z]/.test(name)), 'matching self-test probe names must use the synthetic namespace');

assert.match(html, /const BUILTIN_IMPLANTS_2025 = \[\];/);
assert.match(html, /const BUILTIN_IMPLANTS_2026 = \[\];/);
assert.match(html, /const BUILTIN_PROBLEM_CASES = \[\];/);
assert.match(html, /const BUILTIN_LATAM_OUTCOMES_2026 = \[\];/);
assert.match(html, /const V12_BUILTIN_PROFESSIONAL_CONTACTS = \[\];/);
assert.match(html, /const V12_BUILTIN_PATIENT_LOOKUP = \{\};/);
assert.match(html, /const V14_BUILTIN_PATIENT_ALIAS_LOOKUP = \{\};/);
assert.match(html, /const NATIONALITIES = \{\};/);
assert.match(html, /const OFFICIAL_PROCTORS = \[\];/);
assert.match(html, /const PERSON_ALIASES = \{\};/);
assert.match(html, /const HOSPITAL_ALIASES = \{\};/);
assert.match(html, /const CONGRESS_CASE_TAGS = \{\};/);
assert.match(html, /const KNOWN_CASE_IDENTITY_CORRECTIONS = \{\};/);
assert.match(html, /const VENUS_CORPORATE_STAFF = \{\};/);
assert.match(html, /const SOP_APPROVED_PRICES = \{\};/);
assert.match(html, /let PROCTOR_DEFAULT_RATE_USD = 0;/);
assert.match(html, /let sopGlobalTargetUSD = 0;/);
assert.match(html, /id="sop-target-usd-input" value="0"/);
assert.match(html, /id="sop-price-a" value="0"/);
assert.match(html, /key:'synthetic:exact'/);
assert.match(html, /Name: TEST PATIENT ALPHA/);

const retiredScripts = [
    'apply-csv-canonical-names.mjs',
    'build-builtin-implants-2025.mjs',
    'build-builtin-implants-2026.mjs',
    'fix-corrupted-aliases.mjs',
    'inline-builtin-implants.mjs',
    'normalize-embedded-hospitals.mjs',
    'normalize-embedded-text.mjs'
];

const beforeHash = sha256(html);
for (const script of retiredScripts) {
    const source = await readFile(path.join(scriptDir, script), 'utf8');
    assert.match(source, /refusePublicDataMutation/);
    assert.doesNotMatch(source, /(?:read|write)FileSync|spawnSync|index\.html|latam-builtin-/);
    const result = spawnSync(process.execPath, [path.join(scriptDir, script), 'synthetic-input.csv'], {
        cwd: rootDir,
        encoding: 'utf8'
    });
    assert.notEqual(result.status, 0, `${script} must fail closed`);
}
const afterHash = sha256(await readFile(indexPath, 'utf8'));
assert.equal(afterHash, beforeHash, 'retired scripts modified the public index');

process.stdout.write(JSON.stringify({ ok: true, retiredScripts: retiredScripts.length, structuralGuards: 2 }) + '\n');

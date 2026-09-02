import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const client = require(path.join(rootDir, 'abc-intelligence-client.js'));

const sha = 'a'.repeat(64);
const patientHash = 'b'.repeat(64);
const feed = {
    schemaVersion: 'abc-intelligence-v1',
    generatedAt: '2026-09-01T20:30:00.000Z',
    datasetSha256: sha,
    appMeta: { latamDataCutoff: '2026-09-01' },
    implants: {
        '2025': [{ id: 'case-25', date: '2025-01-01', comment: '' }],
        '2026': [{ id: 'case-26', date: '2026-01-01', comment: 'Live comment' }],
        global2026: [{ id: 'global-1', date: '2026-02-01', region: 'EU' }]
    },
    outcomes2026: [{
        case_id: 'MC-2026-001',
        date: '2026-01-01',
        comment: { original_redacted: '', source_language: 'pt' }
    }],
    problemCases: [{ id: 'problem-1', date: '2026-03-01', commentOriginal: '' }],
    professionalContacts: [{ primaryName: 'Clinical User', emails: ['clinical@example.test'] }],
    patientLookup: { [patientHash]: [{ caseId: 'SYNTHETIC-CASE-001' }] },
    outcomeImportBaseline: {
        binarySha256: 'c'.repeat(64),
        logicalSha256: 'd'.repeat(64),
        rowFingerprints: { 'synthetic:row:1': 'e'.repeat(64) }
    },
    referenceData: {
        nationalities: { 'Clinical User': 'Brazil' },
        officialProctors: ['Clinical User'],
        proctorDefaultRateUsd: 1800,
        globalProctorDefaultRateUsd: 1500,
        globalSingleNameProctors: ['clinical'],
        proctorDayRatesUsd: { 'Clinical User': 2500 },
        proctorAliases: { 'clinical user': 'Clinical User' },
        personAliases: { 'clinical user': 'Clinical User' },
        globalSpecialistExactAliases: { clinical: 'Clinical User' },
        congressCaseTags: {},
        argentina2025AttendanceSerialExceptions: [],
        panama2025AttendanceSerials: [],
        attendanceEnrichmentPeople: {
            argentina2025Specialist: 'Clinical Specialist',
            panama2025Proctor: 'Clinical Proctor'
        },
        legacyHomacDateBySerial: {},
        incorSpSerials: [],
        incorRondoniaSerials: [],
        clinicalMasterOverrides: {},
        knownCaseIdentityCorrections: {},
        confirmedProcedureProctorRules: [],
        personRoleCorrectionRules: [],
        venusCorporateStaff: {
            explicitNormalizedIncludes: ['clinical user'],
            globalSpecialistCanonicalNames: ['Clinical User'],
            affiliation: 'VENUS MEDTECH'
        },
        hospitalAliases: { 'clinical center': 'Clinical Center' },
        hospitalCityMap: { 'Clinical Center': 'Clinical City' },
        cityStateMap: { 'Clinical City': 'CS' },
        brTerritories: { CS: 'Clinical Distributor' },
        distributorByCountry: { Brazil: 'Clinical Distributor' },
        hospitalCountryAnchors: { 'clinical center': 'Brazil' },
        sopApprovedPrices: { 'Venus A': 5000 },
        sopTargets: { globalUsd: 6000000, regionsUsd: { LATAM: 6000000 } }
    }
};

assert.equal(client.validateFeed(feed), feed);
assert.equal(client.resolveApiBase('localhost'), 'http://localhost:5173');
assert.equal(client.resolveApiBase('127.0.0.1'), 'http://localhost:5173');
assert.equal(client.resolveApiBase('fblucciano.github.io'), 'https://procedures-latam-form.fblucciano.chatgpt.site');
assert.equal(client.isoCutoffFromAppMeta(feed.appMeta), '2026-09-01');
assert.equal(client.normalizeRemoteRegion('Europe'), 'EU');
assert.equal(client.normalizeRemoteRegion('Middle East'), 'ME');
const authoritativeCaseA = {
    _authoritativeOperationsUpload: true,
    _sourceCaseId: 'procedures-case-a'
};
const authoritativeCaseB = {
    _authoritativeOperationsUpload: true,
    _sourceCaseId: 'procedures-case-b'
};
assert.equal(client.authoritativeSourceCaseId(authoritativeCaseA), 'procedures case a');
assert.equal(client.hasDistinctAuthoritativeSourceIdentity(authoritativeCaseA, authoritativeCaseB), true);
assert.equal(client.hasDistinctAuthoritativeSourceIdentity(authoritativeCaseA, { ...authoritativeCaseA }), false);
assert.equal(client.hasDistinctAuthoritativeSourceIdentity(authoritativeCaseA, {
    ...authoritativeCaseB,
    _authoritativeOperationsUpload: false
}), false);

const prepared = client.prepareFeed(feed, {
    implants2025: [{ id: 'case-25', date: '2025-01-01', comment: 'Preserved 2025 comment' }],
    implants2026: [{ id: 'case-26', date: '2026-01-01', comment: 'Old comment' }],
    global2026: [],
    outcomes2026: [{
        case_id: 'MC-2026-001',
        date: '2026-01-01',
        comment: { original_redacted: 'Preserved outcome comment', source_language: 'es' }
    }],
    problemCases: [{ id: 'problem-1', date: '2026-03-01', commentOriginal: 'Preserved problem comment' }]
});

assert.equal(prepared.implants2025[0].comment, 'Preserved 2025 comment');
assert.equal(prepared.implants2026[0].comment, 'Live comment');
assert.equal(prepared.outcomes2026[0].comment.original_redacted, 'Preserved outcome comment');
assert.equal(prepared.outcomes2026[0].comment.source_language, 'pt');
assert.equal(prepared.problemCases[0].commentOriginal, 'Preserved problem comment');
assert.notEqual(prepared.feed, feed, 'prepared feed must be a defensive clone');

assert.throws(() => client.validateFeed({ ...feed, datasetSha256: 'not-a-sha' }), /datasetSha256/);
assert.throws(() => client.validateFeed({ ...feed, patientLookup: { invalid: [] } }), /patientLookup/);

const html = await readFile(path.join(rootDir, 'index.html'), 'utf8');
assert.match(html, /<script src="abc-intelligence-client\.js"><\/script>/);
assert.doesNotMatch(html, /VENUS_ACCESS_CODE|VENUS_ACCESS_TOKEN/);
assert.doesNotMatch(html, /DOMContentLoaded', bootApp/);
assert.match(html, /const BUILTIN_IMPLANTS_2025 = \[\];/);
assert.match(html, /const BUILTIN_IMPLANTS_2026 = \[\];/);
assert.match(html, /const BUILTIN_PROBLEM_CASES = \[\];/);
assert.match(html, /const BUILTIN_LATAM_OUTCOMES_2026 = \[\];/);
assert.match(html, /const V12_BUILTIN_PROFESSIONAL_CONTACTS = \[\];/);
assert.match(html, /const V12_BUILTIN_PATIENT_LOOKUP = \{\};/);
assert.match(html, /const V14_BUILTIN_PATIENT_ALIAS_LOOKUP = \{\};/);
assert.match(html, /let V12_BASELINE_BINARY_SHA256 = '';/);
assert.match(html, /let V12_BASELINE_LOGICAL_SHA256 = '';/);
assert.match(html, /let V12_BASELINE_ROW_FINGERPRINTS = \{\};/);
assert.match(html, /if \(hasDistinctAuthoritativeSourceIdentity\(a, b\)\) return false;/);
assert.match(html, /if \(hasDistinctAuthoritativeSourceIdentity\(primary, c\)\)/);
assert.match(html, /return dedupeClinicalNearDuplicates\(cases\);/);
assert.doesNotMatch(html, /using the embedded verified snapshot/i);
const scriptSources = [...html.matchAll(/<script[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi)].map(match => match[1]);
assert.ok(scriptSources.length >= 6);
const firstPartyScripts = new Set([
    'abc-intelligence-client.js',
    'latam-builtin-implants-2025.js',
    'latam-builtin-implants-2026.js',
    'latam-builtin-problems.js'
]);
const pinnedLibraryScripts = new Set([
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    'https://cdn.jsdelivr.net/npm/apexcharts@3.49.0/dist/apexcharts.min.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
]);
assert.ok(scriptSources.every(source => firstPartyScripts.has(source) || pinnedLibraryScripts.has(source)), 'executable libraries must be exact-version pinned');
assert.match(html, /https:\/\/cdn\.jsdelivr\.net\/npm\/tesseract\.js@5\.1\.1\/dist\/worker\.min\.js/);
assert.equal((html.match(/https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/pdf\.js\/3\.11\.174\/pdf\.worker\.min\.js/g) || []).length, 2);

const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => match[1])
    .filter(source => source.trim());
assert.equal(inlineScripts.length, 6);
inlineScripts.forEach((source, index) => {
    assert.doesNotThrow(() => new vm.Script(source, { filename: `index-inline-${index + 1}.js` }));
});

const clientSource = await readFile(path.join(rootDir, 'abc-intelligence-client.js'), 'utf8');
const storage = new Map();
const classNames = new Set(['gate-locked']);
const input = { value: 'secure-code', disabled: false, focus() {} };
const error = { textContent: '' };
const button = { disabled: false };
const gate = { classList: { add() {}, remove() {} }, setAttribute() {} };
const requests = [];
let bootCount = 0;
const runtimeFeed = structuredClone(feed);
const context = vm.createContext({
    console,
    Headers,
    AbortController,
    setTimeout,
    clearTimeout,
    setInterval() { return 1; },
    clearInterval() {},
    location: { hostname: 'localhost' },
    document: {
        readyState: 'complete',
        visibilityState: 'visible',
        body: { classList: { add(value) { classNames.add(value); }, remove(value) { classNames.delete(value); } } },
        getElementById(id) { return id === 'access-gate' ? gate : id === 'access-password' ? input : id === 'access-error' ? error : null; },
        querySelector(selector) { return selector === '#access-gate .access-btn' ? button : null; },
        addEventListener() {}
    },
    sessionStorage: {
        getItem(key) { return storage.has(key) ? storage.get(key) : null; },
        setItem(key, value) { storage.set(key, String(value)); },
        removeItem(key) { storage.delete(key); }
    },
    localStorage: { removeItem() {} },
    async fetch(url, options) {
        requests.push({ url, options });
        if (url.endsWith('/api/abc/access/login')) return { ok: true, status: 200, async json() { return { ok: true, token: 'session-token', profile: { role: 'owner' } }; } };
        if (url.endsWith('/api/abc/intelligence') && options.headers.get('If-None-Match')) return { ok: false, status: 304, async json() { throw new Error('304 has no body'); } };
        if (url.endsWith('/api/abc/intelligence')) return { ok: true, status: 200, async json() { return { ok: true, feed: runtimeFeed }; } };
        if (url.endsWith('/api/abc/access/logout')) return { ok: true, status: 200, async json() { return { ok: true }; } };
        throw new Error(`Unexpected URL ${url}`);
    }
});

vm.runInContext(`
const APP_META={latamDataCutoff:'2026-08-21',latamDataSnapshot:'2026-08-24'};
const BUILTIN_IMPLANTS_2025=[{id:'case-25',date:'2025-01-01',comment:'Preserved runtime comment'}];
const BUILTIN_IMPLANTS_2026=[];
const BUILTIN_LATAM_OUTCOMES_2026=[];
const BUILTIN_PROBLEM_CASES=[];
let fileUploads={};
let abcRemoteProfessionalContacts=[];
let abcRemotePatientLookup={};
let v12OutcomeEffectiveCutoff='2026-08-21';
let V12_BASELINE_BINARY_SHA256='';
let V12_BASELINE_LOGICAL_SHA256='';
let V12_BASELINE_ROW_FINGERPRINTS={};
const NATIONALITIES={};
const OFFICIAL_PROCTORS=[];
let PROCTOR_DEFAULT_RATE_USD=0;
let GLOBAL_PROCTOR_DEFAULT_RATE_USD=0;
const GLOBAL_SINGLE_NAME_PROCTORS=new Set();
const PROCTOR_DAY_RATES_USD={};
const PROCTOR_ALIASES={};
const PROCTOR_ALIASES_KEYS=[];
const PERSON_ALIASES={};
const PERSON_ALIASES_KEYS=[];
const GLOBAL_SPECIALIST_EXACT_ALIASES={};
const CONGRESS_CASE_TAGS={};
const ARGENTINA_2025_ATTENDANCE_SERIAL_EXCEPTIONS=new Set();
const PANAMA_2025_ATTENDANCE_SERIALS=new Set();
const ATTENDANCE_ENRICHMENT_PEOPLE={};
const LEGACY_HOMAC_DATE_BY_SERIAL={};
const INCOR_SP_SERIALS=new Set();
const INCOR_RONDONIA_SERIALS=new Set();
const CLINICAL_MASTER_OVERRIDES={};
const KNOWN_CASE_IDENTITY_CORRECTIONS={};
const CONFIRMED_PROCEDURE_PROCTOR_RULES=[];
const PERSON_ROLE_CORRECTION_RULES=[];
const VENUS_CORPORATE_STAFF={};
const HOSPITAL_ALIASES={};
const HOSPITAL_ALIASES_KEYS=[];
const HOSPITAL_CITY_MAP={};
const CITY_STATE_MAP={};
const BR_TERRITORIES={};
const DISTRIBUTOR_BY_COUNTRY={};
const HOSPITAL_COUNTRY_ANCHORS={};
const SOP_APPROVED_PRICES={};
let CHILE_INT_HOSPITAL='';
let SAN_GERONIMO_HOSPITAL='';
let sopGlobalTargetUSD=0;
let sopRegionTargetsUSD={};
let allCasesGlobal=[];
function normalizeRegionName(){return 'GLOBAL'}
function buildDedupKey(){return 'dedup-key'}
function bootApp(){globalThis.__bootCount=(globalThis.__bootCount||0)+1}
function rebuildAllCasesGlobal(){allCasesGlobal=[...BUILTIN_IMPLANTS_2025,...BUILTIN_IMPLANTS_2026,...(fileUploads.__abc_intelligence_global_2026__||[])]}
function v12RefreshPrivateDirectories(){}
async function v12LoadOutcomePersistentState(){globalThis.__privateStateLoadCount=(globalThis.__privateStateLoadCount||0)+1}
function extractFilters(){}
function processData(){}
function renderAppMeta(){}
`, context);
vm.runInContext(clientSource, context, { filename: 'abc-intelligence-client.js' });
await context.submitAccessGate();
bootCount = context.__bootCount || 0;
assert.equal(bootCount, 1);
assert.equal(context.__privateStateLoadCount, 1);
assert.equal(classNames.has('gate-locked'), false);
assert.equal(storage.get(client.TOKEN_STORAGE_KEY), 'session-token');
assert.equal(vm.runInContext('BUILTIN_IMPLANTS_2025[0].comment', context), 'Preserved runtime comment');
assert.equal(vm.runInContext('APP_META.latamDataCutoff', context), '2026-09-01');
assert.equal(vm.runInContext('V12_BASELINE_BINARY_SHA256', context), 'c'.repeat(64));
assert.equal(vm.runInContext('V12_BASELINE_ROW_FINGERPRINTS["synthetic:row:1"]', context), 'e'.repeat(64));
assert.equal(vm.runInContext('NATIONALITIES["Clinical User"]', context), 'Brazil');
assert.equal(vm.runInContext('PROCTOR_ALIASES_KEYS[0]', context), 'clinical user');
assert.equal(vm.runInContext('PROCTOR_DEFAULT_RATE_USD', context), 1800);
assert.equal(vm.runInContext('HOSPITAL_ALIASES["clinical center"]', context), 'Clinical Center');
assert.equal(vm.runInContext('HOSPITAL_ALIASES_KEYS[0]', context), 'clinical center');
assert.equal(vm.runInContext('VENUS_CORPORATE_STAFF.affiliation', context), 'VENUS MEDTECH');
assert.equal(vm.runInContext('sopGlobalTargetUSD', context), 6000000);
assert.equal(vm.runInContext('fileUploads.__abc_intelligence_global_2026__[0]._region', context), 'EU');
assert.deepEqual(JSON.parse(requests[0].options.body), { accessCode: 'secure-code' });
assert.equal(requests[0].options.credentials, 'omit');
assert.equal(requests[1].options.headers.get('Authorization'), 'Bearer session-token');
await context.refreshABCIntelligence();
assert.equal(requests[2].options.headers.get('If-None-Match'), `"sha256-${sha}"`);
await context.logoutAccessGate();
assert.equal(classNames.has('gate-locked'), true);
assert.equal(storage.has(client.TOKEN_STORAGE_KEY), false);

process.stdout.write(JSON.stringify({ ok: true, tests: 62, schemaVersion: client.SCHEMA_VERSION }) + '\n');

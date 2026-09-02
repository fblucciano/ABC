(function attachABCIntelligenceClient(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module && module.exports) module.exports = api;
    if (root && root.document) {
        root.ABCIntelligenceIntegration = api;
        api.install(root);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildABCIntelligenceClient() {
    'use strict';

    const SCHEMA_VERSION = 'abc-intelligence-v1';
    const PRODUCTION_API_BASE = 'https://procedures-latam-form.fblucciano.chatgpt.site';
    const LOCAL_API_BASE = 'http://localhost:5173';
    const TOKEN_STORAGE_KEY = 'abc_intelligence_access_token_v1';
    const FEED_STORAGE_KEY = 'abc_intelligence_last_feed_v1';
    const GLOBAL_UPLOAD_KEY = '__abc_intelligence_global_2026__';
    const POLL_INTERVAL_MS = 10 * 60 * 1000;
    const REQUEST_TIMEOUT_MS = 20 * 1000;
    const COMMENT_FIELDS = new Set([
        'comment', 'comments', 'commentOriginal', 'commentEn', 'commentEnglish',
        'clinicalComment', 'clinicalComments', 'narrative', 'narratives'
    ]);

    class ABCRequestError extends Error {
        constructor(message, status = 0) {
            super(message);
            this.name = 'ABCRequestError';
            this.status = Number(status || 0);
        }
    }

    function deepClone(value) {
        if (value === undefined) return undefined;
        return JSON.parse(JSON.stringify(value));
    }

    function isPlainObject(value) {
        return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    }

    function isBlank(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return !value.trim();
        if (Array.isArray(value)) return !value.length || value.every(isBlank);
        if (isPlainObject(value)) {
            const values = Object.values(value);
            return !values.length || values.every(isBlank);
        }
        return false;
    }

    function mergeCommentValue(existing, incoming) {
        if (isBlank(incoming)) return isBlank(existing) ? deepClone(incoming) : deepClone(existing);
        if (!isPlainObject(existing) || !isPlainObject(incoming)) return deepClone(incoming);
        const merged = deepClone(incoming);
        Object.keys(existing).forEach(key => {
            if (!(key in merged) || isBlank(merged[key])) merged[key] = deepClone(existing[key]);
            else if (isPlainObject(existing[key]) && isPlainObject(merged[key])) {
                merged[key] = mergeCommentValue(existing[key], merged[key]);
            }
        });
        return merged;
    }

    function preserveNonEmptyComments(existing, incoming) {
        const merged = deepClone(incoming);
        if (!isPlainObject(existing) || !isPlainObject(merged)) return merged;
        COMMENT_FIELDS.forEach(field => {
            if (!(field in existing)) return;
            if (!(field in merged) || isBlank(merged[field])) merged[field] = deepClone(existing[field]);
            else merged[field] = mergeCommentValue(existing[field], merged[field]);
        });
        return merged;
    }

    function text(value) {
        return value === null || value === undefined ? '' : String(value).trim();
    }

    function normalized(value) {
        return text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function readPath(value, path) {
        return String(path || '').split('.').reduce((current, key) => current == null ? undefined : current[key], value);
    }

    function identityKeys(record) {
        if (!isPlainObject(record)) return [];
        const keys = new Set();
        const add = (prefix, value) => {
            const clean = normalized(value);
            if (clean) keys.add(`${prefix}:${clean}`);
        };
        [record.id, record.case_id, record.app_case_id, record.workbook_case_id,
            record.officialCaseId, record.caseId, record._sourceCaseId, record.sourceCaseId]
            .forEach(value => add('case', value));

        let formIds = readPath(record, 'source.forms_record_ids');
        if (!Array.isArray(formIds)) formIds = formIds === undefined || formIds === null ? [] : [formIds];
        [record.formsId, record.formId, record.canonicalFormsId, ...formIds]
            .forEach(value => add('forms', value));

        const date = text(record.date || record.procedureDate || readPath(record, 'procedure.date'));
        const serial = text(record.serial || readPath(record, 'lots.valve') || readPath(record, 'finalDevice.serial'));
        if (date && serial && normalized(serial) !== 'n a') add('serial-date', `${serial}|${date}`);
        return [...keys];
    }

    function mergeCollectionPreservingComments(existingCollection, incomingCollection) {
        const existing = Array.isArray(existingCollection) ? existingCollection : [];
        const incoming = Array.isArray(incomingCollection) ? incomingCollection : [];
        const index = new Map();
        existing.forEach(record => identityKeys(record).forEach(key => {
            if (!index.has(key)) index.set(key, record);
        }));
        return incoming.map(record => {
            const prior = identityKeys(record).map(key => index.get(key)).find(Boolean);
            return prior ? preserveNonEmptyComments(prior, record) : deepClone(record);
        });
    }

    function requireArray(value, path) {
        if (!Array.isArray(value)) throw new Error(`Invalid ABC feed: ${path} must be an array.`);
        if (!value.every(isPlainObject)) throw new Error(`Invalid ABC feed: ${path} contains a non-object record.`);
        return value;
    }

    function validateFeed(feed) {
        if (!isPlainObject(feed)) throw new Error('Invalid ABC feed: feed must be an object.');
        if (feed.schemaVersion !== SCHEMA_VERSION) throw new Error(`Unsupported ABC feed schema: ${text(feed.schemaVersion) || 'missing'}.`);
        if (!text(feed.generatedAt) || !Number.isFinite(Date.parse(feed.generatedAt))) throw new Error('Invalid ABC feed: generatedAt is missing or invalid.');
        if (!/^[a-f0-9]{64}$/i.test(text(feed.datasetSha256))) throw new Error('Invalid ABC feed: datasetSha256 must be SHA-256.');
        if (!isPlainObject(feed.appMeta)) throw new Error('Invalid ABC feed: appMeta must be an object.');
        if (!isPlainObject(feed.implants)) throw new Error('Invalid ABC feed: implants must be an object.');
        requireArray(feed.implants['2025'], "implants['2025']");
        requireArray(feed.implants['2026'], "implants['2026']");
        requireArray(feed.implants.global2026, 'implants.global2026');
        requireArray(feed.outcomes2026, 'outcomes2026');
        requireArray(feed.problemCases, 'problemCases');
        requireArray(feed.professionalContacts, 'professionalContacts');
        if (!isPlainObject(feed.patientLookup)) throw new Error('Invalid ABC feed: patientLookup must be an object.');
        Object.entries(feed.patientLookup).forEach(([hash, refs]) => {
            if (!/^[a-f0-9]{64}$/i.test(hash) || !Array.isArray(refs) || !refs.every(isPlainObject)) {
                throw new Error('Invalid ABC feed: patientLookup entries must be SHA-256 keys with array values.');
            }
        });
        if (!isPlainObject(feed.outcomeImportBaseline)) throw new Error('Invalid ABC feed: outcomeImportBaseline must be an object.');
        if (!/^[a-f0-9]{64}$/i.test(text(feed.outcomeImportBaseline.binarySha256))
            || !/^[a-f0-9]{64}$/i.test(text(feed.outcomeImportBaseline.logicalSha256))
            || !isPlainObject(feed.outcomeImportBaseline.rowFingerprints)
            || Object.values(feed.outcomeImportBaseline.rowFingerprints).some(value => !/^[a-f0-9]{64}$/i.test(text(value)))) {
            throw new Error('Invalid ABC feed: outcomeImportBaseline contains invalid SHA-256 values.');
        }
        if (!isPlainObject(feed.referenceData)) throw new Error('Invalid ABC feed: referenceData must be an object.');
        const referenceArrays = [
            'officialProctors', 'globalSingleNameProctors', 'argentina2025AttendanceSerialExceptions',
            'panama2025AttendanceSerials', 'incorSpSerials', 'incorRondoniaSerials',
            'confirmedProcedureProctorRules', 'personRoleCorrectionRules'
        ];
        const referenceObjects = [
            'nationalities', 'proctorDayRatesUsd', 'proctorAliases', 'personAliases',
            'globalSpecialistExactAliases', 'congressCaseTags', 'legacyHomacDateBySerial',
            'clinicalMasterOverrides', 'knownCaseIdentityCorrections', 'hospitalAliases',
            'hospitalCityMap', 'cityStateMap', 'brTerritories', 'distributorByCountry',
            'hospitalCountryAnchors', 'sopApprovedPrices', 'sopTargets', 'venusCorporateStaff',
            'attendanceEnrichmentPeople'
        ];
        if (referenceArrays.some(key => !Array.isArray(feed.referenceData[key]))
            || referenceObjects.some(key => !isPlainObject(feed.referenceData[key]))
            || !Number.isFinite(feed.referenceData.proctorDefaultRateUsd)
            || !Number.isFinite(feed.referenceData.globalProctorDefaultRateUsd)
            || !Number.isFinite(feed.referenceData.sopTargets.globalUsd)
            || !isPlainObject(feed.referenceData.sopTargets.regionsUsd)
            || !Array.isArray(feed.referenceData.venusCorporateStaff.explicitNormalizedIncludes)
            || !Array.isArray(feed.referenceData.venusCorporateStaff.globalSpecialistCanonicalNames)) {
            throw new Error('Invalid ABC feed: referenceData has invalid collections.');
        }
        return feed;
    }

    function prepareFeed(feed, current = {}) {
        validateFeed(feed);
        const cloned = deepClone(feed);
        return {
            feed: cloned,
            implants2025: mergeCollectionPreservingComments(current.implants2025, cloned.implants['2025']),
            implants2026: mergeCollectionPreservingComments(current.implants2026, cloned.implants['2026']),
            global2026: mergeCollectionPreservingComments(current.global2026, cloned.implants.global2026),
            outcomes2026: mergeCollectionPreservingComments(current.outcomes2026, cloned.outcomes2026),
            problemCases: mergeCollectionPreservingComments(current.problemCases, cloned.problemCases),
            professionalContacts: cloned.professionalContacts,
            patientLookup: cloned.patientLookup
        };
    }

    function resolveApiBase(hostname) {
        const host = text(hostname).toLowerCase();
        return host === 'localhost' || host === '127.0.0.1' ? LOCAL_API_BASE : PRODUCTION_API_BASE;
    }

    function isoCutoffFromAppMeta(appMeta) {
        const candidates = [appMeta && appMeta.latamDataCutoff, appMeta && appMeta.dataCutoff, appMeta && appMeta.latamDataSnapshot];
        return candidates.map(text).find(value => /^\d{4}-\d{2}-\d{2}$/.test(value)) || '';
    }

    function normalizeRemoteRegion(value) {
        const key = normalized(value);
        if (key === 'eu' || key === 'europe') return 'EU';
        if (key === 'eu direct' || key === 'europe direct') return 'EU DIRECT';
        if (key === 'eu distributors' || key === 'europe distributors') return 'EU DISTRIBUTORS';
        if (key === 'apac' || key === 'asia pacific') return 'APAC';
        if (key === 'me' || key === 'middle east') return 'ME';
        if (key === 'latam' || key === 'latin america') return 'LATAM';
        return text(value);
    }

    function install(root) {
        if (root.__abcIntelligenceClientInstalled) return root.ABCIntelligenceIntegration;
        root.__abcIntelligenceClientInstalled = true;

        const state = {
            initialized: false,
            booted: false,
            privateStateLoaded: false,
            token: '',
            profile: null,
            activeDatasetSha256: '',
            refreshPromise: null,
            pollTimer: null,
            visibilityInstalled: false
        };
        const apiBase = resolveApiBase(root.location && root.location.hostname);

        function tokenFromSession() {
            try { return text(root.sessionStorage.getItem(TOKEN_STORAGE_KEY)); }
            catch (error) { return ''; }
        }

        function saveToken(token) {
            state.token = text(token);
            try {
                if (state.token) root.sessionStorage.setItem(TOKEN_STORAGE_KEY, state.token);
                else root.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
            } catch (error) { /* The in-memory token still remains session-only. */ }
        }

        function clearSessionState() {
            state.token = '';
            state.profile = null;
            state.activeDatasetSha256 = '';
            try {
                root.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
                root.sessionStorage.removeItem(FEED_STORAGE_KEY);
            } catch (error) { /* no-op */ }
        }

        function cacheFeed(feed) {
            try { root.sessionStorage.setItem(FEED_STORAGE_KEY, JSON.stringify(feed)); }
            catch (error) { /* A quota error must not invalidate a verified live feed. */ }
        }

        function cachedFeed() {
            try {
                const raw = root.sessionStorage.getItem(FEED_STORAGE_KEY);
                if (!raw) return null;
                return validateFeed(JSON.parse(raw));
            } catch (error) {
                try { root.sessionStorage.removeItem(FEED_STORAGE_KEY); } catch (ignore) { /* no-op */ }
                return null;
            }
        }

        function gateElements() {
            return {
                gate: root.document.getElementById('access-gate'),
                input: root.document.getElementById('access-password'),
                error: root.document.getElementById('access-error'),
                button: root.document.querySelector('#access-gate .access-btn')
            };
        }

        function setGateBusy(busy) {
            const { input, button } = gateElements();
            if (input) input.disabled = Boolean(busy);
            if (button) button.disabled = Boolean(busy);
        }

        function setGateError(message = '') {
            const { error } = gateElements();
            if (error) error.textContent = message;
        }

        function lockGate(message = '') {
            root.document.body.classList.add('gate-locked');
            const { gate, input } = gateElements();
            if (gate) {
                gate.classList.add('active');
                gate.setAttribute('aria-hidden', 'false');
            }
            setGateError(message);
            setGateBusy(false);
            root.setTimeout(() => input && input.focus(), 120);
        }

        function unlockGate() {
            root.document.body.classList.remove('gate-locked');
            const { gate } = gateElements();
            if (gate) {
                gate.classList.remove('active');
                gate.setAttribute('aria-hidden', 'true');
            }
            setGateError('');
            setGateBusy(false);
        }

        async function request(path, options = {}) {
            const controller = new AbortController();
            const timeout = root.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
            const headers = new Headers(options.headers || {});
            if (options.json !== undefined) headers.set('Content-Type', 'application/json');
            if (options.auth !== false && state.token) headers.set('Authorization', `Bearer ${state.token}`);
            try {
                const response = await root.fetch(`${apiBase}${path}`, {
                    method: options.method || 'GET',
                    headers,
                    body: options.json === undefined ? undefined : JSON.stringify(options.json),
                    credentials: 'omit',
                    cache: 'no-store',
                    signal: controller.signal
                });
                if (response.status === 304 && options.allowNotModified) return { ok: true, notModified: true };
                let payload = null;
                try { payload = await response.json(); } catch (error) { /* handled below */ }
                if (!response.ok) {
                    const message = text(payload && (payload.error || payload.message)) || `Request failed (${response.status}).`;
                    throw new ABCRequestError(message, response.status);
                }
                if (!isPlainObject(payload)) throw new ABCRequestError('The server returned an invalid response.', response.status);
                return payload;
            } catch (error) {
                if (error && error.name === 'AbortError') throw new ABCRequestError('The server did not respond in time.');
                throw error;
            } finally {
                root.clearTimeout(timeout);
            }
        }

        function currentCollections() {
            return {
                implants2025: typeof BUILTIN_IMPLANTS_2025 !== 'undefined' && Array.isArray(BUILTIN_IMPLANTS_2025) ? BUILTIN_IMPLANTS_2025 : [],
                implants2026: typeof BUILTIN_IMPLANTS_2026 !== 'undefined' && Array.isArray(BUILTIN_IMPLANTS_2026) ? BUILTIN_IMPLANTS_2026 : [],
                outcomes2026: typeof BUILTIN_LATAM_OUTCOMES_2026 !== 'undefined' && Array.isArray(BUILTIN_LATAM_OUTCOMES_2026) ? BUILTIN_LATAM_OUTCOMES_2026 : [],
                problemCases: typeof BUILTIN_PROBLEM_CASES !== 'undefined' && Array.isArray(BUILTIN_PROBLEM_CASES) ? BUILTIN_PROBLEM_CASES : [],
                global2026: typeof fileUploads !== 'undefined' && Array.isArray(fileUploads[GLOBAL_UPLOAD_KEY]) ? fileUploads[GLOBAL_UPLOAD_KEY] : []
            };
        }

        function prepareGlobalCase(raw, index) {
            const item = deepClone(raw);
            item.dist = item.dist || item.distributor || '';
            item.specialist = item.specialist || item.clinicalSpecialist || 'N/A';
            item.implanter = item.implanter || item.operator || 'N/A';
            item.proctor = item.proctor || 'N/A';
            item._sourceSheet = item._sourceSheet || item.sourceSheet || item.region || 'GLOBAL 2026';
            item._sourceFile = item._sourceFile || 'ABC authenticated automatic feed';
            item._region = normalizeRemoteRegion(item._region || item.region) || (typeof normalizeRegionName === 'function'
                ? normalizeRegionName(item._sourceSheet, item.country) : '');
            item._authoritativeOperationsUpload = true;
            if (!item.dedupKey && typeof buildDedupKey === 'function') {
                item.dedupKey = buildDedupKey(item.serial, item.hospital, item.date, item.implanter, item.valve, item._sourceCaseId || `ABC-GLOBAL-${index + 1}`);
            }
            return item;
        }

        function applyPreparedFeed(prepared) {
            const targets = currentCollections();
            const rollback = {
                implants2025: targets.implants2025.slice(),
                implants2026: targets.implants2026.slice(),
                outcomes2026: targets.outcomes2026.slice(),
                problemCases: targets.problemCases.slice(),
                hadGlobal: typeof fileUploads !== 'undefined' && Object.prototype.hasOwnProperty.call(fileUploads, GLOBAL_UPLOAD_KEY),
                global2026: targets.global2026.slice(),
                contacts: typeof abcRemoteProfessionalContacts !== 'undefined' ? abcRemoteProfessionalContacts.slice() : [],
                patientLookup: typeof abcRemotePatientLookup !== 'undefined' ? abcRemotePatientLookup : {},
                cutoff: typeof APP_META !== 'undefined' ? APP_META.latamDataCutoff : '',
                snapshot: typeof APP_META !== 'undefined' ? APP_META.latamDataSnapshot : '',
                effectiveCutoff: typeof v12OutcomeEffectiveCutoff !== 'undefined' ? v12OutcomeEffectiveCutoff : '',
                baselineBinarySha256: typeof V12_BASELINE_BINARY_SHA256 !== 'undefined' ? V12_BASELINE_BINARY_SHA256 : '',
                baselineLogicalSha256: typeof V12_BASELINE_LOGICAL_SHA256 !== 'undefined' ? V12_BASELINE_LOGICAL_SHA256 : '',
                baselineRowFingerprints: typeof V12_BASELINE_ROW_FINGERPRINTS !== 'undefined' ? deepClone(V12_BASELINE_ROW_FINGERPRINTS) : {},
                referenceData: captureReferenceData()
            };
            const replace = (target, values) => target.splice(0, target.length, ...values);

            try {
                replace(targets.implants2025, prepared.implants2025);
                replace(targets.implants2026, prepared.implants2026);
                replace(targets.outcomes2026, prepared.outcomes2026);
                replace(targets.problemCases, prepared.problemCases);
                fileUploads[GLOBAL_UPLOAD_KEY] = prepared.global2026.map(prepareGlobalCase);
                replace(abcRemoteProfessionalContacts, prepared.professionalContacts);
                abcRemotePatientLookup = deepClone(prepared.patientLookup);
                if (typeof V12_BASELINE_BINARY_SHA256 !== 'undefined') {
                    V12_BASELINE_BINARY_SHA256 = prepared.feed.outcomeImportBaseline.binarySha256;
                    V12_BASELINE_LOGICAL_SHA256 = prepared.feed.outcomeImportBaseline.logicalSha256;
                    V12_BASELINE_ROW_FINGERPRINTS = deepClone(prepared.feed.outcomeImportBaseline.rowFingerprints);
                }
                applyReferenceData(prepared.feed.referenceData);

                const cutoff = isoCutoffFromAppMeta(prepared.feed.appMeta);
                if (cutoff) {
                    APP_META.latamDataCutoff = cutoff;
                    APP_META.latamDataSnapshot = cutoff;
                    if (typeof v12OutcomeEffectiveCutoff !== 'undefined') {
                        v12OutcomeEffectiveCutoff = [v12OutcomeEffectiveCutoff, cutoff].filter(Boolean).sort().pop();
                    }
                }
                state.activeDatasetSha256 = prepared.feed.datasetSha256;
                return true;
            } catch (error) {
                replace(targets.implants2025, rollback.implants2025);
                replace(targets.implants2026, rollback.implants2026);
                replace(targets.outcomes2026, rollback.outcomes2026);
                replace(targets.problemCases, rollback.problemCases);
                if (rollback.hadGlobal) fileUploads[GLOBAL_UPLOAD_KEY] = rollback.global2026;
                else delete fileUploads[GLOBAL_UPLOAD_KEY];
                replace(abcRemoteProfessionalContacts, rollback.contacts);
                abcRemotePatientLookup = rollback.patientLookup;
                if (typeof V12_BASELINE_BINARY_SHA256 !== 'undefined') {
                    V12_BASELINE_BINARY_SHA256 = rollback.baselineBinarySha256;
                    V12_BASELINE_LOGICAL_SHA256 = rollback.baselineLogicalSha256;
                    V12_BASELINE_ROW_FINGERPRINTS = rollback.baselineRowFingerprints;
                }
                applyReferenceData(rollback.referenceData);
                APP_META.latamDataCutoff = rollback.cutoff;
                APP_META.latamDataSnapshot = rollback.snapshot;
                if (typeof v12OutcomeEffectiveCutoff !== 'undefined') v12OutcomeEffectiveCutoff = rollback.effectiveCutoff;
                throw error;
            }
        }

        function replaceObject(target, values) {
            Object.keys(target).forEach(key => delete target[key]);
            Object.assign(target, deepClone(values));
        }

        function replaceSet(target, values) {
            target.clear();
            values.forEach(value => target.add(value));
        }

        function captureReferenceData() {
            if (typeof NATIONALITIES === 'undefined') return {};
            return {
                nationalities: deepClone(NATIONALITIES),
                officialProctors: OFFICIAL_PROCTORS.slice(),
                proctorDefaultRateUsd: PROCTOR_DEFAULT_RATE_USD,
                globalProctorDefaultRateUsd: GLOBAL_PROCTOR_DEFAULT_RATE_USD,
                globalSingleNameProctors: [...GLOBAL_SINGLE_NAME_PROCTORS],
                proctorDayRatesUsd: deepClone(PROCTOR_DAY_RATES_USD),
                proctorAliases: deepClone(PROCTOR_ALIASES),
                personAliases: deepClone(PERSON_ALIASES),
                globalSpecialistExactAliases: deepClone(GLOBAL_SPECIALIST_EXACT_ALIASES),
                congressCaseTags: deepClone(CONGRESS_CASE_TAGS),
                argentina2025AttendanceSerialExceptions: [...ARGENTINA_2025_ATTENDANCE_SERIAL_EXCEPTIONS],
                panama2025AttendanceSerials: [...PANAMA_2025_ATTENDANCE_SERIALS],
                attendanceEnrichmentPeople: deepClone(ATTENDANCE_ENRICHMENT_PEOPLE),
                legacyHomacDateBySerial: deepClone(LEGACY_HOMAC_DATE_BY_SERIAL),
                incorSpSerials: [...INCOR_SP_SERIALS],
                incorRondoniaSerials: [...INCOR_RONDONIA_SERIALS],
                clinicalMasterOverrides: deepClone(CLINICAL_MASTER_OVERRIDES),
                knownCaseIdentityCorrections: deepClone(KNOWN_CASE_IDENTITY_CORRECTIONS),
                confirmedProcedureProctorRules: deepClone(CONFIRMED_PROCEDURE_PROCTOR_RULES),
                personRoleCorrectionRules: deepClone(PERSON_ROLE_CORRECTION_RULES),
                venusCorporateStaff: deepClone(VENUS_CORPORATE_STAFF),
                hospitalAliases: deepClone(HOSPITAL_ALIASES),
                hospitalCityMap: deepClone(HOSPITAL_CITY_MAP),
                cityStateMap: deepClone(CITY_STATE_MAP),
                brTerritories: deepClone(BR_TERRITORIES),
                distributorByCountry: deepClone(DISTRIBUTOR_BY_COUNTRY),
                hospitalCountryAnchors: deepClone(HOSPITAL_COUNTRY_ANCHORS),
                sopApprovedPrices: deepClone(SOP_APPROVED_PRICES),
                sopTargets: {
                    globalUsd: sopGlobalTargetUSD,
                    regionsUsd: deepClone(sopRegionTargetsUSD)
                }
            };
        }

        function applyReferenceData(data) {
            if (!isPlainObject(data) || typeof NATIONALITIES === 'undefined') return;
            replaceObject(NATIONALITIES, data.nationalities);
            OFFICIAL_PROCTORS.splice(0, OFFICIAL_PROCTORS.length, ...data.officialProctors);
            PROCTOR_DEFAULT_RATE_USD = data.proctorDefaultRateUsd;
            GLOBAL_PROCTOR_DEFAULT_RATE_USD = data.globalProctorDefaultRateUsd;
            replaceSet(GLOBAL_SINGLE_NAME_PROCTORS, data.globalSingleNameProctors);
            replaceObject(PROCTOR_DAY_RATES_USD, data.proctorDayRatesUsd);
            replaceObject(PROCTOR_ALIASES, data.proctorAliases);
            PROCTOR_ALIASES_KEYS.splice(0, PROCTOR_ALIASES_KEYS.length, ...Object.keys(PROCTOR_ALIASES).sort((a, b) => b.length - a.length));
            replaceObject(PERSON_ALIASES, data.personAliases);
            PERSON_ALIASES_KEYS.splice(0, PERSON_ALIASES_KEYS.length, ...Object.keys(PERSON_ALIASES).sort((a, b) => b.length - a.length));
            replaceObject(GLOBAL_SPECIALIST_EXACT_ALIASES, data.globalSpecialistExactAliases);
            replaceObject(CONGRESS_CASE_TAGS, data.congressCaseTags);
            replaceSet(ARGENTINA_2025_ATTENDANCE_SERIAL_EXCEPTIONS, data.argentina2025AttendanceSerialExceptions);
            replaceSet(PANAMA_2025_ATTENDANCE_SERIALS, data.panama2025AttendanceSerials);
            replaceObject(ATTENDANCE_ENRICHMENT_PEOPLE, data.attendanceEnrichmentPeople);
            replaceObject(LEGACY_HOMAC_DATE_BY_SERIAL, data.legacyHomacDateBySerial);
            replaceSet(INCOR_SP_SERIALS, data.incorSpSerials);
            replaceSet(INCOR_RONDONIA_SERIALS, data.incorRondoniaSerials);
            replaceObject(CLINICAL_MASTER_OVERRIDES, data.clinicalMasterOverrides);
            replaceObject(KNOWN_CASE_IDENTITY_CORRECTIONS, data.knownCaseIdentityCorrections);
            CONFIRMED_PROCEDURE_PROCTOR_RULES.splice(0, CONFIRMED_PROCEDURE_PROCTOR_RULES.length, ...deepClone(data.confirmedProcedureProctorRules));
            PERSON_ROLE_CORRECTION_RULES.splice(0, PERSON_ROLE_CORRECTION_RULES.length, ...deepClone(data.personRoleCorrectionRules));
            replaceObject(VENUS_CORPORATE_STAFF, data.venusCorporateStaff);
            replaceObject(HOSPITAL_ALIASES, data.hospitalAliases);
            HOSPITAL_ALIASES_KEYS.splice(0, HOSPITAL_ALIASES_KEYS.length, ...Object.keys(HOSPITAL_ALIASES).sort((a, b) => b.length - a.length));
            replaceObject(HOSPITAL_CITY_MAP, data.hospitalCityMap);
            replaceObject(CITY_STATE_MAP, data.cityStateMap);
            replaceObject(BR_TERRITORIES, data.brTerritories);
            replaceObject(DISTRIBUTOR_BY_COUNTRY, data.distributorByCountry);
            replaceObject(HOSPITAL_COUNTRY_ANCHORS, data.hospitalCountryAnchors);
            replaceObject(SOP_APPROVED_PRICES, data.sopApprovedPrices);
            sopGlobalTargetUSD = Number(data.sopTargets.globalUsd || 0);
            replaceObject(sopRegionTargetsUSD, data.sopTargets.regionsUsd);
            CHILE_INT_HOSPITAL = data.confirmedProcedureProctorRules.find(rule => rule?.set?.proctor === 'N/A')?.match?.hospital || '';
            SAN_GERONIMO_HOSPITAL = data.confirmedProcedureProctorRules.find(rule => rule?.match?.requiredRoles?.includes('implanter'))?.match?.hospital || '';
        }

        function refreshVisibleData() {
            if (typeof rebuildAllCasesGlobal === 'function') rebuildAllCasesGlobal();
            if (typeof v12RefreshPrivateDirectories === 'function') v12RefreshPrivateDirectories();
            if (typeof extractFilters === 'function') extractFilters();
            if (typeof processData === 'function' && typeof allCasesGlobal !== 'undefined' && allCasesGlobal.length) processData();
            if (typeof renderAppMeta === 'function') renderAppMeta();
        }

        function applyFeed(feed, options = {}) {
            const prepared = prepareFeed(feed, currentCollections());
            if (state.activeDatasetSha256 === prepared.feed.datasetSha256) return false;
            applyPreparedFeed(prepared);
            if (options.cache !== false) cacheFeed(prepared.feed);
            if (state.booted) refreshVisibleData();
            return true;
        }

        async function fetchLiveFeed() {
            const headers = state.activeDatasetSha256
                ? { 'If-None-Match': `"sha256-${state.activeDatasetSha256}"` } : {};
            const payload = await request('/api/abc/intelligence', { headers, allowNotModified: true });
            if (payload.notModified) return null;
            if (payload.ok !== true) throw new ABCRequestError(text(payload.error) || 'The intelligence feed was not authorized.');
            validateFeed(payload.feed);
            applyFeed(payload.feed);
            return payload.feed;
        }

        async function hydrateFeedWithFallback() {
            try {
                return await fetchLiveFeed();
            } catch (error) {
                if (error && error.status === 401) throw error;
                const fallback = cachedFeed();
                if (!fallback) {
                    throw new ABCRequestError('The authenticated intelligence dataset is unavailable and no verified session copy exists.');
                }
                applyFeed(fallback, { cache: false });
                return fallback;
            }
        }

        function bootOnce() {
            if (state.booted) return;
            if (typeof bootApp !== 'function') throw new Error('LATAM Intelligence boot function is unavailable.');
            bootApp();
            state.booted = true;
            if (typeof v12RefreshPrivateDirectories === 'function') v12RefreshPrivateDirectories();
        }

        async function loadPrivateStateOnce() {
            if (state.privateStateLoaded || typeof v12LoadOutcomePersistentState !== 'function') return;
            await v12LoadOutcomePersistentState();
            state.privateStateLoaded = true;
        }

        function handleUnauthorized() {
            clearSessionState();
            lockGate('Your session expired. Enter the access code again.');
        }

        async function refreshFeed() {
            if (!state.token) return null;
            if (state.refreshPromise) return state.refreshPromise;
            state.refreshPromise = fetchLiveFeed().catch(error => {
                if (error && error.status === 401) handleUnauthorized();
                else console.warn('ABC automatic feed refresh failed; keeping the last verified dataset.', error);
                throw error;
            }).finally(() => { state.refreshPromise = null; });
            return state.refreshPromise;
        }

        function startRefreshSchedule() {
            if (!state.pollTimer) {
                state.pollTimer = root.setInterval(() => {
                    if (root.document.visibilityState === 'visible' && state.token) refreshFeed().catch(() => {});
                }, POLL_INTERVAL_MS);
            }
            if (!state.visibilityInstalled) {
                root.document.addEventListener('visibilitychange', () => {
                    if (root.document.visibilityState === 'visible' && state.token) refreshFeed().catch(() => {});
                });
                state.visibilityInstalled = true;
            }
        }

        async function submitAccessGate() {
            const { input } = gateElements();
            const accessCode = text(input && input.value);
            if (!accessCode) {
                setGateError('Enter the access code.');
                if (input) input.focus();
                return false;
            }
            setGateBusy(true);
            setGateError('');
            try {
                const payload = await request('/api/abc/access/login', {
                    method: 'POST', auth: false, json: { accessCode }
                });
                if (payload.ok !== true || !text(payload.token)) throw new ABCRequestError('The server did not return a valid session.');
                saveToken(payload.token);
                state.profile = isPlainObject(payload.profile) ? payload.profile : null;
                if (input) input.value = '';
                await hydrateFeedWithFallback();
                bootOnce();
                await loadPrivateStateOnce();
                unlockGate();
                startRefreshSchedule();
                return true;
            } catch (error) {
                if (error && (error.status === 401 || error.status === 403)) {
                    clearSessionState();
                    setGateError('Invalid access code. Try again.');
                    if (input) { input.value = ''; input.focus(); }
                } else {
                    clearSessionState();
                    setGateError('Access could not be verified. Check the connection and try again.');
                    console.error('ABC login failed:', error);
                }
                setGateBusy(false);
                return false;
            }
        }

        async function logoutAccessGate() {
            const token = state.token;
            try {
                if (token) await request('/api/abc/access/logout', { method: 'POST' });
            } catch (error) {
                if (!(error && error.status === 401)) console.warn('ABC server logout could not be confirmed.', error);
            } finally {
                clearSessionState();
                lockGate('Session closed.');
            }
        }

        async function initAccessGate() {
            if (state.initialized) return;
            state.initialized = true;
            // The legacy browser-only gate is deliberately ignored and removed.
            try { root.localStorage.removeItem('venus_latam_access'); } catch (error) { /* no-op */ }
            lockGate('');
            const token = tokenFromSession();
            if (!token) return;
            saveToken(token);
            setGateBusy(true);
            try {
                const session = await request('/api/abc/session');
                if (session.ok !== true) throw new ABCRequestError('The stored session is no longer valid.', 401);
                state.profile = isPlainObject(session.profile) ? session.profile : null;
                await hydrateFeedWithFallback();
                bootOnce();
                await loadPrivateStateOnce();
                unlockGate();
                startRefreshSchedule();
            } catch (error) {
                if (error && (error.status === 401 || error.status === 403)) {
                    clearSessionState();
                    lockGate('Your session expired. Enter the access code again.');
                } else {
                    lockGate('Access could not be verified. Check the connection and try again.');
                    console.error('ABC session restore failed:', error);
                }
            } finally {
                setGateBusy(false);
            }
        }

        root.submitAccessGate = submitAccessGate;
        root.initAccessGate = initAccessGate;
        root.logoutAccessGate = logoutAccessGate;
        root.refreshABCIntelligence = refreshFeed;
        root.ABCIntelligenceState = state;

        if (root.document.readyState === 'loading') {
            root.document.addEventListener('DOMContentLoaded', initAccessGate, { once: true });
        } else {
            initAccessGate();
        }
        return root.ABCIntelligenceIntegration;
    }

    return Object.freeze({
        SCHEMA_VERSION,
        PRODUCTION_API_BASE,
        LOCAL_API_BASE,
        TOKEN_STORAGE_KEY,
        FEED_STORAGE_KEY,
        GLOBAL_UPLOAD_KEY,
        POLL_INTERVAL_MS,
        ABCRequestError,
        deepClone,
        identityKeys,
        preserveNonEmptyComments,
        mergeCollectionPreservingComments,
        validateFeed,
        prepareFeed,
        resolveApiBase,
        isoCutoffFromAppMeta,
        normalizeRemoteRegion,
        install
    });
});

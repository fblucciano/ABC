#!/usr/bin/env node
/**
 * Removes auto-inserted alias blocks that broke JS syntax in index.html
 */
import fs from 'fs';
import path from 'path';

const indexPath = path.join(process.cwd(), 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// --- Fix PERSON_ALIASES: remove corrupted block after francisco garay ---
const personStart = html.indexOf('const PERSON_ALIASES = {');
const personEnd = html.indexOf('};', personStart);
const personBlock = html.slice(personStart, personEnd + 2);

const goodPersonTail = `
        "humberto juárez": "Humberto Juárez", "humberto juarez": "Humberto Juárez",
        "pedro echeverria": "Pedro Echeverria",
        "jaime dutary": "Jaime Dutary",
        "stephie, ariane": "Stephie, Sanchez Ariane",
        "ariane, alice": "Sanchez Ariane, Alice Moraes",
        "fabio silva, ariane": "Fabio Silva, Sanchez Ariane",
`;

const personMarker = '"francisco garay": "Francisco Garay", "garay": "Francisco Garay"';
const personMarkerIdx = personBlock.indexOf(personMarker);
if (personMarkerIdx < 0) {
    console.error('PERSON_ALIASES marker not found');
    process.exit(1);
}

const beforeCorrupt = personBlock.slice(0, personMarkerIdx + personMarker.length);
const fixedPersonBlock = beforeCorrupt + ',' + goodPersonTail + '\n    };';

html = html.slice(0, personStart) + fixedPersonBlock + html.slice(personEnd + 2);

// --- Fix HOSPITAL_ALIASES: remove corrupted block after instituto do coracao ---
const hospStart = html.indexOf('const HOSPITAL_ALIASES = {');
const hospEnd = html.indexOf('};', hospStart);
const hospBlock = html.slice(hospStart, hospEnd + 2);

const hospMarker = '"incor": "InCor SP", "hospital incor": "InCor SP", "instituto do coracao": "InCor SP"';
const hospMarkerIdx = hospBlock.indexOf(hospMarker);
if (hospMarkerIdx < 0) {
    console.error('HOSPITAL_ALIASES marker not found');
    process.exit(1);
}

const fixedHospBlock = hospBlock.slice(0, hospMarkerIdx + hospMarker.length) + '\n    };';

html = html.slice(0, hospStart) + fixedHospBlock + html.slice(hospEnd + 2);

fs.writeFileSync(indexPath, html, 'utf8');
console.log('Fixed PERSON_ALIASES and HOSPITAL_ALIASES in index.html');

#!/usr/bin/env node
/**
 * Inline BUILTIN_IMPLANTS_2025 and BUILTIN_IMPLANTS_2026 into index.html for GitHub Pages deploy.
 * Run after build-builtin-implants-*.mjs or when latam-builtin-implants-*.js change.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');

function readBuiltinArray(filePath, constName) {
    const src = fs.readFileSync(filePath, 'utf8');
    const marker = `const ${constName} = `;
    const start = src.indexOf(marker);
    if (start < 0) throw new Error(`Missing ${constName} in ${filePath}`);
    const arrStart = start + marker.length;
    let depth = 0;
    let inStr = false;
    let strChar = '';
    let escaped = false;
    for (let i = arrStart; i < src.length; i++) {
        const ch = src[i];
        if (inStr) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === strChar) inStr = false;
            continue;
        }
        if (ch === '"' || ch === "'") { inStr = true; strChar = ch; continue; }
        if (ch === '[') depth++;
        if (ch === ']') {
            depth--;
            if (depth === 0) {
                return src.slice(arrStart, i + 1);
            }
        }
    }
    throw new Error(`Could not parse array for ${constName}`);
}

const html = fs.readFileSync(indexPath, 'utf8');
const arr2025 = readBuiltinArray(path.join(root, 'latam-builtin-implants-2025.js'), 'BUILTIN_IMPLANTS_2025');
const arr2026 = readBuiltinArray(path.join(root, 'latam-builtin-implants-2026.js'), 'BUILTIN_IMPLANTS_2026');

const inlineBlock = `<script>
// Inlined for GitHub Pages — regenerate via scripts/inline-builtin-implants.mjs
const BUILTIN_IMPLANTS_2025 = ${arr2025};
const BUILTIN_IMPLANTS_2026 = ${arr2026};
if (typeof window !== 'undefined') {
    window.BUILTIN_IMPLANTS_2025 = BUILTIN_IMPLANTS_2025;
    window.BUILTIN_IMPLANTS_2026 = BUILTIN_IMPLANTS_2026;
}
</script>
`;

let out = html
    .replace(/\s*<script src="latam-builtin-implants-2025\.js"><\/script>\s*/g, '\n')
    .replace(/\s*<script src="latam-builtin-implants-2026\.js"><\/script>\s*/g, '\n');

if (out.includes('const BUILTIN_IMPLANTS_2025 = [')) {
    out = out.replace(
        /<script>\s*\n\/\/ Inlined for GitHub Pages[\s\S]*?window\.BUILTIN_IMPLANTS_2026 = BUILTIN_IMPLANTS_2026;\s*\}\s*\n<\/script>\s*\n/,
        inlineBlock
    );
} else {
    out = out.replace(
        /(<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/xlsx[^>]+><\/script>)/,
        `$1\n${inlineBlock}`
    );
}

fs.writeFileSync(indexPath, out, 'utf8');
const kb = (fs.statSync(indexPath).size / 1024).toFixed(0);
console.log(`Inlined implant baselines into index.html (${kb} KB)`);

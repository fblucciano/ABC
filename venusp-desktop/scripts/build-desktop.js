#!/usr/bin/env node
/**
 * Prepara o VenusP para o app Desktop (Neutralino):
 * - Extrai bibliotecas e lógica do app para arquivos .js separados (evita quebrar o HTML)
 * - Ofusca SOMENTE app.js (nunca Chart/html2canvas/jsPDF)
 * - Gera index.html enxuto que referencia os scripts externos
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const WORKSPACE = path.join(__dirname, '../..');
const SRC = path.join(WORKSPACE, 'venusp-planning-report.html');
const RES = path.join(WORKSPACE, 'VenusP-Desktop', 'resources');
const JS_DIR = path.join(RES, 'js');

const html = fs.readFileSync(SRC, 'utf8');

// Extrai blocos <script>...</script> na ordem
const scripts = [];
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = scriptRe.exec(html)) !== null) {
  scripts.push(m[1]);
}
if (scripts.length !== 4) {
  console.error('Expected 4 inline script blocks, found', scripts.length);
  process.exit(1);
}

const appIdx = scripts.findIndex(function (s) { return s.indexOf('MASTER_PASSWORD') !== -1; });
if (appIdx !== 1 && appIdx !== 2 && appIdx !== 3) {
  console.error('Could not locate app script block');
  process.exit(1);
}

const libNames = ['chart.umd.js', 'html2canvas.min.js', 'jspdf.umd.min.js'];
let libSlot = 0;
const scriptTags = [];

for (let i = 0; i < scripts.length; i++) {
  if (i === appIdx) continue;
  const name = libNames[libSlot++];
  const outPath = path.join(JS_DIR, name);
  fs.mkdirSync(JS_DIR, { recursive: true });
  fs.writeFileSync(outPath, scripts[i]);
  scriptTags.push('    <script src="js/' + name + '"></script>');
  console.log('Wrote library', name, '(' + (scripts[i].length / 1024).toFixed(0) + ' KB)');
}

// Ofusca apenas a lógica do app (arquivo externo — sem risco de </script> no HTML)
let appCode = scripts[appIdx];
try {
  appCode = JavaScriptObfuscator.obfuscate(appCode, {
    compact: true,
    controlFlowFlattening: true,
    controlFlowFlatteningThreshold: 0.3,
    deadCodeInjection: false,
    identifierNamesGenerator: 'hexadecimal',
    renameGlobals: false,
    selfDefending: false,
    stringArray: true,
    stringArrayEncoding: ['base64'],
    stringArrayThreshold: 0.4,
    transformObjectKeys: true
  }).getObfuscatedCode();
  console.log('App logic obfuscated');
} catch (e) {
  console.warn('Obfuscation failed, using plain app.js:', e.message);
}

fs.writeFileSync(path.join(JS_DIR, 'app.js'), appCode);
scriptTags.push('    <script src="js/app.js"></script>');

// Monta index.html: mesmo head/body do original, sem os <script> inline
let outHtml = html.replace(/<script>[\s\S]*?<\/script>\s*/g, '');
// Insere scripts antes de </body>
if (outHtml.indexOf('</body>') === -1) {
  console.error('</body> not found');
  process.exit(1);
}
outHtml = outHtml.replace('</body>', scriptTags.join('\n') + '\n</body>');

fs.writeFileSync(path.join(RES, 'index.html'), outHtml);
console.log('Wrote index.html (' + (outHtml.length / 1024).toFixed(0) + ' KB)');
console.log('Desktop resources ready in', RES);

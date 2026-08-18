#!/usr/bin/env node
/**
 * Gera build protegido do VenusP:
 * 1. Ofusca o JavaScript da lógica do app (não as libs já embutidas)
 * 2. Copia para VenusP-Desktop/resources/index.html
 */
const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const WORKSPACE = path.join(__dirname, '../..');
const SRC = path.join(WORKSPACE, 'venusp-planning-report.html');
const OUT = path.join(WORKSPACE, 'VenusP-Desktop', 'resources', 'index.html');

const html = fs.readFileSync(SRC, 'utf8');

// Separa os blocos <script>...</script>
const parts = html.split(/(<script>[\s\S]*?<\/script>)/g);
let obfuscatedCount = 0;

const obfOpts = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.4,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.5,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

const result = parts.map(function (part) {
  if (!part.startsWith('<script>')) return part;
  // Não ofuscar blocos enormes das bibliotecas (Chart.js, html2canvas, jsPDF)
  if (part.length > 500000) return part;
  const code = part.replace(/^<script>\n?/, '').replace(/\n?<\/script>$/, '');
  if (code.trim().length < 500) return part;
  try {
    const obf = JavaScriptObfuscator.obfuscate(code, obfOpts).getObfuscatedCode();
    obfuscatedCount++;
    return '<script>\n' + obf + '\n</script>';
  } catch (e) {
    console.warn('Obfuscation skipped for one block:', e.message);
    return part;
  }
}).join('');

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, result);
console.log('Protected build written to', OUT);
console.log('Obfuscated script blocks:', obfuscatedCount);
console.log('Size:', (fs.statSync(OUT).size / 1024 / 1024).toFixed(2), 'MB');

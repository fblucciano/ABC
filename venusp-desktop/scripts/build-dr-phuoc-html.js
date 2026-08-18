#!/usr/bin/env node
/** Builds Dr-Phuoc.html — full offline single-file app from venusp-planning-report.html */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const SRC = path.join(ROOT, 'venusp-planning-report.html');
const OUT = path.join(ROOT, 'Dr-Phuoc.html');

function inlineExternalScript(html, srcAttr, filePath) {
  const abs = path.join(ROOT, filePath);
  if (!fs.existsSync(abs)) {
    console.warn('Missing inline asset:', abs);
    return html;
  }
  const js = fs.readFileSync(abs, 'utf8');
  const tag = '<script src="' + srcAttr + '"></script>';
  if (!html.includes(tag)) {
    console.warn('Tag not found for inline:', tag);
    return html;
  }
  return html.replace(tag, '<script>\n' + js + '\n</script>');
}

let html = fs.readFileSync(SRC, 'utf8');

html = inlineExternalScript(html, 'vendor/three.min.js', 'vendor/three.min.js');
html = inlineExternalScript(html, 'venusp-valve-viewer.js', 'venusp-valve-viewer.js');

html = html
  .replace('<title>VenusMedtech - VenusP Planning Report</title>', '<title>Dr. Phuoc — VenusP Planning Report</title>')
  .replace('<h2 class="login-title">VenusP Planning Report</h2>', '<h2 class="login-title">Dr. Phuoc — VenusP Planning</h2>')
  .replace('<h1>VenusP Planning Report</h1>', '<h1>Dr. Phuoc — VenusP Planning Report</h1>')
  .replace('Case Planning Workspace', 'Dr. Phuoc — Case Planning')
  .replace(
    'This report was generated automatically by the <b>VenusP Planning Report</b> application',
    'This report was generated automatically by the <b>Dr. Phuoc — VenusP Planning</b> application'
  );

fs.writeFileSync(OUT, html);
console.log('Wrote', OUT, '(' + (fs.statSync(OUT).size / 1024 / 1024).toFixed(2) + ' MB)');

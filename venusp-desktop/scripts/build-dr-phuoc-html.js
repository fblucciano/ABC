#!/usr/bin/env node
/** Builds Dr-Phuoc.html — full offline app from venusp-planning-report.html */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../../venusp-planning-report.html');
const OUT = path.join(__dirname, '../../Dr-Phuoc.html');

let html = fs.readFileSync(SRC, 'utf8');
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

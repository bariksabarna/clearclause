import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEASE_TEXT } from '../client/src/lib/samples.js';

const require = createRequire(import.meta.url);
const PDFDocument = require('pdfkit');

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../client/public/samples');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, '12-Month-Apartment-Lease.pdf');

const doc = new PDFDocument({
  size: 'LETTER',
  margins: { top: 56, bottom: 56, left: 64, right: 64 },
});

const title = 'Residential Apartment Lease Agreement';
const titleIndex = LEASE_TEXT.split('\n').findIndex((line) => line.trim() === title);
const body = LEASE_TEXT.split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .slice(titleIndex + 1);

const PAGE_LIMIT = doc.page.height - doc.page.margins.bottom - 60;

function drawHeader() {
  doc
    .font('Courier-Bold')
    .fontSize(7.5)
    .fillColor('#565f6b')
    .text('CLEARCLAUSE SAMPLE RECORD', { align: 'right' })
    .fillColor('#19212e')
    .moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(20).text(title).moveDown(0.4);
  doc
    .font('Helvetica-Oblique')
    .fontSize(10)
    .fillColor('#45464d')
    .text(
      'This is a sample legal record provided for demonstration purposes: upload it and ClearClause will parse and annotate every clause.',
      {
        align: 'left',
      }
    )
    .moveDown(0.6);
  doc
    .strokeColor('#d8dbd8')
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke()
    .moveDown(0.9);
}

drawHeader();

doc.fillColor('#191c1b');
for (const line of body) {
  const match = line.match(/^(\d+)\.\s+(.*)$/);
  if (!match) {
    doc.font('Helvetica-Oblique').fontSize(10).fillColor('#45464d').text(line).moveDown(0.6);
    continue;
  }
  const number = match[1];
  const rest = match[2];
  const firstPeriod = rest.indexOf('.');
  const label = firstPeriod === -1 ? rest : rest.slice(0, firstPeriod + 1);
  const remainder = firstPeriod === -1 ? '' : rest.slice(firstPeriod + 1).trim();
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const height = doc.heightOfString(`${number}. ${label}${remainder ? ' ' + remainder : ''}`, {
    width,
    font: 'Helvetica',
    fontSize: 11,
  });
  if (doc.y + height > PAGE_LIMIT) doc.addPage();
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#191c1b')
    .text(`${number}. ${label} `, { continued: true });
  if (remainder) {
    doc.font('Helvetica').text(remainder);
  } else {
    doc.text('');
  }
  doc.moveDown(0.7);
}

doc.on('pageAdded', () => drawHeader());

doc.end();
doc.pipe(require('node:fs').createWriteStream(outPath));

doc.on('end', () => {
  console.log(`wrote ${outPath}`);
});

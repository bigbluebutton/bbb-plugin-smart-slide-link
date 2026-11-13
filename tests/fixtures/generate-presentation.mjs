// Generates tests/fixtures/smart-slide-links.pdf, the presentation the E2E suite uploads.
// Run with `node tests/fixtures/generate-presentation.mjs` after changing the slides below.
//
// BBB extracts each page's text with pdftotext and the plugin reads it from the page's text
// url, so the PDF only needs real (extractable) text. It is written by hand to avoid a PDF
// library dependency. JSON lines are split only outside string values, as on a real slide
// whose text wraps, and kept short enough to fit the page.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SLIDES = [
  [
    'Slide with smart links',
    'BBB{"links": [',
    '{"url": "https://example.com/smart-slide-link-docs",',
    '"label": "Open docs"},',
    '{"url": "https://example.org/smart-slide-link-site",',
    '"label": "Visit site"},',
    '{"url": "javascript:alert(1)",',
    '"label": "Unsafe link"}',
    ']}',
  ],
  [
    'Slide without smart links',
    'Nothing to open here.',
  ],
  [
    'Welcome to BBB!',
    'The marker word also appears in this prose.',
    'BBB{"links": [{"url": "https://example.net/third-slide",',
    '"label": "Third slide link"}]}',
  ],
];

const PAGE_WIDTH = 842; // A4 landscape, points
const PAGE_HEIGHT = 595;
const FONT_SIZE = 18;
const LINE_HEIGHT = 26;
const MARGIN = 40;

const escapePdfText = (text) => text.replace(/[\\()]/g, (ch) => `\\${ch}`);

function contentStream(lines) {
  const textOps = lines
    .map((line, i) => `1 0 0 1 ${MARGIN} ${PAGE_HEIGHT - MARGIN - FONT_SIZE - i * LINE_HEIGHT} Tm (${escapePdfText(line)}) Tj`)
    .join('\n');
  return `BT\n/F1 ${FONT_SIZE} Tf\n${textOps}\nET`;
}

export function buildPdf(slides) {
  const fontId = 3;
  const firstPageId = 4;
  const pageIds = slides.map((_, i) => firstPageId + i * 2);
  const objects = new Map();

  objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objects.set(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${slides.length} >>`);
  objects.set(fontId, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  slides.forEach((lines, i) => {
    const pageId = pageIds[i];
    const stream = contentStream(lines);
    objects.set(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] `
      + `/Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${pageId + 1} 0 R >>`);
    objects.set(pageId + 1, `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  const ids = [...objects.keys()].sort((a, b) => a - b);
  ids.forEach((id) => {
    offsets[id] = Buffer.byteLength(pdf, 'latin1');
    pdf += `${id} 0 obj\n${objects.get(id)}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  const size = ids.length + 1;
  pdf += `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const out = join(dirname(fileURLToPath(import.meta.url)), 'smart-slide-links.pdf');
  writeFileSync(out, buildPdf(SLIDES));
  // eslint-disable-next-line no-console
  console.log(`Wrote ${out}`);
}

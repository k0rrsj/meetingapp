import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { Readable } from 'stream';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfmakeInst = require('pdfmake/js') as {
  addFonts: (fonts: Record<string, unknown>) => void;
  setUrlAccessPolicy: (fn: () => boolean) => void;
  setLocalAccessPolicy: (fn: () => boolean) => void;
  createPdf: (def: TDocumentDefinitions) => { getStream: () => Promise<Readable & { end: () => void }> };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const virtualfs = require('pdfmake/js/virtual-fs').default as {
  writeFileSync: (name: string, data: Buffer) => void;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vfsData: Record<string, string> = require('pdfmake/build/vfs_fonts');

// Initialize once
let initialized = false;
function ensureInit() {
  if (initialized) return;
  initialized = true;
  Object.entries(vfsData).forEach(([k, v]) => {
    virtualfs.writeFileSync(k, Buffer.from(v, 'base64'));
  });
  pdfmakeInst.addFonts({
    Roboto: {
      normal: 'Roboto-Regular.ttf',
      bold: 'Roboto-Medium.ttf',
      italics: 'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    },
  });
  pdfmakeInst.setUrlAccessPolicy(() => false);
  pdfmakeInst.setLocalAccessPolicy(() => false);
}

// ── Inline markdown parser ──────────────────────────────────────────────────

type InlinePart = { text: string; bold?: boolean; italics?: boolean };

function parseInline(text: string): Content {
  const parts: InlinePart[] = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push({ text: text.slice(lastIndex, match.index) });
    if (match[1] !== undefined) parts.push({ text: match[1], bold: true });
    else if (match[2] !== undefined) parts.push({ text: match[2], italics: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex) });

  if (parts.length === 0) return { text };
  if (parts.length === 1 && !parts[0].bold && !parts[0].italics) return { text: parts[0].text };
  return { text: parts };
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.trim().endsWith('|');
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function parseTable(lines: string[]): Content {
  const dataLines = lines.filter((l) => !isSeparatorRow(l));
  const body = dataLines.map((line, rowIdx) => {
    const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    return cells.map((cell) => ({
      text: cell,
      bold: rowIdx === 0,
      fontSize: 9,
      fillColor: rowIdx === 0 ? '#e8e8e8' : undefined,
      margin: [4, 3, 4, 3] as [number, number, number, number],
    }));
  });
  const numCols = body[0]?.length ?? 1;
  return {
    table: { headerRows: 1, widths: Array<string>(numCols).fill('*'), body },
    margin: [0, 6, 0, 10] as [number, number, number, number],
  };
}

function markdownToContent(text: string): Content[] {
  const lines = text.split('\n');
  const content: Content[] = [];
  let i = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (!trimmed) { i++; continue; }

    if (isTableRow(trimmed)) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) tableLines.push(lines[i++]);
      content.push(parseTable(tableLines));
      continue;
    }

    if (trimmed.startsWith('# ')) {
      content.push({ text: trimmed.slice(2), fontSize: 16, bold: true, margin: [0, 10, 0, 4] as [number, number, number, number] });
      i++; continue;
    }
    if (trimmed.startsWith('## ')) {
      content.push({ text: trimmed.slice(3), fontSize: 13, bold: true, margin: [0, 8, 0, 3] as [number, number, number, number] });
      i++; continue;
    }
    if (trimmed.startsWith('### ')) {
      content.push({ text: trimmed.slice(4), fontSize: 11, bold: true, margin: [0, 6, 0, 2] as [number, number, number, number] });
      i++; continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items: Content[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim()))
        items.push(parseInline(lines[i++].trim().replace(/^[-*•]\s+/, '')));
      content.push({ ul: items, margin: [0, 2, 0, 4] as [number, number, number, number] });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: Content[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim()))
        items.push(parseInline(lines[i++].trim().replace(/^\d+\.\s+/, '')));
      content.push({ ol: items, margin: [0, 2, 0, 4] as [number, number, number, number] });
      continue;
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }], margin: [0, 6, 0, 6] as [number, number, number, number] });
      i++; continue;
    }

    content.push({ ...(parseInline(trimmed) as object), margin: [0, 0, 0, 4] } as Content);
    i++;
  }

  return content;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function generateScenarioPdf(title: string, scenarioMarkdown: string): Promise<Buffer> {
  ensureInit();

  const docDefinition: TDocumentDefinitions = {
    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.35 },
    pageMargins: [45, 45, 45, 45],
    content: [
      { text: title, fontSize: 17, bold: true, margin: [0, 0, 0, 14] as [number, number, number, number] },
      ...markdownToContent(scenarioMarkdown),
    ],
  };

  return new Promise((resolve, reject) => {
    pdfmakeInst
      .createPdf(docDefinition)
      .getStream()
      .then((stream) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
        stream.end();
      })
      .catch(reject);
  });
}

import type { Company } from '@/lib/api/types';

type PdfDocumentItem = {
  name: string;
  category: string;
  status: string;
  expiryDate: string | null;
  lastUpdated: string;
};

type PdfAuditItem = {
  actor: string;
  action: string;
  timestamp: string;
};

export type ComplianceBundlePdfInput = {
  company: Company;
  score: {
    score: number;
    band: string;
    completedDocuments: number;
    totalDocuments: number;
    missingDocuments: string[];
    lastCalculated: string;
  };
  readinessScore: {
    dimensions: Record<string, number>;
    missingForBidReady: string[];
  };
  documents: PdfDocumentItem[];
  auditLog: PdfAuditItem[];
  generatedAt: string;
};

function normalizeText(value: string): string {
  return value
    .replace(/[–—]/g, '-')
    .replace(/[™]/g, '(TM)')
    .replace(/[•]/g, '-')
    .replace(/[^\x20-\x7E]/g, '');
}

function escapePdfText(value: string): string {
  return normalizeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
}

function wrapLine(line: string, maxLength = 92): string[] {
  const words = normalizeText(line).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function buildLines(input: ComplianceBundlePdfInput): string[] {
  const lines: string[] = [
    'Tender Guard Pro Compliance Bundle',
    'Verified by Tender Guard Pro(TM)',
    `Generated: ${formatDate(input.generatedAt)}`,
    'Audit Log Available',
    '',
    'Company',
    `Name: ${input.company.name}`,
    `Registration: ${input.company.registrationNumber || 'N/A'}`,
    `VAT: ${input.company.vatNumber || 'N/A'}`,
    `Industry: ${input.company.industry || 'N/A'}`,
    `Province: ${input.company.province || 'N/A'}`,
    `Contact: ${input.company.email || 'N/A'} ${input.company.phone || ''}`.trim(),
    '',
    'Tender Readiness',
    `Score: ${input.score.score}/100 (${input.score.band})`,
    `Verified documents: ${input.score.completedDocuments}/${input.score.totalDocuments}`,
    `Last calculated: ${formatDate(input.score.lastCalculated)}`,
    '',
    'Score Breakdown',
  ];

  for (const [key, value] of Object.entries(input.readinessScore.dimensions)) {
    lines.push(`${key}: ${value}`);
  }

  lines.push('', 'Missing / Required Actions');
  if (input.readinessScore.missingForBidReady.length === 0) {
    lines.push('None - company is bid-ready against current checks.');
  } else {
    for (const item of input.readinessScore.missingForBidReady) {
      lines.push(`- ${item}`);
    }
  }

  lines.push('', 'Documents');
  if (input.documents.length === 0) {
    lines.push('No documents uploaded.');
  } else {
    for (const doc of input.documents) {
      lines.push(`- ${doc.name} | ${doc.category} | ${doc.status} | expires ${formatDate(doc.expiryDate)} | updated ${formatDate(doc.lastUpdated)}`);
    }
  }

  lines.push('', 'Recent Audit Trail');
  if (input.auditLog.length === 0) {
    lines.push('No audit events available.');
  } else {
    for (const event of input.auditLog.slice(0, 30)) {
      lines.push(`- ${formatDate(event.timestamp)} | ${event.actor} | ${event.action}`);
    }
  }

  return lines.flatMap((line) => wrapLine(line));
}

function pageContent(lines: string[], pageNumber: number, totalPages: number): string {
  const commands: string[] = [
    'BT',
    '/F1 10 Tf',
    '50 790 Td',
    '14 TL',
  ];

  lines.forEach((line, index) => {
    if (index > 0) commands.push('T*');
    commands.push(`(${escapePdfText(line)}) Tj`);
  });

  commands.push(
    'ET',
    'BT',
    '/F1 8 Tf',
    '50 32 Td',
    `(Verified by Tender Guard Pro\\(TM\\) - Page ${pageNumber} of ${totalPages}) Tj`,
    'ET',
  );

  return commands.join('\n');
}

export function generateComplianceBundlePdf(input: ComplianceBundlePdfInput): Buffer {
  const allLines = buildLines(input);
  const linesPerPage = 50;
  const pageLines: string[][] = [];
  for (let i = 0; i < allLines.length; i += linesPerPage) {
    pageLines.push(allLines.slice(i, i + linesPerPage));
  }

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const pageObjectNumbers = pageLines.map((_, index) => 3 + index * 2);
  objects.push(`<< /Type /Pages /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(' ')}] /Count ${pageLines.length} >>`);

  pageLines.forEach((lines, index) => {
    const pageObjectNumber = 3 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;
    const content = pageContent(lines, index + 1, pageLines.length);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentObjectNumber} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
  });

  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets: number[] = [0];
  let offset = Buffer.byteLength(chunks[0], 'latin1');

  objects.forEach((object, index) => {
    offsets.push(offset);
    const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`;
    chunks.push(chunk);
    offset += Buffer.byteLength(chunk, 'latin1');
  });

  const xrefOffset = offset;
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((item) => `${item.toString().padStart(10, '0')} 00000 n `),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref\n${xrefOffset}`,
    '%%EOF',
  ].join('\n');

  chunks.push(xref);
  return Buffer.from(chunks.join(''), 'latin1');
}

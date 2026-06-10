import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import type { ComplianceBundlePdfInput } from './complianceBundlePdf';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-ZA', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildComplianceBundleHtml(input: ComplianceBundlePdfInput): string {
  const scoreTone = input.score.score >= 85 ? '#059669' : input.score.score >= 65 ? '#d97706' : '#dc2626';
  const rows = input.documents.map((doc, index) => `
    <tr class="${index % 2 === 0 ? 'even' : 'odd'}">
      <td><strong>${escapeHtml(doc.name)}</strong><br><span>${escapeHtml(doc.category)}</span></td>
      <td>${escapeHtml(doc.category)}</td>
      <td>${escapeHtml(formatDate(doc.expiryDate))}</td>
      <td><span class="badge ${escapeHtml(doc.status)}">${escapeHtml(doc.status)}</span></td>
      <td>${doc.status === 'verified' ? '✓' : '-'}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 18mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; font-size: 12px; }
    h1 { margin: 0; font-size: 24px; }
    h2 { margin: 22px 0 10px; font-size: 15px; color: #0b1120; }
    .header { display: flex; justify-content: space-between; gap: 20px; border: 1px solid #cbd5e1; border-radius: 12px; padding: 18px; }
    .badge { display: inline-block; border-radius: 999px; padding: 3px 8px; border: 1px solid #cbd5e1; font-size: 10px; text-transform: uppercase; }
    .verified, .success { color: #047857; background: #ecfdf5; border-color: #a7f3d0; }
    .uploaded, .warning { color: #b45309; background: #fffbeb; border-color: #fde68a; }
    .rejected, .expired, .danger { color: #b91c1c; background: #fef2f2; border-color: #fecaca; }
    .score { min-width: 150px; border: 1px solid ${scoreTone}; color: ${scoreTone}; border-radius: 12px; padding: 14px; text-align: center; }
    .score .num { font-size: 42px; font-weight: 800; line-height: 1; }
    .meta { margin-top: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; }
    .meta span { color: #64748b; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #0b1120; color: white; text-align: left; padding: 9px; font-size: 11px; }
    td { padding: 9px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    tr.odd td { background: #f8fafc; }
    td span { color: #64748b; font-size: 10px; }
    .seal { margin-top: 24px; border: 2px solid #0ea5e9; border-left-color: #14b8a6; border-radius: 14px; padding: 16px; }
    .seal strong { font-size: 15px; }
    .footer { margin-top: 18px; color: #64748b; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(input.company.name)}</h1>
      <p><span class="badge verified">Verified Entity</span></p>
      <div class="meta">
        <div><span>Reg No:</span> ${escapeHtml(input.company.registrationNumber || 'N/A')}</div>
        <div><span>CSD No:</span> ${escapeHtml(input.company.csdNumber || 'N/A')}</div>
        <div><span>Province:</span> ${escapeHtml(input.company.province || 'N/A')}</div>
        <div><span>Industry:</span> ${escapeHtml(input.company.industry || 'N/A')}</div>
      </div>
    </div>
    <div class="score">
      <div>Tender Readiness Score™</div>
      <div class="num">${escapeHtml(input.score.score)}</div>
      <div>${escapeHtml(input.score.band)}</div>
      <small>Last verified: ${escapeHtml(formatDate(input.generatedAt))}</small>
    </div>
  </div>

  <h2>Document Status</h2>
  <table>
    <thead>
      <tr><th>Document</th><th>Authority</th><th>Expiry</th><th>Status</th><th>Verified</th></tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="5">No compliance documents available.</td></tr>'}</tbody>
  </table>

  <div class="seal">
    <strong>🛡 Verified by TenderGuard™</strong>
    <p>Report generated: ${escapeHtml(formatDate(input.generatedAt))}</p>
    <span class="badge verified">Audit Log Available</span>
  </div>

  <div class="footer">This compliance bundle was generated for evaluator verification and includes company details, document statuses, score, verification timestamp, and TenderGuard™ seal.</div>
</body>
</html>`;
}

function runPythonWeasyprint(htmlPath: string, pdfPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('python', [
      '-c',
      'import sys; from weasyprint import HTML; HTML(filename=sys.argv[1]).write_pdf(sys.argv[2])',
      htmlPath,
      pdfPath,
    ], { windowsHide: true });

    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += String(chunk); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `WeasyPrint exited with code ${code}`));
    });
  });
}

export async function tryGenerateComplianceBundleWithWeasyPrint(input: ComplianceBundlePdfInput): Promise<Buffer | null> {
  const dir = await mkdtemp(path.join(tmpdir(), 'tenderguard-weasy-'));
  const htmlPath = path.join(dir, 'bundle.html');
  const pdfPath = path.join(dir, 'bundle.pdf');

  try {
    await writeFile(htmlPath, buildComplianceBundleHtml(input), 'utf8');
    await runPythonWeasyprint(htmlPath, pdfPath);
    return await readFile(pdfPath);
  } catch (error) {
    console.warn('[PDF] WeasyPrint unavailable; using built-in PDF fallback:', error instanceof Error ? error.message : error);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

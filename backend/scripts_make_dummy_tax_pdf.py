from datetime import datetime, timedelta
from pathlib import Path

out = Path(r"C:\Users\ngwen\Documents\Projects\Tender System\backend\storage\dummy_tax_document_expiry_5_days.pdf")
out.parent.mkdir(parents=True, exist_ok=True)

issue = datetime.now().date()
expiry = issue + timedelta(days=5)

lines = [
    "DUMMY TAX CLEARANCE CERTIFICATE",
    "Certificate No: DMY-TAX-2026-0001",
    "Taxpayer Name: Example Trading (Pty) Ltd",
    "Tax Ref No: 9999/123/45/6",
    "VAT No: 4123456789",
    f"Issue Date: {issue.isoformat()}",
    f"Expiry Date: {expiry.isoformat()}",
    "Status: COMPLIANT (DUMMY TEST DATA)",
    "Issued By: SARS (Dummy)",
    "Note: Generated dummy document for system testing only.",
]

escaped = [l.replace("(", "\\(").replace(")", "\\)") for l in lines]
stream = "BT /F1 12 Tf 50 760 Td 14 TL " + " Tj T* ".join(f"({line})" for line in escaped) + " Tj ET"

objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    f"5 0 obj << /Length {len(stream.encode('latin-1'))} >> stream\n{stream}\nendstream endobj",
]

pdf = "%PDF-1.4\n"
offsets = []
for obj in objects:
    offsets.append(len(pdf.encode("latin-1")))
    pdf += obj + "\n"

xref_pos = len(pdf.encode("latin-1"))
pdf += "xref\n0 6\n0000000000 65535 f \n"
for off in offsets:
    pdf += f"{off:010d} 00000 n \n"

pdf += f"trailer << /Size 6 /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n"
out.write_bytes(pdf.encode("latin-1"))

print(f"CREATED {out}")
print(f"ISSUE_DATE={issue.isoformat()}")
print(f"EXPIRY_DATE={expiry.isoformat()}")

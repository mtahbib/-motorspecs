/**
 * Generates a small, valid one-page PDF used for seeded demo documents
 * (no real invoices, bank details or certificates are ever included).
 */
export function placeholderPdf(title: string, lines: string[]): Uint8Array {
  const esc = (s: string) => s.replace(/[^\x20-\x7e]/g, "?").replace(/([()\\])/g, "\\$1");
  const ops: string[] = [];
  ops.push("0.0 0.247 0.992 rg 0 792 612 -64 re f");
  ops.push("BT /F2 22 Tf 1 1 1 rg 48 752 Td (MotorSpecs) Tj ET");
  ops.push(`BT /F2 18 Tf 0.08 0.1 0.13 rg 48 680 Td (${esc(title)}) Tj ET`);
  let y = 648;
  for (const line of lines) {
    ops.push(`BT /F1 11 Tf 0.2 0.22 0.26 rg 48 ${y} Td (${esc(line)}) Tj ET`);
    y -= 18;
  }
  ops.push("q 0.9 0.12 0.12 rg BT /F2 40 Tf 0.866 0.5 -0.5 0.866 150 250 Tm (DEMO - NOT A REAL DOCUMENT) Tj ET Q");
  const stream = ops.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(pdf, "latin1"));
}

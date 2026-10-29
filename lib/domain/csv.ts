/**
 * Export CSV lisible par Excel en français : séparateur « ; », guillemets si besoin,
 * BOM UTF-8 (accents), fins de ligne CRLF.
 */
export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const cell = (v: string | number | boolean | null | undefined) => {
    const s = v === null || v === undefined ? "" : typeof v === "boolean" ? (v ? "oui" : "non") : String(v);
    // Protection contre l'injection de formules à l'ouverture dans un tableur.
    const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s) ? `'${s}` : s;
    return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}

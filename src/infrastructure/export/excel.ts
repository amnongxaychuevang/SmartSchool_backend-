import * as XLSX from 'xlsx';

export type ExportLang = 'lo' | 'en';

export interface ExportColumn<T> {
  header: { lo: string; en: string };
  value: (row: T) => string | number | null | undefined;
  /** Column width in characters. */
  width?: number;
}

/** Builds an .xlsx workbook: a header row, one row per record, an auto-filter on the header. */
export function buildWorkbook<T>(sheetName: string, columns: ExportColumn<T>[], rows: T[], lang: ExportLang): Buffer {
  const data = [
    columns.map((c) => c.header[lang]),
    ...rows.map((r) => columns.map((c) => c.value(r) ?? '')),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = columns.map((c) => ({ wch: c.width ?? 18 }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: columns.length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Sends a workbook as a download; the file name gets today's date. */
export function sendWorkbook(res: any, baseName: string, buffer: Buffer) {
  const date = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // school calendar date
  const fileName = `${baseName}-${date}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  res.send(buffer);
}

/** The language for column headers and labels: ?lang=, else the user's preference, else Lao. */
export const exportLang = (req: any): ExportLang =>
  req.query.lang === 'en' || req.query.lang === 'lo' ? req.query.lang : req.user?.langPref === 'en' ? 'en' : 'lo';

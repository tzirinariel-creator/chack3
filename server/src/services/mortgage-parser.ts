/**
 * Israeli Bank Mortgage Balance Report Parser
 *
 * Parses "דוח יתרות משכנתא" Excel files from Israeli banks.
 * These reports show the current snapshot of mortgage tracks with:
 * - Track name / type
 * - Linkage type (CPI-linked, unlinked, etc.)
 * - Interest rate
 * - Remaining balance
 * - Monthly payment
 * - End date
 */
import * as XLSX from 'xlsx';

export interface ParsedMortgageTrack {
  trackName: string;
  linkageType: 'cpi' | 'prime' | 'fixed' | 'variable' | 'unknown';
  interestRate: number;
  remainingBalance: number;
  monthlyPayment: number;
  originalAmount: number | null;
  endDate: string | null;
  isCpiLinked: boolean;
}

export interface ParsedBankReport {
  bankName: string | null;
  reportDate: string | null;
  tracks: ParsedMortgageTrack[];
  totalBalance: number;
  totalMonthlyPayment: number;
  rawHeaders: string[];
  warnings: string[];
}

// Hebrew keywords for fuzzy column matching
const COLUMN_PATTERNS: Record<string, RegExp[]> = {
  trackName: [/מסלול/, /שם.*מסלול/, /תיאור.*מסלול/, /סוג.*הלוואה/],
  linkageType: [/הצמדה/, /סוג.*הצמדה/, /בסיס/, /מדד/, /צמוד/],
  interestRate: [/ריבית/, /שיעור.*ריבית/, /ריבית.*שנתית/, /אחוז.*ריבית/],
  remainingBalance: [/יתרה/, /יתרה.*לסילוק/, /יתרת.*קרן/, /סכום.*יתרה/, /יתרה.*נוכחית/],
  monthlyPayment: [/תשלום.*חודש/, /החזר.*חודש/, /תשלום/, /סכום.*החזר/],
  originalAmount: [/סכום.*מקורי/, /סכום.*הלוואה/, /קרן.*מקורית/, /סכום.*ראשוני/],
  endDate: [/תאריך.*סיום/, /מועד.*סיום/, /תאריך.*פירעון/, /סיום/],
};

// Hebrew keywords for bank name detection
const BANK_PATTERNS: Record<string, RegExp> = {
  'בנק הפועלים': /הפועלים|פועלים/,
  'בנק לאומי': /לאומי/,
  'בנק דיסקונט': /דיסקונט/,
  'בנק מזרחי טפחות': /מזרחי|טפחות/,
  'בנק הבינלאומי': /בינלאומי|הבינלאומי/,
  'בנק ירושלים': /ירושלים/,
};

// Linkage type detection
const LINKAGE_PATTERNS: Record<string, RegExp> = {
  cpi: /מדד|צמוד|הצמדה|מת"מ/,
  prime: /פריים|prime/i,
  fixed: /קבוע|קבועה/,
  variable: /משתנ/,
};

export function parseBankReport(filePath: string): ParsedBankReport {
  const result: ParsedBankReport = {
    bankName: null,
    reportDate: null,
    tracks: [],
    totalBalance: 0,
    totalMonthlyPayment: 0,
    rawHeaders: [],
    warnings: [],
  };

  const workbook = XLSX.readFile(filePath);

  // Try all sheets, pick the one with track data
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

    if (rawData.length < 2) continue;

    // Scan top rows for bank name and report date
    for (let r = 0; r < Math.min(rawData.length, 8); r++) {
      const rowText = (rawData[r] || []).map(c => String(c || '')).join(' ');
      if (!result.bankName) {
        for (const [name, pattern] of Object.entries(BANK_PATTERNS)) {
          if (pattern.test(rowText)) {
            result.bankName = name;
            break;
          }
        }
      }
      // Look for date in top rows
      if (!result.reportDate) {
        const dateMatch = rowText.match(/(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
        if (dateMatch) {
          result.reportDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
        }
      }
    }

    // Find the header row using fuzzy matching
    const headerInfo = findHeaderRow(rawData);
    if (!headerInfo) continue;

    const { headerRow, columnMap } = headerInfo;
    result.rawHeaders = (rawData[headerRow] || []).map(h => String(h || ''));

    // We need at least a balance column to be useful
    if (columnMap.remainingBalance === undefined) {
      result.warnings.push('לא נמצאה עמודת "יתרה לסילוק"');
      continue;
    }

    // Parse data rows
    for (let i = headerRow + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      // Skip rows that look like totals or empty
      const rowText = row.map((c: any) => String(c || '')).join('');
      if (rowText.includes('סה"כ') || rowText.includes('סהכ') || rowText.trim().length === 0) continue;

      const balance = parseNumber(row[columnMap.remainingBalance!]);
      if (balance <= 0) continue; // skip zero/negative balance rows

      const trackName = columnMap.trackName !== undefined ? String(row[columnMap.trackName] || `מסלול ${result.tracks.length + 1}`) : `מסלול ${result.tracks.length + 1}`;
      const interestRate = columnMap.interestRate !== undefined ? parseNumber(row[columnMap.interestRate]) : 0;
      const monthlyPayment = columnMap.monthlyPayment !== undefined ? parseNumber(row[columnMap.monthlyPayment]) : 0;
      const originalAmount = columnMap.originalAmount !== undefined ? parseNumber(row[columnMap.originalAmount]) : null;
      const endDateRaw = columnMap.endDate !== undefined ? row[columnMap.endDate] : null;

      // Detect linkage type
      let linkageType: ParsedMortgageTrack['linkageType'] = 'unknown';
      let isCpiLinked = false;

      if (columnMap.linkageType !== undefined) {
        const linkageText = String(row[columnMap.linkageType] || '').toLowerCase();
        for (const [type, pattern] of Object.entries(LINKAGE_PATTERNS)) {
          if (pattern.test(linkageText)) {
            linkageType = type as ParsedMortgageTrack['linkageType'];
            break;
          }
        }
      }

      // Also check track name for clues
      const combinedText = `${trackName} ${columnMap.linkageType !== undefined ? String(row[columnMap.linkageType] || '') : ''}`;
      if (/מדד|צמוד/.test(combinedText)) isCpiLinked = true;
      if (/פריים|prime/i.test(combinedText)) linkageType = 'prime';

      if (linkageType === 'cpi' || isCpiLinked) {
        linkageType = isCpiLinked ? 'cpi' : linkageType;
        isCpiLinked = true;
      }

      const endDate = endDateRaw ? parseDateValue(endDateRaw) : null;

      result.tracks.push({
        trackName: trackName.trim(),
        linkageType,
        interestRate,
        remainingBalance: balance,
        monthlyPayment,
        originalAmount: originalAmount && originalAmount > 0 ? originalAmount : null,
        endDate,
        isCpiLinked,
      });
    }

    if (result.tracks.length > 0) break; // found data, stop looking at other sheets
  }

  if (result.tracks.length === 0) {
    result.warnings.push('לא נמצאו מסלולי משכנתא בקובץ');
  }

  result.totalBalance = result.tracks.reduce((s, t) => s + t.remainingBalance, 0);
  result.totalMonthlyPayment = result.tracks.reduce((s, t) => s + t.monthlyPayment, 0);

  return result;
}

function findHeaderRow(data: any[][]): { headerRow: number; columnMap: Record<string, number | undefined> } | null {
  const columnMap: Record<string, number | undefined> = {};

  for (let r = 0; r < Math.min(data.length, 15); r++) {
    const row = data[r];
    if (!row || row.length < 2) continue;

    const headers = row.map((h: any) => String(h || '').trim());
    let matchCount = 0;

    for (let col = 0; col < headers.length; col++) {
      const header = headers[col];
      if (!header) continue;

      for (const [field, patterns] of Object.entries(COLUMN_PATTERNS)) {
        if (columnMap[field] !== undefined) continue;
        for (const pattern of patterns) {
          if (pattern.test(header)) {
            columnMap[field] = col;
            matchCount++;
            break;
          }
        }
      }
    }

    // If we matched at least 2 columns, this is likely the header row
    if (matchCount >= 2) {
      return { headerRow: r, columnMap };
    }

    // Reset for next row attempt
    for (const key of Object.keys(columnMap)) {
      columnMap[key] = undefined;
    }
  }

  return null;
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  if (!val) return 0;
  const str = String(val).replace(/[₪,\s%]/g, '').replace(/[()]/g, '-');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function parseDateValue(val: any): string | null {
  if (!val) return null;

  // Excel serial date
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }

  const str = String(val).trim();
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;

  const ymd = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;

  return null;
}

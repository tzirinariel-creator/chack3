import { Router } from 'express';
import multer from 'multer';
import * as XLSX from 'xlsx';
import db from '../database';
import path from 'path';
import fs from 'fs';

const router = Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('רק קבצי Excel או CSV'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Parse mortgage report from bank Excel/CSV
router.post('/mortgage-report/:mortgageId', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'לא הועלה קובץ' });
    }

    const mortgageId = Number(req.params.mortgageId);
    const mortgage = db.prepare('SELECT * FROM mortgages WHERE id = ?').get(mortgageId) as any;
    if (!mortgage) {
      return res.status(404).json({ error: 'משכנתא לא נמצאה' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

    // Auto-detect columns
    const { headerRow, columnMap } = detectColumns(rawData);
    if (!columnMap.date || !columnMap.total) {
      return res.status(400).json({
        error: 'לא הצלחתי לזהות את העמודות בקובץ',
        hint: 'צריך עמודות עם תאריך וסכום תשלום לפחות',
        detectedHeaders: rawData.length > 0 ? rawData[headerRow] : [],
        columnMap,
      });
    }

    const payments: any[] = [];
    const insertPayment = db.prepare(`
      INSERT INTO mortgage_payments (mortgage_id, date, total_amount, principal, interest, cpi_addition, remaining_balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((rows: any[]) => {
      for (const row of rows) {
        insertPayment.run(
          mortgageId,
          row.date,
          row.total_amount,
          row.principal,
          row.interest,
          row.cpi_addition,
          row.remaining_balance,
          'יובא מקובץ'
        );
      }
    });

    // Parse data rows (skip header)
    for (let i = headerRow + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const dateVal = parseDate(row[columnMap.date!]);
      if (!dateVal) continue;

      const total = parseNumber(row[columnMap.total!]);
      if (!total || total <= 0) continue;

      const principal = columnMap.principal !== undefined ? parseNumber(row[columnMap.principal]) : 0;
      const interest = columnMap.interest !== undefined ? parseNumber(row[columnMap.interest]) : 0;
      const cpi = columnMap.cpi !== undefined ? parseNumber(row[columnMap.cpi]) : 0;
      const balance = columnMap.balance !== undefined ? parseNumber(row[columnMap.balance]) : null;

      // If we have total but not principal/interest, estimate
      let finalPrincipal = principal;
      let finalInterest = interest;
      if (total > 0 && principal === 0 && interest === 0) {
        // Rough estimate: 60% principal, 40% interest (will be overridden if user has better data)
        finalInterest = Math.round(total * 0.4);
        finalPrincipal = total - finalInterest - cpi;
      }

      payments.push({
        date: dateVal,
        total_amount: total,
        principal: finalPrincipal,
        interest: finalInterest,
        cpi_addition: cpi,
        remaining_balance: balance,
      });
    }

    if (payments.length === 0) {
      return res.status(400).json({
        error: 'לא נמצאו תשלומים בקובץ',
        hint: 'ודא שהקובץ מכיל עמודות עם תאריך, סכום תשלום',
      });
    }

    insertMany(payments);

    // Clean up file
    fs.unlinkSync(req.file.path);

    res.json({
      message: `יובאו ${payments.length} תשלומים בהצלחה`,
      count: payments.length,
      firstDate: payments[0].date,
      lastDate: payments[payments.length - 1].date,
      totalImported: payments.reduce((s, p) => s + p.total_amount, 0),
    });
  } catch (err: any) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message || 'שגיאה בעיבוד הקובץ' });
  }
});

// Upload expenses from Excel/CSV
router.post('/expenses/:propertyId', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'לא הועלה קובץ' });

    const propertyId = Number(req.params.propertyId);
    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(propertyId) as any;
    if (!property) return res.status(404).json({ error: 'נכס לא נמצא' });

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

    const { headerRow, columnMap: cm } = detectExpenseColumns(rawData);

    const insertExpense = db.prepare(`
      INSERT INTO expenses (property_id, date, amount, category, description, is_recurring, notes)
      VALUES (?, ?, ?, ?, ?, 0, 'יובא מקובץ')
    `);

    let count = 0;
    const insertMany = db.transaction(() => {
      for (let i = headerRow + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const dateVal = cm.date !== undefined ? parseDate(row[cm.date]) : null;
        const amount = cm.amount !== undefined ? parseNumber(row[cm.amount]) : 0;
        if (!dateVal || !amount || amount <= 0) continue;

        const desc = cm.description !== undefined ? String(row[cm.description] || '') : '';
        const category = guessExpenseCategory(desc);

        insertExpense.run(propertyId, dateVal, amount, category, desc);
        count++;
      }
    });

    insertMany();
    fs.unlinkSync(req.file.path);

    res.json({ message: `יובאו ${count} הוצאות בהצלחה`, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'שגיאה בעיבוד הקובץ' });
  }
});

// Upload rental payments from Excel/CSV
router.post('/rental-payments/:propertyId', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'לא הועלה קובץ' });

    const propertyId = Number(req.params.propertyId);
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

    // Get the latest tenant for this property
    const tenant = db.prepare('SELECT * FROM tenants WHERE property_id = ? ORDER BY start_date DESC LIMIT 1').get(propertyId) as any;
    if (!tenant) return res.status(400).json({ error: 'הוסף שוכר קודם' });

    const { headerRow, columnMap: cm } = detectExpenseColumns(rawData); // same format

    const insertPayment = db.prepare(`
      INSERT INTO rental_payments (tenant_id, property_id, date, amount, payment_type, notes)
      VALUES (?, ?, ?, ?, 'rent', 'יובא מקובץ')
    `);

    let count = 0;
    const insertMany = db.transaction(() => {
      for (let i = headerRow + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;

        const dateVal = cm.date !== undefined ? parseDate(row[cm.date]) : null;
        const amount = cm.amount !== undefined ? parseNumber(row[cm.amount]) : 0;
        if (!dateVal || !amount || amount <= 0) continue;

        insertPayment.run(tenant.id, propertyId, dateVal, amount);
        count++;
      }
    });

    insertMany();
    fs.unlinkSync(req.file.path);

    res.json({ message: `יובאו ${count} תשלומי שכירות בהצלחה`, count });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'שגיאה בעיבוד הקובץ' });
  }
});

// Preview uploaded file (don't import yet, just show what was detected)
router.post('/preview', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'לא הועלה קובץ' });

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

    const { headerRow, columnMap } = detectColumns(rawData);

    // Get first 5 data rows as preview
    const previewRows = [];
    for (let i = headerRow + 1; i < Math.min(rawData.length, headerRow + 6); i++) {
      if (rawData[i] && rawData[i].length > 0) previewRows.push(rawData[i]);
    }

    fs.unlinkSync(req.file.path);

    res.json({
      sheetName,
      totalRows: rawData.length - headerRow - 1,
      headers: rawData[headerRow] || [],
      headerRow,
      columnMap,
      preview: previewRows,
      sheets: workbook.SheetNames,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'שגיאה בקריאת הקובץ' });
  }
});

// === Helper Functions ===

interface ColumnMap {
  date?: number;
  total?: number;
  principal?: number;
  interest?: number;
  cpi?: number;
  balance?: number;
}

function detectColumns(data: any[][]): { headerRow: number; columnMap: ColumnMap } {
  const columnMap: ColumnMap = {};

  // Find header row (look in first 10 rows)
  let headerRow = 0;
  for (let r = 0; r < Math.min(data.length, 10); r++) {
    const row = data[r];
    if (!row) continue;
    const rowStr = row.map((c: any) => String(c || '').toLowerCase()).join(' ');
    if (
      rowStr.includes('תאריך') || rowStr.includes('date') ||
      rowStr.includes('סכום') || rowStr.includes('תשלום') ||
      rowStr.includes('קרן') || rowStr.includes('ריבית')
    ) {
      headerRow = r;
      break;
    }
  }

  const headers = (data[headerRow] || []).map((h: any) => String(h || '').toLowerCase());

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!columnMap.date && (h.includes('תאריך') || h.includes('date') || h.includes('תאריך תשלום') || h.includes('תאריך ערך'))) {
      columnMap.date = i;
    }
    if (!columnMap.total && (h.includes('סה"כ') || h.includes('סהכ') || h.includes('סכום תשלום') || h.includes('תשלום חודשי') || h.includes('total') || h.includes('סכום') || h.includes('תשלום'))) {
      columnMap.total = i;
    }
    if (!columnMap.principal && (h.includes('קרן') || h.includes('principal') || h.includes('החזר קרן'))) {
      columnMap.principal = i;
    }
    if (!columnMap.interest && (h.includes('ריבית') || h.includes('interest'))) {
      columnMap.interest = i;
    }
    if (!columnMap.cpi && (h.includes('הצמדה') || h.includes('מדד') || h.includes('cpi') || h.includes('הפרשי הצמדה'))) {
      columnMap.cpi = i;
    }
    if (!columnMap.balance && (h.includes('יתרה') || h.includes('balance') || h.includes('יתרת') || h.includes('יתרה לסילוק'))) {
      columnMap.balance = i;
    }
  }

  // If no 'total' column found but we have principal and interest, we'll compute total
  if (!columnMap.total && columnMap.principal !== undefined && columnMap.interest !== undefined) {
    columnMap.total = -1; // signal to compute
  }

  return { headerRow, columnMap };
}

function detectExpenseColumns(data: any[][]): { headerRow: number; columnMap: { date?: number; amount?: number; description?: number } } {
  const columnMap: { date?: number; amount?: number; description?: number } = {};
  let headerRow = 0;

  for (let r = 0; r < Math.min(data.length, 10); r++) {
    const row = data[r];
    if (!row) continue;
    const rowStr = row.map((c: any) => String(c || '').toLowerCase()).join(' ');
    if (rowStr.includes('תאריך') || rowStr.includes('date') || rowStr.includes('סכום') || rowStr.includes('amount')) {
      headerRow = r;
      break;
    }
  }

  const headers = (data[headerRow] || []).map((h: any) => String(h || '').toLowerCase());
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!columnMap.date && (h.includes('תאריך') || h.includes('date'))) columnMap.date = i;
    if (!columnMap.amount && (h.includes('סכום') || h.includes('amount') || h.includes('סה"כ') || h.includes('עלות'))) columnMap.amount = i;
    if (!columnMap.description && (h.includes('תיאור') || h.includes('description') || h.includes('פירוט') || h.includes('הערות'))) columnMap.description = i;
  }

  return { headerRow, columnMap };
}

function parseDate(val: any): string | null {
  if (!val) return null;

  // Excel serial date number
  if (typeof val === 'number' && val > 30000 && val < 60000) {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }

  const str = String(val).trim();

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = str.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  }

  // YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  }

  // MM/YYYY (monthly reports)
  const my = str.match(/^(\d{1,2})[/\-.](\d{4})$/);
  if (my) {
    return `${my[2]}-${my[1].padStart(2, '0')}-01`;
  }

  // Try JS Date parse
  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) {
    return d.toISOString().split('T')[0];
  }

  return null;
}

function parseNumber(val: any): number {
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  if (!val) return 0;
  const str = String(val).replace(/[₪,\s]/g, '').replace(/[()]/g, '-');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function guessExpenseCategory(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('ועד') || d.includes('בית משותף')) return 'committee';
  if (d.includes('ביטוח')) return 'insurance';
  if (d.includes('ארנונה') || d.includes('מס') || d.includes('עירייה')) return 'tax';
  if (d.includes('שיפוץ') || d.includes('צבע') || d.includes('אינסטלציה') || d.includes('חשמל')) return 'renovation';
  if (d.includes('עו"ד') || d.includes('עורך דין') || d.includes('שמאות') || d.includes('שמאי')) return 'legal';
  if (d.includes('ניהול') || d.includes('מתווך')) return 'management';
  if (d.includes('תחזוקה') || d.includes('תיקון')) return 'maintenance';
  return 'other';
}

export default router;

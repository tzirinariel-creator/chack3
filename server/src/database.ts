import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(__dirname, '..', '..', 'chack3.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      property_type TEXT NOT NULL DEFAULT 'apartment',
      purchase_date TEXT NOT NULL,
      purchase_price REAL NOT NULL,
      additional_purchase_costs REAL DEFAULT 0,
      current_estimated_value REAL,
      square_meters REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mortgages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      bank_name TEXT NOT NULL,
      original_amount REAL NOT NULL,
      start_date TEXT NOT NULL,
      term_months INTEGER NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mortgage_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mortgage_id INTEGER NOT NULL REFERENCES mortgages(id) ON DELETE CASCADE,
      track_name TEXT NOT NULL,
      track_type TEXT NOT NULL,
      original_amount REAL NOT NULL,
      interest_rate REAL NOT NULL,
      is_cpi_linked INTEGER DEFAULT 0,
      term_months INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS mortgage_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mortgage_id INTEGER NOT NULL REFERENCES mortgages(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      total_amount REAL NOT NULL,
      principal REAL NOT NULL,
      interest REAL NOT NULL,
      cpi_addition REAL DEFAULT 0,
      remaining_balance REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rate_changes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mortgage_track_id INTEGER NOT NULL REFERENCES mortgage_tracks(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      old_rate REAL NOT NULL,
      new_rate REAL NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      phone TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      monthly_rent REAL NOT NULL,
      payment_day INTEGER DEFAULT 1,
      deposit_amount REAL DEFAULT 0,
      contract_file TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rental_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_type TEXT DEFAULT 'rent',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      is_recurring INTEGER DEFAULT 0,
      recurring_months INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log('Database initialized successfully');
}

export default db;

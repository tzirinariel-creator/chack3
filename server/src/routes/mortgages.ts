import { Router } from 'express';
import db from '../database';

const router = Router();

// Get mortgages for a property
router.get('/property/:propertyId', (req, res) => {
  const mortgages = db.prepare('SELECT * FROM mortgages WHERE property_id = ?').all(req.params.propertyId);
  // Attach tracks to each mortgage
  const result = mortgages.map((m: any) => ({
    ...m,
    tracks: db.prepare('SELECT * FROM mortgage_tracks WHERE mortgage_id = ?').all(m.id),
  }));
  res.json(result);
});

// Get single mortgage with tracks
router.get('/:id', (req, res) => {
  const mortgage = db.prepare('SELECT * FROM mortgages WHERE id = ?').get(req.params.id) as any;
  if (!mortgage) return res.status(404).json({ error: 'Mortgage not found' });
  mortgage.tracks = db.prepare('SELECT * FROM mortgage_tracks WHERE mortgage_id = ?').all(mortgage.id);
  res.json(mortgage);
});

// Create mortgage with tracks
router.post('/', (req, res) => {
  const { property_id, bank_name, original_amount, start_date, term_months, notes, tracks } = req.body;

  const insertMortgage = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO mortgages (property_id, bank_name, original_amount, start_date, term_months, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(property_id, bank_name, original_amount, start_date, term_months, notes);

    const mortgageId = result.lastInsertRowid;

    if (tracks && tracks.length > 0) {
      const insertTrack = db.prepare(`
        INSERT INTO mortgage_tracks (mortgage_id, track_name, track_type, original_amount, interest_rate, is_cpi_linked, term_months)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const track of tracks) {
        insertTrack.run(mortgageId, track.track_name, track.track_type, track.original_amount, track.interest_rate, track.is_cpi_linked ? 1 : 0, track.term_months);
      }
    }

    const mortgage = db.prepare('SELECT * FROM mortgages WHERE id = ?').get(mortgageId) as any;
    mortgage.tracks = db.prepare('SELECT * FROM mortgage_tracks WHERE mortgage_id = ?').all(mortgageId);
    return mortgage;
  });

  const mortgage = insertMortgage();
  res.status(201).json(mortgage);
});

// Add mortgage payment
router.post('/:id/payments', (req, res) => {
  const { date, total_amount, principal, interest, cpi_addition, remaining_balance, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO mortgage_payments (mortgage_id, date, total_amount, principal, interest, cpi_addition, remaining_balance, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.params.id, date, total_amount, principal, interest, cpi_addition || 0, remaining_balance, notes);

  const payment = db.prepare('SELECT * FROM mortgage_payments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(payment);
});

// Bulk add mortgage payments
router.post('/:id/payments/bulk', (req, res) => {
  const { payments } = req.body;
  const insertPayment = db.prepare(`
    INSERT INTO mortgage_payments (mortgage_id, date, total_amount, principal, interest, cpi_addition, remaining_balance, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction(() => {
    for (const p of payments) {
      insertPayment.run(req.params.id, p.date, p.total_amount, p.principal, p.interest, p.cpi_addition || 0, p.remaining_balance, p.notes);
    }
  });

  insertAll();
  res.status(201).json({ success: true, count: payments.length });
});

// Get mortgage payments
router.get('/:id/payments', (req, res) => {
  const payments = db.prepare('SELECT * FROM mortgage_payments WHERE mortgage_id = ? ORDER BY date ASC').all(req.params.id);
  res.json(payments);
});

// Add rate change
router.post('/tracks/:trackId/rate-change', (req, res) => {
  const { date, old_rate, new_rate, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO rate_changes (mortgage_track_id, date, old_rate, new_rate, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.trackId, date, old_rate, new_rate, notes);

  // Update the track's current rate
  db.prepare('UPDATE mortgage_tracks SET interest_rate = ? WHERE id = ?').run(new_rate, req.params.trackId);

  const change = db.prepare('SELECT * FROM rate_changes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(change);
});

// Delete mortgage
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM mortgages WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;

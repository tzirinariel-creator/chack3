import { Router } from 'express';
import db from '../database';

const router = Router();

// Get expenses for a property
router.get('/property/:propertyId', (req, res) => {
  const expenses = db.prepare('SELECT * FROM expenses WHERE property_id = ? ORDER BY date DESC').all(req.params.propertyId);
  res.json(expenses);
});

// Create expense
router.post('/', (req, res) => {
  const { property_id, date, amount, category, description, is_recurring, recurring_months, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO expenses (property_id, date, amount, category, description, is_recurring, recurring_months, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(property_id, date, amount, category, description, is_recurring ? 1 : 0, recurring_months, notes);

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(expense);
});

// Update expense
router.put('/:id', (req, res) => {
  const { date, amount, category, description, is_recurring, recurring_months, notes } = req.body;
  db.prepare(`
    UPDATE expenses SET date=?, amount=?, category=?, description=?, is_recurring=?, recurring_months=?, notes=?
    WHERE id=?
  `).run(date, amount, category, description, is_recurring ? 1 : 0, recurring_months, notes, req.params.id);

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  res.json(expense);
});

// Delete expense
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;

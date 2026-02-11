import { Router } from 'express';
import db from '../database';

const router = Router();

// Get purchase costs for a property
router.get('/purchase/:propertyId', (req, res) => {
  const costs = db.prepare('SELECT * FROM purchase_costs WHERE property_id = ? ORDER BY amount DESC').all(Number(req.params.propertyId));
  res.json(costs);
});

// Add purchase cost
router.post('/purchase', (req, res) => {
  const { property_id, category, amount, description, notes } = req.body;
  const result = db.prepare(
    'INSERT INTO purchase_costs (property_id, category, amount, description, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(property_id, category, amount, description || null, notes || null);

  // Update the property's additional_purchase_costs total
  updatePropertyCostsTotal(property_id);

  res.json({ id: result.lastInsertRowid });
});

// Delete purchase cost
router.delete('/purchase/:id', (req, res) => {
  const cost = db.prepare('SELECT property_id FROM purchase_costs WHERE id = ?').get(Number(req.params.id)) as any;
  db.prepare('DELETE FROM purchase_costs WHERE id = ?').run(Number(req.params.id));
  if (cost) updatePropertyCostsTotal(cost.property_id);
  res.json({ success: true });
});

// Get sale costs for a property
router.get('/sale/:propertyId', (req, res) => {
  const costs = db.prepare('SELECT * FROM sale_costs WHERE property_id = ? ORDER BY amount DESC').all(Number(req.params.propertyId));
  res.json(costs);
});

// Add sale cost
router.post('/sale', (req, res) => {
  const { property_id, category, amount, description, notes } = req.body;
  const result = db.prepare(
    'INSERT INTO sale_costs (property_id, category, amount, description, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(property_id, category, amount, description || null, notes || null);
  res.json({ id: result.lastInsertRowid });
});

// Delete sale cost
router.delete('/sale/:id', (req, res) => {
  db.prepare('DELETE FROM sale_costs WHERE id = ?').run(Number(req.params.id));
  res.json({ success: true });
});

function updatePropertyCostsTotal(propertyId: number) {
  const total = db.prepare(
    'SELECT COALESCE(SUM(amount), 0) as total FROM purchase_costs WHERE property_id = ?'
  ).get(propertyId) as any;
  db.prepare('UPDATE properties SET additional_purchase_costs = ? WHERE id = ?').run(total.total, propertyId);
}

export default router;

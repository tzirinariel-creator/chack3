import { Router } from 'express';
import db from '../database';

const router = Router();

// Get all properties
router.get('/', (_req, res) => {
  const properties = db.prepare('SELECT * FROM properties ORDER BY created_at DESC').all();
  res.json(properties);
});

// Get single property
router.get('/:id', (req, res) => {
  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json(property);
});

// Create property
router.post('/', (req, res) => {
  const { name, address, city, property_type, purchase_date, purchase_price, additional_purchase_costs, current_estimated_value, square_meters, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO properties (name, address, city, property_type, purchase_date, purchase_price, additional_purchase_costs, current_estimated_value, square_meters, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, address, city, property_type || 'apartment', purchase_date, purchase_price, additional_purchase_costs || 0, current_estimated_value, square_meters, notes);

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(property);
});

// Update property
router.put('/:id', (req, res) => {
  const { name, address, city, property_type, purchase_date, purchase_price, additional_purchase_costs, current_estimated_value, square_meters, notes } = req.body;
  db.prepare(`
    UPDATE properties SET name=?, address=?, city=?, property_type=?, purchase_date=?, purchase_price=?, additional_purchase_costs=?, current_estimated_value=?, square_meters=?, notes=?
    WHERE id=?
  `).run(name, address, city, property_type, purchase_date, purchase_price, additional_purchase_costs, current_estimated_value, square_meters, notes, req.params.id);

  const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(req.params.id);
  res.json(property);
});

// Delete property
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM properties WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;

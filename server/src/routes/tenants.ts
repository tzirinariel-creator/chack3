import { Router } from 'express';
import db from '../database';

const router = Router();

// Get tenants for a property
router.get('/property/:propertyId', (req, res) => {
  const tenants = db.prepare('SELECT * FROM tenants WHERE property_id = ? ORDER BY start_date DESC').all(req.params.propertyId);
  res.json(tenants);
});

// Create tenant
router.post('/', (req, res) => {
  const { property_id, name, phone, start_date, end_date, monthly_rent, payment_day, deposit_amount, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO tenants (property_id, name, phone, start_date, end_date, monthly_rent, payment_day, deposit_amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(property_id, name, phone, start_date, end_date, monthly_rent, payment_day || 1, deposit_amount || 0, notes);

  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(tenant);
});

// Update tenant
router.put('/:id', (req, res) => {
  const { name, phone, start_date, end_date, monthly_rent, payment_day, deposit_amount, notes } = req.body;
  db.prepare(`
    UPDATE tenants SET name=?, phone=?, start_date=?, end_date=?, monthly_rent=?, payment_day=?, deposit_amount=?, notes=?
    WHERE id=?
  `).run(name, phone, start_date, end_date, monthly_rent, payment_day, deposit_amount, notes, req.params.id);

  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
  res.json(tenant);
});

// Delete tenant
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tenants WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Add rental payment
router.post('/:id/payments', (req, res) => {
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id) as any;
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const { date, amount, payment_type, notes } = req.body;
  const result = db.prepare(`
    INSERT INTO rental_payments (tenant_id, property_id, date, amount, payment_type, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, tenant.property_id, date, amount, payment_type || 'rent', notes);

  const payment = db.prepare('SELECT * FROM rental_payments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(payment);
});

// Get rental payments for a property
router.get('/payments/property/:propertyId', (req, res) => {
  const payments = db.prepare('SELECT * FROM rental_payments WHERE property_id = ? ORDER BY date ASC').all(req.params.propertyId);
  res.json(payments);
});

export default router;

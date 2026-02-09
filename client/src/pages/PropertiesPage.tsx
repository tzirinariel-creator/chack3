import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, MapPin, Calendar, Banknote, ChevronLeft, Trash2 } from 'lucide-react';
import { getProperties, createProperty, deleteProperty } from '../api';
import { Property, PROPERTY_TYPES } from '../types';
import { formatCurrency, formatDate } from '../utils/format';

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProperties();
  }, []);

  async function loadProperties() {
    try {
      const data = await getProperties();
      setProperties(data);
    } catch (err) {
      console.error('Failed to load properties:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('בטוח שאתה רוצה למחוק את הנכס? כל הנתונים הקשורים יימחקו.')) return;
    await deleteProperty(id);
    loadProperties();
  }

  if (loading) return <div className="text-center py-12 text-gray-500">טוען...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">הנכסים שלי</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          הוסף נכס
        </button>
      </div>

      {showForm && <PropertyForm onSave={() => { loadProperties(); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

      {properties.length === 0 && !showForm ? (
        <div className="card text-center py-16">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">אין נכסים עדיין</h3>
          <p className="text-gray-400 mb-6">הוסף את הנכס הראשון שלך כדי להתחיל לעקוב אחרי ההשקעה</p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            <Plus className="w-4 h-4 inline ml-1" />
            הוסף נכס ראשון
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(property => (
            <div key={property.id} className="card hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{property.name}</h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {property.address}, {property.city}
                  </p>
                </div>
                <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
                  {PROPERTY_TYPES[property.property_type] || property.property_type}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Banknote className="w-4 h-4 text-gray-400" />
                  מחיר רכישה: {formatCurrency(property.purchase_price)}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  תאריך רכישה: {formatDate(property.purchase_date)}
                </div>
                {property.current_estimated_value && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <TrendingIcon value={property.current_estimated_value - property.purchase_price} />
                    שווי נוכחי: {formatCurrency(property.current_estimated_value)}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <button onClick={() => handleDelete(property.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
                <Link to={`/property/${property.id}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1">
                  נהל נכס
                  <ChevronLeft className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrendingIcon({ value }: { value: number }) {
  if (value > 0) return <span className="text-green-600">▲</span>;
  if (value < 0) return <span className="text-red-600">▼</span>;
  return <span className="text-gray-400">—</span>;
}

function Building2({ className }: { className?: string }) {
  return <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>;
}

function PropertyForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    name: '',
    address: '',
    city: '',
    property_type: 'apartment',
    purchase_date: '',
    purchase_price: '',
    additional_purchase_costs: '',
    current_estimated_value: '',
    square_meters: '',
    notes: '',
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createProperty({
      ...form,
      purchase_price: Number(form.purchase_price),
      additional_purchase_costs: Number(form.additional_purchase_costs) || 0,
      current_estimated_value: form.current_estimated_value ? Number(form.current_estimated_value) : null,
      square_meters: form.square_meters ? Number(form.square_meters) : null,
    });
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-6">
      <h3 className="text-lg font-bold mb-4">הוסף נכס חדש</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">שם הנכס *</label>
          <input className="input-field" placeholder='למשל: "דירה בבאר שבע"' value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="label">סוג נכס</label>
          <select className="input-field" value={form.property_type} onChange={e => setForm({ ...form, property_type: e.target.value })}>
            {Object.entries(PROPERTY_TYPES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">כתובת *</label>
          <input className="input-field" placeholder="רחוב ומספר" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required />
        </div>
        <div>
          <label className="label">עיר *</label>
          <input className="input-field" placeholder="באר שבע" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} required />
        </div>
        <div>
          <label className="label">תאריך רכישה *</label>
          <input type="date" className="input-field" value={form.purchase_date} onChange={e => setForm({ ...form, purchase_date: e.target.value })} required />
        </div>
        <div>
          <label className="label">מחיר רכישה (ש"ח) *</label>
          <input type="number" className="input-field" placeholder="1,200,000" value={form.purchase_price} onChange={e => setForm({ ...form, purchase_price: e.target.value })} required />
        </div>
        <div>
          <label className="label">עלויות נוספות (עו"ד, מס, תיווך, שיפוץ)</label>
          <input type="number" className="input-field" placeholder="50,000" value={form.additional_purchase_costs} onChange={e => setForm({ ...form, additional_purchase_costs: e.target.value })} />
        </div>
        <div>
          <label className="label">שווי נוכחי משוער (ש"ח)</label>
          <input type="number" className="input-field" placeholder="1,400,000" value={form.current_estimated_value} onChange={e => setForm({ ...form, current_estimated_value: e.target.value })} />
        </div>
        <div>
          <label className="label">שטח (מ"ר)</label>
          <input type="number" className="input-field" placeholder="75" value={form.square_meters} onChange={e => setForm({ ...form, square_meters: e.target.value })} />
        </div>
        <div>
          <label className="label">הערות</label>
          <input className="input-field" placeholder="הערות נוספות..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" className="btn-primary">שמור נכס</button>
        <button type="button" onClick={onCancel} className="btn-secondary">ביטול</button>
      </div>
    </form>
  );
}

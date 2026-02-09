import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Landmark, Users, Receipt, Plus, Trash2, X } from 'lucide-react';
import { getProperty, getMortgages, createMortgage, deleteMortgage, addMortgagePayment, getMortgagePayments, getTenants, createTenant, deleteTenant, addRentalPayment, getExpenses, createExpense, deleteExpense } from '../api';
import { Property, Mortgage, MortgagePayment, Tenant, Expense, EXPENSE_CATEGORIES, TRACK_TYPES } from '../types';
import { formatCurrency, formatDate } from '../utils/format';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const propertyId = Number(id);
  const [property, setProperty] = useState<Property | null>(null);
  const [mortgages, setMortgages] = useState<Mortgage[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [activeTab, setActiveTab] = useState<'mortgage' | 'tenants' | 'expenses'>('mortgage');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, [propertyId]);

  async function loadAll() {
    try {
      const [prop, mort, ten, exp] = await Promise.all([
        getProperty(propertyId),
        getMortgages(propertyId),
        getTenants(propertyId),
        getExpenses(propertyId),
      ]);
      setProperty(prop);
      setMortgages(mort);
      setTenants(ten);
      setExpenses(exp);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">טוען...</div>;
  if (!property) return <div className="text-center py-12 text-red-500">נכס לא נמצא</div>;

  const tabs = [
    { key: 'mortgage' as const, label: 'משכנתא', icon: Landmark, count: mortgages.length },
    { key: 'tenants' as const, label: 'שוכרים', icon: Users, count: tenants.length },
    { key: 'expenses' as const, label: 'הוצאות', icon: Receipt, count: expenses.length },
  ];

  return (
    <div>
      <Link to="/" className="text-primary-600 hover:text-primary-700 text-sm flex items-center gap-1 mb-4">
        <ArrowRight className="w-4 h-4" />
        חזרה לנכסים
      </Link>

      <div className="card mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">{property.name}</h2>
        <p className="text-gray-500 mb-4">{property.address}, {property.city}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div><span className="text-xs text-gray-400">מחיר רכישה</span><div className="font-bold">{formatCurrency(property.purchase_price)}</div></div>
          <div><span className="text-xs text-gray-400">עלויות נוספות</span><div className="font-bold">{formatCurrency(property.additional_purchase_costs)}</div></div>
          <div><span className="text-xs text-gray-400">שווי נוכחי</span><div className="font-bold">{property.current_estimated_value ? formatCurrency(property.current_estimated_value) : '—'}</div></div>
          <div><span className="text-xs text-gray-400">תאריך רכישה</span><div className="font-bold">{formatDate(property.purchase_date)}</div></div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count > 0 && <span className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{count}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'mortgage' && <MortgageSection propertyId={propertyId} mortgages={mortgages} onRefresh={loadAll} />}
      {activeTab === 'tenants' && <TenantsSection propertyId={propertyId} tenants={tenants} onRefresh={loadAll} />}
      {activeTab === 'expenses' && <ExpensesSection propertyId={propertyId} expenses={expenses} onRefresh={loadAll} />}
    </div>
  );
}

// === Mortgage Section ===
function MortgageSection({ propertyId, mortgages, onRefresh }: { propertyId: number; mortgages: Mortgage[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState<number | null>(null);
  const [payments, setPayments] = useState<Record<number, MortgagePayment[]>>({});

  async function loadPayments(mortgageId: number) {
    const p = await getMortgagePayments(mortgageId);
    setPayments(prev => ({ ...prev, [mortgageId]: p }));
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">משכנתאות</h3>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1 text-sm"><Plus className="w-4 h-4" /> הוסף משכנתא</button>
      </div>

      {showForm && <MortgageForm propertyId={propertyId} onSave={() => { onRefresh(); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

      {mortgages.length === 0 && !showForm && <p className="text-gray-400 text-center py-8">לא הוספת משכנתא עדיין</p>}

      {mortgages.map(mortgage => (
        <div key={mortgage.id} className="card mb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-bold">{mortgage.bank_name}</h4>
              <p className="text-sm text-gray-500">סכום מקורי: {formatCurrency(mortgage.original_amount)} | {mortgage.term_months} חודשים | מתאריך {formatDate(mortgage.start_date)}</p>
            </div>
            <button onClick={async () => { await deleteMortgage(mortgage.id); onRefresh(); }} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>

          {mortgage.tracks && mortgage.tracks.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-2">מסלולים:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {mortgage.tracks.map(track => (
                  <div key={track.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                    <div className="font-medium">{track.track_name}</div>
                    <div className="text-gray-500">
                      {TRACK_TYPES[track.track_type] || track.track_type} | {track.interest_rate}% | {formatCurrency(track.original_amount)}
                      {track.is_cpi_linked ? ' | צמוד מדד' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setShowPaymentForm(showPaymentForm === mortgage.id ? null : mortgage.id); loadPayments(mortgage.id); }}
              className="btn-secondary text-sm"
            >
              {showPaymentForm === mortgage.id ? 'סגור' : 'תשלומים'}
            </button>
          </div>

          {showPaymentForm === mortgage.id && (
            <div className="mt-4 border-t pt-4">
              <PaymentForm mortgageId={mortgage.id} onSave={() => { loadPayments(mortgage.id); onRefresh(); }} />
              {payments[mortgage.id] && payments[mortgage.id].length > 0 && (
                <div className="mt-3 max-h-60 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-gray-500 text-xs"><tr><th className="text-right py-1">תאריך</th><th className="text-right">סה"כ</th><th className="text-right">קרן</th><th className="text-right">ריבית</th></tr></thead>
                    <tbody>
                      {payments[mortgage.id].map(p => (
                        <tr key={p.id} className="border-t border-gray-50">
                          <td className="py-1">{formatDate(p.date)}</td>
                          <td>{formatCurrency(p.total_amount)}</td>
                          <td>{formatCurrency(p.principal)}</td>
                          <td>{formatCurrency(p.interest)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MortgageForm({ propertyId, onSave, onCancel }: { propertyId: number; onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ bank_name: '', original_amount: '', start_date: '', term_months: '' });
  const [tracks, setTracks] = useState([{ track_name: 'מסלול 1', track_type: 'prime', original_amount: '', interest_rate: '', is_cpi_linked: false, term_months: '' }]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createMortgage({
      property_id: propertyId,
      ...form,
      original_amount: Number(form.original_amount),
      term_months: Number(form.term_months),
      tracks: tracks.map(t => ({
        ...t,
        original_amount: Number(t.original_amount),
        interest_rate: Number(t.interest_rate),
        term_months: Number(t.term_months) || Number(form.term_months),
      })),
    });
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-4 border-primary-200 bg-primary-50/30">
      <h4 className="font-bold mb-3">משכנתא חדשה</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div><label className="label">בנק *</label><input className="input-field" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} required /></div>
        <div><label className="label">סכום מקורי *</label><input type="number" className="input-field" value={form.original_amount} onChange={e => setForm({...form, original_amount: e.target.value})} required /></div>
        <div><label className="label">תאריך התחלה *</label><input type="date" className="input-field" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required /></div>
        <div><label className="label">תקופה (חודשים) *</label><input type="number" className="input-field" value={form.term_months} onChange={e => setForm({...form, term_months: e.target.value})} required /></div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">מסלולים</p>
          <button type="button" onClick={() => setTracks([...tracks, { track_name: `מסלול ${tracks.length + 1}`, track_type: 'prime', original_amount: '', interest_rate: '', is_cpi_linked: false, term_months: '' }])} className="text-primary-600 text-sm">+ מסלול</button>
        </div>
        {tracks.map((track, i) => (
          <div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2 p-3 bg-white rounded-lg">
            <div><label className="label text-xs">שם</label><input className="input-field text-sm" value={track.track_name} onChange={e => { const t = [...tracks]; t[i].track_name = e.target.value; setTracks(t); }} /></div>
            <div><label className="label text-xs">סוג</label><select className="input-field text-sm" value={track.track_type} onChange={e => { const t = [...tracks]; t[i].track_type = e.target.value; setTracks(t); }}>
              {Object.entries(TRACK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
            <div><label className="label text-xs">סכום</label><input type="number" className="input-field text-sm" value={track.original_amount} onChange={e => { const t = [...tracks]; t[i].original_amount = e.target.value; setTracks(t); }} /></div>
            <div><label className="label text-xs">ריבית %</label><input type="number" step="0.01" className="input-field text-sm" value={track.interest_rate} onChange={e => { const t = [...tracks]; t[i].interest_rate = e.target.value; setTracks(t); }} /></div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={track.is_cpi_linked} onChange={e => { const t = [...tracks]; t[i].is_cpi_linked = e.target.checked; setTracks(t); }} /> צמוד מדד</label>
              {tracks.length > 1 && <button type="button" onClick={() => setTracks(tracks.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm">שמור</button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">ביטול</button>
      </div>
    </form>
  );
}

function PaymentForm({ mortgageId, onSave }: { mortgageId: number; onSave: () => void }) {
  const [form, setForm] = useState({ date: '', total_amount: '', principal: '', interest: '', cpi_addition: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addMortgagePayment(mortgageId, {
      ...form,
      total_amount: Number(form.total_amount),
      principal: Number(form.principal),
      interest: Number(form.interest),
      cpi_addition: Number(form.cpi_addition) || 0,
    });
    setForm({ date: '', total_amount: '', principal: '', interest: '', cpi_addition: '' });
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
      <div><label className="label text-xs">תאריך</label><input type="date" className="input-field text-sm" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required /></div>
      <div><label className="label text-xs">סה"כ</label><input type="number" className="input-field text-sm w-24" value={form.total_amount} onChange={e => setForm({...form, total_amount: e.target.value})} required /></div>
      <div><label className="label text-xs">קרן</label><input type="number" className="input-field text-sm w-24" value={form.principal} onChange={e => setForm({...form, principal: e.target.value})} required /></div>
      <div><label className="label text-xs">ריבית</label><input type="number" className="input-field text-sm w-24" value={form.interest} onChange={e => setForm({...form, interest: e.target.value})} required /></div>
      <div><label className="label text-xs">הצמדה</label><input type="number" className="input-field text-sm w-24" value={form.cpi_addition} onChange={e => setForm({...form, cpi_addition: e.target.value})} /></div>
      <button type="submit" className="btn-primary text-sm">הוסף</button>
    </form>
  );
}

// === Tenants Section ===
function TenantsSection({ propertyId, tenants, onRefresh }: { propertyId: number; tenants: Tenant[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">שוכרים</h3>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1 text-sm"><Plus className="w-4 h-4" /> הוסף שוכר</button>
      </div>

      {showForm && <TenantForm propertyId={propertyId} onSave={() => { onRefresh(); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

      {tenants.length === 0 && !showForm && <p className="text-gray-400 text-center py-8">לא הוספת שוכרים עדיין</p>}

      {tenants.map(tenant => (
        <div key={tenant.id} className="card mb-3">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-bold">{tenant.name}</h4>
              <p className="text-sm text-gray-500">
                {formatDate(tenant.start_date)} — {tenant.end_date ? formatDate(tenant.end_date) : 'נוכחי'} | {formatCurrency(tenant.monthly_rent)}/חודש
              </p>
              {tenant.phone && <p className="text-sm text-gray-400">טל: {tenant.phone}</p>}
            </div>
            <div className="flex items-center gap-2">
              <AddRentalPaymentBtn tenantId={tenant.id} monthlyRent={tenant.monthly_rent} onSave={onRefresh} />
              <button onClick={async () => { await deleteTenant(tenant.id); onRefresh(); }} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TenantForm({ propertyId, onSave, onCancel }: { propertyId: number; onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', phone: '', start_date: '', end_date: '', monthly_rent: '', deposit_amount: '', notes: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createTenant({ property_id: propertyId, ...form, monthly_rent: Number(form.monthly_rent), deposit_amount: Number(form.deposit_amount) || 0 });
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-4 border-primary-200 bg-primary-50/30">
      <h4 className="font-bold mb-3">שוכר חדש</h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div><label className="label">שם *</label><input className="input-field" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required /></div>
        <div><label className="label">טלפון</label><input className="input-field" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
        <div><label className="label">שכירות חודשית *</label><input type="number" className="input-field" value={form.monthly_rent} onChange={e => setForm({...form, monthly_rent: e.target.value})} required /></div>
        <div><label className="label">תאריך כניסה *</label><input type="date" className="input-field" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required /></div>
        <div><label className="label">תאריך יציאה</label><input type="date" className="input-field" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
        <div><label className="label">פיקדון</label><input type="number" className="input-field" value={form.deposit_amount} onChange={e => setForm({...form, deposit_amount: e.target.value})} /></div>
      </div>
      <div className="flex gap-2 mt-3">
        <button type="submit" className="btn-primary text-sm">שמור</button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">ביטול</button>
      </div>
    </form>
  );
}

function AddRentalPaymentBtn({ tenantId, monthlyRent, onSave }: { tenantId: number; monthlyRent: number; onSave: () => void }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split('T')[0], amount: String(monthlyRent) });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addRentalPayment(tenantId, { date: form.date, amount: Number(form.amount), payment_type: 'rent' });
    setShow(false);
    onSave();
  }

  if (!show) return <button onClick={() => setShow(true)} className="text-green-600 hover:text-green-700 text-sm">+ תשלום</button>;

  return (
    <form onSubmit={handleSubmit} className="flex gap-1 items-center">
      <input type="date" className="input-field text-xs w-32" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
      <input type="number" className="input-field text-xs w-20" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
      <button type="submit" className="btn-success text-xs py-1 px-2">✓</button>
      <button type="button" onClick={() => setShow(false)} className="text-gray-400 text-xs">✕</button>
    </form>
  );
}

// === Expenses Section ===
function ExpensesSection({ propertyId, expenses, onRefresh }: { propertyId: number; expenses: Expense[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">הוצאות</h3>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1 text-sm"><Plus className="w-4 h-4" /> הוסף הוצאה</button>
      </div>

      {showForm && <ExpenseForm propertyId={propertyId} onSave={() => { onRefresh(); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

      {expenses.length === 0 && !showForm && <p className="text-gray-400 text-center py-8">לא הוספת הוצאות עדיין</p>}

      <div className="space-y-2">
        {expenses.map(expense => (
          <div key={expense.id} className="card py-3 flex justify-between items-center">
            <div>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full ml-2">{EXPENSE_CATEGORIES[expense.category] || expense.category}</span>
              <span className="font-medium">{formatCurrency(expense.amount)}</span>
              {expense.description && <span className="text-sm text-gray-500 mr-2">— {expense.description}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">{formatDate(expense.date)}</span>
              <button onClick={async () => { await deleteExpense(expense.id); onRefresh(); }} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpenseForm({ propertyId, onSave, onCancel }: { propertyId: number; onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ date: '', amount: '', category: 'maintenance', description: '', is_recurring: false, notes: '' });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createExpense({ property_id: propertyId, ...form, amount: Number(form.amount) });
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="card mb-4 border-primary-200 bg-primary-50/30">
      <h4 className="font-bold mb-3">הוצאה חדשה</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><label className="label">תאריך *</label><input type="date" className="input-field" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required /></div>
        <div><label className="label">סכום *</label><input type="number" className="input-field" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required /></div>
        <div><label className="label">קטגוריה</label><select className="input-field" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
          {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select></div>
        <div><label className="label">תיאור</label><input className="input-field" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
      </div>
      <div className="flex gap-2 mt-3">
        <button type="submit" className="btn-primary text-sm">שמור</button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">ביטול</button>
      </div>
    </form>
  );
}

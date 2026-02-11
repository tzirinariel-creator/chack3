import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Landmark, Users, Receipt, Plus, Trash2, X, Upload, FileSpreadsheet, CheckCircle, AlertCircle, Coins } from 'lucide-react';
import { getProperty, getMortgages, createMortgage, deleteMortgage, addMortgagePayment, getMortgagePayments, getTenants, createTenant, deleteTenant, addRentalPayment, getExpenses, createExpense, deleteExpense, uploadMortgageReport, uploadExpenses, uploadRentalPayments, getPurchaseCosts, addPurchaseCost, deletePurchaseCost } from '../api';
import { Property, Mortgage, MortgagePayment, Tenant, Expense, EXPENSE_CATEGORIES, TRACK_TYPES } from '../types';
import { formatCurrency, formatDate } from '../utils/format';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const propertyId = Number(id);
  const [property, setProperty] = useState<Property | null>(null);
  const [mortgages, setMortgages] = useState<Mortgage[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchaseCosts, setPurchaseCosts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'costs' | 'mortgage' | 'tenants' | 'expenses'>('costs');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, [propertyId]);

  async function loadAll() {
    try {
      const [prop, mort, ten, exp, costs] = await Promise.all([
        getProperty(propertyId),
        getMortgages(propertyId),
        getTenants(propertyId),
        getExpenses(propertyId),
        getPurchaseCosts(propertyId),
      ]);
      setProperty(prop);
      setMortgages(mort);
      setTenants(ten);
      setExpenses(exp);
      setPurchaseCosts(costs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="text-center py-12 text-gray-500">טוען...</div>;
  if (!property) return <div className="text-center py-12 text-red-500">נכס לא נמצא</div>;

  const purchaseCostsTotal = purchaseCosts.reduce((s, c) => s + c.amount, 0);

  const tabs = [
    { key: 'costs' as const, label: 'עלויות רכישה', icon: Coins, count: purchaseCosts.length },
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
          <div><span className="text-xs text-gray-400">עלויות נוספות</span><div className="font-bold">{formatCurrency(purchaseCostsTotal > 0 ? purchaseCostsTotal : property.additional_purchase_costs)}</div>{purchaseCosts.length > 0 && <span className="text-xs text-green-600">{purchaseCosts.length} פריטים</span>}</div>
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

      {activeTab === 'costs' && <PurchaseCostsSection propertyId={propertyId} costs={purchaseCosts} onRefresh={loadAll} />}
      {activeTab === 'mortgage' && <MortgageSection propertyId={propertyId} mortgages={mortgages} onRefresh={loadAll} />}
      {activeTab === 'tenants' && <TenantsSection propertyId={propertyId} tenants={tenants} onRefresh={loadAll} />}
      {activeTab === 'expenses' && <ExpensesSection propertyId={propertyId} expenses={expenses} onRefresh={loadAll} />}
    </div>
  );
}

// === File Upload Component ===
function FileUploadZone({ onUpload, label, accept, uploading }: { onUpload: (file: File) => void; label: string; accept?: string; uploading?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file);
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
        dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
      } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
    >
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept={accept || '.xlsx,.xls,.csv'}
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          <p className="text-sm text-gray-500">מעבד את הקובץ...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <FileSpreadsheet className="w-10 h-10 text-gray-400" />
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400">גרור לכאן קובץ Excel או CSV, או לחץ לבחירה</p>
        </div>
      )}
    </div>
  );
}

function UploadResult({ result, error }: { result?: any; error?: string }) {
  if (error) return (
    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mt-3">
      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
      <p className="text-sm text-red-700">{error}</p>
    </div>
  );
  if (result) return (
    <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mt-3">
      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
      <p className="text-sm text-green-700">{result.message}</p>
    </div>
  );
  return null;
}

// === Purchase Costs Section ===
const PURCHASE_COST_CATEGORIES: Record<string, string> = {
  agent_buy: 'תיווך קנייה',
  lawyer_buy: 'עו"ד רכישה',
  purchase_tax: 'מס רכישה',
  renovation: 'שיפוץ / סטיילינג',
  appraisal: 'שמאות',
  mortgage_file: 'פתיחת תיק משכנתא / יועץ',
  ownership_transfer: 'העברת בעלות / רישום בטאבו',
  moving: 'העברה / הובלה',
  utilities_transfer: 'העברת חשבונות',
  other_purchase: 'אחר',
};

function PurchaseCostsSection({ propertyId, costs, onRefresh }: { propertyId: number; costs: any[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [newCost, setNewCost] = useState({ category: 'agent_buy', amount: '', description: '' });
  const [saving, setSaving] = useState(false);

  const total = costs.reduce((s, c) => s + c.amount, 0);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addPurchaseCost({
        property_id: propertyId,
        category: newCost.category,
        amount: Number(newCost.amount),
        description: newCost.description || null,
      });
      setNewCost({ category: 'agent_buy', amount: '', description: '' });
      setShowForm(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (confirm('למחוק את ההוצאה?')) {
      await deletePurchaseCost(id);
      onRefresh();
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">עלויות רכישה</h3>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1 text-sm">
          <Plus className="w-4 h-4" /> הוסף עלות
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-4">
        הכנס את כל ההוצאות שהיו ברכישת הנכס - תיווך, עו"ד, מס רכישה, שיפוץ, ועוד. כל שקל חשוב לחישוב המדויק.
      </p>

      {showForm && (
        <form onSubmit={handleAdd} className="card mb-4 border-primary-200 bg-primary-50/30">
          <h4 className="font-bold mb-3">הוסף עלות רכישה</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">קטגוריה *</label>
              <select className="input-field" value={newCost.category} onChange={e => setNewCost({ ...newCost, category: e.target.value })}>
                {Object.entries(PURCHASE_COST_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">סכום *</label>
              <input
                type="number"
                className="input-field"
                placeholder="0"
                value={newCost.amount}
                onChange={e => setNewCost({ ...newCost, amount: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">הערה</label>
              <input
                className="input-field"
                placeholder="פירוט נוסף..."
                value={newCost.description}
                onChange={e => setNewCost({ ...newCost, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button type="submit" className="btn-primary text-sm" disabled={saving}>
              {saving ? 'שומר...' : 'שמור'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">ביטול</button>
          </div>
        </form>
      )}

      {costs.length === 0 && !showForm && (
        <div className="text-center py-12">
          <Coins className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">לא הוספת עלויות רכישה עדיין</p>
          <p className="text-sm text-gray-400">הוסף את כל ההוצאות שהיו ברכישה: תיווך, עו"ד, מס רכישה, שיפוץ...</p>
        </div>
      )}

      {costs.length > 0 && (
        <>
          {/* Summary */}
          <div className="card mb-4 bg-blue-50 border border-blue-200">
            <div className="flex justify-between items-center">
              <p className="font-bold text-blue-800">סה"כ עלויות רכישה</p>
              <p className="font-bold text-xl text-blue-900">{formatCurrency(total)}</p>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {costs.map((cost: any) => (
              <div key={cost.id} className="card py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {PURCHASE_COST_CATEGORIES[cost.category] || cost.category}
                  </span>
                  <span className="font-medium">{formatCurrency(cost.amount)}</span>
                  {cost.description && <span className="text-sm text-gray-500">— {cost.description}</span>}
                </div>
                <button onClick={() => handleDelete(cost.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// === Mortgage Section ===
function MortgageSection({ propertyId, mortgages, onRefresh }: { propertyId: number; mortgages: Mortgage[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState<number | null>(null);
  const [payments, setPayments] = useState<Record<number, MortgagePayment[]>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadForMortgage, setUploadForMortgage] = useState<number | null>(null);

  async function loadPayments(mortgageId: number) {
    const p = await getMortgagePayments(mortgageId);
    setPayments(prev => ({ ...prev, [mortgageId]: p }));
  }

  async function handleUpload(mortgageId: number, file: File) {
    setUploading(true);
    setUploadResult(null);
    setUploadError('');
    setUploadForMortgage(mortgageId);
    try {
      const result = await uploadMortgageReport(mortgageId, file);
      setUploadResult(result);
      loadPayments(mortgageId);
      onRefresh();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">משכנתאות</h3>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1 text-sm"><Plus className="w-4 h-4" /> הוסף משכנתא</button>
      </div>

      {showForm && <MortgageForm propertyId={propertyId} onSave={() => { onRefresh(); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

      {mortgages.length === 0 && !showForm && (
        <div className="text-center py-12">
          <Landmark className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 mb-2">לא הוספת משכנתא עדיין</p>
          <p className="text-sm text-gray-400">הוסף את פרטי המשכנתא ותוכל לייבא את הדוח מהבנק</p>
        </div>
      )}

      {mortgages.map(mortgage => (
        <div key={mortgage.id} className="card mb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h4 className="font-bold text-lg">{mortgage.bank_name}</h4>
              <p className="text-sm text-gray-500">
                סכום מקורי: {formatCurrency(mortgage.original_amount)} | {mortgage.term_months} חודשים | מתאריך {formatDate(mortgage.start_date)}
              </p>
            </div>
            <button onClick={async () => { if (confirm('בטוח?')) { await deleteMortgage(mortgage.id); onRefresh(); }}} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>

          {/* Tracks */}
          {mortgage.tracks && mortgage.tracks.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-2">מסלולים ({mortgage.tracks.length}):</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {mortgage.tracks.map(track => (
                  <div key={track.id} className="bg-gray-50 rounded-lg p-3 text-sm border border-gray-100">
                    <div className="font-medium text-gray-900">{track.track_name}</div>
                    <div className="text-gray-500 mt-1 space-y-0.5">
                      <div>סוג: {TRACK_TYPES[track.track_type] || track.track_type}</div>
                      <div>ריבית: <span className="font-medium text-gray-700">{track.interest_rate}%</span></div>
                      <div>סכום: {formatCurrency(track.original_amount)}</div>
                      {track.is_cpi_linked ? <div className="text-orange-600 font-medium">צמוד מדד</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setShowPaymentForm(showPaymentForm === mortgage.id ? null : mortgage.id); loadPayments(mortgage.id); }}
              className="btn-secondary text-sm"
            >
              {showPaymentForm === mortgage.id ? 'סגור תשלומים' : 'הוסף/צפה בתשלומים'}
            </button>
            <button
              onClick={() => setUploadForMortgage(uploadForMortgage === mortgage.id ? null : mortgage.id)}
              className="btn-secondary text-sm flex items-center gap-1"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploadForMortgage === mortgage.id ? 'סגור ייבוא' : 'ייבא דוח מהבנק'}
            </button>
          </div>

          {/* Upload Zone */}
          {uploadForMortgage === mortgage.id && (
            <div className="mt-4">
              <FileUploadZone
                onUpload={(file) => handleUpload(mortgage.id, file)}
                label="העלה דוח משכנתא מהבנק (Excel/CSV)"
                uploading={uploading}
              />
              <UploadResult result={uploadResult} error={uploadError} />
              <p className="text-xs text-gray-400 mt-2">
                הקובץ צריך לכלול עמודות: תאריך, סכום תשלום, קרן, ריבית (ואופציונלי: הצמדה, יתרה)
              </p>
            </div>
          )}

          {/* Payments */}
          {showPaymentForm === mortgage.id && (
            <div className="mt-4 border-t pt-4">
              <PaymentForm mortgageId={mortgage.id} onSave={() => { loadPayments(mortgage.id); onRefresh(); }} />
              {payments[mortgage.id] && payments[mortgage.id].length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-600 mb-2">
                    {payments[mortgage.id].length} תשלומים |
                    סה"כ: {formatCurrency(payments[mortgage.id].reduce((s, p) => s + p.total_amount, 0))}
                  </p>
                  <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="text-gray-500 text-xs bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-right py-2 px-3">תאריך</th>
                          <th className="text-right px-3">סה"כ</th>
                          <th className="text-right px-3">קרן</th>
                          <th className="text-right px-3">ריבית</th>
                          <th className="text-right px-3">הצמדה</th>
                          <th className="text-right px-3">יתרה</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments[mortgage.id].map(p => (
                          <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50">
                            <td className="py-1.5 px-3">{formatDate(p.date)}</td>
                            <td className="px-3 font-medium">{formatCurrency(p.total_amount)}</td>
                            <td className="px-3 text-green-700">{formatCurrency(p.principal)}</td>
                            <td className="px-3 text-red-600">{formatCurrency(p.interest)}</td>
                            <td className="px-3 text-orange-600">{p.cpi_addition ? formatCurrency(p.cpi_addition) : '—'}</td>
                            <td className="px-3 text-gray-500">{p.remaining_balance ? formatCurrency(p.remaining_balance) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
  const [tracks, setTracks] = useState([
    { track_name: 'מסלול 1', track_type: 'prime', original_amount: '', interest_rate: '', is_cpi_linked: false, term_months: '' },
  ]);

  function addTrack() {
    setTracks([...tracks, {
      track_name: `מסלול ${tracks.length + 1}`,
      track_type: 'prime',
      original_amount: '',
      interest_rate: '',
      is_cpi_linked: false,
      term_months: '',
    }]);
  }

  function updateTrack(index: number, field: string, value: any) {
    const updated = [...tracks];
    (updated[index] as any)[field] = value;
    // Auto-set CPI linked based on track type
    if (field === 'track_type') {
      updated[index].is_cpi_linked = value.startsWith('cpi_');
    }
    setTracks(updated);
  }

  function removeTrack(index: number) {
    setTracks(tracks.filter((_, i) => i !== index));
  }

  // Auto-calculate total from tracks
  const tracksTotal = tracks.reduce((s, t) => s + (Number(t.original_amount) || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const totalAmount = Number(form.original_amount) || tracksTotal;
    await createMortgage({
      property_id: propertyId,
      bank_name: form.bank_name,
      original_amount: totalAmount,
      start_date: form.start_date,
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
      <h4 className="font-bold mb-3 text-lg">משכנתא חדשה</h4>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="label">בנק *</label>
          <select className="input-field" value={form.bank_name} onChange={e => setForm({...form, bank_name: e.target.value})} required>
            <option value="">בחר בנק...</option>
            <option value="בנק הפועלים">בנק הפועלים</option>
            <option value="בנק לאומי">בנק לאומי</option>
            <option value="בנק דיסקונט">בנק דיסקונט</option>
            <option value="בנק מזרחי טפחות">בנק מזרחי טפחות</option>
            <option value="בנק הבינלאומי">בנק הבינלאומי</option>
            <option value="בנק ירושלים">בנק ירושלים</option>
            <option value="אחר">אחר</option>
          </select>
        </div>
        <div>
          <label className="label">סכום מקורי *</label>
          <input type="number" className="input-field" placeholder="700,000" value={form.original_amount} onChange={e => setForm({...form, original_amount: e.target.value})} required />
          {tracksTotal > 0 && !form.original_amount && <p className="text-xs text-gray-400 mt-1">סה"כ ממסלולים: {formatCurrency(tracksTotal)}</p>}
        </div>
        <div>
          <label className="label">תאריך התחלה *</label>
          <input type="date" className="input-field" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required />
        </div>
        <div>
          <label className="label">תקופה (חודשים) *</label>
          <input type="number" className="input-field" placeholder="300" value={form.term_months} onChange={e => setForm({...form, term_months: e.target.value})} required />
          {form.term_months && <p className="text-xs text-gray-400 mt-1">{Math.round(Number(form.term_months) / 12)} שנים</p>}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-bold">מסלולי משכנתא ({tracks.length})</p>
          <button type="button" onClick={addTrack} className="text-primary-600 text-sm font-medium hover:text-primary-700">+ הוסף מסלול</button>
        </div>
        <div className="space-y-2">
          {tracks.map((track, i) => (
            <div key={i} className="grid grid-cols-2 md:grid-cols-6 gap-2 p-3 bg-white rounded-lg border border-gray-100">
              <div>
                <label className="label text-xs">שם המסלול</label>
                <input className="input-field text-sm" value={track.track_name} onChange={e => updateTrack(i, 'track_name', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">סוג מסלול</label>
                <select className="input-field text-sm" value={track.track_type} onChange={e => updateTrack(i, 'track_type', e.target.value)}>
                  {Object.entries(TRACK_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">סכום</label>
                <input type="number" className="input-field text-sm" placeholder="0" value={track.original_amount} onChange={e => updateTrack(i, 'original_amount', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">ריבית %</label>
                <input type="number" step="0.01" className="input-field text-sm" placeholder="2.5" value={track.interest_rate} onChange={e => updateTrack(i, 'interest_rate', e.target.value)} />
              </div>
              <div>
                <label className="label text-xs">תקופה (חודשים)</label>
                <input type="number" className="input-field text-sm" placeholder={form.term_months || 'כמו כללי'} value={track.term_months} onChange={e => updateTrack(i, 'term_months', e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-1.5 text-sm py-2">
                  <input type="checkbox" checked={track.is_cpi_linked} onChange={e => updateTrack(i, 'is_cpi_linked', e.target.checked)} className="rounded" />
                  <span className="text-xs">צמוד מדד</span>
                </label>
                {tracks.length > 1 && (
                  <button type="button" onClick={() => removeTrack(i)} className="text-red-400 hover:text-red-600 py-2">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm">שמור משכנתא</button>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">ביטול</button>
      </div>
    </form>
  );
}

function PaymentForm({ mortgageId, onSave }: { mortgageId: number; onSave: () => void }) {
  const [form, setForm] = useState({ date: '', total_amount: '', principal: '', interest: '', cpi_addition: '' });

  // Auto-calculate: if total and interest filled, compute principal
  function handleChange(field: string, value: string) {
    const updated = { ...form, [field]: value };
    const total = Number(updated.total_amount) || 0;
    const interest = Number(updated.interest) || 0;
    const cpi = Number(updated.cpi_addition) || 0;

    if (field === 'total_amount' || field === 'interest' || field === 'cpi_addition') {
      if (total > 0 && interest > 0 && !updated.principal) {
        updated.principal = String(Math.round((total - interest - cpi) * 100) / 100);
      }
    }
    setForm(updated);
  }

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
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end bg-gray-50 p-3 rounded-lg">
      <div><label className="label text-xs">תאריך *</label><input type="date" className="input-field text-sm" value={form.date} onChange={e => handleChange('date', e.target.value)} required /></div>
      <div><label className="label text-xs">סה"כ תשלום *</label><input type="number" step="0.01" className="input-field text-sm w-28" value={form.total_amount} onChange={e => handleChange('total_amount', e.target.value)} required /></div>
      <div><label className="label text-xs">קרן</label><input type="number" step="0.01" className="input-field text-sm w-24" value={form.principal} onChange={e => handleChange('principal', e.target.value)} /></div>
      <div><label className="label text-xs">ריבית</label><input type="number" step="0.01" className="input-field text-sm w-24" value={form.interest} onChange={e => handleChange('interest', e.target.value)} /></div>
      <div><label className="label text-xs">הצמדה</label><input type="number" step="0.01" className="input-field text-sm w-24" value={form.cpi_addition} onChange={e => handleChange('cpi_addition', e.target.value)} /></div>
      <button type="submit" className="btn-primary text-sm">הוסף תשלום</button>
    </form>
  );
}

// === Tenants Section ===
function TenantsSection({ propertyId, tenants, onRefresh }: { propertyId: number; tenants: Tenant[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [showUpload, setShowUpload] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadResult(null);
    setUploadError('');
    try {
      const result = await uploadRentalPayments(propertyId, file);
      setUploadResult(result);
      onRefresh();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">שוכרים</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowUpload(!showUpload)} className="btn-secondary flex items-center gap-1 text-sm">
            <Upload className="w-3.5 h-3.5" />
            ייבא תשלומים
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1 text-sm"><Plus className="w-4 h-4" /> הוסף שוכר</button>
        </div>
      </div>

      {showUpload && (
        <div className="mb-4">
          <FileUploadZone onUpload={handleUpload} label="העלה רשימת תשלומי שכירות (Excel/CSV)" uploading={uploading} />
          <UploadResult result={uploadResult} error={uploadError} />
        </div>
      )}

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
              <button onClick={async () => { if (confirm('בטוח?')) { await deleteTenant(tenant.id); onRefresh(); }}} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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

  if (!show) return <button onClick={() => setShow(true)} className="text-green-600 hover:text-green-700 text-sm font-medium">+ תשלום</button>;

  return (
    <form onSubmit={handleSubmit} className="flex gap-1 items-center">
      <input type="date" className="input-field text-xs w-32" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
      <input type="number" className="input-field text-xs w-20" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
      <button type="submit" className="btn-primary text-xs py-1 px-2">V</button>
      <button type="button" onClick={() => setShow(false)} className="text-gray-400 text-xs">X</button>
    </form>
  );
}

// === Expenses Section ===
function ExpensesSection({ propertyId, expenses, onRefresh }: { propertyId: number; expenses: Expense[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [showUpload, setShowUpload] = useState(false);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadResult(null);
    setUploadError('');
    try {
      const result = await uploadExpenses(propertyId, file);
      setUploadResult(result);
      onRefresh();
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // Group expenses by category for summary
  const byCategory: Record<string, number> = {};
  let totalExpenses = 0;
  for (const e of expenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    totalExpenses += e.amount;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">הוצאות</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowUpload(!showUpload)} className="btn-secondary flex items-center gap-1 text-sm">
            <Upload className="w-3.5 h-3.5" />
            ייבא מאקסל
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1 text-sm"><Plus className="w-4 h-4" /> הוסף הוצאה</button>
        </div>
      </div>

      {showUpload && (
        <div className="mb-4">
          <FileUploadZone onUpload={handleUpload} label="העלה רשימת הוצאות (Excel/CSV)" uploading={uploading} />
          <UploadResult result={uploadResult} error={uploadError} />
        </div>
      )}

      {showForm && <ExpenseForm propertyId={propertyId} onSave={() => { onRefresh(); setShowForm(false); }} onCancel={() => setShowForm(false)} />}

      {/* Summary */}
      {expenses.length > 0 && (
        <div className="card mb-4 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <p className="font-bold">סיכום הוצאות</p>
            <p className="font-bold text-lg text-red-600">{formatCurrency(totalExpenses)}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
              <div key={cat} className="text-sm">
                <span className="text-gray-500">{EXPENSE_CATEGORIES[cat] || cat}: </span>
                <span className="font-medium">{formatCurrency(amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <button onClick={async () => { if (confirm('בטוח?')) { await deleteExpense(expense.id); onRefresh(); }}} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
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

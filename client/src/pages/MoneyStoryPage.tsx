import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getProperties, getSaleCalculation, getMortgageTimeline, uploadBankReport } from '../api';
import { Property } from '../types';
import { formatCurrency, formatPercent, formatMonth } from '../utils/format';
import {
  Home, Landmark, Users, Receipt, HandCoins, Calculator, ChevronDown, ChevronUp,
  AlertCircle, ArrowLeft, Upload, FileSpreadsheet, CheckCircle, TrendingUp,
  TrendingDown, Gauge, DollarSign, Percent, BarChart3,
} from 'lucide-react';
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';

export default function MoneyStoryPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [salePrice, setSalePrice] = useState('1050000');
  const [story, setStory] = useState<any>(null);
  const [timeline, setTimeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Sliders
  const [forecastInflation, setForecastInflation] = useState(2.5);
  const [forecastAppreciation, setForecastAppreciation] = useState(3.0);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bankReportData, setBankReportData] = useState<any>(null);

  // Active view
  const [activeView, setActiveView] = useState<'chart' | 'story'>('chart');

  useEffect(() => {
    getProperties().then(props => {
      setProperties(props);
      if (props.length > 0) {
        setSelectedProperty(props[0].id);
        if (props[0].current_estimated_value) {
          setSalePrice(String(props[0].current_estimated_value));
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Load sale story
  useEffect(() => {
    if (selectedProperty && salePrice) {
      getSaleCalculation(selectedProperty, Number(salePrice))
        .then(s => setStory(s))
        .catch(err => setError(err.message));
    }
  }, [selectedProperty, salePrice]);

  // Load timeline for chart
  const loadTimeline = useCallback(() => {
    if (!selectedProperty) return;
    getMortgageTimeline(
      selectedProperty,
      forecastInflation / 100,
      forecastAppreciation / 100,
      3
    )
      .then(t => setTimeline(t))
      .catch(() => {});
  }, [selectedProperty, forecastInflation, forecastAppreciation]);

  useEffect(() => { loadTimeline(); }, [loadTimeline]);

  // Handle bank report upload
  async function handleBankReportUpload(file: File) {
    if (!selectedProperty) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const result = await uploadBankReport(selectedProperty, file);
      setBankReportData(result.report);
      setUploadMsg({ type: 'success', text: result.message });
      loadTimeline(); // refresh after upload
    } catch (err: any) {
      setUploadMsg({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
    }
  }

  if (!loading && properties.length === 0) {
    return (
      <div className="text-center py-16">
        <Home className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-600 mb-2">אין נכסים עדיין</h3>
        <p className="text-gray-400 mb-6">הוסף נכס והכנס נתונים כדי לראות את הסיפור של הכסף</p>
        <Link to="/" className="btn-primary">עבור לנכסים</Link>
      </div>
    );
  }

  // Prepare chart data
  const chartData = timeline?.timeline
    ? timeline.timeline
        .filter((_: any, i: number) => i % 3 === 0 || i === timeline.timeline.length - 1)
        .map((p: any) => ({
          date: p.date,
          label: formatMonth(p.date),
          equity: p.equity,
          debt: p.mortgageBalance,
          propertyValue: p.propertyValue,
          cpi: p.cpiAccumulated,
          isProjection: p.isProjection,
        }))
    : [];

  // Find the "today" index in chart data
  const todayIdx = chartData.findIndex((d: any) => d.isProjection);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">מרכז הפיקוד - הסיפור של הכסף</h2>
          <p className="text-gray-500 text-sm">ניתוח מלא מרכישה ועד מכירה, עם תחזית עתידית</p>
        </div>
        {properties.length > 1 && (
          <select className="input-field w-auto" value={selectedProperty || ''} onChange={e => setSelectedProperty(Number(e.target.value))}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {/* 3-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* === PANE A: Controller (Left Sidebar) === */}
        <div className="lg:col-span-3 space-y-4">

          {/* Bank Report Upload */}
          <div className="card">
            <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              העלאת דוח יתרות מהבנק
            </h4>
            <BankReportDropzone
              onUpload={handleBankReportUpload}
              uploading={uploading}
            />
            {uploadMsg && (
              <div className={`flex items-center gap-2 p-2 rounded-lg mt-2 text-xs ${
                uploadMsg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {uploadMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                {uploadMsg.text}
              </div>
            )}
            {bankReportData && (
              <div className="mt-2 text-xs space-y-1">
                <p className="font-medium text-gray-700">{bankReportData.bankName || 'בנק'} - {bankReportData.tracks?.length} מסלולים</p>
                <p className="text-gray-500">יתרה: {formatCurrency(bankReportData.totalBalance)}</p>
              </div>
            )}
          </div>

          {/* Sale Price */}
          <div className="card">
            <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-purple-600" />
              מחיר מכירה צפוי
            </h4>
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input-field text-sm flex-1"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
              />
              <span className="text-xs text-gray-500">ש"ח</span>
            </div>
          </div>

          {/* Forecast Sliders */}
          <div className="card">
            <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              תחזית עתידית
            </h4>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">אינפלציה צפויה (שנתי)</span>
                  <span className="font-bold text-orange-600">{forecastInflation.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="8"
                  step="0.5"
                  value={forecastInflation}
                  onChange={e => setForecastInflation(Number(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600">עליית שווי נכס (שנתי)</span>
                  <span className="font-bold text-green-600">{forecastAppreciation.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="-5"
                  max="10"
                  step="0.5"
                  value={forecastAppreciation}
                  onChange={e => setForecastAppreciation(Number(e.target.value))}
                  className="w-full accent-green-500"
                />
              </div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="card p-2">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveView('chart')}
                className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'chart' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <BarChart3 className="w-4 h-4 mx-auto mb-0.5" />
                גרף
              </button>
              <button
                onClick={() => setActiveView('story')}
                className={`flex-1 text-center py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeView === 'story' ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <Receipt className="w-4 h-4 mx-auto mb-0.5" />
                סיפור
              </button>
            </div>
          </div>

          {/* Data source indicator */}
          {timeline && (
            <div className="text-xs text-center text-gray-400">
              מקור נתונים: {
                timeline.dataSource === 'uploaded_report' ? 'דוח בנק (מדויק)' :
                timeline.dataSource === 'payment_history' ? 'היסטוריית תשלומים' :
                'סימולציה'
              }
            </div>
          )}
        </div>

        {/* === PANE B: Visual Story (Center) === */}
        <div className="lg:col-span-6">
          {activeView === 'chart' ? (
            <div className="space-y-4">
              {/* Main Chart */}
              <div className="card">
                <h3 className="font-bold mb-4">הון עצמי מול חוב - לאורך זמן</h3>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={380}>
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        interval={Math.max(0, Math.floor(chartData.length / 8))}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={(v: number) => `${Math.round(v / 1000)}K`}
                        domain={['dataMin - 50000', 'dataMax + 50000']}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        formatter={(value: string) => {
                          const labels: Record<string, string> = {
                            equity: 'הון עצמי',
                            debt: 'יתרת חוב',
                            propertyValue: 'שווי הנכס',
                            cpi: 'עלות הצמדה (מצטבר)',
                          };
                          return labels[value] || value;
                        }}
                      />
                      {/* Property value line */}
                      <Line
                        type="monotone"
                        dataKey="propertyValue"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 5"
                      />
                      {/* Equity area (green) */}
                      <Area
                        type="monotone"
                        dataKey="equity"
                        fill="#dcfce7"
                        stroke="#16a34a"
                        strokeWidth={2}
                        fillOpacity={0.6}
                      />
                      {/* Debt area (red) */}
                      <Area
                        type="monotone"
                        dataKey="debt"
                        fill="#fee2e2"
                        stroke="#dc2626"
                        strokeWidth={2}
                        fillOpacity={0.4}
                      />
                      {/* CPI cost bar */}
                      <Bar
                        dataKey="cpi"
                        fill="#fb923c"
                        opacity={0.4}
                        barSize={4}
                      />
                      {/* Today reference line */}
                      {todayIdx > 0 && (
                        <ReferenceLine
                          x={chartData[todayIdx]?.label}
                          stroke="#6366f1"
                          strokeWidth={2}
                          strokeDasharray="8 4"
                          label={{ value: 'היום', position: 'top', fontSize: 11, fill: '#6366f1' }}
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-gray-400">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>הוסף נתוני משכנתא כדי לראות את הגרף</p>
                  </div>
                )}
              </div>

              {/* CPI Damage Highlight */}
              {timeline && timeline.inflationCostTotal > 0 && (
                <div className="card bg-orange-50 border border-orange-200">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <TrendingDown className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-bold text-orange-800">נזק ההצמדה למדד (אינפלציה)</p>
                      <p className="text-2xl font-bold text-orange-900 my-1">{formatCurrency(timeline.inflationCostTotal)}</p>
                      <p className="text-sm text-orange-700">
                        זה הסכום שהחוב שלך <strong>גדל</strong> בגלל הצמדת חלק מהמשכנתא למדד המחירים לצרכן.
                        כסף שנוסף לחוב במקום לרדת ממנו.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Story view - the expandable chapters */
            <StoryView story={story} salePrice={salePrice} selectedProperty={selectedProperty} error={error} />
          )}
        </div>

        {/* === PANE C: Scorecard (Right) === */}
        <div className="lg:col-span-3 space-y-3">
          {story && (
            <>
              {/* Net Profit / Loss */}
              <div className={`card ${story.bottomLine.totalProfitOrLoss >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                <p className="text-xs text-gray-500 mb-1">רווח/הפסד נקי</p>
                <p className={`text-2xl font-bold ${story.bottomLine.totalProfitOrLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {story.bottomLine.totalProfitOrLoss >= 0 ? '+' : ''}{formatCurrency(story.bottomLine.totalProfitOrLoss)}
                </p>
                <p className="text-xs text-gray-400 mt-1">{story.bottomLine.yearsOwned} שנים</p>
              </div>

              {/* Cash in Hand */}
              <KpiCard
                icon={<HandCoins className="w-4 h-4" />}
                label="כסף ביד (אחרי מכירה)"
                value={formatCurrency(story.sale.cashInHand)}
                color="purple"
              />

              {/* ROI */}
              <KpiCard
                icon={<Percent className="w-4 h-4" />}
                label="תשואה על הון עצמי"
                value={story.bottomLine.downPayment > 0
                  ? formatPercent((story.bottomLine.totalProfitOrLoss / story.bottomLine.downPayment) * 100)
                  : '—'}
                color="blue"
                subtitle="Cash-on-Cash"
              />

              {/* Monthly Cost */}
              <KpiCard
                icon={<DollarSign className="w-4 h-4" />}
                label="עלות חודשית נטו"
                value={`${formatCurrency(Math.abs(story.bottomLine.netMonthlyCostAvg))}/חודש`}
                color={story.bottomLine.netMonthlyCostAvg > 0 ? 'red' : 'green'}
                subtitle={story.bottomLine.netMonthlyCostAvg > 0 ? 'הוצאה' : 'הכנסה'}
              />

              {/* Inflation Cost */}
              {timeline && (
                <KpiCard
                  icon={<TrendingDown className="w-4 h-4" />}
                  label="עלות הצמדה למדד"
                  value={formatCurrency(timeline.inflationCostTotal)}
                  color="orange"
                  subtitle="הפסד מאינפלציה"
                />
              )}

              {/* Interest + CPI total */}
              <KpiCard
                icon={<Landmark className="w-4 h-4" />}
                label="ריבית + הצמדה ששולמו"
                value={formatCurrency(story.bottomLine.totalInterestAndCpi)}
                color="red"
                subtitle="כסף שהלך לבנק"
              />

              {/* Rental */}
              <KpiCard
                icon={<Users className="w-4 h-4" />}
                label="שכירות שהתקבלה"
                value={formatCurrency(story.bottomLine.totalRentalReceived)}
                color="green"
              />

              {/* Down Payment */}
              <KpiCard
                icon={<Home className="w-4 h-4" />}
                label="הון עצמי (מקדמה)"
                value={formatCurrency(story.bottomLine.downPayment)}
                color="gray"
              />

              {/* Link to property */}
              <Link
                to={`/property/${selectedProperty}`}
                className="block text-center text-sm text-primary-600 hover:text-primary-700 font-medium py-2"
              >
                עבור לדף הנכס
                <ArrowLeft className="w-3.5 h-3.5 inline mr-1" />
              </Link>
            </>
          )}

          {!story && !loading && (
            <div className="card text-center py-8">
              <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">הוסף נתונים כדי לראות את הניתוח</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// === Bank Report Dropzone ===
function BankReportDropzone({ onUpload, uploading }: { onUpload: (file: File) => void; uploading: boolean }) {
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
      className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
        dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
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
        accept=".xlsx,.xls,.csv"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
      />
      {uploading ? (
        <div className="flex flex-col items-center gap-1">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          <p className="text-xs text-gray-500">מעבד...</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1">
          <FileSpreadsheet className="w-8 h-8 text-gray-400" />
          <p className="text-xs font-medium text-gray-600">גרור לכאן דוח יתרות משכנתא</p>
          <p className="text-xs text-gray-400">Excel / CSV</p>
        </div>
      )}
    </div>
  );
}

// === KPI Card ===
function KpiCard({ icon, label, value, color, subtitle }: {
  icon: React.ReactNode; label: string; value: string; color: string; subtitle?: string;
}) {
  const colors: Record<string, string> = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    orange: 'text-orange-600',
    gray: 'text-gray-600',
  };

  return (
    <div className="card py-3">
      <div className="flex items-center gap-2 mb-1">
        <span className={colors[color] || 'text-gray-600'}>{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`font-bold text-lg ${colors[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
  );
}

// === Custom Chart Tooltip ===
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white shadow-lg rounded-lg p-3 border text-sm" dir="rtl">
      <p className="font-bold text-gray-700 mb-2">{label}</p>
      {payload.map((entry: any, i: number) => {
        const labels: Record<string, string> = {
          equity: 'הון עצמי',
          debt: 'יתרת חוב',
          propertyValue: 'שווי הנכס',
          cpi: 'עלות הצמדה',
        };
        const colors: Record<string, string> = {
          equity: 'text-green-600',
          debt: 'text-red-600',
          propertyValue: 'text-purple-600',
          cpi: 'text-orange-600',
        };
        return (
          <div key={i} className="flex justify-between gap-4">
            <span className="text-gray-500">{labels[entry.dataKey] || entry.dataKey}</span>
            <span className={`font-medium ${colors[entry.dataKey] || ''}`}>{formatCurrency(entry.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

// === Story View (the chapters - kept from original) ===
function StoryView({ story, salePrice, selectedProperty, error }: {
  story: any; salePrice: string; selectedProperty: number | null; error: string;
}) {
  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <AlertCircle className="w-5 h-5 text-yellow-600" />
        <div>
          <p className="text-sm text-yellow-800">הוסף נתונים בדף הנכס כדי לראות את הסיפור המלא</p>
          <Link to={`/property/${selectedProperty}`} className="text-sm text-blue-600 font-medium">עבור לנכס</Link>
        </div>
      </div>
    );
  }

  if (!story) return <div className="text-center py-8 text-gray-400">טוען...</div>;

  return (
    <div className="space-y-4">
      {/* Chapter 1: The Purchase */}
      <StoryChapter number={1} title="הרכישה" icon={<Home className="w-5 h-5" />} color="blue"
        summary={`קנית את הדירה ב-${formatCurrency(story.purchase.propertyPrice)}`}>
        <StoryRow label="מחיר הדירה" value={formatCurrency(story.purchase.propertyPrice)} />
        {story.purchase.hasDetailedCosts ? (
          <>
            <p className="text-xs font-medium text-gray-500 mt-3 mb-1">עלויות רכישה (פירוט):</p>
            <div className="mr-4 space-y-1">
              {story.purchase.detailedCosts.map((cost: any, i: number) => (
                <StoryRow key={i} label={cost.categoryLabel + (cost.description ? ` (${cost.description})` : '')} value={formatCurrency(cost.amount)} />
              ))}
            </div>
            <div className="mt-2">
              <StoryRow label='סה"כ עלויות נלוות' value={formatCurrency(story.purchase.additionalCosts)} bold />
            </div>
          </>
        ) : (
          <StoryRow label='עלויות נוספות (עו"ד, מס, תיווך, שיפוץ)' value={formatCurrency(story.purchase.additionalCosts)} />
        )}
        <StoryRow label='סה"כ עלות רכישה' value={formatCurrency(story.purchase.totalPurchaseCost)} bold />
        <div className="mt-3 pt-3 border-t border-gray-100">
          <StoryRow label="משכנתא שלקחת" value={formatCurrency(story.purchase.mortgageAmount)} />
          <StoryRow label="הון עצמי (מכיס)" value={formatCurrency(story.purchase.downPayment)} bold color="red" />
        </div>
      </StoryChapter>

      {/* Chapter 2: The Mortgage */}
      <StoryChapter number={2} title="המשכנתא" icon={<Landmark className="w-5 h-5" />} color="red"
        summary={`שילמת ${formatCurrency(story.mortgage.totalPaid)} ב-${story.bottomLine.monthsOwned} חודשים`}>
        <StoryRow label='סה"כ תשלומי משכנתא' value={formatCurrency(story.mortgage.totalPaid)} bold />
        <div className="mt-2 mr-4 space-y-1">
          <StoryRow label="מתוכם קרן (הצטמצם מהחוב)" value={formatCurrency(story.mortgage.principalPaid)} color="green" />
          <StoryRow label="מתוכם ריבית (הלך לבנק)" value={formatCurrency(story.mortgage.interestPaid)} color="red" />
          {story.mortgage.cpiPaid > 0 && (
            <StoryRow label="מתוכם הצמדה למדד" value={formatCurrency(story.mortgage.cpiPaid)} color="orange" />
          )}
        </div>
        {story.mortgage.interestPercentage > 0 && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg">
            <p className="text-sm text-red-800">
              <strong>{story.mortgage.interestPercentage}%</strong> מכל שקל ששילמת הלך <strong>לריבית</strong> - לא הצטמצם מהחוב.
            </p>
          </div>
        )}
        <StoryRow label="תשלום חודשי ממוצע" value={formatCurrency(story.mortgage.monthlyAverage)} />
        <StoryRow label="יתרת משכנתא" value={formatCurrency(story.mortgage.remainingBalance)} bold color="orange" />
      </StoryChapter>

      {/* Chapter 3: Rental Income */}
      <StoryChapter number={3} title="הכנסות משכירות" icon={<Users className="w-5 h-5" />} color="green"
        summary={`קיבלת ${formatCurrency(story.rental.totalIncome)} שכירות`}>
        <StoryRow label='סה"כ שכירות' value={formatCurrency(story.rental.totalIncome)} bold color="green" />
        <StoryRow label="שכירות חודשית ממוצעת" value={formatCurrency(story.rental.averageMonthlyRent)} />
        <StoryRow label="שיעור תפוסה" value={formatPercent(story.rental.occupancyRate * 100)} />
        {story.rental.vacantMonths > 0 && (
          <div className="mt-2 p-3 bg-yellow-50 rounded-lg">
            <p className="text-sm text-yellow-800">
              הדירה עמדה ריקה <strong>{story.rental.vacantMonths} חודשים</strong> -
              הפסדת כ-<strong>{formatCurrency(story.rental.lostRentFromVacancy)}</strong>
            </p>
          </div>
        )}
      </StoryChapter>

      {/* Chapter 4: Expenses */}
      <StoryChapter number={4} title="הוצאות תפעול" icon={<Receipt className="w-5 h-5" />} color="orange"
        summary={story.expenses.total > 0 ? `${formatCurrency(story.expenses.total)} הוצאות` : 'לא הוזנו הוצאות'}>
        {story.expenses.total > 0 ? (
          <>
            <StoryRow label='סה"כ הוצאות' value={formatCurrency(story.expenses.total)} bold color="red" />
            <StoryRow label="ממוצע חודשי" value={formatCurrency(story.expenses.monthlyAverage)} />
            {Object.keys(story.expenses.byCategory).length > 0 && (
              <div className="mt-2 mr-4 space-y-1">
                {Object.entries(story.expenses.byCategory as Record<string, number>)
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, amount]) => (
                    <StoryRow key={cat} label={categoryLabel(cat)} value={formatCurrency(amount)} />
                  ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-500">לא הוזנו הוצאות. הוסף בדף הנכס (ועד בית, ביטוח, ארנונה...)</p>
        )}
      </StoryChapter>

      {/* Chapter 5: The Sale */}
      <StoryChapter number={5} title="אם תמכור" icon={<HandCoins className="w-5 h-5" />} color="purple"
        summary={`תקבל ליד ${formatCurrency(story.sale.cashInHand)} אחרי הכל`} defaultOpen>
        <StoryRow label="מחיר מכירה" value={formatCurrency(story.sale.salePrice)} bold />
        <p className="text-xs text-gray-500 font-medium mt-3 mb-1">עלויות מכירה:</p>
        <div className="mr-4 space-y-1">
          <StoryRow label="עמלת מתווך (2%)" value={`-${formatCurrency(story.sale.agentFee)}`} color="red" />
          <StoryRow label='עו"ד' value={`-${formatCurrency(story.sale.lawyerFee)}`} color="red" />
          {story.sale.capitalGainsTax > 0 && (
            <StoryRow label={story.sale.masShevach?.isSingleExempt ? 'מס שבח (פטור דירה יחידה)' : 'מס שבח'} value={`-${formatCurrency(story.sale.capitalGainsTax)}`} color="red" />
          )}
        </div>
        {story.sale.masShevach && story.sale.capitalGainsTax > 0 && (
          <div className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-xs font-medium text-orange-800 mb-2">פירוט מס שבח (חישוב ליניארי):</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-600">רווח נומינלי</span><span>{formatCurrency(story.sale.masShevach.nominalProfit)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">רווח ריאלי (אחרי מדד)</span><span>{formatCurrency(story.sale.masShevach.realProfit)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">רווח חייב במס</span><span>{formatCurrency(story.sale.masShevach.taxableProfit)}</span></div>
              {story.sale.masShevach.linearExemptPortion > 0 && (
                <div className="flex justify-between"><span className="text-gray-600">חלק פטור (לפני 2014)</span><span>{formatPercent(story.sale.masShevach.linearExemptPortion * 100)}</span></div>
              )}
              <div className="flex justify-between font-medium text-orange-900"><span>מס שבח סופי</span><span>{formatCurrency(story.sale.masShevach.taxAmount)}</span></div>
            </div>
          </div>
        )}
        <StoryRow label="נטו ממכירה" value={formatCurrency(story.sale.netFromSale)} />
        <StoryRow label="פירעון יתרת משכנתא" value={`-${formatCurrency(story.sale.mortgagePayoff)}`} color="red" />
        <div className="mt-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-sm text-purple-700 mb-1">מה נשאר ביד אחרי מכירה ופירעון משכנתא:</p>
          <p className="text-2xl font-bold text-purple-900">{formatCurrency(story.sale.cashInHand)}</p>
        </div>
      </StoryChapter>

      {/* Chapter 6: Bottom Line */}
      <div className="card bg-gray-900 text-white">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-white text-gray-900 flex items-center justify-center text-sm font-bold">6</span>
          השורה התחתונה
        </h3>
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-gray-800">
            <p className="text-gray-400 text-sm mb-1">כמה הוצאת מכיס:</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-400">הון עצמי (מקדמה)</span><span>{formatCurrency(story.bottomLine.downPayment)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">ריבית + הצמדה</span><span>{formatCurrency(story.bottomLine.totalInterestAndCpi)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">הוצאות</span><span>{formatCurrency(story.bottomLine.totalExpenses)}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">שכירות</span><span className="text-green-400">+{formatCurrency(story.bottomLine.totalRentalReceived)}</span></div>
            </div>
          </div>
          <div className={`p-6 rounded-lg ${story.bottomLine.totalProfitOrLoss >= 0 ? 'bg-green-900' : 'bg-red-900'}`}>
            <p className="text-sm mb-2 opacity-80">רווח/הפסד כולל ({story.bottomLine.yearsOwned} שנים):</p>
            <p className="text-4xl font-bold">
              {story.bottomLine.totalProfitOrLoss >= 0 ? '+' : ''}{formatCurrency(story.bottomLine.totalProfitOrLoss)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Shared Components ===
function StoryChapter({ number, title, icon, color, summary, children, defaultOpen }: {
  number: number; title: string; icon: React.ReactNode; color: string; summary: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || false);
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
    orange: 'bg-orange-100 text-orange-700',
    purple: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="card">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 text-right">
        <span className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${colorMap[color]}`}>{number}</span>
        <div className={`p-2 rounded-lg ${colorMap[color]} bg-opacity-30`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg">{title}</h3>
          <p className="text-sm text-gray-500">{summary}</p>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />}
      </button>
      {open && <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">{children}</div>}
    </div>
  );
}

function StoryRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  const colorClass = color === 'red' ? 'text-red-600' : color === 'green' ? 'text-green-600' : color === 'orange' ? 'text-orange-600' : '';
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</span>
      <span className={`${bold ? 'font-bold text-lg' : 'font-medium'} ${colorClass}`}>{value}</span>
    </div>
  );
}

function categoryLabel(key: string): string {
  const map: Record<string, string> = { maintenance: 'תחזוקה', tax: 'מיסים', insurance: 'ביטוח', management: 'ניהול', renovation: 'שיפוץ', legal: 'עו"ד', committee: 'ועד בית', other: 'אחר' };
  return map[key] || key;
}

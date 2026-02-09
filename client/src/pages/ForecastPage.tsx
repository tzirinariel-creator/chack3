import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { getProperties, getForecasts } from '../api';
import { Property, ForecastScenario } from '../types';
import { formatCurrency } from '../utils/format';

const SCENARIO_COLORS = ['#ef4444', '#f59e0b', '#10b981'];

export default function ForecastPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<number | null>(null);
  const [forecasts, setForecasts] = useState<ForecastScenario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProperties().then(props => {
      setProperties(props);
      if (props.length > 0) setSelectedProperty(props[0].id);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      setLoading(true);
      getForecasts(selectedProperty).then(f => {
        setForecasts(f);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [selectedProperty]);

  if (loading && forecasts.length === 0) return <div className="text-center py-12 text-gray-500">טוען...</div>;
  if (properties.length === 0) return <div className="text-center py-12 text-gray-400">הוסף נכס קודם כדי לראות תחזיות</div>;

  // Build chart data for property value comparison
  const valueChartData = forecasts.length > 0 ? forecasts[0].projections.map((_, i) => {
    const point: any = { year: `שנה ${forecasts[0].projections[i].year}` };
    forecasts.forEach((scenario, si) => {
      point[scenario.name] = scenario.projections[i].propertyValue;
    });
    return point;
  }) : [];

  // Build chart data for cumulative profit
  const profitChartData = forecasts.length > 0 ? forecasts[0].projections.map((_, i) => {
    const point: any = { year: `שנה ${forecasts[0].projections[i].year}` };
    forecasts.forEach((scenario) => {
      point[scenario.name] = scenario.projections[i].cumulativeProfit;
    });
    return point;
  }) : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">תחזיות</h2>
        {properties.length > 1 && (
          <select className="input-field w-auto" value={selectedProperty || ''} onChange={e => setSelectedProperty(Number(e.target.value))}>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </div>

      {forecasts.length > 0 && (
        <>
          {/* Property Value Forecast */}
          <div className="card mb-6">
            <h3 className="font-bold mb-4 text-lg">תחזית ערך הנכס</h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={valueChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                {forecasts.map((scenario, i) => (
                  <Line key={scenario.name} type="monotone" dataKey={scenario.name} stroke={SCENARIO_COLORS[i]} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cumulative Profit Forecast */}
          <div className="card mb-6">
            <h3 className="font-bold mb-4 text-lg">תחזית רווח מצטבר</h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={profitChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                {forecasts.map((scenario, i) => (
                  <Line key={scenario.name} type="monotone" dataKey={scenario.name} stroke={SCENARIO_COLORS[i]} strokeWidth={2} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Scenario Tables */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {forecasts.map((scenario, i) => (
              <div key={scenario.name} className="card">
                <h4 className="font-bold mb-1" style={{ color: SCENARIO_COLORS[i] }}>{scenario.name}</h4>
                <p className="text-xs text-gray-500 mb-3">{scenario.description}</p>
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-400"><tr><th className="text-right">שנה</th><th className="text-right">ערך</th><th className="text-right">רווח מצטבר</th><th className="text-right">תזרים שנתי</th></tr></thead>
                  <tbody>
                    {scenario.projections.map(p => (
                      <tr key={p.year} className="border-t border-gray-50">
                        <td className="py-1">{p.year}</td>
                        <td>{formatCurrency(p.propertyValue)}</td>
                        <td className={p.cumulativeProfit >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(p.cumulativeProfit)}</td>
                        <td className={p.annualCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}>{formatCurrency(p.annualCashFlow)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// Properties
export const getProperties = () => request<any[]>('/properties');
export const getProperty = (id: number) => request<any>(`/properties/${id}`);
export const createProperty = (data: any) => request<any>('/properties', { method: 'POST', body: JSON.stringify(data) });
export const updateProperty = (id: number, data: any) => request<any>(`/properties/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProperty = (id: number) => request<any>(`/properties/${id}`, { method: 'DELETE' });

// Mortgages
export const getMortgages = (propertyId: number) => request<any[]>(`/mortgages/property/${propertyId}`);
export const createMortgage = (data: any) => request<any>('/mortgages', { method: 'POST', body: JSON.stringify(data) });
export const deleteMortgage = (id: number) => request<any>(`/mortgages/${id}`, { method: 'DELETE' });
export const addMortgagePayment = (mortgageId: number, data: any) => request<any>(`/mortgages/${mortgageId}/payments`, { method: 'POST', body: JSON.stringify(data) });
export const addMortgagePaymentsBulk = (mortgageId: number, payments: any[]) => request<any>(`/mortgages/${mortgageId}/payments/bulk`, { method: 'POST', body: JSON.stringify({ payments }) });
export const getMortgagePayments = (mortgageId: number) => request<any[]>(`/mortgages/${mortgageId}/payments`);
export const addRateChange = (trackId: number, data: any) => request<any>(`/mortgages/tracks/${trackId}/rate-change`, { method: 'POST', body: JSON.stringify(data) });

// Tenants
export const getTenants = (propertyId: number) => request<any[]>(`/tenants/property/${propertyId}`);
export const createTenant = (data: any) => request<any>('/tenants', { method: 'POST', body: JSON.stringify(data) });
export const updateTenant = (id: number, data: any) => request<any>(`/tenants/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTenant = (id: number) => request<any>(`/tenants/${id}`, { method: 'DELETE' });
export const addRentalPayment = (tenantId: number, data: any) => request<any>(`/tenants/${tenantId}/payments`, { method: 'POST', body: JSON.stringify(data) });
export const getRentalPayments = (propertyId: number) => request<any[]>(`/tenants/payments/property/${propertyId}`);

// Expenses
export const getExpenses = (propertyId: number) => request<any[]>(`/expenses/property/${propertyId}`);
export const createExpense = (data: any) => request<any>('/expenses', { method: 'POST', body: JSON.stringify(data) });
export const updateExpense = (id: number, data: any) => request<any>(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteExpense = (id: number) => request<any>(`/expenses/${id}`, { method: 'DELETE' });

// Analytics
export const getInvestmentSummary = (propertyId: number) => request<any>(`/analytics/summary/${propertyId}`);
export const getForecasts = (propertyId: number) => request<any[]>(`/analytics/forecast/${propertyId}`);
export const getRecommendations = (propertyId: number) => request<any[]>(`/analytics/recommendations/${propertyId}`);
export const getCompleteAnalysis = (propertyId: number) => request<any>(`/analytics/complete/${propertyId}`);

// Sale Calculator
export const getSaleCalculation = (propertyId: number, salePrice: number) =>
  request<any>(`/sale/${propertyId}?price=${salePrice}`);

// Purchase & Sale Costs
export const getPurchaseCosts = (propertyId: number) => request<any[]>(`/costs/purchase/${propertyId}`);
export const addPurchaseCost = (data: any) => request<any>('/costs/purchase', { method: 'POST', body: JSON.stringify(data) });
export const deletePurchaseCost = (id: number) => request<any>(`/costs/purchase/${id}`, { method: 'DELETE' });
export const getSaleCosts = (propertyId: number) => request<any[]>(`/costs/sale/${propertyId}`);
export const addSaleCost = (data: any) => request<any>('/costs/sale', { method: 'POST', body: JSON.stringify(data) });
export const deleteSaleCost = (id: number) => request<any>(`/costs/sale/${id}`, { method: 'DELETE' });

// File Upload
export async function uploadMortgageReport(mortgageId: number, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/upload/mortgage-report/${mortgageId}`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בהעלאת הקובץ');
  return data;
}

export async function uploadExpenses(propertyId: number, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/upload/expenses/${propertyId}`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בהעלאת הקובץ');
  return data;
}

export async function uploadRentalPayments(propertyId: number, file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${BASE}/upload/rental-payments/${propertyId}`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'שגיאה בהעלאת הקובץ');
  return data;
}

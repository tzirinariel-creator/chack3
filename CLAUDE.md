# CLAUDE.md - Architectural & Project Directives for Israeli Real Estate Analytics Platform

## 1. Role and Persona
You are an Elite FinTech Architect and Full-Stack Developer (Node.js/React). You are building a complex, mathematically precise real estate financial analytics application specifically engineered for the Israeli real estate market.

## 2. Core Methodologies and Environment Protocols
- **Plan-Act-Reflect**: Before modifying or creating files, outline a detailed implementation plan, noting exactly what libraries will be used and which files will be touched.
- **Context Compaction & Memory**: If the context window is filling up, save state and critical domain knowledge.
- **TDD First**: Employ Test-Driven Development. Create robust test suites for all financial mathematical logic BEFORE implementing the actual code.
- **Node.js Constraints**: Do not block the event loop. Separate business logic from presentation logic. Do not output raw error traces to the client.

## 3. Project Architecture
- **Monorepo**: Root workspace with `client/` and `server/` packages
- **Server**: Express + TypeScript + SQLite (better-sqlite3) on port 3001
- **Client**: React 18 + TypeScript + Vite + Tailwind CSS + Recharts on port 5173
- **Language**: Hebrew (RTL) with `lang="he" dir="rtl"`
- **Database**: SQLite with WAL mode, foreign keys enabled

### Key Files
- `server/src/database.ts` - Schema definitions
- `server/src/services/calculator.ts` - Investment summary calculations
- `server/src/services/forecaster.ts` - Forecast and recommendation engine
- `server/src/services/tax-engine.ts` - Israeli tax calculations (Mas Shevach, Mas Rechisha)
- `server/src/routes/` - API endpoints (properties, mortgages, tenants, expenses, analytics, upload, sale)
- `client/src/pages/MoneyStoryPage.tsx` - The core "story of your money" interactive narrative
- `client/src/pages/PropertyDetailPage.tsx` - Property management with file upload

## 4. Israeli Financial Logic & Domain Constraints
Precision is critical. All financial calculations must handle Israeli-specific rules:

### Mas Shevach (Capital Gains Tax - מס שבח)
- Standard rate: 25% on REAL GAIN (profit after CPI indexing purchase price and deductible expenses)
- **Linear Calculation Method (חישוב ליניארי)**: Appreciated gain attributed to period prior to January 1, 2014 is tax-exempt. Gain after this date is taxed at 25%.
- Exemptions for "Single Apartment" residents (limit ~5M NIS)
- Deductions: 50% Betterment Levy (היטל השבחה), legal fees, purchase tax, improvements

### Mas Rechisha (Purchase Tax - מס רכישה) - Tiered System
- **Single Property (Israeli Resident)**: 0% up to ~1.94M, then progressively 3.5%, 5%, 8%
- **Investment / Foreign Resident**: Starting rate of 8% up to ~6M, then 10%

### Mortgage Mathematics (CPI-Linked)
- Implement amortization for "Fixed rate, CPI-indexed" mortgages
- Monthly principal balance INCREASES proportionately with assumed inflation rate before monthly payment is deducted
- Support track types: Prime (פריים), Fixed (קבועה), Variable (משתנה), CPI-Fixed (קבועה צמודה), CPI-Variable (משתנה צמודה)

## 5. Purchase Cost Categories (עלויות רכישה)
The system tracks detailed purchase costs by category:
- `purchase_price` - מחיר הדירה
- `agent_buy` - תיווך קנייה
- `lawyer_buy` - עו"ד רכישה
- `purchase_tax` - מס רכישה
- `renovation` - שיפוץ / סטיילינג
- `appraisal` - שמאות
- `mortgage_file` - פתיחת תיק משכנתא / יועץ
- `ownership_transfer` - העברת בעלות / רישום
- `other_purchase` - אחר

## 6. Sale Cost Categories (עלויות מכירה)
- `agent_sell` - תיווך מכירה
- `lawyer_sell` - עו"ד מכירה
- `mortgage_advisor` - יועץ משכנתאות
- `capital_gains_tax` - מס שבח (calculated)
- `betterment_levy` - היטל השבחה
- `other_sale` - אחר

## 7. Frontend Design Constraints
- **Framework**: React + Tailwind CSS
- **Language**: Full Hebrew RTL
- **Key UX**: Interactive "Money Story" narrative - step by step explanation of where money went
- **Charts**: Recharts for data visualization
- **File Upload**: Drag-and-drop Excel/CSV import for mortgage reports, expenses
- **Typography**: Clear number formatting with Israeli Shekel (₪) currency

## 8. Running the Project
```bash
npm install          # Install all dependencies
npm run dev          # Start both client and server
# Client: http://localhost:5173
# Server: http://localhost:3001
```

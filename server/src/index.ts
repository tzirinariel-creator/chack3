import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import propertiesRouter from './routes/properties';
import mortgagesRouter from './routes/mortgages';
import tenantsRouter from './routes/tenants';
import expensesRouter from './routes/expenses';
import analyticsRouter from './routes/analytics';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize database
initDatabase();

// Routes
app.use('/api/properties', propertiesRouter);
app.use('/api/mortgages', mortgagesRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/analytics', analyticsRouter);

app.listen(PORT, () => {
  console.log(`Chack3 server running on port ${PORT}`);
});

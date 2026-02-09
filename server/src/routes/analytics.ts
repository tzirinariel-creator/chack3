import { Router } from 'express';
import { calculateInvestmentSummary } from '../services/calculator';
import { generateForecasts, generateRecommendations } from '../services/forecaster';

const router = Router();

// Get full investment analysis for a property
router.get('/summary/:propertyId', (req, res) => {
  try {
    const summary = calculateInvestmentSummary(Number(req.params.propertyId));
    res.json(summary);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Get forecasts for a property
router.get('/forecast/:propertyId', (req, res) => {
  try {
    const summary = calculateInvestmentSummary(Number(req.params.propertyId));
    const forecasts = generateForecasts(summary);
    res.json(forecasts);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Get recommendations for a property
router.get('/recommendations/:propertyId', (req, res) => {
  try {
    const summary = calculateInvestmentSummary(Number(req.params.propertyId));
    const recommendations = generateRecommendations(summary);
    res.json(recommendations);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Get complete analysis (summary + forecasts + recommendations)
router.get('/complete/:propertyId', (req, res) => {
  try {
    const summary = calculateInvestmentSummary(Number(req.params.propertyId));
    const forecasts = generateForecasts(summary);
    const recommendations = generateRecommendations(summary);
    res.json({ summary, forecasts, recommendations });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { config } from '../config';
import axios from 'axios';

const router = Router();

const analyticsUrl = config.analyticsUrl;

// Get all BRICS country nodes
router.get('/nodes', async (_req: Request, res: Response) => {
  try {
    const response = await axios.get(`${analyticsUrl}/federated/nodes`);
    res.json(response.data);
  } catch (error: any) {
    console.error('[Federated] Error fetching nodes:', error.message);
    res.status(500).json({ error: 'Failed to fetch country nodes' });
  }
});

// Train local model for a specific country
router.post('/train-local', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${analyticsUrl}/federated/train-local`, req.body);
    res.json(response.data);
  } catch (error: any) {
    console.error('[Federated] Error training local model:', error.message);
    res.status(500).json({ error: 'Failed to train local model' });
  }
});

// Aggregate local model updates into global model
router.post('/aggregate', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${analyticsUrl}/federated/aggregate`, req.body);
    res.json(response.data);
  } catch (error: any) {
    console.error('[Federated] Error aggregating models:', error.message);
    res.status(500).json({ error: 'Failed to aggregate models' });
  }
});

// Make prediction using global or local model
router.post('/predict', async (req: Request, res: Response) => {
  try {
    const response = await axios.post(`${analyticsUrl}/federated/predict`, req.body);
    res.json(response.data);
  } catch (error: any) {
    console.error('[Federated] Error making prediction:', error.message);
    res.status(500).json({ error: 'Failed to make prediction' });
  }
});

// Get federated learning status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const response = await axios.get(`${analyticsUrl}/federated/status`);
    res.json(response.data);
  } catch (error: any) {
    console.error('[Federated] Error fetching status:', error.message);
    res.status(500).json({ error: 'Failed to fetch federated status' });
  }
});

export default router;

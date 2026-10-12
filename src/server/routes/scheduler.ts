import { Hono } from 'hono';
import { runBackfillJob, type BackfillResult } from '../scheduler/backfill.js';
import {
  runReconcileJob,
  type ReconcileResult,
} from '../scheduler/reconcile.js';

export const scheduler = new Hono();

scheduler.post('/backfill', async (c) => {
  try {
    const result: BackfillResult = await runBackfillJob();
    return c.json(result, 200);
  } catch (error) {
    console.error(`Backfill job error: ${error}`);
    return c.json({ status: 'error', message: 'Backfill job failed' }, 500);
  }
});

scheduler.post('/reconcile', async (c) => {
  try {
    const result: ReconcileResult = await runReconcileJob();
    return c.json(result, 200);
  } catch (error) {
    console.error(`Reconcile job error: ${error}`);
    return c.json({ status: 'error', message: 'Reconcile job failed' }, 500);
  }
});

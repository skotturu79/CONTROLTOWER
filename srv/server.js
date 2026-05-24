'use strict';

require('express-async-errors');
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { v4: uuid } = require('uuid');

const { THREATS, FLOW, DC_STATUS } = require('../mock-data/threats');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── In-memory state (Phase 1 prototype; Phase 2 writes back to SAP) ──────────
let threatState  = JSON.parse(JSON.stringify(THREATS)); // deep copy
let dispatchLog  = [];

function resetCountdowns() {
  // Refresh from source so the demo restarts cleanly
  threatState = JSON.parse(JSON.stringify(THREATS));
}

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'app')));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── API: DC status ────────────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  const critCount  = threatState.filter(t => t.severity === 'crit'  && !t.dispatched).length;
  const warnCount  = threatState.filter(t => t.severity === 'warn'  && !t.dispatched).length;
  const watchCount = threatState.filter(t => t.severity === 'watch' && !t.dispatched).length;
  res.json({
    ...DC_STATUS,
    timestamp: new Date().toISOString(),
    overallStatus: critCount > 0 ? 'critical' : warnCount > 0 ? 'elevated' : 'green',
    threatSummary: { crit: critCount, warn: warnCount, watch: watchCount },
  });
});

// ── API: Flow strip ───────────────────────────────────────────────────────────
app.get('/api/flow', (_req, res) => res.json(FLOW));

// ── API: Threats (ranked queue) ───────────────────────────────────────────────
const SEV_ORDER = { crit: 0, warn: 1, watch: 2 };

app.get('/api/threats', (_req, res) => {
  const ranked = [...threatState].sort((a, b) => {
    if (a.dispatched !== b.dispatched) return a.dispatched ? 1 : -1;
    return SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
  });
  // Return summary fields only (no full causal path)
  res.json(ranked.map(t => ({
    id:                t.id,
    severity:          t.severity,
    title:             t.title,
    exposure:          t.exposure,
    secondsToDeadline: t.secondsToDeadline,
    deadlineLabel:     t.deadlineLabel,
    confidence:        t.confidence,
    dispatched:        !!t.dispatched,
  })));
});

// ── API: Threat detail ────────────────────────────────────────────────────────
app.get('/api/threats/:id', (req, res) => {
  const t = threatState.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Threat not found' });
  res.json(t);
});

// ── API: Dispatch action (Phase 1 mock — no real SAP write-back yet) ──────────
app.post('/api/threats/:id/dispatch', (req, res) => {
  const t = threatState.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Threat not found' });
  if (t.dispatched) return res.status(409).json({ error: 'Already dispatched' });

  const entry = {
    dispatchId:    uuid(),
    threatId:      t.id,
    threatTitle:   t.title,
    action:        req.body.alternativeIndex != null
                     ? t.alternatives[req.body.alternativeIndex]?.name ?? t.recommendation.name
                     : t.recommendation.name,
    dispatchedAt:  new Date().toISOString(),
    approvedBy:    req.body.approvedBy ?? 'system',
    // Phase 2: here we would POST to the SAP OData API
    sapWriteBack:  { status: 'pending', message: 'Phase 2 — write-back not yet implemented' },
  };

  t.dispatched = true;
  t.dispatchEntry = entry;
  dispatchLog.push(entry);

  res.status(201).json(entry);
});

// ── API: Snooze ───────────────────────────────────────────────────────────────
app.post('/api/threats/:id/snooze', (req, res) => {
  const t = threatState.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Threat not found' });
  t.snoozedUntil = new Date(Date.now() + (req.body.minutes ?? 15) * 60_000).toISOString();
  res.json({ threatId: t.id, snoozedUntil: t.snoozedUntil });
});

// ── API: Dispatch log ─────────────────────────────────────────────────────────
app.get('/api/dispatch-log', (_req, res) => res.json(dispatchLog));

// ── Demo: reset state ─────────────────────────────────────────────────────────
app.post('/api/demo/reset', (_req, res) => {
  resetCountdowns();
  dispatchLog = [];
  res.json({ reset: true });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n  Warehouse Control Tower`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  UI   → http://localhost:${PORT}`);
  console.log(`  API  → http://localhost:${PORT}/api/threats`);
  console.log(`  Mode → Phase 1 (read-only, mock data)\n`);
});

module.exports = app;

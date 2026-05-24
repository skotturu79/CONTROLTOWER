'use strict';

/**
 * Mock threat data for Phase 1 (read-only prototype).
 * In production these are derived by the dependency-graph engine
 * from live SAP S/4HANA events + OData reads.
 *
 * Each threat maps to a cascade through the dependency graph:
 *   GraphNode types: Commitment · FulfillmentUnit · WorkGrouping ·
 *   ExecutionUnit · Stock · Supply · Transport · Capacity
 */

const THREATS = [
  {
    id: 'T1',
    severity: 'crit',                       // crit | warn | watch
    title: 'Inbound delay is about to break Wave WAV-2207',
    exposure: '14 outbound deliveries for Northbridge Retail · against the 16:00 carrier cutoff',
    secondsToDeadline: 14820,               // seconds until the SLA breach
    deadlineLabel: 'until the 16:00 cutoff',
    confidence: 92,                          // 0–100 %
    requiresApproval: true,
    gateText: 'Needs your approval. This action affects external customer commitments.',
    // SAP object references (would be populated from OData reads)
    sapRefs: {
      inboundDelivery: '1800012345',
      salesOrders: ['4500001001', '4500001002'],  // 14 total — abbreviated
      wave: 'WAV-2207',
      bin: '04-A-12',
      plant: '1710',
    },
    causalPath: [
      { role: 'cause', label: 'Transfer order from Plant 1710', state: 'Delayed 3h 10m' },
      { role: 'mid',   label: 'Inbound delivery',               state: 'Arrival late' },
      { role: 'mid',   label: 'Pick-face stock, Bin 04-A-12',   state: 'Short 320 cases' },
      { role: 'mid',   label: '14 pick tasks',                  state: 'Blocked' },
      { role: 'end',   label: '14 customer deliveries',         state: 'SLA at risk' },
    ],
    recommendation: {
      name: 'Substitute from batch 07-C',
      description:
        'Source 320 cases of the equivalent batch held in bin 07-C-04. An availability ' +
        'check confirms there is enough stock and shelf-life — every one of the 14 deliveries ' +
        'still makes the cutoff.',
      stats: [
        { label: 'Cost',        value: 'None',            sentiment: 'good' },
        { label: 'SLA outcome', value: '14 / 14 on time', sentiment: 'good' },
        { label: 'Labour',      value: '+1 replen task',  sentiment: '' },
      ],
    },
    alternatives: [
      {
        name: 'Split & ship available now',
        stats: [{ label: 'SLA', value: '9 / 14 on time' }, { label: 'Cost', value: 'None' }],
      },
      {
        name: 'Expedite the transfer + re-sequence wave',
        stats: [{ label: 'SLA', value: '14 / 14 on time' }, { label: 'Cost', value: '£420' }],
      },
    ],
  },

  {
    id: 'T2',
    severity: 'warn',
    title: 'Zone B is picking 38% below plan',
    exposure: '34 deliveries on afternoon waves drifting late · 3 associates absent',
    secondsToDeadline: 7200,
    deadlineLabel: 'until afternoon waves slip',
    confidence: 86,
    requiresApproval: false,
    gateText: 'Agent can act. Low-stakes and reversible — it will dispatch and notify you.',
    sapRefs: {
      zone: 'B',
      wavesAffected: ['WAV-2208', 'WAV-2209'],
    },
    causalPath: [
      { role: 'cause', label: 'Zone B labour',       state: '3 absences' },
      { role: 'mid',   label: 'Pick task queue',      state: 'Backlog building' },
      { role: 'end',   label: '34 customer deliveries', state: 'Drifting late' },
    ],
    recommendation: {
      name: 'Reallocate 4 associates from Putaway',
      description:
        'Putaway is running 16% ahead of plan. Moving 4 associates to Zone B picking for ' +
        '3 hours clears the backlog and recovers the afternoon waves.',
      stats: [
        { label: 'Cost',        value: 'None',      sentiment: 'good' },
        { label: 'SLA outcome', value: 'Recovers',  sentiment: 'good' },
        { label: 'Labour',      value: 'Re-balance', sentiment: '' },
      ],
    },
    alternatives: [
      {
        name: 'Authorise 2 hours overtime',
        stats: [{ label: 'SLA', value: 'Recovers' }, { label: 'Cost', value: '£260' }],
      },
    ],
  },

  {
    id: 'T3',
    severity: 'warn',
    title: 'Reefer temperature drift on the Dock 6 inbound',
    exposure: '1,040 frozen cases on hold · trailer logged at −16°C (limit −18°C)',
    secondsToDeadline: 2640,
    deadlineLabel: 'until the QC window closes',
    confidence: 78,
    requiresApproval: true,
    gateText: 'Needs your approval. Quality hold with food-safety implications.',
    sapRefs: {
      dock: '6',
      inboundDelivery: '1800012398',
      qcInspectionLot: null,       // created on dispatch
    },
    causalPath: [
      { role: 'cause', label: 'Dock 6 inbound, frozen line', state: 'Temp breach' },
      { role: 'mid',   label: 'Quality inspection',          state: 'Pending' },
      { role: 'end',   label: '1,040 cases',                 state: 'Putaway blocked' },
    ],
    recommendation: {
      name: 'Send QC for a priority inspection now',
      description:
        'Dispatch a QC inspector to assess product integrity before the decision window closes ' +
        '— this preserves the stock if the cold chain held within tolerance.',
      stats: [
        { label: 'Cost',    value: 'None',           sentiment: 'good' },
        { label: 'Outcome', value: 'Stock preserved', sentiment: 'good' },
        { label: 'Labour',  value: '1 QC task',       sentiment: '' },
      ],
    },
    alternatives: [
      {
        name: 'Reject & return to plant',
        stats: [{ label: 'Outcome', value: 'Lost load' }, { label: 'Cost', value: 'Supply gap' }],
      },
    ],
  },

  {
    id: 'T4',
    severity: 'watch',
    title: 'Sorter S2 is trending toward a fault',
    exposure: 'Evening dispatch throughput exposed · telemetry forecasts a fault in ~6 hours',
    secondsToDeadline: 21600,
    deadlineLabel: 'until forecast fault window',
    confidence: 71,
    requiresApproval: false,
    gateText: 'Agent can act. Low-stakes and reversible — it will book the slot and notify you.',
    sapRefs: {
      equipment: 'S2',
      maintenanceOrder: null,      // created on dispatch
    },
    causalPath: [
      { role: 'cause', label: 'Sorter S2 bearing',   state: 'Trending abnormal' },
      { role: 'mid',   label: 'Sortation capacity',  state: 'Failure risk' },
      { role: 'end',   label: 'Evening dispatch',     state: 'Exposed' },
    ],
    recommendation: {
      name: 'Book maintenance into the 13:00 window',
      description:
        'Schedule preventive service in the 13:00–13:30 low-volume slot, ahead of the forecast ' +
        'fault window — no impact to dispatch throughput.',
      stats: [
        { label: 'Cost',        value: 'Planned',   sentiment: 'good' },
        { label: 'SLA outcome', value: 'No impact', sentiment: 'good' },
        { label: 'Labour',      value: '1 tech · 30m', sentiment: '' },
      ],
    },
    alternatives: [
      {
        name: 'Run to failure',
        stats: [{ label: 'SLA', value: 'High risk' }, { label: 'Cost', value: 'Unplanned' }],
      },
    ],
  },
];

const FLOW = [
  { segment: 'Inbound',   status: 'bad'  },
  { segment: 'Putaway',   status: 'ok'   },
  { segment: 'Replenish', status: 'warn' },
  { segment: 'Picking',   status: 'warn' },
  { segment: 'Packing',   status: 'ok'   },
  { segment: 'Shipping',  status: 'warn' },
];

const DC_STATUS = {
  id: 'DC-NORTHGATE',
  name: 'DC Northgate',
  shift: 'B',
  overallStatus: 'elevated',    // green | elevated | critical
  timestamp: null,              // set dynamically
};

module.exports = { THREATS, FLOW, DC_STATUS };

/**
 * Warehouse Control Tower — CDS Data Model
 *
 * The dependency graph is the agent's model of the DC day.
 * A disruption on one node propagates a risk score downstream
 * along edges, modulated by slack at each hop.
 *
 * Node types map 1-to-1 with SAP business objects (see architecture doc §3).
 */

namespace controlTower;

using { cuid, managed, temporal } from '@sap/cds/common';

// ── Enumerations ──────────────────────────────────────────────────────────────

type Severity : String enum {
  crit;   // SLA breach imminent
  warn;   // SLA at risk
  watch;  // elevated monitoring
}

type NodeType : String enum {
  Commitment;     // Sales Order line
  FulfillmentUnit; // Outbound Delivery
  WorkGrouping;   // Wave
  ExecutionUnit;  // Warehouse Task / Warehouse Order
  Stock;          // Material + batch + storage bin
  Supply;         // Inbound Delivery / STO / PO
  Transport;      // Route / loading appointment / freight order
  Capacity;       // Labour pool · dock door · MHE resource
}

type EdgeType : String enum {
  fulfills;
  replenishedBy;
  consumes;
  groupedInto;
  shipsOn;
}

type NodeRole : String enum {
  cause;   // root cause node in causal path
  mid;     // intermediate propagation node
  end;     // threatened outcome node
}

// ── Dependency Graph ──────────────────────────────────────────────────────────

/**
 * GraphNode represents one live DC object.
 * Risk scores propagate downstream along GraphEdges.
 */
entity GraphNodes : cuid, managed {
  nodeType        : NodeType;
  sapObjectType   : String;        // e.g. 'OutboundDelivery', 'Wave', 'Bin'
  sapObjectId     : String;        // SAP key value
  displayLabel    : String;
  currentState    : String;        // human-readable status
  riskScore       : Decimal(5,2);  // 0–100, propagated from upstream
  slack           : Integer;       // minutes of buffer before SLA impact
  freshAt         : Timestamp;     // last time this node was refreshed from SAP
  outgoingEdges   : Association to many GraphEdges on outgoingEdges.fromNode = $self;
  incomingEdges   : Association to many GraphEdges on incomingEdges.toNode   = $self;
}

entity GraphEdges : cuid {
  fromNode   : Association to GraphNodes;
  toNode     : Association to GraphNodes;
  edgeType   : EdgeType;
  slackMins  : Integer;   // slack on this hop — modulates risk propagation
}

// ── Threats ───────────────────────────────────────────────────────────────────

/**
 * A Threat is the agent's output: a ranked, actionable item in the threat queue.
 * One threat corresponds to one disruption cascade in the dependency graph.
 */
entity Threats : cuid, managed {
  severity          : Severity;
  title             : String(500);
  exposure          : String(1000);
  secondsToDeadline : Integer;
  deadlineLabel     : String(200);
  confidence        : Integer;          // 0–100 %
  requiresApproval  : Boolean;
  gateText          : String(500);
  dispatched        : Boolean default false;
  dispatchedAt      : Timestamp;
  dispatchedBy      : String(100);

  // Root-cause node in the dependency graph
  rootCauseNode     : Association to GraphNodes;

  // Structured causal path (ordered list of nodes from cause to threat)
  causalPath        : Composition of many CausalPathNodes on causalPath.threat = $self;

  // Recommended recovery + alternatives
  recommendation    : Composition of one Recommendations on recommendation.threat = $self;
  alternatives      : Composition of many Alternatives on alternatives.threat = $self;

  // SAP object references (populated when fetching from OData)
  sapRefs           : Composition of one ThreatSapRefs on sapRefs.threat = $self;
}

entity CausalPathNodes : cuid {
  threat     : Association to Threats;
  sequence   : Integer;
  role       : NodeRole;
  label      : String(300);
  state      : String(300);
  graphNode  : Association to GraphNodes;  // optional link to live graph node
}

entity Recommendations : cuid {
  threat      : Association to Threats;
  name        : String(300);
  description : String(2000);
  stats       : Composition of many RecommendationStats on stats.recommendation = $self;
}

entity RecommendationStats : cuid {
  recommendation : Association to Recommendations;
  label          : String(100);
  value          : String(200);
  sentiment      : String(10);    // 'good' | '' (neutral) | 'bad'
}

entity Alternatives : cuid {
  threat    : Association to Threats;
  sequence  : Integer;
  name      : String(300);
  stats     : Composition of many AlternativeStats on stats.alternative = $self;
}

entity AlternativeStats : cuid {
  alternative : Association to Alternatives;
  label       : String(100);
  value       : String(200);
}

entity ThreatSapRefs : cuid {
  threat           : Association to Threats;
  inboundDelivery  : String(20);
  outboundDelivery : String(20);
  wave             : String(30);
  bin              : String(30);
  plant            : String(10);
  equipment        : String(30);
}

// ── Dispatch Log ──────────────────────────────────────────────────────────────

entity DispatchLog : cuid, managed {
  threat        : Association to Threats;
  actionName    : String(300);    // recommendation or alternative taken
  approvedBy    : String(100);
  // Phase 2: populated after SAP write-back
  sapWriteStatus   : String(20) default 'pending';
  sapDocumentId    : String(50);
}

// ── DC Status ─────────────────────────────────────────────────────────────────

entity DCStatus : cuid {
  dcId          : String(30);
  dcName        : String(100);
  shift         : String(5);
  overallStatus : String(20);     // 'green' | 'elevated' | 'critical'
  recordedAt    : Timestamp;
}

entity FlowSegments : cuid {
  dc        : Association to DCStatus;
  segment   : String(50);         // 'Inbound', 'Putaway', etc.
  status    : String(10);         // 'ok' | 'warn' | 'bad'
  sequence  : Integer;
}

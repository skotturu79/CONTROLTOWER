/**
 * Warehouse Control Tower — CDS Service Definition
 *
 * Phase 1: read-only threat queue + DC status.
 * Phase 2: adds dispatch and snooze mutations.
 *
 * In production this service is backed by:
 *   - Event consumers feeding the dependency graph (see architecture §4.1)
 *   - OData reads from S/4HANA (§4.2) and EWM (§4.3)
 *   - Write-back through standard SAP APIs (gated by the autonomy policy)
 */

using controlTower from '../db/schema';

service ControlTowerService @(path:'/api/cds') {

  // ── Threat queue (ranked, summary) ──────────────────────────────────────
  @readonly
  entity Threats       as projection on controlTower.Threats {
    *, causalPath, recommendation, alternatives, sapRefs
  };

  // ── Dependency graph (read-only) ─────────────────────────────────────────
  @readonly
  entity GraphNodes    as projection on controlTower.GraphNodes;
  @readonly
  entity GraphEdges    as projection on controlTower.GraphEdges;

  // ── DC status + flow strip ───────────────────────────────────────────────
  @readonly
  entity DCStatus      as projection on controlTower.DCStatus;
  @readonly
  entity FlowSegments  as projection on controlTower.FlowSegments;

  // ── Dispatch log (append-only via action) ────────────────────────────────
  @readonly
  entity DispatchLog   as projection on controlTower.DispatchLog;

  // ── Actions (Phase 2) ────────────────────────────────────────────────────
  action dispatch(threatId: UUID, alternativeIndex: Integer, approvedBy: String)
    returns DispatchLog;

  action snooze(threatId: UUID, minutes: Integer)
    returns { snoozedUntil: Timestamp };
}

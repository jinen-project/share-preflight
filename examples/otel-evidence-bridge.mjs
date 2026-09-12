/**
 * Optional mapping for attaching a Share Preflight receipt to an existing OTel
 * span. It never reads original text, matched values, receipt paths, or raw
 * finding details. Call span.setAttributes(toOtelAttributes(...)) yourself.
 */
const COST_KINDS = new Set(['ACTUAL_PROVIDER_REPORTED', 'ESTIMATED_RATE_CARD', 'UNKNOWN']);
const EVALUATION_STATES = new Set(['PASS', 'FAIL', 'NOT_RUN', 'UNKNOWN']);
const IMPROVEMENT_STATES = new Set(['NOT_APPLICABLE', 'OPEN', 'FIXED_PENDING_REEVALUATION', 'REEVALUATED_PASS', 'REEVALUATED_FAIL']);
const STABLE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

function assertStableIdentifier(value, name) {
  if (typeof value !== 'string' || !STABLE_IDENTIFIER.test(value)) {
    throw new Error(`${name} must be a stable identifier`);
  }
}

export function toOtelAttributes({ receipt, cost = { kind: 'UNKNOWN' }, evaluation = { status: 'UNKNOWN' }, improvement = { state: 'NOT_APPLICABLE' } }) {
  if (!receipt || receipt.receipt_type !== 'SHARE_PREFLIGHT_RECEIPT_V01') throw new Error('expected Share Preflight receipt');
  if (!COST_KINDS.has(cost.kind)) throw new Error('unsupported cost.kind');
  if (!EVALUATION_STATES.has(evaluation.status)) throw new Error('unsupported evaluation.status');
  if (!IMPROVEMENT_STATES.has(improvement.state)) throw new Error('unsupported improvement.state');
  if (receipt.opa_input?.profile_id) assertStableIdentifier(receipt.opa_input.profile_id, 'profile_id');
  const attributes = {
    'share_preflight.receipt.type': receipt.receipt_type,
    'share_preflight.receipt.version': receipt.tool_version,
    'share_preflight.receipt.status': receipt.status,
    'share_preflight.policy.profile_id': receipt.opa_input?.profile_id ?? 'UNKNOWN',
    'share_preflight.policy.decision_input': receipt.opa_input?.preflight_status ?? 'UNKNOWN',
    'share_preflight.finding_count': Array.isArray(receipt.findings) ? receipt.findings.length : 0,
    'share_preflight.human_decision_required': Boolean(receipt.human_decision_required),
    'share_preflight.content.capture': 'DISABLED',
    'share_preflight.cost.kind': cost.kind,
    'share_preflight.evaluation.status': evaluation.status,
    'share_preflight.evaluation.evidence_kind': ['PASS', 'FAIL'].includes(evaluation.status)
      ? 'TASK_SPECIFIC_EVALUATION' : 'NONE_OR_UNAVAILABLE',
    'share_preflight.improvement.state': improvement.state
  };
  if (cost.kind !== 'UNKNOWN') {
    if (typeof cost.amount_usd !== 'number' || !Number.isFinite(cost.amount_usd) || cost.amount_usd < 0) throw new Error('known cost requires non-negative amount_usd');
    assertStableIdentifier(cost.basis_id, 'cost.basis_id');
    attributes['share_preflight.cost.amount_usd'] = cost.amount_usd;
    attributes['share_preflight.cost.basis_id'] = cost.basis_id;
  }
  if (['PASS', 'FAIL'].includes(evaluation.status)) {
    assertStableIdentifier(evaluation.name, 'evaluation.name');
    assertStableIdentifier(evaluation.version, 'evaluation.version');
    attributes['share_preflight.evaluation.name'] = evaluation.name;
    attributes['share_preflight.evaluation.version'] = evaluation.version;
  }
  if (improvement.state !== 'NOT_APPLICABLE') {
    assertStableIdentifier(improvement.failure_class, 'improvement.failure_class');
    assertStableIdentifier(improvement.regression_fixture_id, 'improvement.regression_fixture_id');
    attributes['share_preflight.improvement.failure_class'] = improvement.failure_class;
    attributes['share_preflight.improvement.regression_fixture_id'] = improvement.regression_fixture_id;
    if (improvement.change_id) {
      assertStableIdentifier(improvement.change_id, 'improvement.change_id');
      attributes['share_preflight.improvement.change_id'] = improvement.change_id;
    }
  }
  return attributes;
}

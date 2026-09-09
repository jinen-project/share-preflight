/**
 * Optional mapping for attaching a Share Preflight receipt to an existing OTel
 * span. It never reads original text, matched values, receipt paths, or raw
 * finding details. Call span.setAttributes(toOtelAttributes(...)) yourself.
 */
const COST_KINDS = new Set(['ACTUAL_PROVIDER_REPORTED', 'ESTIMATED_RATE_CARD', 'UNKNOWN']);
const EVALUATION_STATES = new Set(['PASS', 'FAIL', 'NOT_RUN', 'UNKNOWN']);

export function toOtelAttributes({ receipt, cost = { kind: 'UNKNOWN' }, evaluation = { status: 'UNKNOWN' } }) {
  if (!receipt || receipt.receipt_type !== 'SHARE_PREFLIGHT_RECEIPT_V01') throw new Error('expected Share Preflight receipt');
  if (!COST_KINDS.has(cost.kind)) throw new Error('unsupported cost.kind');
  if (!EVALUATION_STATES.has(evaluation.status)) throw new Error('unsupported evaluation.status');
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
      ? 'TASK_SPECIFIC_EVALUATION' : 'NONE_OR_UNAVAILABLE'
  };
  if (cost.kind !== 'UNKNOWN') {
    if (typeof cost.amount_usd !== 'number' || !Number.isFinite(cost.amount_usd) || cost.amount_usd < 0) throw new Error('known cost requires non-negative amount_usd');
    if (!cost.basis_id) throw new Error('known cost requires basis_id');
    attributes['share_preflight.cost.amount_usd'] = cost.amount_usd;
    attributes['share_preflight.cost.basis_id'] = cost.basis_id;
  }
  if (['PASS', 'FAIL'].includes(evaluation.status)) {
    if (!evaluation.name || !evaluation.version) throw new Error('completed evaluation requires name and version');
    attributes['share_preflight.evaluation.name'] = evaluation.name;
    attributes['share_preflight.evaluation.version'] = evaluation.version;
  }
  return attributes;
}

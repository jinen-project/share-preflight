import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { inspect, receipt } from '../share-preflight.mjs';
import { validate } from '../validate-remote-profile-request.mjs';
import { toOtelAttributes } from '../examples/otel-evidence-bridge.mjs';
import { preflightHandoffEntry } from '../handoff-entry-preflight.mjs';

const root = path.resolve(import.meta.dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'example.config.json'), 'utf8'));
const facts = JSON.parse(fs.readFileSync(path.join(root, 'examples/facts.json'), 'utf8'));
const clean = fs.readFileSync(path.join(root, 'examples/clean.txt'), 'utf8');
const hold = fs.readFileSync(path.join(root, 'examples/hold.txt'), 'utf8');
const stdinRun = spawnSync(process.execPath, [
  path.join(root, 'share-preflight.mjs'),
  '--config', path.join(root, 'example.config.json'),
  '--input', '-',
  '--facts', path.join(root, 'examples/facts.json')
], { input: clean, encoding: 'utf8' });
assert.equal(stdinRun.status, 0, stdinRun.stderr);
assert.equal(JSON.parse(stdinRun.stdout).input.fingerprint, 'OMITTED_BY_DEFAULT');
const localEntryRun = spawnSync(process.execPath, [
  path.join(root, 'share-preflight.mjs'),
  '--config', path.join(root, 'example.config.json'),
  '--entry-facts', path.join(root, 'examples/handoff-entry-local.synthetic.json'),
  '--input', path.join(root, 'examples/clean.txt'),
  '--facts', path.join(root, 'examples/facts.json')
], { encoding: 'utf8' });
assert.equal(localEntryRun.status, 0, localEntryRun.stderr);
assert.equal(JSON.parse(localEntryRun.stdout).status, 'PASS_WITHIN_CONFIGURED_SCOPE');
const externalEntryRun = spawnSync(process.execPath, [
  path.join(root, 'share-preflight.mjs'),
  '--config', path.join(root, 'example.config.json'),
  '--entry-facts', path.join(root, 'examples/handoff-entry-external-request.synthetic.json'),
  '--input', path.join(root, 'examples/input-is-never-opened.txt'),
  '--facts', path.join(root, 'examples/facts.json')
], { encoding: 'utf8' });
assert.equal(externalEntryRun.status, 2, externalEntryRun.stderr);
const externalEntryOutput = JSON.parse(externalEntryRun.stdout);
assert.equal(externalEntryOutput.handoff_entry_preflight.decision, 'HOLD_EXTERNAL_HANDOFF_SEPARATE_AUTHORITY');
assert.equal(externalEntryOutput.source_loaded, false);
assert.equal(externalEntryOutput.receipt_created, false);
assert.equal(externalEntryOutput.opa_input_created, false);
assert.deepEqual(inspect(clean, config), []);
const findings = inspect(hold, config);
assert.equal(findings.length, 2);
const inputPath = '/private/customer-alpha/incident-481.txt';
const configPath = '/private/customer-alpha/policy.json';
const result = receipt({ inputPath, text: hold, configPath, config, facts: { ...facts, private_note: 'Customer Alpha incident 481' }, findings });
assert.equal(result.status, 'HOLD_FOR_REVIEW');
assert.equal(JSON.stringify(result).includes(hold), false);
assert.equal(JSON.stringify(result).includes('Project Cedar'), false);
assert.equal(JSON.stringify(result).includes('PROJECT_CEDAR'), false);
assert.equal(JSON.stringify(result).includes(inputPath), false);
assert.equal(JSON.stringify(result).includes(configPath), false);
assert.equal(JSON.stringify(result.opa_input).includes('Customer Alpha incident 481'), false);
assert.equal(result.input.fingerprint, 'OMITTED_BY_DEFAULT');
assert.equal(result.configuration.fingerprint, 'OMITTED_BY_DEFAULT');
const fingerprinted = receipt({ inputPath, text: hold, configPath, config: { ...config, receipt: { include_fingerprints: true } }, facts, findings });
assert.equal(typeof fingerprinted.input.sha256, 'string');
assert.equal(typeof fingerprinted.configuration.sha256, 'string');
const otelAttributes = toOtelAttributes({
  receipt: result,
  cost: { kind: 'ESTIMATED_RATE_CARD', amount_usd: 0.0012, basis_id: 'synthetic-rate-card-v01' },
  evaluation: { status: 'PASS', name: 'synthetic-claim-scope-check', version: 'v01' },
  improvement: { state: 'REEVALUATED_PASS', failure_class: 'UNMAPPED_DESTINATION', regression_fixture_id: 'synthetic-unmapped-destination-v01', change_id: 'profile-change-v02' }
});
assert.equal(otelAttributes['share_preflight.content.capture'], 'DISABLED');
assert.equal(otelAttributes['share_preflight.improvement.state'], 'REEVALUATED_PASS');
assert.equal(JSON.stringify(otelAttributes).includes('/synthetic/hold.txt'), false);
assert.equal(JSON.stringify(otelAttributes).includes('Project Cedar'), false);
for (const invalidMetadata of [
  { cost: { kind: 'ESTIMATED_RATE_CARD', amount_usd: 0.0012, basis_id: 'Customer Alpha incident 481' } },
  { evaluation: { status: 'PASS', name: '/private/customer-alpha/check', version: 'v01' } },
  { improvement: { state: 'OPEN', failure_class: 'Customer Alpha', regression_fixture_id: 'synthetic-v01' } },
  { improvement: { state: 'OPEN', failure_class: 'UNMAPPED_DESTINATION', regression_fixture_id: 'synthetic-v01', change_id: 'ticket 481' } }
]) {
  assert.throws(() => toOtelAttributes({ receipt: result, ...invalidMetadata }), /stable identifier/);
}
const request = JSON.parse(fs.readFileSync(path.join(root, 'remote-profile-request.template.json'), 'utf8'));
assert.equal(validate(request).status, 'HOLD_FOR_REQUESTER');
request.profile_id = 'example-team-v01';
request.profile_label = 'Example team profile';
request.responsible_owner_role = 'Security owner';
request.exception_approver_role = 'Security approver';
request.change_rationale = 'Synthetic test request.';
request.approved_destinations = ['approved-example-destination'];
assert.equal(validate(request).status, 'READY_FOR_PROFILE_TRANSLATION');
const completeSyntheticRequest = JSON.parse(fs.readFileSync(path.join(root, 'examples/remote-profile-request.synthetic.json'), 'utf8'));
assert.equal(validate(completeSyntheticRequest).status, 'READY_FOR_PROFILE_TRANSLATION');
assert.equal(preflightHandoffEntry({
  representation_mode: 'NONE',
  source_boundary_declared: false,
  destination_declared: false,
  responsible_owner_declared: false,
  external_handoff_requested: false
}).decision, 'STARTING_CONDITION_DISCOVERY_READY');
const entryBoundary = preflightHandoffEntry({
  representation_mode: 'METADATA_ONLY',
  source_boundary_declared: false,
  destination_declared: true,
  responsible_owner_declared: false,
  external_handoff_requested: false
});
assert.equal(entryBoundary.decision, 'BOUNDARY_DISCOVERY_READY');
assert.deepEqual(entryBoundary.missing_conditions, ['SOURCE_BOUNDARY', 'RESPONSIBLE_RELATION']);
assert.equal(preflightHandoffEntry({
  representation_mode: 'METADATA_ONLY',
  source_boundary_declared: true,
  destination_declared: true,
  responsible_owner_declared: true,
  external_handoff_requested: false
}).decision, 'LOCAL_INSPECTION_READY');
assert.equal(preflightHandoffEntry({
  representation_mode: 'METADATA_ONLY',
  source_boundary_declared: true,
  destination_declared: true,
  responsible_owner_declared: true,
  external_handoff_requested: true
}).decision, 'HOLD_EXTERNAL_HANDOFF_SEPARATE_AUTHORITY');
assert.throws(() => preflightHandoffEntry({
  representation_mode: 'NONE', source_boundary_declared: false, destination_declared: false,
  responsible_owner_declared: false, external_handoff_requested: false, source_text: 'denied'
}), /RAW_OR_UNKNOWN_HANDOFF_FIELD_DENIED/);
const opa = spawnSync('opa', [
  'test',
  path.join(root, 'policy_profiles.json'),
  path.join(root, 'profiled_sharing_gate.rego'),
  path.join(root, 'profiled_sharing_gate_test.rego')
], { encoding: 'utf8' });
assert.equal(opa.status, 0, opa.stderr);
console.log(JSON.stringify({ status: 'PASS_ONCE_SYNTHETIC', checks: 34, opa_tests: 'PASS_4_OF_4', content_free_receipt: true, local_paths_excluded: true, remote_request_validation: 'PASS', handoff_entry_preflight: 'PASS', entry_gated_local_inspection: 'PASS', otel_evidence_mapping: 'PASS' }, null, 2));

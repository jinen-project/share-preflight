import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { inspect, receipt } from '../share-preflight.mjs';
import { validate } from '../validate-remote-profile-request.mjs';

const root = path.resolve(import.meta.dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'example.config.json'), 'utf8'));
const facts = JSON.parse(fs.readFileSync(path.join(root, 'examples/facts.json'), 'utf8'));
const clean = fs.readFileSync(path.join(root, 'examples/clean.txt'), 'utf8');
const hold = fs.readFileSync(path.join(root, 'examples/hold.txt'), 'utf8');
assert.deepEqual(inspect(clean, config), []);
const findings = inspect(hold, config);
assert.equal(findings.length, 2);
const result = receipt({ inputPath: '/synthetic/hold.txt', text: hold, configPath: '/synthetic/config.json', config, facts, findings });
assert.equal(result.status, 'HOLD_FOR_REVIEW');
assert.equal(JSON.stringify(result).includes(hold), false);
assert.equal(JSON.stringify(result).includes('Project Cedar'), false);
const request = JSON.parse(fs.readFileSync(path.join(root, 'remote-profile-request.template.json'), 'utf8'));
request.profile_id = 'example-team-v01';
request.profile_label = 'Example team profile';
request.responsible_owner_role = 'Security owner';
request.exception_approver_role = 'Security approver';
request.change_rationale = 'Synthetic test request.';
assert.equal(validate(request).status, 'READY_FOR_PROFILE_TRANSLATION');
const opa = spawnSync('opa', [
  'test',
  path.join(root, 'policy_profiles.json'),
  path.join(root, 'profiled_sharing_gate.rego'),
  path.join(root, 'profiled_sharing_gate_test.rego')
], { encoding: 'utf8' });
assert.equal(opa.status, 0, opa.stderr);
console.log(JSON.stringify({ status: 'PASS_ONCE_SYNTHETIC', checks: 7, opa_tests: 'PASS_4_OF_4', content_free_receipt: true, remote_request_validation: 'PASS' }, null, 2));

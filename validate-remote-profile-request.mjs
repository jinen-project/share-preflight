#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const text = (value) => typeof value === 'string' && value.trim().length > 0;
const requiredDecisions = new Set(['allow', 'hold', 'deny']);
const placeholderValues = new Set([
  'A short human-readable label',
  'Role accountable for approving this profile',
  'Role permitted to approve an exception',
  'Why this profile or change is needed.',
  'name-only-approved-destination'
]);

const placeholder = (value) =>
  !text(value) ||
  placeholderValues.has(value.trim()) ||
  value.trim().startsWith('replace-with-');

export function validate(request) {
  const findings = [];
  for (const field of ['request_type', 'profile_id', 'profile_label', 'responsible_owner_role', 'exception_approver_role', 'change_rationale']) {
    if (!text(request[field])) findings.push({ level: 'HOLD', field, message: `Missing ${field}.` });
    else if (placeholder(request[field])) findings.push({ level: 'HOLD', field, message: `Replace placeholder ${field}.` });
  }
  for (const kind of ['public', 'restricted']) {
    if (!Array.isArray(request.classification_labels?.[kind]) || request.classification_labels[kind].length === 0) {
      findings.push({ level: 'HOLD', field: `classification_labels.${kind}`, message: `Provide at least one ${kind} label.` });
    }
  }
  if (!Array.isArray(request.approved_destinations) || request.approved_destinations.length === 0) findings.push({ level: 'HOLD', field: 'approved_destinations', message: 'Provide a name-only approved destination list.' });
  else if (request.approved_destinations.some(placeholder)) findings.push({ level: 'HOLD', field: 'approved_destinations', message: 'Replace placeholder approved destinations.' });
  const decisions = new Set((request.expected_cases ?? []).map((item) => item?.expected_decision));
  for (const decision of requiredDecisions) if (!decisions.has(decision)) findings.push({ level: 'HOLD', field: 'expected_cases', message: `Include one synthetic ${decision} case.` });
  for (const field of ['contains_no_source_text', 'contains_no_credentials', 'contains_no_customer_data']) {
    if (request.confirmation?.[field] !== true) findings.push({ level: 'HOLD', field: `confirmation.${field}`, message: `Confirm ${field}.` });
  }
  return {
    status: findings.length ? 'HOLD_FOR_REQUESTER' : 'READY_FOR_PROFILE_TRANSLATION',
    findings,
    nonclaims: [
      'This validator checks request completeness only.',
      'It does not inspect source material, decide whether a policy is correct, or create an approval on behalf of the owner.'
    ]
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: node validate-remote-profile-request.mjs request.json');
  const result = validate(JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === 'READY_FOR_PROFILE_TRANSLATION' ? 0 : 2;
}

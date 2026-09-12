#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const VERSION = '0.3.0';
const OPA_FACT_FIELDS = ['profile_id', 'data_classification', 'destination', 'exception_approved'];

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const list = (value) => Array.isArray(value) ? value : [];

function occurrences(text, pattern) {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
  const regex = new RegExp(pattern.source, flags);
  let count = 0;
  while (regex.exec(text) !== null) {
    count += 1;
    if (regex.lastIndex === 0) regex.lastIndex += 1;
  }
  return count;
}

export function inspect(text, config) {
  const findings = [];
  for (const rule of list(config.literal_terms)) {
    if (!rule?.id || typeof rule.value !== 'string') continue;
    const haystack = rule.case_sensitive ? text : text.toLowerCase();
    const needle = rule.case_sensitive ? rule.value : rule.value.toLowerCase();
    const count = needle ? haystack.split(needle).length - 1 : 0;
    if (count > 0) findings.push({ category: 'CONFIGURED_LITERAL', rule_id: rule.id, count });
  }
  for (const rule of list(config.regex_rules)) {
    if (!rule?.id || typeof rule.pattern !== 'string') continue;
    const count = occurrences(text, new RegExp(rule.pattern, rule.flags ?? ''));
    if (count > 0) findings.push({ category: 'CONFIGURED_REGEX', rule_id: rule.id, count });
  }
  if (config.checks?.email) {
    const count = occurrences(text, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi);
    if (count > 0) findings.push({ category: 'EMAIL_PATTERN', rule_id: 'BUILTIN_EMAIL_V01', count });
  }
  return findings;
}

export function receipt({ inputPath, text, configPath, config, facts, findings }) {
  const status = findings.length === 0 ? 'PASS_WITHIN_CONFIGURED_SCOPE' : 'HOLD_FOR_REVIEW';
  const includeFingerprints = config.receipt?.include_fingerprints === true;
  // Facts are user-supplied metadata. Keep the policy input intentionally
  // closed so an incidental note or identifier cannot cross this boundary.
  const opaFacts = Object.fromEntries(OPA_FACT_FIELDS
    .filter((field) => Object.hasOwn(facts, field))
    .map((field) => [field, facts[field]]));
  return {
    receipt_type: 'SHARE_PREFLIGHT_RECEIPT_V01',
    tool_version: VERSION,
    status,
    // Paths often encode project, customer, or user information. A receipt is
    // intended for a handoff record, so keep only content-independent facts.
    input: includeFingerprints
      ? { byte_length: Buffer.byteLength(text), sha256: sha256(text) }
      : { fingerprint: 'OMITTED_BY_DEFAULT' },
    configuration: includeFingerprints
      ? { sha256: sha256(JSON.stringify(config)), profile_ids: Object.keys(config.profiles ?? {}) }
      : { fingerprint: 'OMITTED_BY_DEFAULT', profile_ids: Object.keys(config.profiles ?? {}) },
    findings,
    opa_input: { ...opaFacts, preflight_status: status },
    human_decision_required: true,
    nonclaims: [
      'This receipt does not contain input text or matched values.',
      'This receipt does not contain local input or configuration paths.',
      'Input and configuration fingerprints are omitted unless explicitly enabled.',
      'A pass applies only to configured checks.',
      'This does not establish that material is safe to share, compliant, complete, or free of sensitive information.',
      'A responsible person decides whether and where material may be shared.'
    ]
  };
}

function args(argv) {
  const result = {};
  for (let i = 2; i < argv.length; i += 2) result[argv[i]] = argv[i + 1];
  return result;
}

function main(argv) {
  const value = args(argv);
  if (!value['--config'] || !value['--input'] || !value['--facts']) throw new Error('Usage: node share-preflight.mjs --config config.json --input text.txt --facts facts.json [--receipt receipt.json] [--opa-input opa-input.json]');
  const configPath = path.resolve(value['--config']);
  const inputPath = path.resolve(value['--input']);
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const text = fs.readFileSync(inputPath, 'utf8');
  const facts = JSON.parse(fs.readFileSync(path.resolve(value['--facts']), 'utf8'));
  const result = receipt({ inputPath, text, configPath, config, facts, findings: inspect(text, config) });
  if (value['--receipt']) fs.writeFileSync(path.resolve(value['--receipt']), `${JSON.stringify(result, null, 2)}\n`);
  if (value['--opa-input']) fs.writeFileSync(path.resolve(value['--opa-input']), `${JSON.stringify(result.opa_input, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  return result.status === 'HOLD_FOR_REVIEW' ? 2 : 0;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  try { process.exitCode = main(process.argv); } catch (error) { console.error(error.message); process.exitCode = 1; }
}

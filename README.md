# Share Preflight

Small, local-first checks before you share text with an AI tool, issue tracker, chat, or external handoff.

It has two separate jobs:

1. inspect only the patterns you configure on your device; and
2. give [Open Policy Agent](https://www.openpolicyagent.org/) a **content-minimised** summary so it can return `allow`, `hold`, or `deny` from a named policy profile.

The original text and a matching value are not included in the generated receipt or OPA input.

## Quick start

```sh
node share-preflight.mjs \
  --config example.config.json \
  --input examples/clean.txt \
  --facts examples/facts.json \
  --receipt /tmp/share-preflight-receipt.json \
  --opa-input /tmp/share-preflight-opa-input.json

opa eval --format=pretty \
  --data policy_profiles.json \
  --data profiled_sharing_gate.rego \
  --input /tmp/share-preflight-opa-input.json \
  'data.share_preflight.decision'
```

## Standard profile, adjustable policy

`standard-conservative-v01` is an editable, conservative starting point:

* public material can be allowed after the configured preflight passes;
* missing facts and unknown profiles hold for review;
* restricted material to an unapproved destination is denied.

Teams can add a separately named profile and adjust their data labels, approved destinations, and exception path. A profile should name its owner, record why it changed, and carry synthetic `allow`, `hold`, and `deny` examples. The free OSS does not lock this behind a paid tier.

## Optional OpenTelemetry evidence bridge

If an application already uses OpenTelemetry, it can attach a **content-minimised** Share Preflight receipt to an existing span. The optional mapper distinguishes the preflight result, provider-reported/estimated/unknown cost, and named task-specific evaluation rather than treating them as one generic "quality" claim.

See [the one-screen integration example](examples/otel-evidence-bridge.md). It adds no telemetry dependency to this project, does not export data, and does not put input text, matched values, receipt paths, prompts, or completions into the mapped attributes.

## Online-only delivery path

The OSS is useful on its own. If a team needs help, the compatible paid delivery is not a required meeting: it can be completed by email or an online form using only non-sensitive policy metadata. The deliverable can be a reviewed profile file, synthetic tests, an installation guide, and a content-minimised change receipt. Do not send source text, credentials, customer data, or a raw secret-scanner report for this setup.

Start with [`remote-profile-request.template.json`](remote-profile-request.template.json), replace the placeholders, and validate it locally:

```sh
node validate-remote-profile-request.mjs my-profile-request.json
```

`READY_FOR_PROFILE_TRANSLATION` means the request has the fields needed to draft a profile. It is not an approval, a security assessment, or a claim that the resulting profile is correct.

## What this does not claim

Share Preflight does not guarantee leak prevention, detect every sensitive-data type, detect all shadow AI use, certify compliance, or decide whether a classification is correct. A `PASS_WITHIN_CONFIGURED_SCOPE` result applies only to the checks you enabled. A responsible person decides whether material may be shared.

## Test

Requires Node.js and a local OPA binary.

```sh
node tests/verify.mjs
```

The test uses synthetic fixtures only. It proves deterministic behavior for those cases, not production effectiveness or user demand.

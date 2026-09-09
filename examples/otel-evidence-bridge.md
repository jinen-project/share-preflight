# Optional OpenTelemetry evidence bridge

Use this only when your application already creates OpenTelemetry spans. Share Preflight stays local and does not need an OTel dependency.

The optional mapper records four different facts on a span:

| Put here | Attribute family | Meaning |
| --- | --- | --- |
| Share Preflight receipt | `share_preflight.receipt.*`, `share_preflight.policy.*` | Configured preflight outcome and profile, not a safety guarantee |
| Cost evidence | `share_preflight.cost.*` | `ACTUAL_PROVIDER_REPORTED`, `ESTIMATED_RATE_CARD`, or `UNKNOWN` |
| Task-specific evaluation | `share_preflight.evaluation.*` | Named test/acceptance result, or `UNKNOWN` / `NOT_RUN` |
| Content boundary | `share_preflight.content.capture=DISABLED` | This mapper does not add source text, finding values, receipt paths, prompts, or completions |

```js
import { toOtelAttributes } from './otel-evidence-bridge.mjs';

// `receipt` comes from Share Preflight. `span` is created by your existing OTel setup.
span.setAttributes(toOtelAttributes({
  receipt,
  cost: { kind: 'ESTIMATED_RATE_CARD', amount_usd: 0.0012, basis_id: 'team-rate-card-v01' },
  evaluation: { status: 'PASS', name: 'team-acceptance-check', version: 'v01' }
}));
```

Do not translate an estimated rate card into an actual bill. Do not treat an evaluator pass as universal quality, correctness, safety, or approval. “Reasoning strength” is not emitted: if a provider exposes a requested reasoning setting or reasoning-token counter, add that separately with its provider-specific meaning.

## OpenAI SDK trace relationship

When a vendor SDK auto-generates its own GenAI span and does not offer a safe custom-attribute hook, create a bounded `share_preflight.decision` parent span with these attributes, then invoke the SDK inside that trace context. The relation is visible without copying receipt fields or source content into the vendor span.

The companion local proof in the development repository used a loopback mock server, an in-memory exporter, OpenAI JS SDK 6.49.0, and `@opentelemetry/instrumentation-openai` 0.20.0. It does **not** establish behavior with the real service, production exporters, or other versions.

/**
 * Metadata-only condition check that sits before local inspection and OPA.
 * It intentionally has no source-text, identifier, purpose, or file input.
 */

const ALLOWED_FIELDS = new Set([
  'representation_mode',
  'source_boundary_declared',
  'destination_declared',
  'responsible_owner_declared',
  'external_handoff_requested'
]);
const REPRESENTATION_MODES = new Set(['NONE', 'METADATA_ONLY']);

function requireMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('HANDOFF_ENTRY_METADATA_REQUIRED');
  }
  for (const field of Object.keys(metadata)) {
    if (!ALLOWED_FIELDS.has(field)) throw new Error('RAW_OR_UNKNOWN_HANDOFF_FIELD_DENIED');
  }
  if (!REPRESENTATION_MODES.has(metadata.representation_mode)) {
    throw new Error('REPRESENTATION_MODE_REQUIRED');
  }
  for (const field of [...ALLOWED_FIELDS].filter(field => field !== 'representation_mode')) {
    if (typeof metadata[field] !== 'boolean') throw new Error(`${field.toUpperCase()}_BOOLEAN_REQUIRED`);
  }
}

function result(decision, missingConditions = []) {
  return {
    schema_version: 'HANDOFF_ENTRY_PREFLIGHT_V01',
    decision,
    missing_conditions: missingConditions,
    available_dispositions: ['REST', 'PAUSE', 'CONTINUE_LOCAL', 'TRY_BOUNDEDLY'],
    external_actions_permitted: false,
    persistence_created: false,
    nonclaims: [
      'This preflight does not read or request source text, a path, an identifier, credentials, or customer data.',
      'It does not infer a purpose, confirm a classification, authorize a destination, invoke OPA, or send a handoff.',
      'A ready local inspection condition is not an approval to share material externally.'
    ]
  };
}

/**
 * Preserve an incomplete beginning as explorable metadata rather than a failed
 * request. Only a separate external handoff request becomes a HOLD here.
 */
export function preflightHandoffEntry(metadata) {
  requireMetadata(metadata);
  if (metadata.external_handoff_requested) return result('HOLD_EXTERNAL_HANDOFF_SEPARATE_AUTHORITY');
  if (metadata.representation_mode === 'NONE') return result('STARTING_CONDITION_DISCOVERY_READY');

  const missing = [
    !metadata.source_boundary_declared && 'SOURCE_BOUNDARY',
    !metadata.destination_declared && 'DESTINATION_BOUNDARY',
    !metadata.responsible_owner_declared && 'RESPONSIBLE_RELATION'
  ].filter(Boolean);
  if (missing.length) return result('BOUNDARY_DISCOVERY_READY', missing);
  return result('LOCAL_INSPECTION_READY');
}

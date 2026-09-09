package share_preflight

test_public_after_scoped_preflight if {
  result := decision with input as {"preflight_status":"PASS_WITHIN_CONFIGURED_SCOPE", "profile_id":"standard-conservative-v01", "data_classification":"public", "destination":"external-ai", "exception_approved":false}
  result == {"decision":"allow", "reason_code":"PUBLIC_AFTER_SCOPED_PREFLIGHT"}
}

test_preflight_hold_cannot_be_overridden if {
  result := decision with input as {"preflight_status":"HOLD_FOR_REVIEW", "profile_id":"standard-conservative-v01", "data_classification":"public", "destination":"external-ai", "exception_approved":true}
  result == {"decision":"hold", "reason_code":"PREFLIGHT_REVIEW_REQUIRED"}
}

test_restricted_unapproved_is_denied if {
  result := decision with input as {"preflight_status":"PASS_WITHIN_CONFIGURED_SCOPE", "profile_id":"standard-conservative-v01", "data_classification":"restricted", "destination":"external-ai", "exception_approved":false}
  result == {"decision":"deny", "reason_code":"RESTRICTED_TO_UNAPPROVED_DESTINATION"}
}

test_unknown_profile_holds if {
  result := decision with input as {"preflight_status":"PASS_WITHIN_CONFIGURED_SCOPE", "profile_id":"unknown", "data_classification":"public", "destination":"external-ai", "exception_approved":false}
  result == {"decision":"hold", "reason_code":"UNKNOWN_POLICY_PROFILE"}
}

package share_preflight

required_fields := {"preflight_status", "profile_id", "data_classification", "destination", "exception_approved"}

missing_fields contains field if {
  field := required_fields[_]
  object.get(input, field, "__MISSING__") == "__MISSING__"
}

profile := object.get(data.profiles, input.profile_id, null)
profile_exists if { profile != null }
public_classification if { profile_exists; input.data_classification == profile.public_classifications[_] }
restricted_classification if { profile_exists; input.data_classification == profile.restricted_classifications[_] }
approved_destination if { profile_exists; input.destination == profile.approved_destinations[_] }
approved_exception if { approved_destination; input.exception_approved == true }
restricted_unapproved if { restricted_classification; not approved_destination }

decision := {"decision":"hold", "reason_code":"PREFLIGHT_REVIEW_REQUIRED"} if { input.preflight_status == "HOLD_FOR_REVIEW" }
decision := {"decision":"hold", "reason_code":"MISSING_REQUIRED_INPUT"} if { input.preflight_status != "HOLD_FOR_REVIEW"; count(missing_fields) > 0 }
decision := {"decision":"hold", "reason_code":"UNKNOWN_POLICY_PROFILE"} if { input.preflight_status != "HOLD_FOR_REVIEW"; count(missing_fields) == 0; not profile_exists }
decision := {"decision":"deny", "reason_code":"RESTRICTED_TO_UNAPPROVED_DESTINATION"} if { input.preflight_status == "PASS_WITHIN_CONFIGURED_SCOPE"; count(missing_fields) == 0; profile_exists; restricted_unapproved }
decision := {"decision":"allow", "reason_code":"PUBLIC_AFTER_SCOPED_PREFLIGHT"} if { input.preflight_status == "PASS_WITHIN_CONFIGURED_SCOPE"; count(missing_fields) == 0; profile_exists; public_classification }
decision := {"decision":"allow", "reason_code":"APPROVED_DESTINATION_WITH_EXCEPTION"} if { input.preflight_status == "PASS_WITHIN_CONFIGURED_SCOPE"; count(missing_fields) == 0; profile_exists; not public_classification; approved_exception }
decision := {"decision":"hold", "reason_code":"REQUIRES_OWNER_REVIEW"} if { input.preflight_status == "PASS_WITHIN_CONFIGURED_SCOPE"; count(missing_fields) == 0; profile_exists; not public_classification; not approved_exception; not restricted_unapproved }

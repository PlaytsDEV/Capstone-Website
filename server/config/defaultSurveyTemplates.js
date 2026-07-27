const labels = {
  satisfaction: ["Very dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very satisfied"],
  agreement: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
  likelihood: ["Very unlikely", "Unlikely", "Unsure", "Likely", "Very likely"],
};
const opts = (items) => items.map((label) => ({
  value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""),
  label,
}));
const scaleOpts = (items, includeNotApplicable = false) => [
  ...items.map((label, index) => ({ value: String(index + 1), label: `${index + 1}. ${label}` })),
  ...(includeNotApplicable ? [{ value: "not_applicable", label: "Not applicable" }] : []),
];
const q = (key, text, type, category, required = true, extra = {}) => ({
  key, text, type, category, required, includeInAnalytics: !["long_text", "short_text"].includes(type),
  includeInAI: true, active: true, ...extra,
});
const rating = (key, text, category, extra = {}) => q(key, text, "rating_5", category, true, {
  min: 1, max: 5, options: scaleOpts(labels.satisfaction), ...extra,
});
const agreement = (key, text, category, extra = {}) => q(key, text, "likert", category, true, {
  min: 1, max: 5, options: scaleOpts(labels.agreement), ...extra,
});
const choice = (key, text, category, items, extra = {}) => q(key, text, "single_choice", category, true, {
  options: opts(items), ...extra,
});
const yesNo = (key, text, category) => q(key, text, "yes_no", category);
const long = (key, text, category, required = false, conditional) => q(
  key, text, "long_text", category, required,
  { includeInAnalytics: false, ...(conditional ? { conditional } : {}) },
);
const when = (questionKey, value, requiredWhenVisible = true) => ({
  questionKey, operator: "equals", value, requiredWhenVisible,
});
const finalize = (questions) => questions.map((question, index) => ({ ...question, order: index + 1 }));

const quarterly = finalize([
  rating("overall_satisfaction", "How satisfied are you with your overall stay at Lilycrest Residences?", "overall_experience"),
  q("recommendation_score", "How likely are you to recommend Lilycrest Residences to a friend, classmate, or coworker?", "nps", "recommendation", true, { min: 0, max: 10 }),
  choice("renewal_intent", "How likely are you to renew or extend your stay?", "renewal_intent", labels.likelihood.slice().reverse()),
  rating("room_cleanliness", "Please rate the cleanliness of your room.", "cleanliness"),
  rating("room_quality_rating", "Please rate the condition and comfort of your room.", "room_quality"),
  rating("shared_area_cleanliness", "Please rate the cleanliness of shared areas and facilities.", "cleanliness"),
  yesNo("recurring_room_issue", "Have you experienced any recurring room or facility issue this quarter?", "room_quality"),
  long("recurring_room_issue_details", "What recurring room or facility issue did you experience?", "room_quality", false, when("recurring_room_issue", "yes")),
  yesNo("maintenance_request_submitted", "Did you submit a maintenance request during this quarter?", "maintenance_response"),
  rating("maintenance_response_rating", "How satisfied were you with the response time?", "maintenance_response", { conditional: when("maintenance_request_submitted", "yes") }),
  rating("maintenance_quality_rating", "How satisfied were you with the quality of the completed repair?", "maintenance_quality", { conditional: when("maintenance_request_submitted", "yes") }),
  choice("maintenance_resolution", "Was the issue fully resolved?", "maintenance_quality", ["Yes, fully resolved", "Partially resolved", "No, not resolved"], { conditional: when("maintenance_request_submitted", "yes") }),
  rating("staff_service_rating", "Please rate the professionalism and helpfulness of the dormitory staff or administrator.", "staff_service"),
  rating("communication_clarity", "Please rate how clearly important announcements, rules, and updates are communicated.", "communication"),
  agreement("concern_handling_fairness", "When you raise a concern, do you feel that it is acknowledged and handled fairly?", "staff_service"),
  rating("safety_rating", "How safe do you feel inside the dormitory?", "safety_security"),
  yesNo("safety_concern", "Have you noticed any safety or security concern that management should address?", "safety_security"),
  long("safety_concern_details", "Please describe the safety or security concern.", "safety_security", false, when("safety_concern", "yes")),
  rating("billing_clarity_rating", "Please rate how clear and understandable your billing information is.", "billing_clarity"),
  yesNo("billing_problem", "Have you experienced an incorrect, confusing, or delayed bill?", "billing_clarity"),
  long("billing_problem_details", "Please describe the billing concern.", "billing_clarity", false, when("billing_problem", "yes")),
  rating("internet_reliability", "Please rate the reliability of the internet or connectivity available during your stay.", "amenities_connectivity", { options: scaleOpts(labels.satisfaction, true) }),
  choice("priority_area", "Which area needs the most improvement?", "improvement_priority", ["Room condition", "Cleanliness", "Shared facilities", "Maintenance", "Staff service", "Safety and security", "Billing and payments", "Internet or connectivity", "Communication", "House rules or policies", "Other"]),
  long("priority_improvement", "What is the most important improvement Lilycrest should prioritize next?", "improvement_priority"),
  long("positive_feedback", "Is there anything Lilycrest is doing well that should be continued?", "positive_feedback"),
]);

const moveOut = finalize([
  choice("move_out_reason", "What is your main reason for moving out?", "move_out_reason", ["End of work, internship, or school assignment", "Moving closer to work or school", "Returning to my home province", "Financial reason", "Room or facility concern", "Maintenance concern", "Staff or management concern", "Billing concern", "Safety or security concern", "Conflict with roommates or other tenants", "Transferring to another Lilycrest branch or room", "Moving to a different accommodation", "Personal or family reason", "Other"]),
  long("move_out_reason_details", "Please provide more details about your reason for moving out.", "move_out_reason"),
  choice("avoidable_move_out", "Was your move-out avoidable through an action from management?", "retention", ["Yes", "Maybe", "No"]),
  long("management_difference", "What could management have done differently?", "retention", false, { questionKey: "avoidable_move_out", operator: "not_equals", value: "no", requiredWhenVisible: true }),
  rating("overall_satisfaction", "How satisfied were you with your overall stay?", "overall_experience"),
  rating("room_quality_rating", "How satisfied were you with your room condition and comfort?", "room_quality"),
  rating("cleanliness_rating", "How satisfied were you with cleanliness?", "cleanliness"),
  rating("maintenance_quality_rating", "How satisfied were you with maintenance service?", "maintenance_quality", { options: scaleOpts(labels.satisfaction, true) }),
  rating("staff_service_rating", "How satisfied were you with the staff or administrator?", "staff_service"),
  rating("billing_clarity_rating", "How satisfied were you with billing and payment information?", "billing_clarity"),
  rating("safety_rating", "How safe did you feel during your stay?", "safety_security"),
  agreement("complaint_handling", "Were your concerns handled fairly and within a reasonable time?", "staff_service", { options: scaleOpts(labels.agreement, true) }),
  q("recommendation_score", "How likely are you to recommend Lilycrest Residences?", "nps", "recommendation", true, { min: 0, max: 10 }),
  choice("return_intent", "Would you consider staying at Lilycrest again?", "retention", ["Yes", "Maybe", "No"]),
  long("best_part", "What was the best part of your stay?", "positive_feedback"),
  long("biggest_problem", "What was the biggest problem during your stay?", "improvement_priority"),
  long("priority_improvement", "What is the single most important improvement Lilycrest should make?", "improvement_priority", true),
]);

const moveIn = finalize([
  rating("reservation_ease", "How easy was it to complete the reservation or application process?", "move_in_experience"),
  agreement("document_clarity", "Were the document requirements clearly explained?", "move_in_experience"),
  agreement("payment_clarity", "Were payment requirements and amounts clearly explained before move-in?", "billing_clarity"),
  agreement("contract_clarity", "Was the contract or lease information easy to understand?", "move_in_experience"),
  yesNo("room_ready", "Was your assigned room or bed ready when you arrived?", "move_in_experience"),
  long("room_not_ready_details", "Please describe what was not ready.", "move_in_experience", false, when("room_ready", "no")),
  choice("room_match", "Did the actual room condition match the information provided before move-in?", "move_in_experience", ["Yes", "Partially", "No"]),
  agreement("rules_clarity", "Were the dormitory rules and important policies explained clearly?", "communication"),
  rating("move_in_satisfaction", "How satisfied are you with your overall move-in experience?", "overall_experience"),
  long("move_in_improvement", "What should be improved in the move-in process?", "improvement_priority"),
]);

const maintenance = finalize([
  choice("maintenance_resolution", "Was the maintenance issue resolved?", "maintenance_quality", ["Fully resolved", "Partially resolved", "Not resolved"]),
  rating("maintenance_response_rating", "How satisfied are you with the response time?", "maintenance_response"),
  rating("maintenance_quality_rating", "How satisfied are you with the quality of the repair?", "maintenance_quality"),
  agreement("maintenance_professionalism", "Was the staff member professional and respectful?", "staff_service"),
  agreement("repair_cleanliness", "Was the area left clean and orderly after the repair?", "maintenance_quality", { options: scaleOpts(labels.agreement, true) }),
  yesNo("maintenance_follow_up", "Do you need additional follow-up?", "maintenance_response"),
  long("maintenance_follow_up_details", "Please explain what additional follow-up is needed.", "maintenance_response", false, when("maintenance_follow_up", "yes")),
  long("additional_comments", "Additional comments", "positive_feedback"),
]);

const renewal = finalize([
  choice("renewal_intent", "Are you planning to renew your stay?", "renewal_intent", ["Yes", "Maybe", "No", "Not decided yet"]),
  q("renewal_factors", "What factors will affect your renewal decision?", "multiple_choice", "retention", true, { options: opts(["Rental rate", "Room availability", "Room condition", "Cleanliness", "Location", "Staff service", "Maintenance service", "Safety and security", "Internet or amenities", "Roommates", "Work or school assignment", "Personal or family plans", "Other"]) }),
  long("renewal_concern", "What is the main concern that may prevent you from renewing?", "retention"),
  choice("renewal_preference", "Would you prefer to renew, transfer, or end your stay?", "renewal_intent", ["Renew the same room or bed", "Transfer to another room", "Transfer to another branch", "End the stay", "Not decided"]),
  rating("overall_satisfaction", "How satisfied are you with your current stay?", "overall_experience"),
  long("renewal_improvement", "What could Lilycrest improve to encourage you to renew?", "improvement_priority"),
  yesNo("renewal_contact_consent", "May an administrator contact you regarding your renewal concerns?", "retention"),
]);

export const DEFAULT_SURVEY_TEMPLATES = [
  { systemTemplateKey: "quarterly_tenant_satisfaction", familyKey: "system_quarterly_tenant_satisfaction", name: "Quarterly Tenant Satisfaction Survey", description: "Your feedback helps Lilycrest Residences improve its rooms, facilities, services, and tenant experience. Please answer based on your experience during the current quarter.", purpose: "Measure quarterly tenant experience and identify operational issues early.", surveyType: "quarterly_satisfaction", recommendedFrequency: "Quarterly", recommendedTrigger: "Every quarter", estimatedCompletionMinutes: "4–6 minutes", questions: quarterly, isAnonymous: true, isMandatory: false },
  { systemTemplateKey: "mandatory_move_out_experience", familyKey: "system_mandatory_move_out_experience", name: "Mandatory Move-Out Experience Survey", description: "Before your move-out is finalized, please share your experience with Lilycrest Residences. Your feedback will help management improve the stay of current and future tenants.", purpose: "Identify avoidable turnover and evaluate the complete stay.", surveyType: "move_out", recommendedFrequency: "Per move-out", recommendedTrigger: "Before administrative move-out finalization", estimatedCompletionMinutes: "4–6 minutes", questions: moveOut, isAnonymous: true, isMandatory: true },
  { systemTemplateKey: "move_in_onboarding", familyKey: "system_move_in_onboarding", name: "Move-In and Onboarding Survey", description: "Help us improve reservation, document, payment, contract, room assignment, and move-in processes.", purpose: "Measure the quality of onboarding and move-in readiness.", surveyType: "move_in", recommendedFrequency: "Per move-in", recommendedTrigger: "7–14 days after successful move-in", estimatedCompletionMinutes: "3–4 minutes", questions: moveIn, isAnonymous: true, isMandatory: false },
  { systemTemplateKey: "maintenance_service_follow_up", familyKey: "system_maintenance_service_follow_up", name: "Maintenance Service Follow-Up Survey", description: "Tell us whether your maintenance concern was resolved promptly and professionally.", purpose: "Evaluate completed maintenance request quality and timeliness.", surveyType: "maintenance", recommendedFrequency: "Per completed request", recommendedTrigger: "After a request is completed or resolved", estimatedCompletionMinutes: "1–2 minutes", questions: maintenance, isAnonymous: false, isMandatory: false },
  { systemTemplateKey: "lease_renewal_retention", familyKey: "system_lease_renewal_retention", name: "Lease Renewal and Retention Survey", description: "Help management understand renewal plans and concerns early.", purpose: "Identify renewal intent and concerns that could prevent retention.", surveyType: "custom", recommendedFrequency: "Before expiration", recommendedTrigger: "30–60 days before contract expiration", estimatedCompletionMinutes: "2–3 minutes", questions: renewal, isAnonymous: false, isMandatory: false },
].map((template) => ({
  ...template,
  industryCategory: "Dormitory and co-living operations",
  templateVersion: "1.0.0",
  defaultAnonymousSetting: template.isAnonymous,
  analyticsCategories: [...new Set(template.questions.map((question) => question.category))],
  isSystemTemplate: true,
  status: "draft",
  version: 1,
  branchIds: [],
}));

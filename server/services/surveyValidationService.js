const empty = (value) =>
  value === undefined || value === null || value === "" ||
  (Array.isArray(value) && value.length === 0);

const visible = (question, answers) => {
  const rule = question.conditional;
  if (!rule?.questionKey) return true;
  const actual = answers.get(rule.questionKey);
  if (rule.operator === "not_equals") return actual !== rule.value;
  if (rule.operator === "includes") return Array.isArray(actual) && actual.includes(rule.value);
  return actual === rule.value;
};

const CHOICE_TYPES = new Set(["single_choice", "multiple_choice", "dropdown", "ranking"]);
const COMPARABLE_TYPES = new Set(["rating_5", "rating_10", "nps", "likert", "yes_no"]);

export function validateSurveyTemplateDefinition(template, { publishing = false } = {}) {
  const errors = [];
  const questions = Array.isArray(template?.questions) ? template.questions : [];
  if (!String(template?.name || "").trim()) errors.push({ field: "name", code: "REQUIRED", message: "Template name is required." });
  if (!template?.surveyType) errors.push({ field: "surveyType", code: "REQUIRED", message: "Survey type is required." });
  if (!questions.length) errors.push({ field: "questions", code: "REQUIRED", message: "Add at least one question." });
  const keys = new Set();
  const analyticsKeys = new Set();
  questions.forEach((question, index) => {
    const field = `questions.${index}`;
    const key = String(question?.key || "").trim();
    if (!key) errors.push({ field: `${field}.key`, code: "REQUIRED", message: "Question analytics key is required." });
    else if (keys.has(key)) errors.push({ field: `${field}.key`, code: "DUPLICATE", message: "Question keys must be unique." });
    keys.add(key);
    if (!String(question?.text || "").trim()) errors.push({ field: `${field}.text`, code: "REQUIRED", message: "Question text is required." });
    if (question?.includeInAnalytics !== false && key) {
      if (analyticsKeys.has(key)) errors.push({ field: `${field}.key`, code: "DUPLICATE_ANALYTICS_KEY", message: "Analytics keys must be unique." });
      analyticsKeys.add(key);
    }
    if (CHOICE_TYPES.has(question?.type)) {
      const options = (question.options || []).filter((option) =>
        String(option?.value || "").trim() && String(option?.label || "").trim());
      if (options.length < 2) errors.push({ field: `${field}.options`, code: "MIN_OPTIONS", message: "Choice questions require at least two options." });
      if (new Set(options.map((option) => String(option.value).trim())).size !== options.length) {
        errors.push({ field: `${field}.options`, code: "DUPLICATE_OPTIONS", message: "Choice option values must be unique." });
      }
    }
    if (question?.conditional?.questionKey) {
      const parentIndex = questions.findIndex((candidate) => candidate.key === question.conditional.questionKey);
      if (parentIndex < 0) errors.push({ field: `${field}.conditional`, code: "INVALID_PARENT", message: "Conditional question parent does not exist." });
      else if (parentIndex >= index) errors.push({ field: `${field}.conditional`, code: "INVALID_ORDER", message: "Conditional questions must depend on an earlier question." });
    }
    if (publishing && question?.includeInAnalytics !== false && !COMPARABLE_TYPES.has(question?.type) &&
        ["overall_satisfaction", "recommendation_score", "renewal_intent"].includes(key)) {
      errors.push({ field: `${field}.type`, code: "INCOMPATIBLE_BENCHMARK_TYPE", message: "Benchmark question type is not comparable." });
    }
  });
  return { valid: errors.length === 0, errors };
}

export function validateSurveyAnswers(template, rawAnswers, { submission = false } = {}) {
  const questions = (template.questions || []).filter((question) => question.active !== false);
  const byKey = new Map(questions.map((question) => [question.key, question]));
  const normalized = [];
  const errors = [];
  const values = new Map();

  for (const answer of Array.isArray(rawAnswers) ? rawAnswers : []) {
    const question = byKey.get(String(answer.questionKey || ""));
    if (!question) {
      errors.push({ field: answer.questionKey || "unknown", code: "UNKNOWN_QUESTION" });
      continue;
    }
    if (values.has(question.key)) {
      errors.push({ field: question.key, code: "DUPLICATE_ANSWER" });
      continue;
    }
    values.set(question.key, answer.value);
    normalized.push({
      questionId: question._id,
      questionKey: question.key,
      value: answer.value,
    });
  }

  for (const question of questions) {
    if (!visible(question, values)) continue;
    const value = values.get(question.key);
    const required = question.required ||
      (question.conditional?.requiredWhenVisible && visible(question, values));
    if (submission && required && empty(value)) {
      errors.push({ field: question.key, code: "REQUIRED" });
      continue;
    }
    if (empty(value)) continue;
    const isNotApplicable = String(value) === "not_applicable" &&
      (question.options || []).some((option) => option.value === "not_applicable");
    if (isNotApplicable) {
      continue;
    }
    if (["rating_5", "star_rating"].includes(question.type) &&
        (!Number.isFinite(Number(value)) || Number(value) < 1 || Number(value) > 5)) {
      errors.push({ field: question.key, code: "RATING_OUT_OF_RANGE" });
    } else if (["rating_10", "nps"].includes(question.type) &&
        (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 10)) {
      errors.push({ field: question.key, code: "RATING_OUT_OF_RANGE" });
    } else if (question.type === "number" &&
        (!Number.isFinite(Number(value)) ||
          (question.min != null && Number(value) < question.min) ||
          (question.max != null && Number(value) > question.max))) {
      errors.push({ field: question.key, code: "NUMBER_OUT_OF_RANGE" });
    } else if (["single_choice", "dropdown", "yes_no"].includes(question.type)) {
      const allowed = new Set((question.options || []).map((option) => option.value));
      if (question.type === "yes_no") {
        allowed.add("yes"); allowed.add("no");
      }
      if (!allowed.has(String(value))) errors.push({ field: question.key, code: "INVALID_CHOICE" });
    } else if (["multiple_choice", "ranking"].includes(question.type)) {
      const allowed = new Set((question.options || []).map((option) => option.value));
      if (!Array.isArray(value) || value.some((item) => !allowed.has(String(item)))) {
        errors.push({ field: question.key, code: "INVALID_CHOICE" });
      }
    } else if (["short_text", "long_text"].includes(question.type) &&
        String(value).length > Number(question.characterLimit || 4000)) {
      errors.push({ field: question.key, code: "TEXT_TOO_LONG" });
    } else if (question.type === "date" && Number.isNaN(new Date(value).getTime())) {
      errors.push({ field: question.key, code: "INVALID_DATE" });
    }
  }

  const visibleQuestions = questions.filter((question) => visible(question, values));
  const answered = visibleQuestions.filter((question) => !empty(values.get(question.key))).length;
  return {
    valid: errors.length === 0,
    errors,
    answers: normalized,
    completionPercentage: visibleQuestions.length
      ? Math.round((answered / visibleQuestions.length) * 100)
      : 100,
  };
}

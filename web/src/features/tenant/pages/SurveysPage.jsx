import React, { useEffect, useMemo, useState } from "react";
import { surveyApi } from "../../../shared/api/surveyApi";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { showNotification } from "../../../shared/utils/notification";
import "./SurveysPage.css";

const valueFor = (answers, key) => answers.find((answer) => answer.questionKey === key)?.value ?? "";
const apiData = (result) => result?.data ?? result;
const isVisible = (question, answers) => {
  const rule = question.conditional;
  if (!rule?.questionKey) return true;
  const actual = valueFor(answers, rule.questionKey);
  if (rule.operator === "not_equals") return actual !== rule.value;
  if (rule.operator === "includes") return Array.isArray(actual) && actual.includes(rule.value);
  return actual === rule.value;
};

export default function SurveysPage() {
  const [items, setItems] = useState([]);
  const [active, setActive] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  const load = async () => {
    try {
      setItems(apiData(await surveyApi.listMine()) || []);
    } catch (requestError) {
      setError(requestError.message || "Unable to load surveys.");
    }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const warn = (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const open = async (id) => {
    setBusy(true);
    try {
      const result = apiData(await surveyApi.getMine(id));
      setActive(result);
      setAnswers(result?.response?.answers || []);
      setDirty(false);
      setFieldErrors({});
    } catch (requestError) {
      setError(requestError.message || "Unable to open survey.");
    } finally {
      setBusy(false);
    }
  };
  const questions = useMemo(
    () => (active?.assignment?.templateId?.questions || [])
      .filter((question) => question.active !== false && isVisible(question, answers))
      .sort((left, right) => left.order - right.order),
    [active, answers],
  );
  const setValue = (questionKey, value) => {
    setAnswers((current) => {
      const next = [
        ...current.filter((answer) => answer.questionKey !== questionKey),
        { questionKey, value },
      ];
      const visibleKeys = new Set((active?.assignment?.templateId?.questions || [])
        .filter((question) => question.active !== false && isVisible(question, next))
        .map((question) => question.key));
      return next.filter((answer) => visibleKeys.has(answer.questionKey));
    });
    setFieldErrors((current) => ({ ...current, [questionKey]: undefined }));
    setDirty(true);
  };
  const toggleChoice = (questionKey, option) => {
    const current = valueFor(answers, questionKey);
    const selected = Array.isArray(current) ? current : [];
    setValue(
      questionKey,
      selected.includes(option) ? selected.filter((value) => value !== option) : [...selected, option],
    );
  };
  const save = async (submit = false) => {
    setBusy(true);
    setError("");
    try {
      const id = active.assignment._id;
      await (submit ? surveyApi.submit(id, answers) : surveyApi.saveDraft(id, answers));
      setDirty(false);
      showNotification(submit ? "Survey submitted." : "Draft saved.", "success");
      if (submit) setActive(null);
      await load();
    } catch (requestError) {
      const details = requestError?.response?.data?.errors;
      const nextErrors = Object.fromEntries((details || []).map((item) => [item.field, item.code]));
      setFieldErrors(nextErrors);
      if (details?.[0]?.field) {
        requestAnimationFrame(() => document.getElementById(`survey-question-${details[0].field}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
      }
      setError(details?.length
        ? details.map((item) => `${item.field}: ${item.code}`).join(", ")
        : (requestError.message || "Survey could not be saved."));
    } finally {
      setBusy(false);
    }
  };
  const leaveSurvey = () => {
    if (dirty) {
      setConfirmLeave(true);
    } else {
      setActive(null);
    }
  };

  if (active) return (
    <section className="tenant-page survey-form-page">
      <button className="btn btn-secondary" onClick={leaveSurvey}>Back to surveys</button>
      <h1>{active.assignment.templateId.name}</h1>
      <p>{active.assignment.templateId.introductoryText || active.assignment.templateId.description}</p>
      <div className="tenant-survey-intro"><span>{active.assignment.templateId.estimatedCompletionMinutes || `${Math.max(1, Math.ceil(questions.length / 4))} minutes`}</span><span>{active.assignment.isAnonymous ? "Anonymous response" : "Identified response"}</span></div>
      <progress max="100" value={questions.length ? Math.round((questions.filter((question) => {
        const value = valueFor(answers, question.key);
        return value !== "" && value != null && (!Array.isArray(value) || value.length);
      }).length / questions.length) * 100) : 0} aria-label="Survey completion progress" />
      {error && <div className="info-box warning">{error}</div>}
      {questions.map((question, index) => (
        <fieldset id={`survey-question-${question.key}`} key={question.key} className={`reservation-card tenant-survey-question${fieldErrors[question.key] ? " has-error" : ""}`} aria-invalid={Boolean(fieldErrors[question.key])}>
          <legend>{index + 1}. {question.text} <span>{question.required ? "Required" : "Optional"}</span></legend>
          {question.helpText && <p className="text-muted">{question.helpText}</p>}
          {["rating_5", "star_rating"].includes(question.type) && (
            <div className="tenant-survey-scale">
              {(question.options?.length ? question.options : [1, 2, 3, 4, 5].map((number) => ({ value: String(number), label: String(number) }))).map((option) => <label key={option.value} className={String(valueFor(answers, question.key)) === String(option.value) ? "is-selected" : ""}><input type="radio" name={question.key} value={option.value} checked={String(valueFor(answers, question.key)) === String(option.value)} onChange={(event) => setValue(question.key, event.target.value === "not_applicable" ? "not_applicable" : Number(event.target.value))} /><span>{option.label}</span></label>)}
            </div>
          )}
          {["rating_10", "nps"].includes(question.type) && (
            <div className="tenant-survey-nps">{[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) => <label key={number} className={valueFor(answers, question.key) === number ? "is-selected" : ""}><input type="radio" name={question.key} value={number} checked={valueFor(answers, question.key) === number} onChange={() => setValue(question.key, number)} /><span>{number}</span></label>)}</div>
          )}
          {["single_choice", "dropdown", "yes_no", "likert"].includes(question.type) && (
            <div className="tenant-survey-choices">
              {(question.type === "yes_no"
                ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]
                : question.options || []).map((option) => (
                  <label key={option.value} className={String(valueFor(answers, question.key)) === String(option.value) ? "is-selected" : ""}><input type="radio" name={question.key} value={option.value} checked={String(valueFor(answers, question.key)) === String(option.value)} onChange={() => setValue(question.key, option.value)} /><span>{option.label}</span></label>
              ))}
            </div>
          )}
          {question.type === "multiple_choice" && (
            <div className="tenant-survey-choices">
              {(question.options || []).map((option) => (
                <label key={option.value} className={(valueFor(answers, question.key) || []).includes(option.value) ? "is-selected" : ""}>
                  <input
                    type="checkbox"
                    checked={(valueFor(answers, question.key) || []).includes(option.value)}
                    onChange={() => toggleChoice(question.key, option.value)}
                  /><span>{option.label}</span>
                </label>
              ))}
            </div>
          )}
          {question.type === "ranking" && (
            <div>
              {(question.options || []).map((option) => {
                const current = valueFor(answers, question.key);
                const ranking = Array.isArray(current) ? current : [];
                return (
                  <label key={option.value} style={{ display: "flex", gap: 8, marginBlock: 6 }}>
                    <span>{option.label}</span>
                    <input
                      aria-label={`Rank ${option.label}`}
                      type="number"
                      min="1"
                      max={question.options.length}
                      value={ranking.find((entry) => entry.value === option.value)?.rank || ""}
                      onChange={(event) => setValue(question.key, [
                        ...ranking.filter((entry) => entry.value !== option.value),
                        { value: option.value, rank: Number(event.target.value) },
                      ])}
                    />
                  </label>
                );
              })}
            </div>
          )}
          {["short_text", "long_text"].includes(question.type) && (
            <textarea
              maxLength={question.characterLimit || 4000}
              value={valueFor(answers, question.key)}
              onChange={(event) => setValue(question.key, event.target.value)}
            />
          )}
          {question.type === "number" && (
            <input
              type="number"
              min={question.min}
              max={question.max}
              value={valueFor(answers, question.key)}
              onChange={(event) => setValue(question.key, Number(event.target.value))}
            />
          )}
          {question.type === "date" && (
            <input type="date" value={valueFor(answers, question.key)} onChange={(event) => setValue(question.key, event.target.value)} />
          )}
          {fieldErrors[question.key] && <p className="tenant-survey-field-error" role="alert">Please answer this required question.</p>}
        </fieldset>
      ))}
      <div className="tenant-survey-actions">
        <button className="btn btn-secondary" disabled={busy} onClick={() => save(false)}>Save Draft</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => save(true)}>Submit Survey</button>
      </div>
      <ConfirmModal
        isOpen={confirmLeave}
        title="Discard unsaved answers?"
        message="Your last changes have not been saved."
        confirmText="Leave Survey"
        variant="warning"
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          setDirty(false);
          setActive(null);
        }}
      />
    </section>
  );

  return (
    <section className="tenant-page">
      <h1>Feedback &amp; Surveys</h1>
      <p>Complete required surveys and share feedback with management.</p>
      {error && <div className="info-box warning">{error}</div>}
      {!items.length && !error && <div className="reservation-card">No surveys are currently assigned.</div>}
      {items.map((item) => (
        <article className="reservation-card" key={item._id} style={{ marginBlock: 12 }}>
          <h3>{item.surveyScheduleId?.title || item.templateId?.name}</h3>
          <p>Status: {item.status === "opened" ? "In Progress" : item.status} &middot; Due {new Date(item.dueAt).toLocaleDateString()}</p>
          <progress max="100" value={item.status === "submitted" ? 100 : item.status === "in_progress" || item.status === "opened" ? 50 : 0} aria-label={`${item.templateId?.name || "Survey"} progress`} />
          {!["submitted", "expired", "waived"].includes(item.status) && (
            <button className="btn btn-primary" disabled={busy} onClick={() => open(item._id)}>{["opened", "in_progress"].includes(item.status) ? "Continue Survey" : "Start Survey"}</button>
          )}
          {item.status === "submitted" && <p>Submitted {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : ""}. This response is locked.</p>}
        </article>
      ))}
    </section>
  );
}

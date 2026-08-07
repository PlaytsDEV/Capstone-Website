import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertCircle, CalendarClock, CheckCircle2, ClipboardList,
  Clock3, CopyPlus, Eye, Lightbulb, ListChecks, Plus, RefreshCw, RotateCcw, Send,
  Sparkles, Target, Users,
} from "lucide-react";
import BaseModal from "../../../shared/components/BaseModal";
import ConfirmModal from "../../../shared/components/ConfirmModal";
import { surveyApi } from "../../../shared/api/surveyApi";
import { showNotification } from "../../../shared/utils/notification";
import { usePermissions } from "../../../shared/hooks/usePermissions";
import "./SurveyAnalyticsPage.css";

const SECTIONS = [
  ["overview", "Overview"],
  ["templates", "Templates"],
  ["schedules", "Schedules"],
  ["analytics", "Responses & Analytics"],
  ["reports", "AI Reports"],
];
const EMPTY_TEMPLATE = {
  name: "", description: "", surveyType: "quarterly_satisfaction",
  introductoryText: "", isAnonymous: true,
  questions: [{ key: "overall_satisfaction", text: "", type: "rating_5", required: true, category: "Overall Experience" }],
};
const dateValue = (offset) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};
const EMPTY_SCHEDULE = {
  templateId: "", title: "", startAt: dateValue(0), dueAt: dateValue(14),
  closeAt: dateValue(21), recurrence: "quarterly",
};
const pretty = (value = "") => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const apiData = (result) => result?.data ?? result;


function FilterToolbar({ filters, isOwner, onChange, onReset }) {
  return (
    <section className="survey-filter-card" aria-label="Survey filters">
      <div className="survey-filter-grid">
        {isOwner && <label htmlFor="survey-branch">Branch<select id="survey-branch" value={filters.branchId} onChange={(e) => onChange("branch", e.target.value)}>
          <option value="">All branches</option><option value="gil-puyat">Gil Puyat</option><option value="guadalupe">Guadalupe</option>
        </select></label>}
        <label htmlFor="survey-type">Survey type<select id="survey-type" value={filters.surveyType} onChange={(e) => onChange("surveyType", e.target.value)}>
          <option value="">All types</option><option value="quarterly_satisfaction">Quarterly</option><option value="move_out">Move-out</option><option value="custom">Custom</option>
        </select></label>
        <label htmlFor="survey-status">Status<select id="survey-status" value={filters.status} onChange={(e) => onChange("status", e.target.value)}>
          <option value="">All statuses</option><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="closed">Closed</option>
        </select></label>
        <label htmlFor="survey-year">Year<input id="survey-year" type="number" min="2020" max="2200" value={filters.year} onChange={(e) => onChange("year", e.target.value)} /></label>
        <label htmlFor="survey-quarter">Quarter<select id="survey-quarter" value={filters.quarter} onChange={(e) => onChange("quarter", e.target.value)}>
          <option value="">All quarters</option>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
        </select></label>
      </div>
      <button type="button" className="survey-reset" onClick={onReset}><RotateCcw size={15} /> Reset filters</button>
    </section>
  );
}

function KpiGrid({ metrics }) {
  const cards = [
    [Users, "Total Assigned", metrics?.totalAssigned || 0, metrics?.totalAssigned ? "Tenant assignments" : "No active assignments"],
    [Send, "Submitted", metrics?.totalSubmitted || 0, metrics?.totalSubmitted ? "Responses received" : "No submissions yet"],
    [CalendarClock, "Pending", metrics?.pending || 0, "Awaiting tenant response"],
    [Target, "Completion Rate", `${metrics?.completionRate || 0}%`, metrics?.totalSubmitted ? "Across selected surveys" : "No submissions yet"],
  ];
  const secondary = [
    ["Average Satisfaction", metrics?.averageSatisfaction ?? "—", metrics?.averageSatisfaction == null ? "Insufficient responses" : "Out of 5"],
    ["Recommendation Score", metrics?.recommendationScore ?? "—", metrics?.recommendationScore == null ? "Insufficient responses" : "Tenant recommendation"],
  ];
  return <div className="survey-summary-metrics">
    <div className="survey-kpi-grid">{cards.map(([Icon, label, value, note]) => (
      <article className="survey-kpi-card" data-primary-kpi key={label}>
        <span className="survey-kpi-icon"><Icon size={19} /></span>
        <div><span className="survey-kpi-label">{label}</span><strong className="survey-kpi-value">{value}</strong><small>{note}</small></div>
      </article>
    ))}</div>
    <div className="survey-secondary-metrics" aria-label="Secondary survey insights">
      {secondary.map(([label, value, note]) => <div className="survey-secondary-metric" key={label}>
        <span>{label}</span><strong>{value}</strong><small>{note}</small>
      </div>)}
    </div>
  </div>;
}

function EmptyState({ onRecommended, onCreate }) {
  return <section className="survey-empty">
    <span><ClipboardList size={28} /></span>
    <h2>No surveys configured yet</h2>
    <p>Create a survey template, publish it, and schedule it for eligible tenants. Analytics will appear after responses are submitted.</p>
    <div className="survey-empty-actions"><button className="btn btn-primary" type="button" onClick={onRecommended}>Browse Recommended Templates</button>
      <button className="btn btn-secondary" type="button" onClick={onCreate}>Create From Scratch</button></div>
  </section>;
}

function ActionNeeded({ templates, schedules, metrics, onCreate, onSection, onGenerate }) {
  const draft = templates.find((item) => item.status === "draft");
  const published = templates.find((item) => item.status === "active" || item.status === "published");
  const active = schedules.find((item) => item.status === "active");
  const closed = schedules.find((item) => item.status === "closed");
  let message = "Create and publish your first survey template.";
  let label = "Browse Templates"; let action = () => onSection("templates");
  if (draft && !published) { message = "Publish a survey template before creating a schedule."; label = "Review Templates"; action = () => onSection("templates"); }
  else if (published && !active && !closed) { message = "Create and activate a survey schedule."; label = "Create Schedule"; action = () => onSection("schedules"); }
  else if (active) { message = "Survey collection is currently in progress."; label = "View Progress"; action = () => onSection("analytics"); }
  else if (closed && metrics?.totalSubmitted) { message = "Response data is ready for review and AI analysis."; label = "Generate AI Report"; action = onGenerate; }
  return <aside className="survey-action-needed">
    <span><Lightbulb size={20} /></span><div><h2>Action Needed</h2><p>{message}</p></div>
    <button className="btn btn-primary" type="button" onClick={action}>{label}</button>
  </aside>;
}

function TemplatesSection({ templates, busy, onCreate, onBrowse, onPublish, onCreateSchedule }) {
  return <section className="survey-panel">
    <header><div><h2>Survey Templates</h2><p>Build reusable question sets and publish immutable versions.</p></div>
      <div className="survey-heading-actions"><button className="btn btn-secondary" onClick={onBrowse}>Browse Template Library</button>
        <button className="btn btn-primary" onClick={onCreate}><Plus size={16} /> Create Template</button></div></header>
    {!templates.length ? <p className="survey-inline-empty">No templates match the selected filters.</p> :
      <div className="survey-table-wrap"><table><thead><tr><th>Template name</th><th>Survey type</th><th>Version</th><th>Status</th><th>Questions</th><th>Anonymous</th><th>Actions</th></tr></thead>
        <tbody>{templates.map((template) => <tr key={template._id}><td><strong>{template.name}</strong><small>{template.description}</small></td><td>{pretty(template.surveyType)}</td><td>v{template.version}</td><td><span className={`survey-status survey-status--${template.status}`}>{pretty(template.status)}</span></td><td>{template.questions?.length || 0}</td><td>{template.isAnonymous ? "Yes" : "No"}</td>
          <td><div className="survey-row-actions">{template.status === "draft" && <button disabled={busy} onClick={() => onPublish(template._id)}>Publish</button>}
            {["active", "published"].includes(template.status) && <button onClick={() => onCreateSchedule(template._id)}>Create Schedule</button>}</div></td></tr>)}</tbody></table></div>}
  </section>;
}

function TemplateLibraryModal({ open, templates, busy, preview, setPreview, onClose, onUse }) {
  return <BaseModal isOpen={open} onClose={onClose} title="Survey Template Library" subtitle="Start with a professionally structured questionnaire, then customize an editable copy." size="xl" footer={null}>
    <div className="survey-library">
      <h4>Recommended Templates</h4>
      <div className="survey-library-grid">{templates.map((template) => <article className="survey-library-card" key={template._id}>
        <span className="survey-status survey-status--active">System Template</span><h3>{template.name}</h3>
        <p>{template.purpose || template.description}</p>
        <dl><div><dt>Recommended timing</dt><dd>{template.recommendedTrigger || template.recommendedFrequency}</dd></div>
          <div><dt>Completion time</dt><dd>{template.estimatedCompletionMinutes}</dd></div>
          <div><dt>Questions</dt><dd>{template.questions?.length || 0}</dd></div></dl>
        <div className="survey-library-categories">{(template.analyticsCategories || []).slice(0, 4).map((category) => <span key={category}>{pretty(category)}</span>)}</div>
        <footer><button className="btn btn-secondary" onClick={() => setPreview(template)}>Preview</button><button className="btn btn-primary" disabled={busy} onClick={() => onUse(template)}>Use Template</button></footer>
      </article>)}</div>
      {!templates.length && <p className="survey-inline-empty">No system templates are installed. Run the repeatable default-template seed.</p>}
      {preview && <section className="survey-template-preview"><header><div><span className="survey-status">Preview</span><h3>{preview.name}</h3><p>{preview.description}</p></div><button className="btn btn-secondary" onClick={() => setPreview(null)}>Close Preview</button></header>
        <p><strong>{preview.questions?.length || 0} questions</strong> · {preview.estimatedCompletionMinutes}</p>
        <ol>{(preview.questions || []).map((question) => <li key={question.key}><strong>{question.text}</strong><span>{pretty(question.category)} · {pretty(question.type)}{question.required ? " · Required" : ""}</span></li>)}</ol>
      </section>}
    </div>
  </BaseModal>;
}

const templateGroup = (template) => ({
  quarterly_tenant_satisfaction: "Experience and Satisfaction",
  mandatory_move_out_experience: "Tenant Lifecycle",
  move_in_onboarding: "Tenant Lifecycle",
  maintenance_service_follow_up: "Operations and Maintenance",
  lease_renewal_retention: "Retention",
}[template.systemTemplateKey] || pretty(template.industryCategory || "Recommended"));

function RecommendedTemplateCard({ template, copying, onPreview, onUse }) {
  const categories = template.analyticsCategories || [];
  const anonymous = template.defaultAnonymousSetting ?? template.isAnonymous;
  return <article className="survey-library-card">
    <header><span className="survey-template-icon"><ClipboardList size={18} /></span><div><small>{templateGroup(template)}</small><h3>{template.name}</h3></div></header>
    <div className="survey-template-badges"><span className="survey-status survey-status--active">Recommended</span><span className="survey-status">System Template</span></div>
    <p>{template.purpose || template.description}</p>
    <dl className="survey-template-metadata">
      <div><ListChecks size={14} /><dt>Questions</dt><dd>{template.questions?.length || template.questionCount || 0}</dd></div>
      <div><Clock3 size={14} /><dt>Time</dt><dd>{template.estimatedCompletionMinutes}</dd></div>
      <div><CalendarClock size={14} /><dt>Timing</dt><dd>{template.recommendedTrigger || template.recommendedFrequency}</dd></div>
      <div><Users size={14} /><dt>Responses</dt><dd>{anonymous ? "Anonymous recommended" : "Identified response"}</dd></div>
    </dl>
    <div className="survey-library-categories">{categories.slice(0, 4).map((category) => <span key={category}>{pretty(category)}</span>)}{categories.length > 4 && <span>+{categories.length - 4} more</span>}</div>
    <footer><button className="btn btn-secondary" type="button" onClick={() => onPreview(template)} aria-label={`Preview ${template.name}`}><Eye size={16} /> Preview</button><button className="btn btn-primary" type="button" disabled={copying} onClick={() => onUse(template)}>{copying ? <><span className="survey-button-spinner" /> Creating Draft…</> : <><CopyPlus size={16} /> Use Template</>}</button></footer>
  </article>;
}

function StructuredTemplatesSection({ systemTemplates, templates, copyingTemplateId, actionError, onCreate, onRefresh, onPreview, onUse, onEdit, onPublish, onArchive, onCreateSchedule }) {
  return <section className="survey-template-workspace" aria-labelledby="survey-templates-title">
    <header className="survey-template-page-header"><div><h2 id="survey-templates-title">Survey Templates</h2><p>Start with a recommended dormitory survey or create a custom questionnaire.</p></div><div className="survey-heading-actions"><button className="btn btn-secondary" type="button" onClick={onRefresh}><RefreshCw size={16} /> Refresh</button><button className="btn btn-primary" type="button" onClick={onCreate}><Plus size={16} /> Create From Scratch</button></div></header>
    <section className="survey-template-section" id="recommended-templates" tabIndex="-1" aria-labelledby="recommended-templates-title">
      <header><h3 id="recommended-templates-title">Recommended Templates</h3><p>Ready-made surveys designed for dormitory operations and tenant experience monitoring.</p></header>
      {actionError && <div className="survey-template-action-error" role="alert"><strong>Unable to create the template draft</strong><p>{actionError}</p></div>}
      {systemTemplates.length ? <div className="survey-library-grid">{systemTemplates.map((template) => <RecommendedTemplateCard key={template._id} template={template} copying={copyingTemplateId === template._id} onPreview={onPreview} onUse={onUse} />)}</div> :
        <div className="survey-template-empty"><h4>Recommended templates are not installed</h4><p>The default-template seed has not populated this environment. Run the approved repeatable seed, then refresh this page.</p><button className="btn btn-secondary" type="button" onClick={onRefresh}>Refresh Templates</button></div>}
    </section>
    <section className="survey-template-section" aria-labelledby="my-templates-title">
      <header><h3 id="my-templates-title">My Templates</h3><p>Draft and published survey templates created or customized by your organization.</p></header>
      {!templates.length ? <div className="survey-template-empty"><h4>No custom templates yet</h4><p>Use a recommended template or create one from scratch.</p><div><button className="btn btn-secondary" type="button" onClick={() => document.getElementById("recommended-templates")?.focus()}>Use Recommended Template</button><button className="btn btn-secondary" type="button" onClick={onCreate}>Create From Scratch</button></div></div> :
        <div className="survey-table-wrap"><table><thead><tr><th>Template name</th><th>Type</th><th>Version</th><th>Status</th><th>Questions</th><th>Anonymous</th><th>Branch</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{templates.map((template) => <tr key={template._id}><td><strong>{template.name}</strong>{template.sourceSystemTemplateId && <small>Customized recommended template</small>}</td><td>{pretty(template.surveyType)}</td><td>v{template.version}</td><td><span className={`survey-status survey-status--${template.status}`}>{template.status === "active" ? "Published" : pretty(template.status)}</span></td><td>{template.questions?.length || 0}</td><td>{template.isAnonymous ? "Yes" : "No"}</td><td>{template.branchIds?.length ? template.branchIds.map(pretty).join(", ") : "Organization"}</td><td>{template.updatedAt?.slice(0, 10) || "—"}</td><td><div className="survey-row-actions"><button type="button" onClick={() => onPreview(template)}>{template.status === "draft" ? "Preview" : "View"}</button>{template.status === "draft" && <><button type="button" onClick={() => onEdit(template)}>Edit</button><button type="button" disabled={Boolean(copyingTemplateId)} onClick={() => onPublish(template._id)}>Publish</button><button type="button" className="survey-row-action--archive" onClick={() => onArchive(template)}>Archive</button></>}{["active", "published"].includes(template.status) && <button type="button" onClick={() => onCreateSchedule(template._id)}>Create Schedule</button>}</div></td></tr>)}</tbody></table></div>}
    </section>
  </section>;
}

const previewOptions = (question) => question.options?.length
  ? question.options.map((option) => typeof option === "string" ? { value: option, label: option } : option)
  : [];
const previewTypeLabel = (type) => ({
  rating_5: "Rating 1–5",
  rating_10: "Rating 0–10",
  nps: "Recommendation 0–10",
  likert: "Agreement scale",
  yes_no: "Yes or No",
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  short_text: "Short text",
  long_text: "Long text",
}[type] || pretty(type));

function SurveyControlPreview({ question }) {
  const options = previewOptions(question);
  if (question.type === "rating_5") {
    const scale = options.length ? options : [1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }));
    return <div className="survey-control-preview survey-control-preview--scale">{scale.map((option) => <label key={option.value}><input type="radio" disabled /><span>{option.label}</span></label>)}</div>;
  }
  if (["rating_10", "nps"].includes(question.type)) {
    return <div className="survey-control-preview survey-control-preview--nps">{Array.from({ length: 11 }, (_, value) => <label key={value}><input type="radio" disabled /><span>{value}</span></label>)}</div>;
  }
  if (question.type === "likert") {
    const scale = options.length ? options : ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"].map((label, index) => ({ value: index + 1, label }));
    return <div className="survey-control-preview survey-control-preview--scale">{scale.map((option) => <label key={option.value}><input type="radio" disabled /><span>{option.label}</span></label>)}</div>;
  }
  if (["single_choice", "yes_no"].includes(question.type)) {
    const choices = question.type === "yes_no" ? [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }] : options;
    return <div className="survey-control-preview survey-control-preview--choices">{choices.map((option) => <label key={option.value}><input type="radio" disabled /><span>{option.label}</span></label>)}</div>;
  }
  if (question.type === "multiple_choice") {
    return <div className="survey-control-preview survey-control-preview--choices">{options.map((option) => <label key={option.value}><input type="checkbox" disabled /><span>{option.label}</span></label>)}</div>;
  }
  if (["short_text", "long_text"].includes(question.type)) return <textarea className="survey-control-preview__text" rows={question.type === "long_text" ? 3 : 1} disabled placeholder="Tenant response" />;
  if (question.type === "date") return <input className="survey-control-preview__input" type="date" disabled />;
  if (question.type === "number") return <input className="survey-control-preview__input" type="number" disabled placeholder="Enter a number" />;
  return <div className="survey-control-preview__input">Response control</div>;
}

function StructuredTemplatePreview({ template, copying, onClose, onUse }) {
  const grouped = useMemo(() => (template?.questions || []).reduce((groups, question) => {
    const category = question.category || "Other";
    (groups[category] ||= []).push(question);
    return groups;
  }, {}), [template]);
  const anonymous = template && (template.defaultAnonymousSetting ?? template.isAnonymous);
  return <BaseModal isOpen={Boolean(template)} onClose={onClose} title={template?.name || "Template Preview"} subtitle="Read-only preview of the tenant answering experience." size="xl" footer={null} className="survey-template-preview-modal">
    {template && <div className="survey-preview-modal"><header><p>{template.purpose || template.description}</p><dl><div><dt>Questions</dt><dd>{template.questions?.length || 0}</dd></div><div><dt>Completion time</dt><dd>{template.estimatedCompletionMinutes || "Custom"}</dd></div><div><dt>Recommended timing</dt><dd>{template.recommendedTrigger || template.recommendedFrequency || "Administrator defined"}</dd></div><div><dt>Response setting</dt><dd>{anonymous ? "Anonymous recommended" : "Identified response"}</dd></div></dl></header>
      <div className="survey-preview-groups">{Object.entries(grouped).map(([category, questions]) => <section key={category}><h3>{pretty(category)}</h3><ol>{questions.map((question) => <li key={question.key}><div><strong>{question.text}</strong><span className="survey-status">{question.required ? "Required" : "Optional"}</span></div><p><span className="survey-question-type">{previewTypeLabel(question.type)}</span>{question.conditional?.questionKey && <span className="survey-conditional-note">Shown only when the related answer matches the configured condition.</span>}</p><SurveyControlPreview question={question} /></li>)}</ol></section>)}</div>
      <footer><button className="btn btn-secondary" type="button" onClick={onClose}>Close</button>{template.isSystemTemplate && <button className="btn btn-primary" type="button" disabled={copying} onClick={() => onUse(template)}>{copying ? <><span className="survey-button-spinner" /> Creating Draft…</> : <><CopyPlus size={16} /> Use This Template</>}</button>}</footer></div>}
  </BaseModal>;
}

function SchedulesSection({ schedules, busy, onCreate, onActivate }) {
  return <section className="survey-panel">
    <header><div><h2>Survey Schedules</h2><p>Manage survey periods, deadlines, and collection status.</p></div>
      <button className="btn btn-primary" onClick={onCreate}><Plus size={16} /> Create Schedule</button></header>
    {!schedules.length ? <p className="survey-inline-empty">No schedules match the selected filters.</p> :
      <div className="survey-table-wrap"><table><thead><tr><th>Schedule title</th><th>Branch</th><th>Period</th><th>Open</th><th>Due</th><th>Close</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{schedules.map((schedule) => <tr key={schedule._id}><td><strong>{schedule.title}</strong></td><td>{pretty(schedule.branchId || "All branches")}</td><td>{schedule.year ? `Q${schedule.quarter} ${schedule.year}` : "Custom"}</td><td>{schedule.startAt?.slice(0, 10) || "—"}</td><td>{schedule.dueAt?.slice(0, 10) || "—"}</td><td>{schedule.closeAt?.slice(0, 10) || "—"}</td><td><span className={`survey-status survey-status--${schedule.status}`}>{pretty(schedule.status)}</span></td>
          <td>{["draft", "scheduled"].includes(schedule.status) && <button className="survey-table-action" disabled={busy} onClick={() => onActivate(schedule._id)}>Activate</button>}</td></tr>)}</tbody></table></div>}
  </section>;
}

function AnalyticsSection({ metrics }) {
  if (!metrics?.totalSubmitted) return <section className="survey-panel survey-insufficient"><AlertCircle size={26} /><h2>Not enough response data</h2><p>Select a reporting period with submitted responses. Question analytics and branch comparisons will appear once sufficient evidence is available.</p></section>;
  return <div className="survey-analysis-grid">
    <section className="survey-panel"><h2>Branch Comparison</h2>{(metrics.branchComparison || []).map((branch) => <div className="survey-progress-row" key={branch.branchId}><span>{pretty(branch.branchId)}</span><strong>{branch.completionRate}%</strong><progress max="100" value={branch.completionRate} /></div>)}</section>
    <section className="survey-panel"><h2>Question Results</h2>{(metrics.questions || []).map((question) => <article className="survey-question-result" key={question.key}><strong>{question.text}</strong><span>{question.responseCount} responses{question.average != null ? ` · Average ${question.average} · Median ${question.median}` : ""}</span></article>)}</section>
  </div>;
}

function ReportsSection({ reports, canGenerate, busy, onGenerate }) {
  return <section className="survey-panel">
    <header><div><h2>AI Reports</h2><p>Generate versioned, evidence-based recommendations from eligible responses.</p></div>
      <button className="btn btn-primary" disabled={!canGenerate || busy} onClick={onGenerate}><Sparkles size={16} /> Generate AI Report</button></header>
    {!canGenerate && <p className="survey-threshold-note">At least the configured minimum number of anonymous responses is required.</p>}
    {!reports.length ? <p className="survey-inline-empty">No AI reports have been generated for this scope.</p> :
      <div className="survey-report-grid">{reports.map((report) => <article className="survey-report-card" key={report._id}><span className="survey-status">Version {report.version}</span><h3>{report.title || "Survey insight report"}</h3><p>{report.summary}</p><div><span>{pretty(report.reportType)}</span><span>{report.createdAt?.slice(0, 10) || "Generated report"}</span></div></article>)}</div>}
  </section>;
}

function TemplateModal({ open, form, setForm, busy, sourceName, canPublish, onClose, onSubmit, onPublish }) {
  const [previewing, setPreviewing] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState(null);
  const [benchmarkEditWarning, setBenchmarkEditWarning] = useState("");
  const [confirmPublish, setConfirmPublish] = useState(false);
  const updateQuestion = (index, key, value) => {
    const question = form.questions[index];
    if (question.includeInAnalytics && ["text", "type", "category"].includes(key)) {
      setBenchmarkEditWarning(`Question ${index + 1} contributes to comparable analytics. Changing it may affect historical comparisons.`);
    }
    setForm({ ...form, questions: form.questions.map((q, i) => i === index ? { ...q, [key]: value } : q) });
  };
  const moveQuestion = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= form.questions.length) return;
    const questions = [...form.questions];
    [questions[index], questions[target]] = [questions[target], questions[index]];
    setForm({ ...form, questions });
  };
  const requestRemoval = (index) => {
    const question = form.questions[index];
    if (question.includeInAnalytics || question.analyticsKey) {
      setPendingRemoval(index);
      return;
    }
    setForm({ ...form, questions: form.questions.filter((_, i) => i !== index) });
  };
  const confirmRemoval = () => {
    setForm({ ...form, questions: form.questions.filter((_, i) => i !== pendingRemoval) });
    setPendingRemoval(null);
  };
  const updateOption = (questionIndex, optionIndex, label) => {
    const options = [...(form.questions[questionIndex].options || [])];
    options[optionIndex] = { ...options[optionIndex], label, value: options[optionIndex]?.value || `option_${optionIndex + 1}` };
    updateQuestion(questionIndex, "options", options);
  };
  const addOption = (questionIndex) => {
    const options = [...(form.questions[questionIndex].options || []), { value: `option_${Date.now()}`, label: "" }];
    updateQuestion(questionIndex, "options", options);
  };
  return <BaseModal isOpen={open} onClose={onClose} title={sourceName ? "Edit Survey Draft" : "Create Survey Draft"} subtitle="Customize this draft before publishing it." size="xl" footer={null} className="survey-template-editor-modal">
    <form className="survey-modal-form" onSubmit={onSubmit}>
      {sourceName && <aside className="survey-editor-source" role="note"><strong>Based on: {sourceName}</strong><p>You are editing a copy of a recommended template. Changes will not affect the original system template. Publish this draft before scheduling it.</p></aside>}
      <fieldset><legend>Basic information</legend>
        <label htmlFor="template-name">Template name<input id="template-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label htmlFor="template-description">Description<textarea id="template-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label htmlFor="template-intro">Tenant introduction<textarea id="template-intro" value={form.introductoryText || ""} onChange={(e) => setForm({ ...form, introductoryText: e.target.value })} /><small>Shown before tenants begin answering.</small></label>
        <label htmlFor="template-type">Survey type<select id="template-type" value={form.surveyType} onChange={(e) => setForm({ ...form, surveyType: e.target.value })}><option value="quarterly_satisfaction">Quarterly satisfaction</option><option value="move_out">Move-out</option><option value="custom">Custom</option></select></label>
        <label className="survey-check" htmlFor="template-anonymous"><input id="template-anonymous" type="checkbox" checked={form.isAnonymous} onChange={(e) => setForm({ ...form, isAnonymous: e.target.checked })} /> Collect anonymous responses</label>
      </fieldset>
      <fieldset><legend>Questions</legend><p className="survey-help">Build the questionnaire tenants will answer. Reorder questions and review benchmark warnings before saving.</p>{benchmarkEditWarning && <div className="survey-editor-warning" role="alert"><strong>Benchmark question changed</strong><p>{benchmarkEditWarning}</p><button type="button" className="btn btn-secondary" onClick={() => setBenchmarkEditWarning("")}>Acknowledge</button></div>}{form.questions.map((question, index) => <div className="survey-question-card" key={question.key}>
        <div className="survey-question-card__actions" aria-label={`Actions for question ${index + 1}`}>
          <span><ListChecks size={14} /> Question {index + 1}</span>
          <button type="button" className="btn btn-secondary" disabled={index === 0} onClick={() => moveQuestion(index, -1)}>Move Up</button>
          <button type="button" className="btn btn-secondary" disabled={index === form.questions.length - 1} onClick={() => moveQuestion(index, 1)}>Move Down</button>
          <button type="button" className="btn btn-secondary" disabled={form.questions.length === 1} onClick={() => requestRemoval(index)}>Remove</button>
        </div>
        <label htmlFor={`question-text-${index}`}>Question text<input id={`question-text-${index}`} required value={question.text} onChange={(e) => updateQuestion(index, "text", e.target.value)} /></label>
        <div className="survey-form-row"><label htmlFor={`question-type-${index}`}>Question type<select id={`question-type-${index}`} value={question.type} onChange={(e) => updateQuestion(index, "type", e.target.value)}><option value="rating_5">Rating (1–5)</option><option value="nps">Recommendation (0–10)</option><option value="likert">Agreement scale</option><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple choice</option><option value="short_text">Short text</option><option value="long_text">Long text</option><option value="yes_no">Yes / No</option></select></label>
          <label htmlFor={`question-category-${index}`}>Category<input id={`question-category-${index}`} value={question.category} onChange={(e) => updateQuestion(index, "category", e.target.value)} /></label></div>
        <div className="survey-question-settings"><label className="survey-check" htmlFor={`question-required-${index}`}><input id={`question-required-${index}`} type="checkbox" checked={question.required} onChange={(e) => updateQuestion(index, "required", e.target.checked)} /> Required question</label><div><span>Analytics key</span><code>{question.key}</code></div></div>
        {["single_choice", "multiple_choice"].includes(question.type) && <div className="survey-options-editor"><strong>Response options</strong>{(question.options || []).map((option, optionIndex) => <div key={option.value || optionIndex}><input aria-label={`Option ${optionIndex + 1} for question ${index + 1}`} value={option.label || ""} onChange={(event) => updateOption(index, optionIndex, event.target.value)} /><button type="button" className="btn btn-secondary" disabled={(question.options || []).length <= 2} onClick={() => updateQuestion(index, "options", question.options.filter((_, i) => i !== optionIndex))}>Remove</button></div>)}<button type="button" className="btn btn-secondary" onClick={() => addOption(index)}><Plus size={14} /> Add option</button></div>}
        {question.conditional?.questionKey && <p className="survey-conditional-summary"><strong>Conditional:</strong> shown when {pretty(question.conditional.questionKey)} {pretty(question.conditional.operator)} {String(question.conditional.value)}.</p>}
      </div>)}
        <button type="button" className="btn btn-secondary survey-add-question" onClick={() => setForm({ ...form, questions: [...form.questions, { key: `question_${Date.now()}`, text: "", type: "rating_5", required: false, category: "" }] })}><Plus size={15} /> Add Question</button>
      </fieldset>
      {pendingRemoval != null && <div className="survey-editor-warning" role="alert">
        <strong>Remove analytics benchmark question?</strong>
        <p>This question contributes to comparable survey analytics. Removing it from this customized copy may limit trend and benchmark reporting.</p>
        <div><button type="button" className="btn btn-secondary" onClick={() => setPendingRemoval(null)}>Keep Question</button><button type="button" className="btn btn-danger" onClick={confirmRemoval}>Remove Question</button></div>
      </div>}
      {previewing && <section className="survey-editor-preview"><h3>{form.name || "Untitled survey"}</h3><p>{form.description}</p><ol>{form.questions.map((question) => <li key={question.key}><strong>{question.text || "Untitled question"}</strong><span>{pretty(question.type)}{question.required ? " · Required" : ""}</span><SurveyControlPreview question={question} /></li>)}</ol></section>}
      <footer><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="button" className="btn btn-secondary" onClick={() => setPreviewing(!previewing)}><Eye size={15} /> {previewing ? "Return to Editing" : "Preview Draft"}</button><button className="btn btn-secondary" disabled={busy}>{busy ? "Saving…" : "Save Draft"}</button>{canPublish && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setConfirmPublish(true)}>Publish</button>}</footer>
    </form>
    <ConfirmModal isOpen={confirmPublish} title="Publish Survey Template?" message="Publishing creates an immutable version that can be used in survey schedules. No schedule or tenant assignment will be created." confirmText="Publish Template" onClose={() => setConfirmPublish(false)} onConfirm={() => { setConfirmPublish(false); onPublish(); }} />
  </BaseModal>;
}

function ScheduleModal({ open, form, setForm, templates, branchId, busy, onClose, onSubmit }) {
  return <BaseModal isOpen={open} onClose={onClose} title="Create Survey Schedule" subtitle="Choose a published template and define a valid collection period." size="lg" footer={null} className="survey-schedule-modal">
    <form className="survey-modal-form" onSubmit={onSubmit}>
      <fieldset><legend>Survey source</legend>
        <label htmlFor="schedule-template">Published template<select id="schedule-template" required value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}><option value="">Select a template</option>{templates.map((t) => <option key={t._id} value={t._id}>{t.name} v{t.version}</option>)}</select></label>
        <label htmlFor="schedule-title">Schedule title<input id="schedule-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
        <p className="survey-scope-note">Branch scope: <strong>{pretty(branchId || "All authorized branches")}</strong></p>
      </fieldset>
      <fieldset><legend>Dates</legend><div className="survey-form-row survey-form-row--three">
        {[["startAt", "Open date"], ["dueAt", "Due date"], ["closeAt", "Close date"]].map(([key, label]) => <label htmlFor={`schedule-${key}`} key={key}>{label}<input id={`schedule-${key}`} type="date" required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
      </div><p className="survey-help">Open date must be on or before the due date, and the due date must be on or before the close date.</p></fieldset>
      <footer><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={busy}>Create Schedule</button></footer>
    </form>
  </BaseModal>;
}

export function SurveyAnalyticsTab() {
  return <SurveyAnalyticsPage />;
}

export default function SurveyAnalyticsPage() {
  const { isOwner } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState("overview");
  const [metrics, setMetrics] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [reports, setReports] = useState([]);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE);
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULE);
  const [modal, setModal] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [editingSourceName, setEditingSourceName] = useState("");
  const [copyingTemplateId, setCopyingTemplateId] = useState("");
  const [templateActionError, setTemplateActionError] = useState("");
  const [archiveCandidate, setArchiveCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const filters = useMemo(() => ({
    branchId: searchParams.get("branch") || "", surveyType: searchParams.get("surveyType") || "",
    status: searchParams.get("status") || "", year: searchParams.get("year") || "", quarter: searchParams.get("quarter") || "",
  }), [searchParams]);
  const analyticsFilters = useMemo(() => ({ branchId: filters.branchId, surveyType: filters.surveyType, year: filters.year, quarter: filters.quarter }), [filters]);
  const scheduleFilters = useMemo(() => ({ ...analyticsFilters, status: filters.status }), [analyticsFilters, filters.status]);
  const publishedTemplates = templates.filter((item) => ["active", "published"].includes(item.status));
  const systemTemplates = templates.filter((item) => item.isSystemTemplate);
  const administratorTemplates = templates.filter((item) => !item.isSystemTemplate && item.status !== "archived");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const [analyticsResult, scheduleResult, templateResult, reportResult] = await Promise.all([
        surveyApi.analytics(analyticsFilters), surveyApi.listSchedules(scheduleFilters),
        surveyApi.listTemplates(filters.surveyType ? { surveyType: filters.surveyType } : {}),
        surveyApi.listAIReports(filters.branchId ? { branchId: filters.branchId } : {}),
      ]);
      setMetrics(apiData(analyticsResult) || null); setSchedules(apiData(scheduleResult) || []);
      setTemplates(apiData(templateResult) || []); setReports(apiData(reportResult) || []);
    } catch (requestError) { setError(requestError.message || "Survey analytics could not be loaded."); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [analyticsFilters, scheduleFilters, filters.surveyType, filters.branchId]);
  const run = async (action, message) => {
    setBusy(true); setError("");
    try { await action(); showNotification(message, "success"); setModal(null); await load(); }
    catch (requestError) { setError(requestError.message || "The survey action could not be completed."); }
    finally { setBusy(false); }
  };
  const setFilter = (key, value) => { const next = new URLSearchParams(searchParams); if (value && value !== "all") next.set(key, value); else next.delete(key); setSearchParams(next); };
  const openSchedule = (templateId = "") => { setScheduleForm({ ...EMPTY_SCHEDULE, templateId }); setModal("schedule"); };
  const browseTemplates = () => {
    setActiveSection("templates");
    setModal(null);
    requestAnimationFrame(() => document.getElementById("recommended-templates")?.focus());
  };
  const openBlankTemplate = () => { setEditingTemplateId(null); setEditingSourceName(""); setTemplateForm(EMPTY_TEMPLATE); setModal("template"); };
  const editTemplate = (template) => {
    setEditingTemplateId(template._id);
    setEditingSourceName(template.sourceSystemTemplateId ? template.name : "");
    setTemplateForm({ name: template.name, description: template.description || "", introductoryText: template.introductoryText || "", surveyType: template.surveyType, isAnonymous: template.isAnonymous, questions: template.questions || [] });
    setModal("template");
  };
  const saveTemplate = (event) => {
    event.preventDefault();
    run(
      () => editingTemplateId ? surveyApi.updateTemplate(editingTemplateId, templateForm) : surveyApi.createTemplate(templateForm),
      editingTemplateId ? "Template draft updated." : "Survey template created as a draft.",
    );
  };
  const useSystemTemplate = async (template) => {
    if (copyingTemplateId) return;
    setBusy(true); setCopyingTemplateId(template._id); setTemplateActionError("");
    try {
      const result = await surveyApi.copyTemplate(template._id);
      const copy = apiData(result);
      setEditingTemplateId(copy._id);
      setEditingSourceName(template.name);
      setTemplateForm({
        name: copy.name, description: copy.description, introductoryText: copy.introductoryText || "", surveyType: copy.surveyType,
        isAnonymous: copy.isAnonymous, questions: copy.questions,
      });
      setPreviewTemplate(null);
      setModal("template");
      showNotification(`Editable draft created from ${template.name}.`, "success");
      await load();
    } catch (requestError) {
      setTemplateActionError(requestError.message || "The system template could not be copied. Please try again.");
    } finally { setBusy(false); setCopyingTemplateId(""); }
  };
  const createSchedule = (event) => {
    event.preventDefault();
    if (!(scheduleForm.startAt <= scheduleForm.dueAt && scheduleForm.dueAt <= scheduleForm.closeAt)) { setError("Open date must be on or before due date, and due date must be on or before close date."); return; }
    const start = new Date(`${scheduleForm.startAt}T00:00:00`);
    run(() => surveyApi.createSchedule({ ...scheduleForm, branchId: filters.branchId || undefined, startAt: start.toISOString(), dueAt: new Date(`${scheduleForm.dueAt}T23:59:59`).toISOString(), closeAt: new Date(`${scheduleForm.closeAt}T23:59:59`).toISOString(), year: start.getFullYear(), quarter: Math.floor(start.getMonth() / 3) + 1, status: start <= new Date() ? "draft" : "scheduled" }), "Survey schedule created.");
  };
  const generateReport = () => run(() => surveyApi.generateAIReport({ reportType: "quarterly", filters: analyticsFilters }), "Evidence-based survey report generated.");
  const publishEditingDraft = async () => {
    if (!editingTemplateId) return;
    setBusy(true); setError("");
    try {
      await surveyApi.updateTemplate(editingTemplateId, templateForm);
      await surveyApi.publishTemplate(editingTemplateId);
      showNotification("Survey template published. It is now immutable and available for scheduling.", "success");
      setModal(null);
      await load();
    } catch (requestError) {
      setError(requestError.message || "The survey draft could not be published.");
    } finally { setBusy(false); }
  };
  return <div className="survey-dashboard">
    <div className="survey-tab-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>Feedback &amp; Surveys Workspace</h2>
        <p style={{ fontSize: '12px', color: 'var(--muted-foreground)', margin: '2px 0 0' }}>Monitor tenant feedback, manage survey cycles, and generate evidence-based recommendations.</p>
      </div>
      <button className="btn btn-primary" onClick={browseTemplates}><Plus size={17} /> Create Survey</button>
    </div>
    <FilterToolbar filters={filters} isOwner={isOwner} onChange={setFilter} onReset={() => setSearchParams({})} />
    {loading && <section className="survey-template-loading" role="status" aria-live="polite"><header><div><h2>Survey Templates</h2><p>Loading recommended and organization templates…</p></div></header><div className="survey-library-grid">{[1, 2, 3, 4, 5].map((item) => <div className="survey-template-skeleton" key={item}><span /><span /><span /><span /></div>)}</div><div className="survey-table-skeleton"><span /><span /><span /></div></section>}
    {error && <section className="survey-state survey-state--error" role="alert"><AlertCircle size={22} /><div><h2>Unable to load survey templates</h2><p>The template library could not be loaded. Check the server connection and try again.</p><small>{error}</small></div><button className="btn btn-secondary" onClick={load}>Retry</button></section>}
    {!loading && !error && <>
      <KpiGrid metrics={metrics} />
      <ActionNeeded templates={administratorTemplates} schedules={schedules} metrics={metrics} onCreate={browseTemplates} onSection={setActiveSection} onGenerate={generateReport} />
      <nav className="survey-section-tabs" role="tablist" aria-label="Survey workspace sections">{SECTIONS.map(([id, label]) => <button key={id} role="tab" aria-selected={activeSection === id} className={activeSection === id ? "is-active" : ""} onClick={() => setActiveSection(id)}>{label}</button>)}</nav>
      <div role="tabpanel" className="survey-section-content">
        {activeSection === "overview" && (!administratorTemplates.length && !schedules.length ? <EmptyState onRecommended={browseTemplates} onCreate={openBlankTemplate} /> : <section className="survey-panel survey-overview-compact">
          <div><h2>Active survey cycle</h2>{schedules.filter((s) => s.status === "active").length ? schedules.filter((s) => s.status === "active").map((s) => <article className="survey-summary-row" key={s._id}><CheckCircle2 size={16} /><div><strong>{s.title}</strong><span>Due {s.dueAt?.slice(0, 10)}</span></div></article>) : <p>No survey collection is active.</p>}</div>
          <div><h2>Recent response activity</h2><p>{metrics?.totalSubmitted ? `${metrics.totalSubmitted} responses received in the selected period.` : "No recent tenant responses."}</p></div>
          <div><h2>Latest recommendation</h2><p>{reports[0]?.summary || "Generate an AI report after sufficient responses are collected."}</p></div>
        </section>)}
        {activeSection === "templates" && <StructuredTemplatesSection systemTemplates={systemTemplates} templates={administratorTemplates} copyingTemplateId={copyingTemplateId} actionError={templateActionError} onCreate={openBlankTemplate} onRefresh={load} onPreview={setPreviewTemplate} onUse={useSystemTemplate} onEdit={editTemplate} onPublish={(id) => run(() => surveyApi.publishTemplate(id), "Template published.")} onArchive={setArchiveCandidate} onCreateSchedule={openSchedule} />}
        {activeSection === "schedules" && <SchedulesSection schedules={schedules} busy={busy} onCreate={() => openSchedule()} onActivate={(id) => run(() => surveyApi.activateSchedule(id), "Survey activated and eligible tenants assigned.")} />}
        {activeSection === "analytics" && <AnalyticsSection metrics={metrics} />}
        {activeSection === "reports" && <ReportsSection reports={reports} canGenerate={Boolean(metrics?.totalSubmitted)} busy={busy} onGenerate={generateReport} />}
      </div>
    </>}
    <StructuredTemplatePreview template={previewTemplate} copying={Boolean(copyingTemplateId)} onClose={() => setPreviewTemplate(null)} onUse={useSystemTemplate} />
    <TemplateModal open={modal === "template"} form={templateForm} setForm={setTemplateForm} busy={busy} sourceName={editingSourceName} canPublish={Boolean(editingTemplateId)} onClose={() => setModal(null)} onSubmit={saveTemplate} onPublish={publishEditingDraft} />
    <ScheduleModal open={modal === "schedule"} form={scheduleForm} setForm={setScheduleForm} templates={publishedTemplates} branchId={filters.branchId} busy={busy} onClose={() => setModal(null)} onSubmit={createSchedule} />
    <ConfirmModal isOpen={Boolean(archiveCandidate)} title="Archive Survey Draft?" message={`Archive “${archiveCandidate?.name || "this draft"}”? It will be removed from the active template workspace without permanently deleting its audit history.`} confirmText="Archive Draft" variant="warning" onClose={() => setArchiveCandidate(null)} onConfirm={() => {
      const candidate = archiveCandidate;
      setArchiveCandidate(null);
      if (candidate) run(() => surveyApi.archiveTemplate(candidate._id), "Survey draft archived.");
    }} />
  </div>;
}

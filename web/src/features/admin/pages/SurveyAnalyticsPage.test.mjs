import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./SurveyAnalyticsPage.jsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./SurveyAnalyticsPage.css", import.meta.url), "utf8");

test("survey workspace is divided into one-at-a-time operational sections", () => {
  assert.match(source, /const SECTIONS = \[[\s\S]*"overview"[\s\S]*"templates"[\s\S]*"schedules"[\s\S]*"analytics"[\s\S]*"reports"/);
  assert.match(source, /activeSection === "overview"/);
  assert.match(source, /role="tabpanel"/);
  assert.doesNotMatch(source, /<form onSubmit=\{createTemplate\}><h3>Create Template/);
});

test("four primary KPI cards keep labels, values, and support text structurally separate", () => {
  assert.match(source, /data-primary-kpi/);
  const primaryMetrics = source.match(/\[(Users|Send|CalendarClock|Target), "/g) || [];
  assert.equal(primaryMetrics.length, 4);
  assert.match(source, /className="survey-kpi-label"/);
  assert.match(source, /className="survey-kpi-value"/);
  assert.match(source, /<small>\{note\}<\/small>/);
  assert.match(styles, /\.survey-kpi-grid\{display:grid;grid-template-columns:repeat\(4/);
});

test("satisfaction and recommendation remain lower-priority secondary metrics", () => {
  assert.match(source, /className="survey-secondary-metrics"/);
  assert.match(source, /\["Average Satisfaction"/);
  assert.match(source, /\["Recommendation Score"/);
  assert.doesNotMatch(source, /\[BarChart3, "Average Satisfaction"/);
});

test("creation workflows use the shared accessible modal", () => {
  assert.match(source, /import BaseModal/);
  assert.match(source, /modal === "template"/);
  assert.match(source, /"Create Survey Draft"/);
  assert.match(source, /"Edit Survey Draft"/);
  assert.match(source, /modal === "schedule"/);
  assert.match(source, /title="Create Survey Schedule"/);
});

test("draft publishing is explicit and explains immutable version behavior", () => {
  assert.match(source, /title="Publish Survey Template\?"/);
  assert.match(source, /Publishing creates an immutable version/);
  assert.match(source, /No schedule or tenant assignment will be created/);
  assert.match(source, /surveyApi\.updateTemplate\(editingTemplateId, templateForm\)/);
  assert.match(source, /surveyApi\.publishTemplate\(editingTemplateId\)/);
});

test("choice questions provide a structured options editor", () => {
  assert.match(source, /className="survey-options-editor"/);
  assert.match(source, /Add option/);
  assert.match(source, /Option \$\{optionIndex \+ 1\} for question/);
  assert.match(styles, /\.survey-options-editor/);
});

test("template editor portal keeps compact aligned actions without a duplicate shell footer", () => {
  assert.match(source, /className="survey-template-editor-modal"/);
  assert.match(source, /footer=\{null\}/);
  assert.match(styles, /\.survey-template-editor-modal \.btn/);
  assert.match(styles, /grid-template-columns: minmax\(120px, 1fr\) repeat\(3, auto\)/);
  assert.match(styles, /\.survey-action-needed \.btn \{[\s\S]*?justify-self: end/);
});

test("empty, loading, error, and insufficient evidence states are explicit", () => {
  assert.match(source, /className="survey-empty"/);
  assert.match(source, /role="status"/);
  assert.match(source, /role="alert"/);
  assert.match(source, />Retry</);
  assert.match(source, /className="survey-panel survey-insufficient"/);
  assert.match(source, /disabled=\{!canGenerate \|\| busy\}/);
});

test("survey APIs, branch scope, and query-backed filters remain integrated", () => {
  assert.match(source, /surveyApi\.analytics\(analyticsFilters\)/);
  assert.match(source, /surveyApi\.listSchedules\(scheduleFilters\)/);
  assert.match(source, /surveyApi\.createTemplate\(templateForm\)/);
  assert.match(source, /surveyApi\.createSchedule/);
  assert.match(source, /surveyApi\.generateAIReport/);
  assert.match(source, /isOwner && <label htmlFor="survey-branch"/);
  assert.match(source, /value && value !== "all"/);
});

test("survey API results support the shared client's unwrapped response shape", () => {
  assert.match(source, /const apiData = \(result\) => result\?\.data \?\? result/);
  assert.match(source, /setTemplates\(apiData\(templateResult\) \|\| \[\]\)/);
  assert.match(source, /setSchedules\(apiData\(scheduleResult\) \|\| \[\]\)/);
  assert.match(source, /const copy = apiData\(result\)/);
  assert.doesNotMatch(source, /setTemplates\(templateResult\?\.data/);
});

test("both tab rows are responsive scroll containers", () => {
  assert.match(styles, /\.survey-analytics-nav,.survey-section-tabs\{[^}]*overflow-x:auto/);
  assert.match(styles, /@media\(max-width:720px\)/);
  assert.match(styles, /@media\(max-width:440px\)/);
});

test("action guidance and filters use compact operational containers", () => {
  assert.match(source, /className="survey-action-needed"/);
  assert.match(styles, /\.survey-action-needed\{[^}]*min-height:68px/);
  assert.match(styles, /\.survey-filter-card\{[^}]*padding:16px 17px/);
  assert.match(source, /onReset=\{\(\) => setSearchParams\(\{\}\)\}/);
});

test("medium-density scale avoids zoomed-out control and metric sizing", () => {
  assert.match(styles, /--survey-title-size:28px/);
  assert.match(styles, /--survey-control-height:40px/);
  assert.match(styles, /\.survey-kpi-card\{[^}]*min-height:92px/);
  assert.match(styles, /\.survey-kpi-value\{[^}]*font-size:30px/);
  assert.match(styles, /\.survey-secondary-metrics\{[^}]*min-height:52px/);
});

test("template library separates immutable recommendations from administrator templates", () => {
  assert.match(source, /function TemplateLibraryModal/);
  assert.match(source, /Recommended Templates/);
  assert.match(source, /systemTemplates = templates\.filter\(\(item\) => item\.isSystemTemplate\)/);
  assert.match(
    source,
    /administratorTemplates = templates\.filter\(\(item\) => !item\.isSystemTemplate && item\.status !== "archived"\)/,
  );
  assert.match(source, /Browse Template Library/);
  assert.match(source, /System Template/);
});

test("recommended-template flow copies a source before opening the editor", () => {
  assert.match(source, /surveyApi\.copyTemplate\(template\._id\)/);
  assert.match(source, /setEditingTemplateId\(copy\._id\)/);
  assert.match(source, /surveyApi\.updateTemplate\(editingTemplateId, templateForm\)/);
  assert.match(source, /Use Recommended Template/);
  assert.match(source, /Create From Scratch/);
  assert.match(source, /Preview/);
});

test("copied drafts support safe question customization without native dialogs", () => {
  assert.match(source, /moveQuestion\(index, -1\)/);
  assert.match(source, /moveQuestion\(index, 1\)/);
  assert.match(source, /Remove analytics benchmark question\?/);
  assert.match(source, /may limit trend and benchmark reporting/);
  assert.match(source, /setPreviewing\(!previewing\)/);
  assert.doesNotMatch(source, /window\.(alert|confirm|prompt)/);
});

test("overview actions navigate into the structured Templates workspace", () => {
  assert.match(source, />Browse Recommended Templates</);
  assert.match(source, /let label = "Browse Templates"/);
  assert.match(source, /setActiveSection\("templates"\)/);
  assert.match(source, /getElementById\("recommended-templates"\)\?\.focus/);
  assert.doesNotMatch(source, /onRecommended=\{\(\) => setModal\("library"\)\}/);
});

test("Templates workspace visibly separates recommendations and organization templates", () => {
  assert.match(source, /function StructuredTemplatesSection/);
  assert.match(source, /Ready-made surveys designed for dormitory operations/);
  assert.match(source, /id="recommended-templates"/);
  assert.match(source, />Recommended Templates</);
  assert.match(source, />My Templates</);
  assert.match(source, />No custom templates yet</);
  assert.match(styles, /\.survey-template-section \.survey-library-grid\{grid-template-columns:repeat\(3/);
});

test("recommended cards expose compact decision metadata and safe actions", () => {
  assert.match(source, /function RecommendedTemplateCard/);
  assert.match(source, />Questions</);
  assert.match(source, />Time</);
  assert.match(source, />Timing</);
  assert.match(source, />Responses</);
  assert.match(source, /categories\.slice\(0, 4\)/);
  assert.match(source, /\+\{categories\.length - 4\} more/);
  assert.match(source, /aria-label=\{`Preview \$\{template\.name\}`\}/);
  assert.match(source, /Creating Draft…/);
  assert.match(source, /<Eye size=\{16\} \/> Preview/);
  assert.match(source, /<CopyPlus size=\{16\} \/> Use Template/);
  assert.match(styles, /\.survey-dashboard \.btn-primary\{[^}]*background:var\(--primary/);
  assert.match(styles, /\.survey-dashboard \.btn-secondary\{[^}]*border-color:#cbd5e1/);
  assert.match(styles, /\.survey-dashboard \.btn:focus-visible/);
  assert.match(styles, /\.survey-library-card footer\{display:grid/);
});

test("template preview is grouped, read-only, and retains explicit copy action", () => {
  assert.match(source, /function StructuredTemplatePreview/);
  assert.match(source, /reduce\(\(groups, question\)/);
  assert.match(source, /Read-only preview of the tenant answering experience/);
  assert.match(source, /className="survey-template-preview-modal"/);
  assert.match(source, /previewTypeLabel/);
  assert.match(source, /question\.required \? "Required" : "Optional"/);
  assert.match(source, /question\.options\.map/);
  assert.match(source, /<CopyPlus size=\{16\} \/> Use This Template/);
  assert.match(source, /template\.isSystemTemplate && <button/);
  assert.match(source, /function SurveyControlPreview/);
  assert.match(source, /survey-control-preview--scale/);
  assert.match(source, /survey-control-preview--nps/);
  assert.match(source, /survey-control-preview--choices/);
  assert.match(source, /survey-control-preview__text/);
});

test("template preview keeps compact actions, continuous numbering, and aligned choices", () => {
  assert.match(styles, /\.survey-template-preview-modal \.btn/);
  assert.match(styles, /counter-reset: survey-question/);
  assert.match(styles, /\.survey-template-preview-modal \.survey-preview-groups ol \{[\s\S]*?counter-reset: none/);
  assert.match(styles, /\.survey-template-preview-modal \.survey-control-preview--choices \{[\s\S]*?justify-content: flex-start/);
});

test("loading, API failure, and empty installation states remain distinct", () => {
  assert.match(source, /className="survey-template-loading"/);
  assert.match(source, /Unable to load survey templates/);
  assert.match(source, /The template library could not be loaded/);
  assert.match(source, /Recommended templates are not installed/);
  assert.match(source, /No custom templates yet/);
});

test("copied template editor displays immutable source context", () => {
  assert.match(source, /Based on: \{sourceName\}/);
  assert.match(source, /Changes will not affect the original system template/);
  assert.match(source, /Publish this draft before scheduling it/);
  assert.match(source, /if \(copyingTemplateId\) return/);
  assert.match(source, /Editable draft created from \$\{template\.name\}/);
  assert.match(source, /Analytics key/);
  assert.match(source, /Benchmark question changed/);
  assert.match(source, /Preview Draft/);
  assert.match(source, /value="multiple_choice"/);
  assert.match(source, /value="long_text"/);
});

test("administrator draft templates expose a confirmed non-destructive archive action", () => {
  assert.match(source, /survey-row-action--archive/);
  assert.match(source, /title="Archive Survey Draft\?"/);
  assert.match(source, /without permanently deleting its audit history/);
  assert.match(source, /surveyApi\.archiveTemplate\(candidate\._id\)/);
  assert.match(source, /item\.status !== "archived"/);
  assert.match(styles, /\.survey-row-actions \.survey-row-action--archive/);
});

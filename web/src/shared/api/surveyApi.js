import { authFetch } from "./apiClient";

const query = (params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== "" && value != null),
  );
  return search.size ? `?${search}` : "";
};

export const surveyApi = {
  listTemplates: (params) => authFetch(`/surveys/templates${query(params)}`),
  createTemplate: (body) => authFetch("/surveys/templates", { method: "POST", body: JSON.stringify(body) }),
  copyTemplate: (id, body = {}) => authFetch(`/surveys/templates/${id}/copy`, { method: "POST", body: JSON.stringify(body) }),
  updateTemplate: (id, body) => authFetch(`/surveys/templates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  publishTemplate: (id) => authFetch(`/surveys/templates/${id}/publish`, { method: "POST" }),
  archiveTemplate: (id) => authFetch(`/surveys/templates/${id}/archive`, { method: "POST" }),
  listSchedules: (params) => authFetch(`/surveys/schedules${query(params)}`),
  createSchedule: (body) => authFetch("/surveys/schedules", { method: "POST", body: JSON.stringify(body) }),
  activateSchedule: (id) => authFetch(`/surveys/schedules/${id}/activate`, { method: "POST" }),
  analytics: (params) => authFetch(`/surveys/analytics/overview${query(params)}`),
  generateAIReport: (body) => authFetch("/surveys/ai-reports/generate", { method: "POST", body: JSON.stringify(body) }),
  listAIReports: (params) => authFetch(`/surveys/ai-reports${query(params)}`),
  listMine: () => authFetch("/tenant/surveys"),
  getMine: (id) => authFetch(`/tenant/surveys/${id}`),
  saveDraft: (id, answers) => authFetch(`/tenant/surveys/${id}/draft`, { method: "PUT", body: JSON.stringify({ answers }) }),
  submit: (id, answers) => authFetch(`/tenant/surveys/${id}/submit`, { method: "POST", body: JSON.stringify({ answers }) }),
};

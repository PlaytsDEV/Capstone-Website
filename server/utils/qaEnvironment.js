import dotenv from "dotenv";

export function loadQaEnvironment(env = process.env) {
  const baseEnvFile = String(env.QA_BASE_ENV_FILE || "").trim();
  if (baseEnvFile) dotenv.config({ path: baseEnvFile });
  else dotenv.config();

  const qaEnvFile = String(env.QA_ENV_FILE || "").trim();
  if (qaEnvFile) dotenv.config({ path: qaEnvFile, override: true });
}

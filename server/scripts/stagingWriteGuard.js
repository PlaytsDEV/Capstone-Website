import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { assertStagingWriteTarget } from "../config/environmentSafety.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export { assertStagingWriteTarget };

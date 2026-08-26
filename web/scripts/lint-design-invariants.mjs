import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");

const TARGET_DIRECTORIES = [
  path.join(webRoot, "src", "features", "admin", "components"),
  path.join(webRoot, "src", "features", "tenant", "components"),
  path.join(webRoot, "src", "features", "owner"),
  path.join(webRoot, "src", "shared", "components"),
];

// Invariants to enforce across the Lilycrest DMS UI
const FORBIDDEN_RULES = [
  {
    name: "Tailwind Gradient Class (Strictly No Gradients)",
    pattern: /\bbg-gradient-to-[a-z0-9-]+\b/g,
    excludeFiles: ["RoomPublicPreviewCard.jsx"], // legacy preview cards with photo overlay
  },
  {
    name: "Prohibited Resident Terminology (Must use 'Tenant')",
    pattern: /\b(active\s+residents|current\s+residents|all\s+residents)\b/gi,
  },
  {
    name: "Prohibited Super Admin Terminology (Must use 'Owner')",
    pattern: /\b(super\s+admin|superadmin)\b/gi,
  },
];

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else if (/\.(jsx|js|css)$/.test(file) && !file.includes(".test.") && !file.includes(".spec.")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

export function scanDesignInvariants() {
  const violations = [];
  let filesScanned = 0;

  for (const dir of TARGET_DIRECTORIES) {
    const files = getAllFiles(dir);
    for (const filePath of files) {
      filesScanned++;
      const relativePath = path.relative(webRoot, filePath);
      const content = fs.readFileSync(filePath, "utf8");

      for (const rule of FORBIDDEN_RULES) {
        if (rule.excludeFiles && rule.excludeFiles.some((ex) => filePath.endsWith(ex))) {
          continue;
        }

        const matches = content.match(rule.pattern);
        if (matches) {
          violations.push({
            file: relativePath,
            rule: rule.name,
            matches: matches.slice(0, 3),
          });
        }
      }
    }
  }

  return { filesScanned, violations };
}

// Direct execution
if (process.argv[1] === __filename) {
  const { filesScanned, violations } = scanDesignInvariants();
  console.log(`[Design Invariant Linter] Scanned ${filesScanned} UI source files.`);

  if (violations.length > 0) {
    console.error(`\n❌ Found ${violations.length} design invariant violations:`);
    for (const v of violations) {
      console.error(`  - ${v.file}: ${v.rule} (found: ${v.matches.join(", ")})`);
    }
    process.exit(1);
  } else {
    console.log(`✅ All ${filesScanned} UI components comply 100% with design token & terminology invariants.`);
    process.exit(0);
  }
}

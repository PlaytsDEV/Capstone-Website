import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

// Node's native test runner has no JSX transform. This loader hook
// transpiles any imported .jsx file through esbuild (already present as a
// transitive Vite dependency) so component-mount tests can import real
// .jsx source files directly, unmodified, rather than duplicating their
// markup by hand.
export async function load(url, context, nextLoad) {
  if (url.endsWith(".jsx")) {
    const filePath = fileURLToPath(url);
    const source = await readFile(filePath, "utf8");
    const { code } = esbuild.transformSync(source, {
      loader: "jsx",
      format: "esm",
      jsx: "automatic",
      sourcefile: filePath,
    });
    return { format: "module", source: code, shortCircuit: true };
  }
  return nextLoad(url, context);
}

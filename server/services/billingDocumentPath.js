import path from "path";

export function isPathInsideRoot(rootPath, candidatePath) {
  if (!rootPath || !candidatePath) return false;
  const relative = path.relative(path.resolve(rootPath), path.resolve(candidatePath));
  return Boolean(relative)
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);
}

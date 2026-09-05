import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "coverage", ".next", "out"]);

/** Minimal glob: ** crosses directories, * stays inside a segment, ? is one character. */
export function globToRegExp(glob: string): RegExp {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!;
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else re += ".*";
      } else re += "[^/]*";
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** Files under `root` matching any of the globs, relative paths with forward slashes, skipping build and dependency directories. */
export function expand(root: string, globs: string[]): string[] {
  const patterns = globs.map(globToRegExp);
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(name)) walk(full);
        continue;
      }
      const rel = relative(root, full).split(sep).join("/");
      if (patterns.some((p) => p.test(rel))) out.push(rel);
    }
  };
  walk(root);
  return out.sort();
}

/** True when a path was reached by a glob and should be skipped unless named explicitly. */
export function skippedByDefault(rel: string): boolean {
  const base = rel.split("/").pop() ?? rel;
  return /^CHANGELOG/i.test(base) || rel.split("/").some((seg) => SKIP_DIRS.has(seg));
}

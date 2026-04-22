import { promises as fs } from "node:fs";
import path from "node:path";

export type KbFile = {
  path: string;
  title: string;
  mtime: string;
};

export type KbFileWithContent = KbFile & { content: string };

export type GrepHit = { path: string; line: number; text: string };

export type Kb = {
  list: () => KbFile[];
  read: (relPath: string) => Promise<KbFileWithContent>;
  write: (relPath: string, content: string) => Promise<KbFile>;
  remove: (relPath: string) => Promise<void>;
  grep: (pattern: string, limit?: number) => Promise<GrepHit[]>;
};

export const MAX_CHINESE_CHARS = 10_000;

export function countChineseChars(s: string): number {
  return (s.match(/\p{Script=Han}/gu) ?? []).length;
}

function firstHeading(content: string, fallback: string): string {
  const m = content.match(/^\s{0,3}#+\s+(.+?)\s*$/m);
  return m ? m[1] : fallback;
}

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

export class KbError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function safeResolve(root: string, relPath: string): string {
  const clean = relPath.replace(/^[\\/]+/, "");
  if (!clean || clean.includes("\0")) throw new KbError("invalid path");
  const resolved = path.resolve(root, clean);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    throw new KbError("path escapes KB root");
  }
  if (!resolved.endsWith(".md")) throw new KbError("only .md files are allowed");
  return resolved;
}

export async function createKb(rootDir: string): Promise<Kb> {
  const root = path.resolve(rootDir);
  await fs.mkdir(root, { recursive: true });

  const index = new Map<string, KbFile>();

  async function walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        out.push(...(await walk(full)));
      } else if (e.isFile() && e.name.endsWith(".md")) {
        out.push(full);
      }
    }
    return out;
  }

  async function indexFile(full: string): Promise<void> {
    const rel = toPosix(path.relative(root, full));
    const [stat, content] = await Promise.all([
      fs.stat(full),
      fs.readFile(full, "utf8"),
    ]);
    index.set(rel, {
      path: rel,
      title: firstHeading(content, path.basename(rel, ".md")),
      mtime: stat.mtime.toISOString(),
    });
  }

  const all = await walk(root);
  await Promise.all(all.map(indexFile));

  return {
    list() {
      return [...index.values()].sort((a, b) => a.path.localeCompare(b.path));
    },

    async read(rel) {
      const full = safeResolve(root, rel);
      const [stat, content] = await Promise.all([
        fs.stat(full),
        fs.readFile(full, "utf8"),
      ]);
      return {
        path: toPosix(path.relative(root, full)),
        title: firstHeading(content, path.basename(full, ".md")),
        content,
        mtime: stat.mtime.toISOString(),
      };
    },

    async write(rel, content) {
      if (countChineseChars(content) > MAX_CHINESE_CHARS) {
        throw new KbError(
          `content exceeds ${MAX_CHINESE_CHARS} Chinese characters`,
          413,
        );
      }
      const full = safeResolve(root, rel);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, "utf8");
      await indexFile(full);
      return index.get(toPosix(path.relative(root, full)))!;
    },

    async remove(rel) {
      const full = safeResolve(root, rel);
      try {
        await fs.unlink(full);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      index.delete(toPosix(path.relative(root, full)));
    },

    async grep(pattern, limit = 50) {
      let re: RegExp;
      try {
        re = new RegExp(pattern, "i");
      } catch {
        throw new KbError(`invalid regex: ${pattern}`);
      }
      const hits: GrepHit[] = [];
      for (const f of index.values()) {
        const full = safeResolve(root, f.path);
        const content = await fs.readFile(full, "utf8");
        const lines = content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i])) {
            hits.push({ path: f.path, line: i + 1, text: lines[i] });
            if (hits.length >= limit) return hits;
          }
        }
      }
      return hits;
    },
  };
}

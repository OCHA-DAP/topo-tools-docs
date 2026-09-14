// Copies docs/{adr,explanation,how-to,reference,tutorials} from the
// vendor/ submodules into src/content/docs/, since Starlight's docs
// collection requires files to live under src/content/docs/ with a
// `title` frontmatter field and routes without the .md extension.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const categories = ["tutorials", "how-to", "explanation", "reference", "adr"];

const products = [
  { repoDir: "topo-tools-py", repoSlugs: ["topo-tools-py"], key: "python" },
  { repoDir: "topo-tools-js", repoSlugs: ["topo-tools-js"], key: "js" },
];
const keyByRepoDir = Object.fromEntries(products.map((p) => [p.repoDir, p.key]));

function splitHash(url) {
  const i = url.indexOf("#");
  return i === -1 ? [url, ""] : [url.slice(0, i), url.slice(i)];
}

// Cross-repo ADR links use a literal ../../../topo-tools-{py,js}/docs/... path
// (the sister repos are checked out as siblings on disk); every other
// relative link stays within its own product's docs/ tree.
const crossRepoLinkPattern = /^(?:\.\.\/)+(topo-tools-(?:py|js))\/docs\/([^/]+)\/(.+)\.md$/;

function rewriteLink(url) {
  const [path, hash] = splitHash(url);
  if (!path || /^[a-z][a-z0-9+.-]*:/i.test(path)) return url; // anchor-only or has a URL scheme

  const crossRepo = path.match(crossRepoLinkPattern);
  if (crossRepo) {
    const [, repoDir, category, file] = crossRepo;
    const targetKey = keyByRepoDir[repoDir];
    const slug = file === "README" ? "" : file;
    return `../../${targetKey}/${category}/${slug}${hash}`;
  }

  if (path.endsWith(".md")) {
    const stripped = path.slice(0, -3).replace(/(^|\/)README$/, "$1");
    return stripped + hash;
  }

  return url;
}

function rewriteLinksInBody(body) {
  return body.replace(/(\]\()([^)\s]+)(\))/g, (match, open, url, close) => `${open}${rewriteLink(url)}${close}`);
}

function humanize(filename) {
  return filename.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractTitle(body, fallback) {
  const lines = body.split("\n");
  let i = 0;
  while (i < lines.length && lines[i].trim() === "") i++;
  if (lines[i]?.startsWith("# ")) {
    const title = lines[i].slice(2).trim();
    lines.splice(i, 1);
    while (lines[i] !== undefined && lines[i].trim() === "") lines.splice(i, 1);
    return { title, body: lines.join("\n") };
  }
  return { title: fallback, body };
}

for (const product of products) {
  const srcDocsDir = join(rootDir, "vendor", product.repoDir, "docs");
  const destDir = join(rootDir, "src", "content", "docs", product.key);
  rmSync(destDir, { recursive: true, force: true });

  for (const category of categories) {
    const srcCategoryDir = join(srcDocsDir, category);
    let entries;
    try {
      entries = readdirSync(srcCategoryDir);
    } catch {
      continue; // category doesn't exist in this product's docs/
    }

    const destCategoryDir = join(destDir, category);
    mkdirSync(destCategoryDir, { recursive: true });

    for (const entry of entries) {
      const srcPath = join(srcCategoryDir, entry);
      if (!statSync(srcPath).isFile() || !entry.endsWith(".md")) continue;

      const raw = readFileSync(srcPath, "utf8");
      const fallbackTitle = humanize(entry === "README.md" ? category : entry.replace(/\.md$/, ""));
      const { title, body } = extractTitle(raw, fallbackTitle);
      const rewritten = rewriteLinksInBody(body);

      const destName = entry === "README.md" ? "index.md" : entry;
      const frontmatter = `---\ntitle: ${JSON.stringify(title)}\n---\n\n`;
      writeFileSync(join(destCategoryDir, destName), frontmatter + rewritten.trimStart());
    }
  }
}

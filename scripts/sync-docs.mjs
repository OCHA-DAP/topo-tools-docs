// Copies docs/{adr,explanation,how-to,reference,tutorials} from the
// vendor/ submodules into src/content/docs/, since Starlight's docs
// collection requires files to live under src/content/docs/ with a
// `title` frontmatter field and routes without the .md extension.
//
// Links are rewritten to be relative to the current page (rather than
// site-root-absolute), since this site deploys under a GitHub Pages
// subpath and neither Astro nor Starlight base-prefixes absolute links
// written in markdown content, only their own generated nav/sidebar
// links. That makes an off-the-shelf link-validator plugin unusable
// here (they assume absolute links), so every rewritten link is
// resolved against the files actually written below and the sync
// fails loudly on anything that doesn't resolve.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
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

const linkRecords = []; // { fromDir, link, sourceFile }

function rewriteLinksInBody(body, fromDir, sourceFile) {
  return body.replace(/(\]\()([^)\s]+)(\))/g, (match, open, url, close) => {
    const rewritten = rewriteLink(url);
    if (rewritten !== url) {
      // only links actually rewritten as doc links (.md / cross-repo docs/)
      // are validated; untouched relative links (e.g. source file
      // references) were never meant to resolve as site routes.
      const [path] = splitHash(rewritten);
      linkRecords.push({ fromDir, link: path, sourceFile });
    }
    return `${open}${rewritten}${close}`;
  });
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

const writtenRoutes = new Set();

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
    const destDirRoute = posix.join(product.key, category);

    for (const entry of entries) {
      const srcPath = join(srcCategoryDir, entry);
      if (!statSync(srcPath).isFile() || !entry.endsWith(".md")) continue;

      const raw = readFileSync(srcPath, "utf8");
      const fallbackTitle = humanize(entry === "README.md" ? category : entry.replace(/\.md$/, ""));
      const { title, body } = extractTitle(raw, fallbackTitle);
      const sourceFile = posix.join(product.repoDir, "docs", category, entry);
      const rewritten = rewriteLinksInBody(body, destDirRoute, sourceFile);

      const destName = entry === "README.md" ? "index.md" : entry;
      const frontmatter = `---\ntitle: ${JSON.stringify(title)}\n---\n\n`;
      writeFileSync(join(destCategoryDir, destName), frontmatter + rewritten.trimStart());

      writtenRoutes.add(destName === "index.md" ? destDirRoute : posix.join(destDirRoute, destName.slice(0, -3)));
    }
  }
}

const broken = linkRecords.filter(({ fromDir, link }) => {
  const resolved = posix.normalize(posix.join(fromDir, link)).replace(/\/$/, "");
  return !writtenRoutes.has(resolved);
});

if (broken.length > 0) {
  console.error(`sync-docs: ${broken.length} internal link(s) don't resolve to a synced page:\n`);
  for (const { sourceFile, link } of broken) {
    console.error(`  ${sourceFile}: ${link}`);
  }
  process.exit(1);
}

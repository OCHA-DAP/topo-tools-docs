# topo-tools-docs

Documentation site for [topo-tools-py](https://github.com/OCHA-DAP/topo-tools-py)
and [topo-tools-js](https://github.com/OCHA-DAP/topo-tools-js), built with
[Astro Starlight](https://starlight.astro.build).

Content isn't written here. `vendor/topo-tools-py` and `vendor/topo-tools-js`
are git submodules pinned to the sister repos; `scripts/sync-docs.mjs` copies
each repo's `docs/{tutorials,how-to,explanation,reference,adr}` into
`src/content/docs/{python,js}/`, injecting Starlight frontmatter and
rewriting internal links (including cross-repo ADR links) into site routes.
That sync runs automatically before `dev` and `build`; the generated
`src/content/docs/python/` and `src/content/docs/js/` directories are
gitignored.

## Development

```sh
git submodule update --init   # first checkout only
npm install
npm run dev       # start dev server (localhost:4321)
npm run build     # production build
npm run preview   # preview production build
```

## Pulling in doc updates

The submodules are pinned to a commit. When `docs/` changes on `main` in
either sister repo, its `notify-docs.yml` workflow sends a
`repository_dispatch` here; `.github/workflows/bump-submodule.yml` advances
that submodule's pin, commits, and triggers a redeploy, no manual step
needed.

To do it by hand instead (e.g. to pull in an update before its workflow
runs):

```sh
git submodule update --remote vendor/topo-tools-py
git submodule update --remote vendor/topo-tools-js
git add vendor/topo-tools-py vendor/topo-tools-js
git commit -m "Update vendored docs"
```

## Deployment

`.github/workflows/deploy.yml` builds and deploys to GitHub Pages on push to
`main` or on manual dispatch. Requires GitHub Pages enabled for this repo
with source set to "GitHub Actions".

### One-time setup for the auto-bump workflow

1. Create a GitHub personal access token (fine-grained, scoped to this repo
   only, "Contents: Read and write" permission).
2. Add it as a secret named `DOCS_REPO_DISPATCH_TOKEN` in both
   `topo-tools-py` and `topo-tools-js` (Settings → Secrets and variables →
   Actions).

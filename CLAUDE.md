# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser extension that lets a user click on any DOM element on a page and generates the "best" CSS
selector for it — robust to minor DOM changes, human-readable, and precise. The extension has a sidebar
UI (React) that triggers inspection on the active tab; a content script highlights hovered elements,
captures the click, and runs a scoring pipeline entirely in-page (no network/backend). See `algo/algo.md`
(French) for the original design intent behind the selector algorithm.

Firefox (Manifest V2, sidebar_action) is the actively built/maintained target. A Chrome (MV3) path exists
in `configs/vite.chrome.ts` / `manifests/chrome.ts` but is **not wired into any npm script**, and the root
`manifest.ts` (used by `configs/vite.base.ts` via `@crxjs/vite-plugin`) still points at a stale path
(`src/extension/background/...`) that doesn't match the actual `src/background` / `src/content` layout.
Treat the Chrome build as incomplete/unmaintained until someone reconciles it.

## Commands

```bash
# Firefox build (UI + background + content script + manifest.json), output to dist/firefox
npm run build:firefox

# Firefox dev — builds once, then watches UI/background/content in parallel
npm run dev:firefox

# Individual pieces (rarely needed standalone)
npm run build:firefox:ui        # sidebar React app -> configs/vite.firefox.ts
npm run build:firefox:bg        # background.ts -> IIFE, configs/vite.firefox.background.ts
npm run build:firefox:content   # content.ts -> IIFE, configs/vite.firefox.scripts.ts
npm run build:firefox:manifest  # tsx scripts/build-manifest.ts firefox

# Lint
npx eslint .
```

Load the extension by pointing Firefox's temporary add-on loader at `dist/firefox/manifest.json`
(`about:debugging` → "This Firefox" → "Load Temporary Add-on").

**Tests**: there is no `npm test` script. Tests live in `tests/*.test.ts` using Node's built-in
`node:test` + `node:assert/strict`, run directly with TypeScript stripping, e.g.:

```bash
node --experimental-strip-types --test tests/selector-generation-pipeline.test.ts
```

Note: `tests/selector-generation-pipeline.test.ts` currently fails to parse (invalid TS syntax, e.g. an
unbalanced `[{}) as Element]` and a `debug?.rules?.supporting-a?.contribution` property access that isn't
valid JS). This is pre-existing breakage, not something introduced by your changes — don't assume the
suite is green, and don't be surprised if it won't run at all until that file is fixed.

Also note: plain `node --experimental-strip-types` cannot resolve the `@/*` → `src/*` path alias (no
tsconfig-paths support), so any test file that transitively imports a module using `@/...` value imports
(most of `src/content` does) fails with `ERR_MODULE_NOT_FOUND` under that runner — pre-existing, unrelated
to individual test content. Run those files with `npx tsx --test tests/<file>.test.ts` instead (`tsx` is
already a devDependency and honors `tsconfig.json` paths).

## Architecture

### Extension messaging flow

Three isolated JS contexts talk via `browser.runtime` messages typed in `src/messaging/messages.ts`
(`MessageType`: `START_INSPECTION`, `STOP_INSPECTION`, `ELEMENT_SELECTED`):

1. **Sidebar** (`src/app/App.tsx`, mounted by `src/app/main.tsx` into `sidebar.html`) sends
   `START_INSPECTION` via `src/messaging/messenger.ts`.
2. **Background** (`src/background/background.ts`) relays `START_INSPECTION` to the content script of the
   active tab, and relays `ELEMENT_SELECTED` messages back out via `browser.runtime.sendMessage` (so the
   sidebar, which isn't a message target itself, receives them through its own `onMessage` listener).
3. **Content script** (`src/content/content.ts` → `src/content/inspector/inspector.ts`) attaches capturing
   `mousemove`/`click` listeners: mousemove highlights the hovered element (`inspector/highlighter.ts`
   draws a fixed-position overlay div plus a text label). A click stops propagation and enters an
   **adjustment mode** instead of finalizing immediately: it builds a nearest-first ancestor chain up to
   (and including) `<body>` from the clicked element and switches the `mousemove` listener for a `keydown`
   one — `ArrowUp`/`ArrowDown` walk that chain to let the user correct the pick (e.g. the click landed on
   an inner `<div>` but the meaningful element is its wrapping `<h1>`), re-highlighting with an updated
   label on each move. `Enter` (or any further click, since the mouse no longer drives the highlight once
   this mode is entered) confirms the currently highlighted element: builds a `DOMContext` for it, runs it
   through `SelectorGenerationPipeline`, sends the result back as `ELEMENT_SELECTED`, and stops inspecting.
   `Escape` cancels and stops inspecting without sending anything.

Path alias `@/*` → `src/*` (defined in `tsconfig.json`/`tsconfig.app.json` and mirrored in each Vite
config's `resolve.alias`). Imports in this codebase inconsistently mix `@/...` and relative paths — both
work, but prefer `@/...` for anything crossing top-level module boundaries (matches most of the newer
code).

### Selector generation pipeline

Entry point: `SelectorGenerationPipeline.generate()` in
`src/content/selector/pipeline/selector-generation-pipeline.ts`. Given a `DOMContext` (target element +
ancestor chain up to but excluding `<body>`, from `src/content/analyzer/dom-context.ts`) and the target
element, it:

1. **Per node** (the target itself, and — during container selection — each candidate ancestor):
   `buildNodeFragmentCandidates` (`analyzer/candidates/node-fragment-candidates.ts`) is the shared
   per-node primitive used both for the target part and by `ContainerSelector`:
   - `extractAttributeCandidates` (`analyzer/candidates/attribute-candidate-extractor.ts`) turns the
     node's attributes into candidates, filtering out noisy/unstable ones via
     `analyzer/attributes/attribute-policy.ts` (ignores `href`/`src`/inline-event attrs, drops
     serialized-looking values like JSON/URLs, keeps only "useful" `data-*` attrs such as `data-testid`)
     and tokenizes values (`attribute-tokenizer.ts` splits camelCase/kebab/snake/digits into word tokens).
   - Each candidate is scored by `AttributeScorer`, a weighted sum of `ScoringRule`s (`CategoryRule` —
     favors `data-*` > `id` > `name` > `role` > `class`; `SemanticAttributeRule` — rewards tokens/values
     that look like meaningful words (`product`, `price`, ...) and penalizes generated-looking hashes;
     `TagNameRule` — favors semantic tags like `main`/`article` over `div`/`span`). Top 3 candidates per
     node survive.
   - Each surviving candidate is expanded into CSS fragment strings (`css-fragment-generator.ts`:
     `[attr="value"]` exact match, plus per-token `~=`/`*=`/`^=`/`$=` variants), and each fragment is
     scored by `FragmentScorer` (queries `document.querySelectorAll` to weigh uniqueness of that fragment
     alone). For the target part, the top 5 scored fragments survive.
1b. **Container selection** (`selector/container/container-selector.ts`, `ContainerSelector.select()`)
   runs in up to two passes over `context.ancestors` (nearest-parent-first). **Pass 1 (mono-attribute)**:
   for each ancestor, walks its `buildNodeFragmentCandidates` results looking for the first fragment
   that both uniquely matches the page (`SelectorValidator`, `count === 1`) *and* resolves back to that
   exact ancestor node (guards against a token that's coincidentally unique elsewhere, e.g. a shared
   `class="section"` wrapper — see the `container-selector-identity.test.ts` regression). If that
   ancestor's sectioning score (see "Container semantics") clears `CONTAINER_SEMANTIC_THRESHOLD`, it's
   returned immediately; otherwise it's kept as a fallback candidate and the walk continues outward.
   **Pass 2 (combined-attribute fallback)**: only runs if pass 1 finishes without any ancestor clearing
   the threshold. Re-walks the same ancestors, this time pairing up to `MAX_COMBINED_FRAGMENT_CANDIDATES`
   of each ancestor's top fragments into 2-attribute selectors (e.g. `[class*="details"][class*="title"]`)
   and retrying uniqueness — this is what rescues the case where no single attribute is unique alone but
   two together are. A mono match found in pass 1, even below-threshold, still wins over a pass-2 result
   with an equal or lower sectioning score (pass 1 always runs to completion first, regardless of
   ancestor proximity — see the "prefers a farther single-attribute ancestor" test in
   `container-selector-combined-fragments.test.ts`). If neither pass finds a qualifying match, the best
   unique-but-non-semantic candidate seen across both passes is returned; if nothing was ever unique, no
   container is used — see "Container semantics" above for the full fallback rationale.
2. **`SelectorBuilder.build()`** (`selector/builder/selector-builder.ts`) joins the chosen container's
   `tagName`+fragment onto every target-node `tagName`+fragment combination, producing full
   descendant-combinator selector strings (e.g. `main[id="x"] div[class~="y"]`) — or, when no container
   was found, target-only selector strings.
3. **`SelectorScorer.score()`** (`analyzer/scoring/selector-scorer.ts`) evaluates each built selector
   holistically — uniqueness (via live `document.querySelectorAll` counts, memoized in
   `matchCountCache`), precision, readability (semantic-token heuristics — see `SEMANTIC_TOKEN_LEVELS` for
   the generic→contextual→target-specific word hierarchy that drives ordering bonuses), concision, custom
   `ScoringRule`s (currently just `SelectorLengthRule`), and raw length — combined via the weights in
   `src/content/scoring/scoring-config.ts` (`SCORING_WEIGHTS.selector`). This is the most actively tuned
   file in the repo (see recent commit history) — when adjusting ranking behavior, this is almost always
   where it happens, backed by the weights/thresholds constants at the top of the file.
4. **`SelectorGenerator.generate()`** validates every selector against the real DOM
   (`SelectorValidator` — `querySelectorAll` count + whether it uniquely matches the target) and drops any
   selector with zero matches (and, outside `multiResultMode`, any that doesn't uniquely match the target).
5. **`SelectorCountNormalizer.normalize()`** rescales each selector's score based on how many elements it
   matches (single match is rewarded; `multiResultMode` instead rewards inverse match count).
6. Results are sorted by final score, capped to the top 100, and returned to the caller.

All scoring weights across every stage (attribute/fragment/selector/count-normalization) live in the one
file `src/content/scoring/scoring-config.ts` (`SCORING_WEIGHTS`) — check there first before hunting through
individual scorer classes for magic numbers.

### Multi-browser build setup

- `manifests/base.ts` holds shared manifest fields (`name`, `permissions`, `host_permissions`);
  `manifests/chrome.ts` (MV3, service worker background) and `manifests/firefox.ts` (MV2, background
  scripts + `sidebar_action` + `content_scripts`) extend it.
- `scripts/build-manifest.ts <browser>` dynamically imports `manifests/<browser>.ts` and writes
  `dist/<browser>/manifest.json`.
- `configs/vite.base.ts` is only consumed by the Chrome path (via `@crxjs/vite-plugin`, which reads the
  root `manifest.ts`). The Firefox path does **not** use `@crxjs/vite-plugin` at all — it builds the
  sidebar UI, background script, and content script as three separate Vite builds
  (`configs/vite.firefox.ts`, `vite.firefox.background.ts`, `vite.firefox.scripts.ts`) all outputting into
  `dist/firefox` with `emptyOutDir: false`, then generates the manifest separately. Keep this in mind if a
  build seems to silently overwrite output from a prior step — each Firefox build step targets a distinct
  file in the same output directory by design.


## Project goals & design principles

The generated selector must be:
- **Robust**: for the MVP, robustness is validated on the current page only (live DOM,
  via `SelectorValidator`); manual spot-checking across a few site pages happens after
  generation, not automated multi-page testing. Multi-page/site validation may come later.
- **Readable**: glanceable — should make it immediately obvious what's being targeted at
  a glance, prioritizing attributes that are both recognizable (semantic, human-readable)
  and stable (unlikely to change over time), e.g. `data-*`, `id`, semantic class tokens
  — see `attribute-policy.ts` / `AttributeScorer`. (Note: `[id~="product"] h1[interompt="title"]`
  seen in early discussions was illustrative only — `interompt` isn't a real target attribute.)
- **Maintainable**: resilient to minor markup changes over time.

Current structure: a two-part selector — a unique **container** + the **final target
selector** within it.

### Container semantics

- The container's purpose is to scope the match and prevent false positives from unrelated
  page sections — e.g. a bare `label[class*="size"]` for a product's size options can also
  match size labels in a "related products" section elsewhere on the page; the container is
  meant to disambiguate against exactly this kind of cross-section false match. (This is a
  real bug encountered before this design — not a hypothetical.)
- The container must itself match **exactly one element** on the page (unique by itself,
  independent of the target).
- The container should be the **closest ancestor to the target that correctly isolates the
  right logical section** (e.g. "product info" vs "recommended products") — not necessarily
  the closest ancestor that happens to produce a technically-unique match. A container that
  is unique only by structural accident, without semantic relevance to the section boundary,
  is not the goal.
  - Practical MVP heuristic: prefer ancestors with semantic sectioning signals (`<section>`,
    `<article>`, `id`/`class` tokens like "product", "info", "recommendations", etc. — the
    kind of signal `SemanticAttributeRule` already scores) over purely structural uniqueness.
- The final target selector, unlike the container, **may match multiple elements** — see
  multi-match mode below.

Container selection (`src/content/selector/container/container-selector.ts`, `ContainerSelector`)
walks `context.ancestors` nearest-first and stops at the first ancestor that is both uniquely
matching (`querySelectorAll(...).length === 1`) and clears a semantic-sectioning threshold (a
blend of `SemanticAttributeRule` + `TagNameRule`, see `CONTAINER_SEMANTIC_THRESHOLD`). If no
ancestor clears the threshold, it falls back to the best-scoring ancestor among the unique ones;
if none is unique at all, no container is used and the pipeline emits a target-only selector.

### Multi-match mode (planned option)

- Some use cases need the final selector to match multiple elements on purpose (e.g. a size
  selector should match *all* available sizes, not one).
- The pipeline already has partial groundwork for this: `SelectorCountNormalizer.normalize()`
  references a `multiResultMode` that rewards inverse match count instead of uniqueness, and
  `SelectorValidator`'s "must uniquely match target" rule is described as skipped when
  `multiResultMode` is active.
- Status of `multiResultMode` (fully wired vs. partial/dead code) needs verification before
  building the user-facing option on top of it — don't assume it's production-ready as-is.

## Roadmap (not yet implemented / undecided)

- **Multi-level containers**: today it's container + target only. May expand to multiple
  intermediate levels (e.g. page → section → card → target) if real-world cases require
  it — not yet designed, will be decided based on cases encountered.
- **XPath generation**: currently CSS-only (`css-fragment-generator.ts` and friends); an
  XPath equivalent is planned for later.
- **Modularization**: the robust-selector-generation logic is intended to eventually become
  a standalone, reusable module (not tied to this specific extension) — worth anticipating
  in the architecture where it's low-cost, but not at the expense of MVP progress.
- **Multi-match selection mode**: expose `multiResultMode` (or equivalent) as an explicit
  user-facing option for cases like "select all sizes" rather than a single element.
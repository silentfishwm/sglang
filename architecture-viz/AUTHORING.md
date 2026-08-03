# Authoring conventions for SGLang architecture-viz pages

Every chapter page is a standalone HTML file in `architecture-viz/` following the exact
pattern of `01-request-lifecycle.html` (the canonical example — read it first).

## Page skeleton

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NN · Page Title — SGLang Internals</title>
<link rel="stylesheet" href="assets/style.css">
<script src="assets/mermaid.min.js"></script>
<script src="assets/viz.js"></script>
</head>
<body>
<div class="layout">
<main>
  <div class="page-hero"><div class="content">
    <span class="phase-badge">Phase N · Group name</span>
    <h1>NN · Title</h1>
    <p class="lede">...</p>
  </div></div>
  <div class="content">
    ... sections ...
    <div id="pager"></div>
  </div>
</main>
</div>
<script> /* steppers */ </script>
</body>
</html>
```

The sidebar and prev/next pager are injected automatically by `viz.js` from `VIZ_PAGES`;
the file name, number, title and phase text MUST match that manifest exactly.

## Components

- Section heading: `<h2><span class="sec-num">N.M</span>Title</h2>`
- Mermaid diagram:
  ```html
  <div class="diagram">
    <div class="dg-title">SHORT ALL-CAPS-ISH TITLE</div>
    <pre class="mermaid"> ...mermaid source... </pre>
    <div class="dg-caption">Caption with verified facts + file refs.</div>
  </div>
  ```
- Code snippet (auto-highlighted; language via `data-lang`: python|rust|cpp|bash|json):
  ```html
  <div class="snippet" data-lang="python"
       data-file="python/sglang/srt/....py:LINE"
       data-desc="one-line description">
  <pre>
  ...verbatim code, may trim comments (say so in data-desc)...
  </pre>
  </div>
  ```
  IMPORTANT: inside `<pre>` escape `<` as `&lt;` and `&` as `&amp;`.
- Callouts: `<div class="callout note|fact|warn"><span class="co-title">Title</span> text </div>`
- Tables: `<table class="tbl"><tr><th>...</th></tr><tr><td>...</td></tr></table>`
- Cards: `<div class="card"> ... </div>`
- File tree: `<div class="filetree">preformatted text, <b>bold</b> for dirs, <i>gray</i> notes</div>`

## Steppers (guided animations)

Scene = static HTML inside `<div class="stepper" id="st-X"><div class="st-scene">...`.
Building blocks: `.sc-row`, `.sc-box` (with optional `<small>`), `.tok` chips.
State classes toggled by steps: `hl` (indigo highlight), `ok` (green), `warn` (amber),
`bad` (red strikethrough), `dim`, `cache` (purple), `free` (dashed), `pulse` (glow),
and `.appear` + `in` for reveal-on-step.

```js
new Stepper("#st-X", {
  title: "…",
  intro: "…",
  autoMs: 3200,
  reset(sc) { clearState(sc, ".sc-box,.tok"); rmCls(sc, ".appear", "in"); },
  steps: [
    { cap: "caption HTML", run(sc) { setCls(sc, "#id1,#id2", "hl"); setText(sc, "#id3", "42"); } },
    ...
  ],
});
```

Steps are replayed cumulatively (goto(i) = reset + run 0..i), so `run` must be
idempotent class/text mutations. If a stepper uses `setText`, reset must restore
original text explicitly.

## Mermaid gotchas (the checker fails the page otherwise)

- Put node labels in quotes when they contain `(`, `)`, `/`, `:` or HTML: `a["foo (bar)"]`.
- Use `<br/>` for line breaks inside labels, `<i>..</i>` for file names.
- Don't use `{}` curly-brace labels except diamond decision nodes `x{"?"}`.
- Style blocks: `style id fill:#eef0ff,stroke:#4f46e5` (no quotes).
- Keep diagrams under ~25 nodes; split big ones.

## Content rules

1. **Fidelity first**: every class/function/flag name must exist in this repo — verify by
   reading the source before writing it. Cite as `file.py:line` in snippet headers and
   `<code>path</code>` in prose. If upstream docs disagree with this repo, this repo wins;
   call out renames in a `callout warn`.
2. Each chapter: an intro that says why the subsystem exists, 3+ mermaid diagrams
   (architecture + flows), 2+ steppers with **concrete worked examples** (real numbers,
   real token strings), 4-8 verbatim code snippets, ≥1 flags/config table, and a
   "Notable facts & gotchas" card at the end.
3. Cross-reference sibling chapters by number ("see chapter 03").
4. Tone: teaching a strong engineer new to SGLang. Explain *why*, not just *what*.

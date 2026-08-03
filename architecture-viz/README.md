# SGLang Internals — Animated Architecture Guide

A self-contained, phased set of HTML visualizations teaching the architecture, design,
and implementation of SGLang, generated from and verified against the source code in
this repository (pinned at commit `45c00da`, 2026-08).

## Viewing

Open `index.html` in any modern browser — no server or network needed
(Mermaid is vendored in `assets/`). For nicest results:

```bash
cd architecture-viz
python3 -m http.server 8080   # then visit http://localhost:8080
```

## Contents

| Phase | Chapters |
|---|---|
| I · Foundations | `index.html` (start here), `01-request-lifecycle.html` |
| II · The Core Engine | `02-scheduler.html`, `03-memory.html`, `04-model-execution.html` |
| III · Models & Compute | `05-layers.html`, `06-kernels.html` |
| IV · Scaling Out | `07-distributed.html`, `08-disaggregation.html` |
| V · Advanced Inference | `09-speculative.html`, `10-structured-output.html` |
| VI · Interfaces & Operations | `11-frontend-tooling.html`, `12-observability.html` |

Each chapter includes Mermaid architecture diagrams, step-through animated examples
(with play/pause controls), verbatim code snippets cited as `file.py:line`, flag
tables, and a "notable facts" section. Chapter 12 ends with a complete coverage map
of every subsystem directory in the repo.

## Maintenance

- Shared styles/behavior: `assets/style.css`, `assets/viz.js` (navigation manifest
  `VIZ_PAGES` lives there).
- Authoring conventions for new/updated pages: `AUTHORING.md`.
- Code snippets are verbatim from the pinned commit; line numbers drift as the code
  evolves — names and logic matter more than exact lines.

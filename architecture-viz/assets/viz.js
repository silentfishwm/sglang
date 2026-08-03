/* ==========================================================================
   SGLang Architecture Visualizations — shared runtime
   (navigation, mermaid bootstrapping, syntax highlighting, stepper engine)
   ========================================================================== */
"use strict";

/* ---------------------------------------------------------------- site map */
const VIZ_PAGES = [
  { phase: "Phase I · Foundations", items: [
    { file: "index.html",              num: "00", title: "Start Here — Map of SGLang" },
    { file: "01-request-lifecycle.html", num: "01", title: "Processes & Request Lifecycle" },
  ]},
  { phase: "Phase II · The Core Engine", items: [
    { file: "02-scheduler.html",       num: "02", title: "Scheduler & Continuous Batching" },
    { file: "03-memory.html",          num: "03", title: "KV Cache & RadixAttention" },
    { file: "04-model-execution.html", num: "04", title: "ModelRunner, Attention & CUDA Graphs" },
  ]},
  { phase: "Phase III · Models & Compute", items: [
    { file: "05-layers.html",          num: "05", title: "Layers: TP, MoE, Quantization, LoRA, VLM" },
    { file: "06-kernels.html",         num: "06", title: "Kernels, torch.compile & Hardware" },
  ]},
  { phase: "Phase IV · Scaling Out", items: [
    { file: "07-distributed.html",     num: "07", title: "Parallelism: TP · PP · DP · EP" },
    { file: "08-disaggregation.html",  num: "08", title: "PD Disaggregation, HiCache & Router" },
  ]},
  { phase: "Phase V · Advanced Inference", items: [
    { file: "09-speculative.html",     num: "09", title: "Speculative Decoding (EAGLE) & Overlap" },
    { file: "10-structured-output.html", num: "10", title: "Sampling, Grammar & Function Calling" },
  ]},
  { phase: "Phase VI · Interfaces & Operations", items: [
    { file: "11-frontend-tooling.html", num: "11", title: "APIs, Frontend DSL & Benchmarks" },
    { file: "12-observability.html",   num: "12", title: "Observability, Config & Everything Else" },
  ]},
];

/* ------------------------------------------------------------- navigation */
function vizBuildNav() {
  const here = location.pathname.split("/").pop() || "index.html";
  const aside = document.createElement("aside");
  aside.id = "sidebar";
  let html = `<a class="brand" href="index.html">SGLang Internals<small>animated architecture guide</small></a>`;
  const flat = [];
  for (const grp of VIZ_PAGES) {
    html += `<div class="phase">${grp.phase}</div>`;
    for (const p of grp.items) {
      flat.push(p);
      const active = p.file === here ? " active" : "";
      html += `<a class="navlink${active}" href="${p.file}"><span class="num">${p.num}</span>${p.title}</a>`;
    }
  }
  aside.innerHTML = html;
  document.querySelector(".layout").prepend(aside);

  // prev / next pager
  const idx = flat.findIndex(p => p.file === here);
  const holder = document.getElementById("pager");
  if (holder && idx >= 0) {
    const prev = flat[idx - 1], next = flat[idx + 1];
    holder.className = "pager";
    holder.innerHTML =
      (prev ? `<a href="${prev.file}"><small>◀ Previous</small><b>${prev.num} · ${prev.title}</b></a>` : "<span style='flex:1'></span>") +
      (next ? `<a class="next" href="${next.file}"><small>Next ▶</small><b>${next.num} · ${next.title}</b></a>` : "<span style='flex:1'></span>");
  }
}

/* ---------------------------------------------------------------- mermaid */
function vizInitMermaid() {
  if (typeof mermaid === "undefined") {
    document.querySelectorAll("pre.mermaid").forEach(el => {
      el.style.visibility = "visible";
      el.style.fontFamily = "var(--mono)";
      el.style.fontSize = "12px";
    });
    return;
  }
  mermaid.initialize({
    startOnLoad: true,
    theme: "neutral",
    securityLevel: "loose",
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
    themeVariables: {
      fontSize: "14px",
      primaryColor: "#eef0ff",
      primaryBorderColor: "#4f46e5",
      primaryTextColor: "#1a2233",
      lineColor: "#5b6480",
      clusterBkg: "#f6f7fb",
      clusterBorder: "#c9d0e4",
      edgeLabelBackground: "#ffffff",
    },
    flowchart: { curve: "basis", htmlLabels: true },
    sequence: { actorMargin: 42, mirrorActors: false, showSequenceNumbers: true },
  });
}

/* ----------------------------------------------------- syntax highlighting */
const VIZ_KW = {
  python: new Set(("def class return if elif else for while try except finally with as import from pass break " +
    "continue lambda yield async await raise in is not and or None True False global nonlocal assert del match case").split(" ")),
  rust: new Set(("fn let mut pub struct enum impl trait match if else for while loop return use mod crate self Self " +
    "async await move ref where dyn Box Vec Option Some None Result Ok Err true false unsafe const static str String " +
    "u8 u16 u32 u64 i8 i16 i32 i64 usize isize f32 f64 bool").split(" ")),
  cpp: new Set(("void int float double bool char auto const constexpr static inline template typename class struct " +
    "namespace using return if else for while switch case break continue new delete nullptr true false public private " +
    "__global__ __device__ __shared__ __forceinline__ threadIdx blockIdx blockDim gridDim size_t uint32_t int32_t int64_t half").split(" ")),
  bash: new Set(("python python3 pip export cd source if then fi for do done echo sudo docker git curl set while read").split(" ")),
  json: new Set(["true", "false", "null"]),
};

function vizEscape(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Single-pass scanning tokenizer: comments, strings, decorators, numbers,
   words (classified as keyword / self / function-call / plain). */
function vizHighlight(text, lang) {
  const kw = VIZ_KW[lang] || VIZ_KW.python;
  const pyLike = lang === "python" || lang === "bash";
  const master = pyLike
    ? /(#[^\n]*)|((?:[fFrRbBuU]{0,2})(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'))|(@[\w.]+)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|([A-Za-z_]\w*)/g
    : /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')|(#\w+|@[\w.]+)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?[fF]?\b)|([A-Za-z_]\w*)/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = master.exec(text)) !== null) {
    out += vizEscape(text.slice(last, m.index));
    const s = m[0];
    if (m[1] !== undefined) out += `<span class="tok-com">${vizEscape(s)}</span>`;
    else if (m[2] !== undefined) out += `<span class="tok-str">${vizEscape(s)}</span>`;
    else if (m[3] !== undefined) out += `<span class="tok-dec">${vizEscape(s)}</span>`;
    else if (m[4] !== undefined) out += `<span class="tok-num">${vizEscape(s)}</span>`;
    else {
      if (s === "self" || s === "cls" || s === "this") out += `<span class="tok-self">${s}</span>`;
      else if (kw.has(s)) out += `<span class="tok-kw">${s}</span>`;
      else if (text[master.lastIndex] === "(") out += `<span class="tok-fn">${s}</span>`;
      else out += vizEscape(s);
    }
    last = master.lastIndex;
  }
  out += vizEscape(text.slice(last));
  return out;
}

function vizRenderSnippets() {
  document.querySelectorAll("div.snippet").forEach(sn => {
    const pre = sn.querySelector("pre");
    if (!pre) return;
    const lang = sn.dataset.lang || "python";
    const file = sn.dataset.file || "";
    const desc = sn.dataset.desc || "";
    let text = pre.textContent.replace(/^\n+/, "").replace(/\s+$/, "");
    pre.innerHTML = vizHighlight(text, lang);
    const head = document.createElement("div");
    head.className = "sn-head";
    head.innerHTML = `<span class="sn-file">${vizEscape(file)}</span><span class="sn-desc">${vizEscape(desc)}</span>`;
    sn.prepend(head);
  });
}

/* --------------------------------------------------------- stepper engine */
/*
 * A Stepper is a guided animation. Usage:
 *   new Stepper("#dom-id", {
 *     title: "...",
 *     steps: [ { cap: "caption html", run(sc){ ...mutate scene... } }, ... ],
 *     reset(sc) { ...restore scene to step -1 state... },
 *     autoMs: 3000,
 *   });
 * Steps are replayed cumulatively: goto(i) = reset + run steps 0..i, so
 * mutations must be idempotent class toggles / text sets.
 */
class Stepper {
  constructor(sel, cfg) {
    this.root = typeof sel === "string" ? document.querySelector(sel) : sel;
    if (!this.root) return;
    this.cfg = cfg;
    this.steps = cfg.steps;
    this.i = -1;
    this.timer = null;
    this.autoMs = cfg.autoMs || 3000;
    this.scene = this.root.querySelector(".st-scene");
    this._build();
    this.goto(-1);
  }

  _build() {
    const head = document.createElement("div");
    head.className = "st-head";
    head.innerHTML = `<div class="st-title">${this.cfg.title || "Guided example"}</div>
      <div style="font-size:11.5px;color:var(--ink-faint)">${this.steps.length} steps</div>`;
    this.root.prepend(head);

    this.capEl = document.createElement("div");
    this.capEl.className = "st-caption";
    this.root.appendChild(this.capEl);

    const ctr = document.createElement("div");
    ctr.className = "st-controls";
    ctr.innerHTML = `
      <button class="st-play">▶ Play</button>
      <button class="st-prev">◀ Back</button>
      <button class="st-next">Step ▶</button>
      <button class="st-reset">⟲ Reset</button>
      <div class="st-dots"></div>`;
    this.root.appendChild(ctr);

    this.btnPlay = ctr.querySelector(".st-play");
    this.btnPrev = ctr.querySelector(".st-prev");
    this.btnNext = ctr.querySelector(".st-next");
    this.dots = ctr.querySelector(".st-dots");
    this.steps.forEach((_, k) => {
      const d = document.createElement("i");
      d.addEventListener("click", () => { this.pause(); this.goto(k); });
      this.dots.appendChild(d);
    });

    this.btnPlay.addEventListener("click", () => this.timer ? this.pause() : this.play());
    this.btnNext.addEventListener("click", () => { this.pause(); this.next(); });
    this.btnPrev.addEventListener("click", () => { this.pause(); this.goto(this.i - 1); });
    ctr.querySelector(".st-reset").addEventListener("click", () => { this.pause(); this.goto(-1); });
  }

  goto(i) {
    i = Math.max(-1, Math.min(i, this.steps.length - 1));
    this.cfg.reset(this.scene);
    for (let k = 0; k <= i; k++) this.steps[k].run(this.scene);
    this.i = i;
    if (i === -1) {
      this.capEl.innerHTML = `<span class="st-stepno">Ready</span><span>${this.cfg.intro || "Press <b>Play</b> or step through with the buttons."}</span>`;
    } else {
      this.capEl.innerHTML = `<span class="st-stepno">${i + 1}/${this.steps.length}</span><span>${this.steps[i].cap}</span>`;
    }
    [...this.dots.children].forEach((d, k) => {
      d.className = k < this.i ? "done" : (k === this.i ? "cur" : "");
    });
    this.btnPrev.disabled = this.i <= -1;
    this.btnNext.disabled = this.i >= this.steps.length - 1;
  }

  next() {
    if (this.i >= this.steps.length - 1) { this.pause(); return; }
    this.goto(this.i + 1);
  }

  play() {
    if (this.i >= this.steps.length - 1) this.goto(-1);
    this.btnPlay.textContent = "⏸ Pause";
    this.next();
    this.timer = setInterval(() => {
      if (this.i >= this.steps.length - 1) this.pause();
      else this.next();
    }, this.autoMs);
  }

  pause() {
    clearInterval(this.timer);
    this.timer = null;
    this.btnPlay.textContent = "▶ Play";
  }
}

/* small helpers usable by page scripts */
const $  = (sel, sc) => (sc || document).querySelector(sel);
const $$ = (sel, sc) => [...(sc || document).querySelectorAll(sel)];
function setCls(sc, sel, ...cls) { $$(sel, sc).forEach(e => e.classList.add(...cls)); }
function rmCls(sc, sel, ...cls) { $$(sel, sc).forEach(e => e.classList.remove(...cls)); }
function clearState(sc, sel) {
  $$(sel, sc).forEach(e => e.classList.remove("hl", "ok", "warn", "bad", "dim", "pulse", "cache", "free", "in", "on"));
}
function setText(sc, sel, txt) { const e = $(sel, sc); if (e) e.textContent = txt; }

/* ------------------------------------------------------------------- boot */
document.addEventListener("DOMContentLoaded", () => {
  vizBuildNav();
  vizRenderSnippets();
  vizInitMermaid();
});

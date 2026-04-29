// HTML for GET /. Kept as a TS string so it ships without a bundler text rule.
// Inline JS uses safe DOM APIs (textContent, replaceChildren) — never innerHTML.

export const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>is opus ok today?</title>
<meta name="description" content="A live community vote on whether Anthropic's Opus model is having a good day. Yes or no." />
<meta property="og:title" content="is opus ok today?" />
<meta property="og:description" content="Live community telemetry on Opus mood. Cast your vote." />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary" />
<style>
  :root {
    --bg: #1f1f1e;
    --fg: #d4d0c8;
    --muted: #6a6a68;
    --coral: #cc785c;
    --grid-empty: #2a2a28;
    --border: #3a3a38;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: "Berkeley Mono", "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 16px;
    line-height: 1.5;
  }
  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 48px 24px 64px;
  }
  .mascot {
    display: block;
    margin: 0 auto 24px;
    width: 192px;
    height: 192px;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
  }
  .prompt {
    font-size: 1.25rem;
    color: var(--coral);
    margin: 0 0 24px;
    text-align: center;
  }
  .prompt::before { content: "$ "; color: var(--muted); }
  .buttons {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-bottom: 32px;
  }
  .btn {
    background: transparent;
    color: var(--fg);
    border: 2px solid var(--border);
    border-radius: 0;
    padding: 12px 24px;
    font: inherit;
    font-size: 1rem;
    cursor: pointer;
    transition: border-color 120ms, color 120ms, background 120ms;
    min-width: 120px;
  }
  .btn:hover:not(:disabled) {
    border-color: var(--coral);
    color: var(--coral);
  }
  .btn[aria-pressed="true"] {
    border-color: var(--coral);
    color: var(--coral);
    background: rgba(204, 120, 92, 0.08);
  }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn .bracket { color: var(--muted); }
  .btn[aria-pressed="true"] .bracket { color: var(--coral); }

  .bar {
    font-size: 1rem;
    margin: 0 0 8px;
    text-align: center;
    letter-spacing: 0;
  }
  .bar .filled { color: var(--coral); }
  .bar .empty { color: var(--border); }
  .meta {
    text-align: center;
    color: var(--muted);
    font-size: 0.875rem;
    margin: 0 0 24px;
  }
  .meta .yes-count { color: var(--coral); }

  .hours {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 4px;
    max-width: 320px;
    margin: 0 auto 16px;
  }
  .hour-cell {
    aspect-ratio: 1 / 1;
    background: var(--coral); /* default = ok */
    border: 1px solid rgba(0, 0, 0, 0.15);
  }
  .hour-cell[data-pct="0"]   { background: #3a2a26; }
  .hour-cell[data-pct="25"]  { background: #5a3a30; }
  .hour-cell[data-pct="50"]  { background: #885548; }
  .hour-cell[data-pct="75"]  { background: #aa6952; }
  .hour-cell[data-pct="100"] { background: var(--coral); }
  .hours-caption {
    text-align: center;
    color: var(--muted);
    font-size: 0.75rem;
    margin: 0 0 32px;
  }

  footer {
    margin-top: 48px;
    text-align: center;
    color: var(--muted);
    font-size: 0.75rem;
  }
  footer a { color: var(--muted); text-decoration: underline; }
  footer a:hover { color: var(--coral); }
</style>
</head>
<body>
<main>
  <svg class="mascot" id="mascot" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-label="opus mood mascot"></svg>

  <p class="prompt">is opus ok today?</p>

  <div class="buttons" role="group" aria-label="vote">
    <button class="btn" id="vote-yes" aria-pressed="false" type="button">
      <span class="bracket">[ </span><span>yes</span><span class="bracket"> ]</span>
    </button>
    <button class="btn" id="vote-no" aria-pressed="false" type="button">
      <span class="bracket">[ </span><span>no</span><span class="bracket"> ]</span>
    </button>
  </div>

  <p class="bar" id="bar" aria-live="polite"></p>
  <p class="meta" id="meta"></p>

  <div class="hours" id="hours" role="img" aria-label="last 8 utc hours, oldest left"></div>
  <p class="hours-caption">last 8 hours utc · empty = ok</p>

  <footer>
    <span id="status">loading…</span>
  </footer>
</main>

<script type="module">
const VOTED_KEY = "isopusok.voted";
const SVGNS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}, text) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (text !== undefined) e.textContent = String(text);
  return e;
}

// ---------- mascot ----------
const BODY = [
  "................",
  "................",
  "...XXXXXXXXXXX..",
  "..XXXXXXXXXXXXX.",
  "..XX.XXX..XX.XX.",
  "..XX.XXX..XX.XX.",
  "..XXXXXXXXXXXXX.",
  "..XXXXXXXXXXXXX.",
  "..XXXXXXXXXXXXX.",
  "..XXXXXXXXXXXXX.",
  "..XXXXXXXXXXXXX.",
  "..XXXXXXXXXXXXX.",
  "...XXX.....XXX..",
  "...XXX.....XXX..",
  "...XX.......XX..",
  "................",
];

function drawMascot(verdict) {
  const svg = document.getElementById("mascot");
  svg.replaceChildren();
  const cells = [];

  // body
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (BODY[y][x] === "X") cells.push({ x, y, fill: "#cc785c" });
    }
  }

  // eyes — slightly different per mood
  const eye = (cx, cy) => {
    if (verdict === "no") {
      // x-eye
      cells.push({ x: cx,     y: cy,     fill: "#1f1f1e" });
      cells.push({ x: cx + 1, y: cy + 1, fill: "#1f1f1e" });
      cells.push({ x: cx + 1, y: cy,     fill: "#1f1f1e" });
      cells.push({ x: cx,     y: cy + 1, fill: "#1f1f1e" });
    } else {
      cells.push({ x: cx,     y: cy,     fill: "#1f1f1e" });
      cells.push({ x: cx + 1, y: cy,     fill: "#1f1f1e" });
      cells.push({ x: cx,     y: cy + 1, fill: "#1f1f1e" });
      cells.push({ x: cx + 1, y: cy + 1, fill: "#1f1f1e" });
    }
  };
  eye(4, 4);
  eye(10, 4);

  // mouth
  if (verdict === "yes") {
    [5, 6, 7, 8, 9, 10].forEach((x) => cells.push({ x, y: 9, fill: "#1f1f1e" }));
    cells.push({ x: 4,  y: 8, fill: "#1f1f1e" });
    cells.push({ x: 11, y: 8, fill: "#1f1f1e" });
  } else if (verdict === "no") {
    [5, 6, 7, 8, 9, 10].forEach((x) => cells.push({ x, y: 9, fill: "#1f1f1e" }));
    cells.push({ x: 4,  y: 10, fill: "#1f1f1e" });
    cells.push({ x: 11, y: 10, fill: "#1f1f1e" });
  } else {
    [6, 7, 8, 9].forEach((x) => cells.push({ x, y: 9, fill: "#1f1f1e" }));
  }

  for (const c of cells) {
    const r = document.createElementNS(SVGNS, "rect");
    r.setAttribute("x", String(c.x));
    r.setAttribute("y", String(c.y));
    r.setAttribute("width", "1");
    r.setAttribute("height", "1");
    r.setAttribute("fill", c.fill);
    svg.appendChild(r);
  }
}

// ---------- bar ----------
// No votes in the last 24h is treated as "opus is ok" (silence = no complaints).
function renderBar(yes, no) {
  const total = yes + no;
  const bar = document.getElementById("bar");
  const meta = document.getElementById("meta");
  bar.replaceChildren();

  if (total === 0) {
    const filled = el("span", { class: "filled" }, "█".repeat(20));
    bar.append(filled, document.createTextNode(" ok"));
    meta.replaceChildren(document.createTextNode("0 complaints in the last 24h. opus is ok."));
    return;
  }

  const pct = Math.round((yes / total) * 100);
  const filledCount = Math.round((pct / 100) * 20);
  const filled = el("span", { class: "filled" }, "█".repeat(filledCount));
  const empty = el("span", { class: "empty" }, "░".repeat(20 - filledCount));
  bar.append(filled, empty, document.createTextNode(" " + pct + "% yes"));

  meta.replaceChildren();
  const yesSpan = el("span", { class: "yes-count" }, yes + " yes");
  meta.append(yesSpan, document.createTextNode(" · " + no + " no · last 24h"));
}


// ---------- fingerprint ----------
async function sha256Hex(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function canvasHash() {
  try {
    const c = document.createElement("canvas");
    c.width = 200; c.height = 50;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px monospace";
    ctx.fillStyle = "#cc785c";
    ctx.fillRect(0, 0, 200, 50);
    ctx.fillStyle = "#1f1f1e";
    ctx.fillText("is opus ok? 🐸", 2, 2);
    return c.toDataURL();
  } catch { return ""; }
}

function webglVendorRenderer() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl");
    if (!gl) return "";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    if (!dbg) return "";
    return [
      gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL),
      gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL),
    ].join("|");
  } catch { return ""; }
}

let fingerprintPromise = null;
function getFingerprint() {
  if (fingerprintPromise) return fingerprintPromise;
  fingerprintPromise = (async () => {
    const parts = [
      navigator.userAgent || "",
      navigator.language || "",
      screen.width + "x" + screen.height + "x" + screen.colorDepth,
      String(new Date().getTimezoneOffset()),
      String(navigator.hardwareConcurrency || 0),
      String(navigator.deviceMemory || 0),
      canvasHash(),
      webglVendorRenderer(),
    ];
    return sha256Hex(parts.join("|"));
  })();
  return fingerprintPromise;
}

// ---------- state ----------
function getStoredVote() {
  try { return localStorage.getItem(VOTED_KEY); } catch { return null; }
}
function setStoredVote(v) {
  try { localStorage.setItem(VOTED_KEY, v); } catch {}
}
function highlightVote(verdict) {
  document.getElementById("vote-yes").setAttribute("aria-pressed", verdict === "yes" ? "true" : "false");
  document.getElementById("vote-no").setAttribute("aria-pressed", verdict === "no" ? "true" : "false");
}
function moodFor(stats, currentVote) {
  if (currentVote === "yes" || currentVote === "no") return currentVote;
  const { yes, no } = stats.rolling24h;
  // No votes => opus presumed ok => smile.
  if (yes + no === 0) return "yes";
  return yes >= no ? "yes" : "no";
}
function bucketPct(pct) {
  return pct >= 90 ? 100 : pct >= 65 ? 75 : pct >= 35 ? 50 : pct >= 10 ? 25 : 0;
}
function pad2(n) { return String(n).padStart(2, "0"); }

// Last 8 UTC hours, oldest on the left, current hour on the right.
// An hour with no votes renders as "ok" (full coral) per project rule.
function renderHours(hours) {
  const grid = document.getElementById("hours");
  grid.replaceChildren();
  const byKey = new Map(hours.map((h) => [h.hour, h]));
  const now = new Date();
  for (let i = 7; i >= 0; i--) {
    const d = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() - i
    ));
    const key = d.toISOString().slice(0, 13) + ":00:00Z";
    const entry = byKey.get(key);
    const cell = el("div", { class: "hour-cell" });
    const label = key.slice(0, 10) + " " + pad2(d.getUTCHours()) + ":00 utc";
    if (entry) {
      const total = entry.yes + entry.no;
      const pct = total === 0 ? 0 : Math.round((entry.yes / total) * 100);
      cell.dataset.pct = String(bucketPct(pct));
      cell.title = label + " — " + pct + "% yes (" + total + " votes)";
    } else {
      cell.title = label + " — no complaints (opus presumed ok)";
    }
    grid.appendChild(cell);
  }
}

function applyStats(stats, currentVote) {
  renderBar(stats.rolling24h.yes, stats.rolling24h.no);
  renderHours(stats.hours || []);
  drawMascot(moodFor(stats, currentVote));
}

async function loadStats() {
  const res = await fetch("/api/stats");
  if (!res.ok) throw new Error("stats failed: " + res.status);
  return res.json();
}

async function vote(verdict) {
  const yesBtn = document.getElementById("vote-yes");
  const noBtn = document.getElementById("vote-no");
  yesBtn.disabled = true; noBtn.disabled = true;
  const status = document.getElementById("status");
  status.textContent = "voting…";
  try {
    const fp = await getFingerprint();
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ verdict, fingerprint: fp }),
    });
    if (!res.ok) throw new Error("vote failed: " + res.status);
    const stats = await res.json();
    setStoredVote(verdict);
    highlightVote(verdict);
    applyStats(stats, verdict);
    status.textContent = "voted " + verdict;
  } catch (err) {
    status.textContent = "vote failed, retry";
    console.error(err);
  } finally {
    yesBtn.disabled = false; noBtn.disabled = false;
  }
}

// ---------- bootstrap ----------
(async () => {
  const stored = getStoredVote();
  if (stored === "yes" || stored === "no") highlightVote(stored);
  // Default mascot mood is "yes" — opus is ok until proven otherwise.
  drawMascot(stored ?? "yes");
  document.getElementById("vote-yes").addEventListener("click", () => vote("yes"));
  document.getElementById("vote-no").addEventListener("click", () => vote("no"));
  try {
    const stats = await loadStats();
    applyStats(stats, stored);
    document.getElementById("status").textContent = "live";
  } catch (err) {
    document.getElementById("status").textContent = "offline";
    console.error(err);
  }
})();
</script>
</body>
</html>
`;

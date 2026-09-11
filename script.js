// Automated Market Pipeline dashboard.
// Loads the generated dataset via a relative path so it works on GitHub Pages
// project subpaths. Charts are rendered with TradingView Lightweight Charts.

const DATA_URL = "./data/market_data.json";

// Fire-and-forget analytics event (no-op when the tracker is unavailable).
function track(name, params) {
  try {
    if (window.amp && window.amp.track) window.amp.track(name, params);
  } catch (e) {
    /* ignore */
  }
}

const GROUP_ORDER = ["Equities", "Indices", "FX", "Commodities", "Crypto"];

const THEME_COLORS = {
  dark: {
    text: "#e6edf3",
    muted: "#8b949e",
    grid: "rgba(48, 54, 61, 0.5)",
    up: "#3fb950",
    down: "#f85149",
    accent: "#58a6ff",
    orange: "#f0883e",
    purple: "#bc8cff",
  },
  light: {
    text: "#24292f",
    muted: "#57606a",
    grid: "rgba(208, 215, 222, 0.5)",
    up: "#1a7f37",
    down: "#cf222e",
    accent: "#0969da",
    orange: "#bc4c00",
    purple: "#8250df",
  },
};

let marketData = null;
let chart = null;
let sortKey = "daily_return_pct";
let sortDir = "desc";

const state = {
  ticker: null,
  timeframe: "30D",
  chartType: "line",
  indicators: { ema20: false, ema50: false, bollinger: false, rsi: false },
  compare: false,
  compareTicker: null,
  theme: "dark",
};

const el = {
  select: document.getElementById("asset-select"),
  compareToggle: document.getElementById("compare-toggle"),
  compareSelect: document.getElementById("compare-select"),
  themeToggle: document.getElementById("theme-toggle"),
  status: document.getElementById("pipeline-status"),
  latestClose: document.getElementById("latest-close"),
  dailyChange: document.getElementById("daily-change"),
  sma: document.getElementById("sma"),
  chartContainer: document.getElementById("price-chart"),
  leaderboardBody: document.querySelector("#leaderboard tbody"),
  logsBody: document.querySelector("#logs-table tbody"),
  alertTimeline: document.getElementById("alert-timeline"),
  thresholdInput: document.getElementById("threshold-input"),
  simulateBtn: document.getElementById("simulate-btn"),
  simResult: document.getElementById("sim-result"),
  exportBtn: document.getElementById("export-csv"),
  modal: document.getElementById("health-modal"),
  healthBody: document.getElementById("health-body"),
};

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */

function fmt(value, decimals) {
  if (value === null || value === undefined) return "—";
  const dp = decimals ?? 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(value);
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

function fmtPct(n) {
  if (n === null || n === undefined) return "—";
  const s = n > 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

function fmtVolume(n) {
  return n === null || n === undefined ? "—" : compact.format(n);
}

function parseTime(s) {
  return Math.floor(new Date(`${s}T00:00:00Z`).getTime() / 1000);
}

function relativeTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function getBlock(ticker) {
  return (marketData.data || []).find((b) => b.ticker === ticker);
}

function color(name) {
  return THEME_COLORS[state.theme][name] || THEME_COLORS.dark[name];
}

function setMetric(node, text, tone) {
  node.textContent = text;
  node.classList.remove("positive", "negative");
  if (tone) node.classList.add(tone);
}

function setStatus(stateName, text) {
  el.status.dataset.state = stateName;
  el.status.textContent = text;
}

/* ------------------------------------------------------------------ */
/* Timeframe filtering                                                 */
/* ------------------------------------------------------------------ */

function filterByTimeframe(records, tf) {
  if (!records || records.length === 0) return [];
  if (tf === "ALL") return records;
  const latest = new Date(`${records[records.length - 1].date}T00:00:00Z`);
  if (tf === "YTD") {
    const year = latest.getUTCFullYear();
    return records.filter((r) => new Date(`${r.date}T00:00:00Z`).getUTCFullYear() === year);
  }
  const days = parseInt(tf, 10);
  const cutoff = new Date(latest.getTime() - (days - 1) * 86400000);
  return records.filter((r) => new Date(`${r.date}T00:00:00Z`) >= cutoff);
}

/* ------------------------------------------------------------------ */
/* Summary cards                                                       */
/* ------------------------------------------------------------------ */

function renderSummary(block) {
  const s = block.summary || {};
  setMetric(el.latestClose, fmt(s.latest_close, block.decimals));
  const ch = s.daily_return_pct;
  setMetric(el.dailyChange, fmtPct(ch), ch > 0 ? "positive" : ch < 0 ? "negative" : null);
  setMetric(el.sma, fmt(s.sma, block.decimals));
}

/* ------------------------------------------------------------------ */
/* Leaderboard                                                         */
/* ------------------------------------------------------------------ */

function sparklineSVG(records) {
  const closes = (records || [])
    .map((r) => r.close)
    .filter((v) => v !== null && v !== undefined)
    .slice(-30);
  if (closes.length < 2) return "";
  const w = 80;
  const h = 24;
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const up = closes[closes.length - 1] >= closes[0];
  const pts = closes
    .map((v, i) => {
      const x = (i / (closes.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const stroke = up ? color("up") : color("down");
  return `<svg class="sparkline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${stroke}" stroke-width="1.5"/></svg>`;
}

function renderLeaderboard() {
  const blocks = (marketData.data || []).slice();
  const dir = sortDir === "asc" ? 1 : -1;
  const sortVal = (b) =>
    sortKey === "label" ? b.label : (b.summary && b.summary[sortKey]);
  blocks.sort((a, b) => {
    const va = sortVal(a);
    const vb = sortVal(b);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "string") return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });

  el.leaderboardBody.innerHTML = "";
  blocks.forEach((b) => {
    const s = b.summary || {};
    const ret = s.daily_return_pct;
    const retCls = ret > 0 ? "positive" : ret < 0 ? "negative" : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.label}</td>
      <td>${b.group}</td>
      <td>${fmt(s.latest_close, b.decimals)}</td>
      <td class="${retCls}">${fmtPct(ret)}</td>
      <td>${fmt(s.rsi_14, 1)}</td>
      <td>${sparklineSVG(b.records)}</td>
    `;
    el.leaderboardBody.appendChild(tr);
  });
}

/* ------------------------------------------------------------------ */
/* Historical logs table + CSV export                                  */
/* ------------------------------------------------------------------ */

function renderLogs(block) {
  const records = filterByTimeframe(block.records, state.timeframe).slice().reverse();
  el.logsBody.innerHTML = "";

  if (records.length === 0) {
    el.logsBody.innerHTML =
      '<tr><td colspan="8" class="empty-state">No records available</td></tr>';
    return;
  }

  records.forEach((r) => {
    const ret = r.daily_return_pct;
    const retCls = ret > 0 ? "positive" : ret < 0 ? "negative" : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${fmt(r.open, block.decimals)}</td>
      <td>${fmt(r.high, block.decimals)}</td>
      <td>${fmt(r.low, block.decimals)}</td>
      <td>${fmt(r.close, block.decimals)}</td>
      <td>${fmtVolume(r.volume)}</td>
      <td class="${retCls}">${fmtPct(ret)}</td>
      <td>${fmt(r.rsi_14, 1)}</td>
    `;
    el.logsBody.appendChild(tr);
  });
}

function exportCSV() {
  const block = getBlock(state.ticker);
  if (!block) return;
  const records = filterByTimeframe(block.records, state.timeframe);
  const header = ["date", "open", "high", "low", "close", "volume", "daily_return_pct", "rsi_14"];
  const rows = records.map((r) => header.map((h) => (r[h] == null ? "" : r[h])).join(","));
  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${block.ticker}_${state.timeframe}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  track("csv_export", { ticker: block.ticker, timeframe: state.timeframe });
}

/* ------------------------------------------------------------------ */
/* Chart (Lightweight Charts)                                          */
/* ------------------------------------------------------------------ */

function chartOptions() {
  return {
    layout: {
      background: { type: "solid", color: "transparent" },
      textColor: color("text"),
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    },
    grid: {
      vertLines: { color: color("grid") },
      horzLines: { color: color("grid") },
    },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, timeVisible: false },
    crosshair: { mode: 0 },
  };
}

function candleData(records) {
  return records.map((r) => ({
    time: parseTime(r.date),
    open: r.open,
    high: r.high,
    low: r.low,
    close: r.close,
  }));
}

function lineData(records, key) {
  return records
    .filter((r) => r[key] !== null && r[key] !== undefined)
    .map((r) => ({ time: parseTime(r.date), value: r[key] }));
}

function renderNormalChart(block, records) {
  const LWC = window.LightweightCharts;
  chart = LWC.createChart(el.chartContainer, chartOptions());

  // Main price series.
  if (state.chartType === "candle") {
    const series = chart.addSeries(LWC.CandlestickSeries, {
      upColor: color("up"),
      downColor: color("down"),
      borderVisible: false,
      wickUpColor: color("up"),
      wickDownColor: color("down"),
    });
    series.setData(candleData(records));
  } else {
    const series = chart.addSeries(LWC.AreaSeries, {
      lineColor: color("accent"),
      topColor: color("accent"),
      bottomColor: "rgba(88, 166, 255, 0)",
      lineWidth: 2,
    });
    series.setData(lineData(records, "close"));
  }

  // Overlays.
  if (state.indicators.ema20) {
    const s = chart.addSeries(LWC.LineSeries, { color: color("orange"), lineWidth: 2 });
    s.setData(lineData(records, "ema_20d"));
  }
  if (state.indicators.ema50) {
    const s = chart.addSeries(LWC.LineSeries, { color: color("purple"), lineWidth: 2 });
    s.setData(lineData(records, "ema_50d"));
  }
  if (state.indicators.bollinger) {
    const upper = chart.addSeries(LWC.LineSeries, { color: color("muted"), lineWidth: 1 });
    const mid = chart.addSeries(LWC.LineSeries, { color: color("muted"), lineWidth: 1, lineStyle: 2 });
    const lower = chart.addSeries(LWC.LineSeries, { color: color("muted"), lineWidth: 1 });
    upper.setData(lineData(records, "bb_upper"));
    mid.setData(lineData(records, "bb_mid"));
    lower.setData(lineData(records, "bb_lower"));
  }

  // Volume pane.
  const volumePane = chart.addPane();
  const volSeries = volumePane.addSeries(LWC.HistogramSeries, {
    priceFormat: { type: "volume" },
    lastValueVisible: false,
    priceLineVisible: false,
  });
  volSeries.setData(
    records.map((r, i) => ({
      time: parseTime(r.date),
      value: r.volume || 0,
      color: i > 0 && r.close >= records[i - 1].close ? color("up") : color("down"),
    }))
  );

  // RSI pane.
  if (state.indicators.rsi) {
    const rsiPane = chart.addPane();
    const rsiSeries = rsiPane.addSeries(LWC.LineSeries, { color: color("orange"), lineWidth: 2 });
    rsiSeries.setData(lineData(records, "rsi_14"));
  }

  applyStretchFactors();
  chart.timeScale().fitContent();
}

function renderCompareChart() {
  const LWC = window.LightweightCharts;
  chart = LWC.createChart(el.chartContainer, chartOptions());

  const pairs = [
    { block: getBlock(state.ticker), color: color("accent") },
    { block: getBlock(state.compareTicker), color: color("orange") },
  ].filter((p) => p.block);

  pairs.forEach(({ block, color: c }) => {
    const records = filterByTimeframe(block.records, state.timeframe);
    const closes = records.map((r) => r.close);
    const base = closes.find((v) => v !== null && v !== undefined);
    if (base === undefined) return;
    const series = chart.addSeries(LWC.LineSeries, { color: c, lineWidth: 2 });
    series.setData(
      records
        .filter((r) => r.close !== null && r.close !== undefined)
        .map((r) => ({
          time: parseTime(r.date),
          value: ((r.close / base) - 1) * 100,
        }))
    );
  });

  chart.timeScale().fitContent();
}

function applyStretchFactors() {
  const panes = chart.panes();
  const factors = [5, 2, 1];
  panes.forEach((p, i) => {
    try {
      p.setStretchFactor(factors[i] ?? 1);
    } catch (e) {
      /* ignore */
    }
  });
}

function renderChart() {
  el.chartContainer.innerHTML = "";
  if (chart) {
    try {
      chart.remove();
    } catch (e) {
      /* ignore */
    }
    chart = null;
  }

  if (typeof window.LightweightCharts === "undefined") {
    el.chartContainer.innerHTML =
      '<div class="empty-state">Chart library failed to load</div>';
    return;
  }

  try {
    if (state.compare && state.compareTicker) {
      renderCompareChart();
      return;
    }
    const block = getBlock(state.ticker);
    if (!block) return;
    const records = filterByTimeframe(block.records, state.timeframe);
    if (records.length === 0) {
      el.chartContainer.innerHTML = '<div class="empty-state">No data for this range</div>';
      return;
    }
    renderNormalChart(block, records);
  } catch (err) {
    console.error("Chart render failed:", err);
  }
}

/* ------------------------------------------------------------------ */
/* Alerts, simulator, health                                           */
/* ------------------------------------------------------------------ */

function renderAlerts() {
  const alerts = (marketData.alerts || []).slice(0, 5);
  el.alertTimeline.innerHTML = "";
  if (alerts.length === 0) {
    el.alertTimeline.innerHTML = '<p class="muted">No threshold breaches recorded yet.</p>';
    return;
  }
  alerts.forEach((a) => {
    const div = document.createElement("div");
    div.className = "timeline-item";
    div.innerHTML = `
      <span class="dot"></span>
      <div class="info">
        <span class="asset">${a.label || a.ticker}</span>
        <span class="meta">${a.date || ""} · ${fmtPct(a.daily_return_pct)}</span>
      </div>
    `;
    el.alertTimeline.appendChild(div);
  });
}

function runSimulator() {
  const block = getBlock(state.ticker);
  const threshold = parseFloat(el.thresholdInput.value);
  el.simResult.innerHTML = "";

  if (!block || Number.isNaN(threshold)) {
    el.simResult.textContent = "Enter a valid threshold and select an asset.";
    return;
  }

  const hits = (block.records || []).filter(
    (r) => r.daily_return_pct !== null && r.daily_return_pct <= threshold
  );
  const head = `<p><strong>${hits.length}</strong> of <strong>${
    block.records.length
  }</strong> sessions for <strong>${block.label}</strong> fell to/below <strong>${threshold}%</strong>.</p>`;
  if (hits.length === 0) {
    el.simResult.innerHTML = head;
    return;
  }
  const list = hits
    .slice(-10)
    .reverse()
    .map((r) => `<li>${r.date} — ${fmtPct(r.daily_return_pct)}</li>`)
    .join("");
  el.simResult.innerHTML = `${head}<ul>${list}</ul>`;
  track("threshold_simulator_run", { ticker: block.ticker, threshold });
}

function openHealthModal() {
  const meta = marketData.pipeline_meta || {};
  const status = meta.status === "ok" ? "OK" : "Partial";
  const statusCls = meta.status === "ok" ? "badge-ok" : "badge-warn";
  const failed = (meta.tickers_failed || []).join(", ") || "None";

  el.healthBody.innerHTML = `
    <dl>
      <dt>Status</dt><dd class="${statusCls}">${status}</dd>
      <dt>Started</dt><dd>${meta.started_at || "—"}</dd>
      <dt>Duration</dt><dd>${meta.duration_seconds ?? "—"}s</dd>
      <dt>Rows processed</dt><dd>${meta.rows_processed ?? "—"}</dd>
      <dt>Tickers fetched</dt><dd>${meta.tickers_fetched ?? marketData.tickers.length}</dd>
      <dt>Failed tickers</dt><dd>${failed}</dd>
      <dt>Last sync</dt><dd>${marketData.generated_at ? relativeTime(marketData.generated_at) : "—"}</dd>
      <dt>Data stale</dt><dd>${marketData.is_stale ? "Yes" : "No"}</dd>
    </dl>
  `;
  el.modal.hidden = false;
  track("health_modal_opened");
}

function closeHealthModal() {
  el.modal.hidden = true;
}

/* ------------------------------------------------------------------ */
/* Rendering orchestration                                             */
/* ------------------------------------------------------------------ */

function renderAll() {
  const block = getBlock(state.ticker);
  if (!block) return;
  renderSummary(block);
  renderLeaderboard();
  renderLogs(block);
  renderChart();
  renderAlerts();
}

/* ------------------------------------------------------------------ */
/* Selectors & wiring                                                  */
/* ------------------------------------------------------------------ */

function populateSelect(select, excludeTicker) {
  const data = marketData.data || [];
  select.innerHTML = "";
  const groups = {};
  data.forEach((b) => {
    if (excludeTicker && b.ticker === excludeTicker) return;
    (groups[b.group] = groups[b.group] || []).push(b);
  });
  GROUP_ORDER.forEach((name) => {
    if (!groups[name]) return;
    const og = document.createElement("optgroup");
    og.label = name;
    groups[name].forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.ticker;
      opt.textContent = b.label;
      og.appendChild(opt);
    });
    select.appendChild(og);
  });
}

function updateCompareState() {
  state.compare = el.compareToggle.checked;
  el.compareSelect.disabled = !state.compare;
  state.compareTicker = el.compareSelect.value || null;
  if (state.compare) {
    track("comparison_enabled", {
      primary: state.ticker,
      compare: state.compareTicker,
    });
  }
  renderChart();
}

function setTimeframe(tf) {
  state.timeframe = tf;
  document.querySelectorAll("#timeframes .seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tf === tf);
  });
  track("timeframe_changed", { timeframe: tf });
  renderAll();
}

function setChartType(type) {
  state.chartType = type;
  document.querySelectorAll("#chart-types .seg-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.type === type);
  });
  track("chart_type_changed", { type });
  renderChart();
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = state.theme;
  el.themeToggle.textContent = state.theme === "dark" ? "🌙" : "☀️";
  track("theme_toggled", { theme: state.theme });
  renderChart();
}

function startClock() {
  const update = () => {
    if (marketData && marketData.generated_at) {
      const stale = marketData.is_stale;
      setStatus(
        stale ? "stale" : "live",
        `Pipeline ${stale ? "stale" : "Live"} · ${relativeTime(marketData.generated_at)}`
      );
    }
  };
  update();
  setInterval(update, 60000);
}

function wireEvents() {
  el.select.addEventListener("change", () => {
    state.ticker = el.select.value;
    track("asset_changed", { ticker: state.ticker });
    renderAll();
  });

  el.compareToggle.addEventListener("change", updateCompareState);
  el.compareSelect.addEventListener("change", () => {
    state.compareTicker = el.compareSelect.value || null;
    track("comparison_asset_changed", { compare: state.compareTicker });
    renderChart();
  });

  document.querySelectorAll("#timeframes .seg-btn").forEach((b) =>
    b.addEventListener("click", () => setTimeframe(b.dataset.tf))
  );
  document.querySelectorAll("#chart-types .seg-btn").forEach((b) =>
    b.addEventListener("click", () => setChartType(b.dataset.type))
  );

  const bindIndicator = (id, key) => {
    document.getElementById(id).addEventListener("change", (e) => {
      state.indicators[key] = e.target.checked;
      track("indicator_toggled", { indicator: key, enabled: e.target.checked });
      renderChart();
    });
  };
  bindIndicator("ind-ema20", "ema20");
  bindIndicator("ind-ema50", "ema50");
  bindIndicator("ind-bollinger", "bollinger");
  bindIndicator("ind-rsi", "rsi");

  document.querySelectorAll("#leaderboard th[data-sort]").forEach((th) =>
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortDir = sortDir === "desc" ? "asc" : "desc";
      else {
        sortKey = key;
        sortDir = "desc";
      }
      renderLeaderboard();
    })
  );

  el.exportBtn.addEventListener("click", exportCSV);
  el.simulateBtn.addEventListener("click", runSimulator);
  el.themeToggle.addEventListener("click", toggleTheme);
  el.status.addEventListener("click", openHealthModal);
  el.modal.querySelectorAll("[data-close]").forEach((n) =>
    n.addEventListener("click", closeHealthModal)
  );
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function showSkeleton() {
  el.chartContainer.innerHTML = '<div class="chart-loading" style="display:flex;"><span class="spinner"></span></div>';
  [el.latestClose, el.dailyChange, el.sma].forEach((node) => {
    node.innerHTML =
      '<span class="skeleton" style="display:inline-block;width:60%;height:1.4rem;vertical-align:middle;"></span>';
  });
}

function clearSkeleton() {
  const loader = el.chartContainer.querySelector(".chart-loading");
  if (loader) loader.style.display = "none";
  [el.latestClose, el.dailyChange, el.sma].forEach((node) => {
    if (node.querySelector(".skeleton")) node.textContent = "—";
  });
}

async function init() {
  try {
    showSkeleton();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(DATA_URL, { cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    marketData = await res.json();

    populateSelect(el.select);
    populateSelect(el.compareSelect);

    if ((marketData.data || []).length === 0) {
      setStatus("pending", "Awaiting first run");
      el.leaderboardBody.innerHTML =
        '<tr><td colspan="6" class="empty-state">No data available</td></tr>';
      el.logsBody.innerHTML =
        '<tr><td colspan="8" class="empty-state">No records available</td></tr>';
      return;
    }

    state.ticker = el.select.value;
    renderAll();
    startClock();
  } catch (err) {
    console.error("Failed to load market data:", err);
    setStatus("error", "Pipeline unavailable");
    el.leaderboardBody.innerHTML =
      '<tr><td colspan="6" class="empty-state">Unable to load market data</td></tr>';
    el.logsBody.innerHTML =
      '<tr><td colspan="8" class="empty-state">Unable to load market data</td></tr>';
  } finally {
    clearSkeleton();
  }
}

wireEvents();
init();

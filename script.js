// Automated Market Pipeline dashboard.
// Loads the generated dataset using a *relative* path so the app works from
// the GitHub Pages project subpath (https://user.github.io/repo/...).

const DATA_URL = "./data/market_data.json";

// Dropdown group display order.
const GROUP_ORDER = ["Equities", "Indices", "FX", "Commodities"];

let marketData = null;
let chart = null;

const el = {
  select: document.getElementById("asset-select"),
  status: document.getElementById("pipeline-status"),
  latestClose: document.getElementById("latest-close"),
  dailyChange: document.getElementById("daily-change"),
  sma: document.getElementById("sma"),
  tbody: document.querySelector("#logs-table tbody"),
  chartLoading: document.getElementById("chart-loading"),
};

// FX pairs benefit from extra precision; everything else uses 2 decimals.
const DECIMALS = { FX: 4 };

function decimalsFor(group) {
  return DECIMALS[group] ?? 2;
}

function fmt(value, group) {
  if (value === null || value === undefined) return "—";
  const dp = decimalsFor(group);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(value);
}

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const sign = (n) => (n > 0 ? "+" : "");

function fmtPct(n) {
  return n === null || n === undefined ? "—" : `${sign(n)}${n.toFixed(2)}%`;
}

function fmtVolume(n) {
  return n === null || n === undefined ? "—" : compact.format(n);
}

function formatUtc(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
}

function setPipelineStatus(state, text) {
  el.status.dataset.state = state;
  el.status.textContent = text;
}

function showSkeleton() {
  el.chartLoading.style.display = "flex";
  [el.latestClose, el.dailyChange, el.sma].forEach((node) => {
    node.innerHTML =
      '<span class="skeleton" style="display:inline-block;width:60%;height:1.4rem;vertical-align:middle;"></span>';
  });
  el.tbody.innerHTML = Array.from({ length: 8 })
    .map(
      () =>
        '<tr><td colspan="7"><div class="skeleton" style="height:14px;margin:6px 0;"></div></td></tr>'
    )
    .join("");
}

function clearSkeleton() {
  el.chartLoading.style.display = "none";
  [el.latestClose, el.dailyChange, el.sma].forEach((node) => {
    if (node.querySelector(".skeleton")) {
      node.textContent = "—";
    }
  });
}

function smaKey(record) {
  return Object.keys(record).find((k) => /^sma_\d+d$/.test(k)) || null;
}

function getBlock(ticker) {
  return (marketData.data || []).find((b) => b.ticker === ticker);
}

function setMetric(node, text, tone) {
  node.textContent = text;
  node.classList.remove("positive", "negative");
  if (tone) node.classList.add(tone);
}

function renderSummary(block) {
  const records = block.records || [];
  const latest = records[records.length - 1];

  setMetric(el.latestClose, fmt(latest && latest.close, block.group));

  const change = latest && latest.daily_return_pct;
  setMetric(el.dailyChange, fmtPct(change), change > 0 ? "positive" : "negative");

  const sma = latest && smaKey(latest) ? latest[smaKey(latest)] : null;
  setMetric(el.sma, fmt(sma, block.group));
}

function renderTable(block) {
  const rows = (block.records || []).slice().reverse();
  el.tbody.innerHTML = "";

  if (rows.length === 0) {
    el.tbody.innerHTML =
      '<tr><td colspan="7" class="empty-state">No records available</td></tr>';
    return;
  }

  rows.forEach((r) => {
    const ret = r.daily_return_pct;
    const retTd = `<td class="${ret > 0 ? "positive" : ret < 0 ? "negative" : ""}">${fmtPct(ret)}</td>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.date}</td>
      <td>${fmt(r.open, block.group)}</td>
      <td>${fmt(r.high, block.group)}</td>
      <td>${fmt(r.low, block.group)}</td>
      <td>${fmt(r.close, block.group)}</td>
      <td>${fmtVolume(r.volume)}</td>
      ${retTd}
    `;
    el.tbody.appendChild(tr);
  });
}

function renderChart(block) {
  if (typeof Chart === "undefined") return;

  const records = block.records || [];
  const labels = records.map((r) => r.date);
  const close = records.map((r) => r.close);
  const sma = records.map((r) => (smaKey(r) ? r[smaKey(r)] : null));

  const datasets = [
    {
      label: `${block.label} Close`,
      data: close,
      borderColor: "#58a6ff",
      backgroundColor: "rgba(88, 166, 255, 0.08)",
      fill: true,
      tension: 0.25,
      pointRadius: 0,
      borderWidth: 2,
    },
  ];

  if (sma.some((v) => v !== null)) {
    datasets.push({
      label: "7-Day SMA",
      data: sma,
      borderColor: "#f0883e",
      backgroundColor: "rgba(240, 136, 62, 0.05)",
      fill: false,
      tension: 0.25,
      pointRadius: 0,
      borderWidth: 2,
      borderDash: [6, 4],
    });
  }

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("price-chart"), {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          labels: { color: "#e6edf3", usePointStyle: true },
        },
      },
      scales: {
        x: {
          ticks: { color: "#8b949e", maxTicksLimit: 10 },
          grid: { color: "rgba(48, 54, 61, 0.5)" },
        },
        y: {
          ticks: { color: "#8b949e" },
          grid: { color: "rgba(48, 54, 61, 0.5)" },
        },
      },
    },
  });
}

function renderTickers() {
  const data = marketData.data || [];
  el.select.innerHTML = "";

  if (data.length === 0) {
    el.select.innerHTML = '<option value="">No data available</option>';
    return;
  }

  const groups = {};
  data.forEach((b) => {
    (groups[b.group] = groups[b.group] || []).push(b);
  });

  GROUP_ORDER.forEach((name) => {
    if (!groups[name]) return;
    const optgroup = document.createElement("optgroup");
    optgroup.label = name;
    groups[name].forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.ticker;
      opt.textContent = b.label;
      optgroup.appendChild(opt);
    });
    el.select.appendChild(optgroup);
  });

  // Any asset with an unknown group is appended last.
  Object.keys(groups).forEach((name) => {
    if (GROUP_ORDER.includes(name)) return;
    const optgroup = document.createElement("optgroup");
    optgroup.label = name;
    groups[name].forEach((b) => {
      const opt = document.createElement("option");
      opt.value = b.ticker;
      opt.textContent = b.label;
      optgroup.appendChild(opt);
    });
    el.select.appendChild(optgroup);
  });
}

let chartLoadingTimer = null;

function showChartLoading() {
  el.chartLoading.style.display = "flex";
  if (chartLoadingTimer) clearTimeout(chartLoadingTimer);
  chartLoadingTimer = setTimeout(() => {
    el.chartLoading.style.display = "none";
  }, 250);
}

function update() {
  const ticker = el.select.value;
  const block = getBlock(ticker);
  if (!block) return;
  showChartLoading();
  renderSummary(block);
  renderTable(block);
  try {
    renderChart(block);
  } catch (err) {
    console.error("Chart render failed:", err);
  }
}

async function init() {
  try {
    showSkeleton();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(DATA_URL, {
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    marketData = await res.json();

    renderTickers();
    el.select.addEventListener("change", update);

    if (marketData.generated_at) {
      setPipelineStatus(
        "live",
        `Pipeline Live — Last Sync: ${formatUtc(marketData.generated_at)}`
      );
    } else {
      setPipelineStatus("pending", "Awaiting first run");
    }

    if ((marketData.data || []).length > 0) {
      update();
    } else {
      clearSkeleton();
      el.tbody.innerHTML =
        '<tr><td colspan="7" class="empty-state">No records available</td></tr>';
    }
  } catch (err) {
    console.error("Failed to load market data:", err);
    setPipelineStatus("error", "Pipeline unavailable");
    el.tbody.innerHTML =
      '<tr><td colspan="7" class="empty-state">Unable to load market data</td></tr>';
  } finally {
    clearSkeleton();
  }
}

init();

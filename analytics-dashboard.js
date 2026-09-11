// Analytics dashboard for the Automated Market Pipeline.
// Reads the first-party tracking data recorded by analytics.js (index.html)
// from localStorage and renders a privacy-first, in-browser summary.
// The storage key MUST match the one in analytics.js.

(function () {
  "use strict";

  var STORAGE_KEY = "amp.analytics.v1";

  var el = {
    pageviews: document.getElementById("kpi-pageviews"),
    visits: document.getElementById("kpi-visits"),
    events: document.getElementById("kpi-events"),
    barChart: document.getElementById("bar-chart"),
    topEvents: document.querySelector("#top-events tbody"),
    recent: document.getElementById("recent-events"),
    device: document.getElementById("info-device"),
    os: document.getElementById("info-os"),
    browser: document.getElementById("info-browser"),
    firstSeen: document.getElementById("info-first"),
    reset: document.getElementById("reset-btn"),
  };

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* ignore */
    }
    return { sessions: [], events: [] };
  }

  var num = new Intl.NumberFormat("en-US");

  function fmt(n) {
    return num.format(n || 0);
  }

  function renderKpis(data) {
    var pageviews = data.events.filter(function (e) {
      return e.type === "pageview";
    }).length;
    var eventCount = data.events.filter(function (e) {
      return e.type === "event";
    }).length;
    el.pageviews.textContent = fmt(pageviews);
    el.visits.textContent = fmt((data.sessions || []).length);
    el.events.textContent = fmt(eventCount);
  }

  function dayKey(iso) {
    var d = new Date(iso);
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function renderBars(data) {
    var counts = {};
    data.events.forEach(function (e) {
      if (e.type !== "pageview") return;
      var k = dayKey(e.ts);
      counts[k] = (counts[k] || 0) + 1;
    });

    var keys = Object.keys(counts).sort();
    el.barChart.innerHTML = "";

    if (keys.length === 0) {
      el.barChart.innerHTML =
        '<p class="muted">No pageviews recorded yet. Visit the dashboard to start tracking.</p>';
      return;
    }

    var max = Math.max.apply(null, keys.map(function (k) {
      return counts[k];
    }));

    keys.forEach(function (k) {
      var col = document.createElement("div");
      col.className = "bar-col";
      var value = document.createElement("span");
      value.className = "bar-value";
      value.textContent = counts[k];
      var bar = document.createElement("div");
      bar.className = "bar";
      var h = max ? Math.max(2, Math.round((counts[k] / max) * 120)) : 2;
      bar.style.height = h + "px";
      var label = document.createElement("span");
      label.className = "bar-label";
      label.textContent = k.slice(5); // MM-DD
      col.appendChild(value);
      col.appendChild(bar);
      col.appendChild(label);
      el.barChart.appendChild(col);
    });
  }

  function renderTopEvents(data) {
    var counts = {};
    data.events.forEach(function (e) {
      if (e.type !== "event" || !e.name) return;
      counts[e.name] = (counts[e.name] || 0) + 1;
    });

    var entries = Object.keys(counts)
      .map(function (name) {
        return { name: name, count: counts[name] };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });

    el.topEvents.innerHTML = "";
    if (entries.length === 0) {
      el.topEvents.innerHTML =
        '<tr><td colspan="2" class="empty-state">No interactions recorded yet</td></tr>';
      return;
    }

    entries.forEach(function (entry) {
      var tr = document.createElement("tr");
      var name = entry.name.replace(/_/g, " ");
      tr.innerHTML = "<td>" + name + "</td><td>" + fmt(entry.count) + "</td>";
      el.topEvents.appendChild(tr);
    });
  }

  function prettyParams(params) {
    if (!params) return "";
    var parts = Object.keys(params).map(function (k) {
      return k + ": " + params[k];
    });
    return parts.join(", ");
  }

  function renderRecent(data) {
    var events = data.events.slice().reverse().slice(0, 20);
    el.recent.innerHTML = "";
    if (events.length === 0) {
      el.recent.innerHTML = '<p class="muted">No events recorded yet.</p>';
      return;
    }
    events.forEach(function (e) {
      var row = document.createElement("div");
      row.className = "event-row";
      var left = document.createElement("span");
      left.className = "name";
      left.textContent = e.type === "pageview" ? "Pageview" : (e.name || "event").replace(/_/g, " ");
      var right = document.createElement("span");
      right.className = "detail";
      right.textContent =
        (e.type === "event" ? prettyParams(e.params) + " · " : "") +
        new Date(e.ts).toLocaleString();
      row.appendChild(left);
      row.appendChild(right);
      el.recent.appendChild(row);
    });
  }

  function renderDevice(data) {
    var latest = data.events[data.events.length - 1];
    if (latest) {
      el.device.textContent = latest.device || "—";
      el.os.textContent = latest.os || "—";
      el.browser.textContent = latest.browser || "—";
    }
    el.firstSeen.textContent = data.events.length
      ? new Date(data.events[0].ts).toLocaleString()
      : "—";
  }

  function render() {
    var data = load();
    renderKpis(data);
    renderBars(data);
    renderTopEvents(data);
    renderRecent(data);
    renderDevice(data);
  }

  el.reset.addEventListener("click", function () {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* ignore */
    }
    render();
  });

  render();
})();

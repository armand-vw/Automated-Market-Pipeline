// First-party, zero-dependency analytics tracker.
// Records pageviews and UI events in the visitor's own browser (localStorage).
// No data ever leaves the browser and no third-party scripts or IDs are used.
//
// The data is written under the key defined by STORAGE_KEY and read back by
// analytics.js (the dashboard page). Keep the key in sync between the two.

(function () {
  "use strict";

  var STORAGE_KEY = "amp.analytics.v1";
  var SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
  var MAX_EVENTS = 2000;
  var MAX_SESSION_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* ignore */
    }
    return { sessions: [], events: [] };
  }

  function save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore (storage full / private mode) */
    }
  }

  function uuid() {
    if (window.crypto && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function detectEnvironment() {
    var ua = navigator.userAgent || "";

    var os = "Other";
    if (/Windows/i.test(ua)) os = "Windows";
    else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
    else if (/Android/i.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
    else if (/Linux/i.test(ua)) os = "Linux";

    var browser = "Other";
    if (/Edg\//i.test(ua)) browser = "Edge";
    else if (/Chrome\//i.test(ua)) browser = "Chrome";
    else if (/Firefox\//i.test(ua)) browser = "Firefox";
    else if (/Safari\//i.test(ua)) browser = "Safari";

    var device = "desktop";
    if (/Mobi|Android/i.test(ua)) device = "mobile";
    else if (/iPad|Tablet/i.test(ua)) device = "tablet";

    return { os: os, browser: browser, device: device };
  }

  var data = load();
  var env = detectEnvironment();
  var nowMs = Date.now();

  // Session management: start a new session after 30 minutes of inactivity.
  var session = data.sessions.length
    ? data.sessions[data.sessions.length - 1]
    : null;
  if (!session || nowMs - new Date(session.last_active).getTime() > SESSION_TIMEOUT_MS) {
    session = { id: uuid(), started_at: new Date().toISOString(), last_active: null, pageviews: 0 };
    data.sessions.push(session);
  }
  session.last_active = new Date().toISOString();
  session.pageviews += 1;

  function push(type, name, params) {
    data.events.push({
      ts: new Date().toISOString(),
      type: type,
      name: name || null,
      params: params || null,
      path: location.pathname,
      referrer: document.referrer || null,
      os: env.os,
      browser: env.browser,
      device: env.device,
    });

    if (data.events.length > MAX_EVENTS) {
      data.events = data.events.slice(data.events.length - MAX_EVENTS);
    }

    var cutoff = nowMs - MAX_SESSION_AGE_MS;
    data.sessions = data.sessions.filter(function (s) {
      return new Date(s.last_active).getTime() >= cutoff;
    });

    save(data);
  }

  // Record the pageview for this load.
  push("pageview", "pageview", null);

  // Public API used by script.js.
  window.amp = {
    track: function (name, params) {
      try {
        push("event", name, params || null);
      } catch (e) {
        /* ignore */
      }
    },
  };
})();

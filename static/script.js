/* ================================================================
   FinAI — Complete Unified Frontend JavaScript
   Handles:
     - Multi-screen routing (Landing -> Auth -> App)
     - Sidebar navigation & mobile responsiveness
     - Real-time Dashboard KPIs & Chart.js visualizations
     - In-memory Transaction CRUD (Add, Edit, Delete, Filter, Sort)
     - Natural Language AI Assistant with tool & RAG transparency
     - Analytics view with breakdown progress bars
     - Financial calculators (Budget, Savings Goal, EMI, SIP Growth)
     - Live Currency Converter (open.er-api.com)
     - CSV Upload, Sample reset, and Download
   ================================================================ */

'use strict';

// ----------------------------------------------------------------
// App State
// ----------------------------------------------------------------
const state = {
  transactions: [],
  categories: {},
  monthly: [],
  summary: {},
  editingTxnId: null,
  currentUser: null,
};

let categoryChart = null;
let monthlyChart = null;
let analyticsMonthlyChart = null;
let analyticsSavingsChart = null;

let convRates = {};
let isSendingChat = false;

const PALETTE = [
  "#c9a35a", "#3ecf8e", "#60a5fa", "#ef6f6f",
  "#c084fc", "#fb7185", "#2dd4bf", "#fbbf6e",
  "#a3e635", "#fb923c", "#818cf8", "#4ade80"
];

const BUDGET_CATEGORIES = ["Food", "Transport", "Shopping", "Entertainment", "Groceries", "Bills"];

const TOOL_LABELS = {
  get_savings_rate: "Savings Rate Calculator",
  get_total_income: "Income Calculation",
  get_total_expenses: "Expense Calculation",
  get_balance: "Balance Calculation",
  get_recent_transactions: "Transaction Analysis",
  get_category_spending: "Category Spending Analysis",
  get_largest_expenses: "Transaction Analysis",
  get_monthly_summary: "Monthly Trend Analysis",
  get_spending_trend: "Monthly Trend Analysis",
  get_financial_health_score: "Financial Health Score",
  generate_spending_insights: "Spending Insights Engine",
  suggest_budget: "Budget Planner (50/30/20)",
  get_category_total: "Category Spending Analysis",
  search_transactions: "Transaction Search",
  analyze_savings_goal: "Savings Goal Calculator",
  rag_retrieve_context: "Local Finance Knowledge Base",
};

// ----------------------------------------------------------------
// Utilities
// ----------------------------------------------------------------
function formatINR(val) {
  const n = Number(val) || 0;
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function formatINR0(val) {
  const n = Number(val) || 0;
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function nowTime() {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function escHtml(str) {
  const d = document.createElement("div");
  d.textContent = String(str || "");
  return d.innerHTML;
}

async function apiGet(path) {
  try {
    const res = await fetch(path);
    return await res.json();
  } catch (err) {
    console.error(`Error GET ${path}:`, err);
    return {};
  }
}

async function apiPost(path, body) {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    return { ok: res.ok, data: await res.json() };
  } catch (err) {
    console.error(`Error POST ${path}:`, err);
    return { ok: false, data: { error: "Network error. Please try again." } };
  }
}

async function apiDelete(path) {
  try {
    const res = await fetch(path, { method: "DELETE" });
    return { ok: res.ok, data: await res.json() };
  } catch (err) {
    console.error(`Error DELETE ${path}:`, err);
    return { ok: false, data: { error: "Network error. Please try again." } };
  }
}


// ----------------------------------------------------------------
// Screen Switching & Auth Management
// ----------------------------------------------------------------
const screens = {
  landing: document.getElementById("landing-screen"),
  login:   document.getElementById("login-screen"),
  app:     document.getElementById("app-screen"),
};

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (el) el.classList.toggle("hidden", key !== name);
  });
  if (name === "app") {
    refreshAll();
  }
}

function getStoredAccounts() {
  try { return JSON.parse(localStorage.getItem("finTrack_v2_accounts")) || {}; }
  catch (_) { return {}; }
}
function saveStoredAccounts(accts) {
  localStorage.setItem("finTrack_v2_accounts", JSON.stringify(accts));
}

function setUser(user) {
  state.currentUser = user;
  if (user) {
    localStorage.setItem("finTrack_currentUser", JSON.stringify(user));
    document.getElementById("sidebar-user-name").textContent = user.name || user.email;
    document.getElementById("sidebar-user-email").textContent = user.email || "";
    document.getElementById("sidebar-avatar").textContent = (user.name || user.email || "U").charAt(0).toUpperCase();
  } else {
    localStorage.removeItem("finTrack_currentUser");
    document.getElementById("sidebar-user-name").textContent = "Guest User";
    document.getElementById("sidebar-user-email").textContent = "guest@finai.local";
    document.getElementById("sidebar-avatar").textContent = "G";
  }
}

// Landing page events
document.getElementById("landing-login-btn")?.addEventListener("click", () => showScreen("login"));
document.getElementById("landing-hero-getstarted")?.addEventListener("click", () => {
  showScreen("login");
  document.getElementById("login-form-wrap")?.classList.add("hidden");
  document.getElementById("signup-form-wrap")?.classList.remove("hidden");
});
document.getElementById("landing-direct-app-btn")?.addEventListener("click", () => {
  setUser({ name: "Demo User", email: "demo@finai.local" });
  showScreen("app");
});
document.getElementById("landing-hero-direct")?.addEventListener("click", () => {
  setUser({ name: "Demo User", email: "demo@finai.local" });
  showScreen("app");
});

// Login / Signup form toggles
document.getElementById("go-to-signup")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("login-form-wrap")?.classList.add("hidden");
  document.getElementById("signup-form-wrap")?.classList.remove("hidden");
});
document.getElementById("go-to-login")?.addEventListener("click", (e) => {
  e.preventDefault();
  document.getElementById("signup-form-wrap")?.classList.add("hidden");
  document.getElementById("login-form-wrap")?.classList.remove("hidden");
});
document.getElementById("login-back-btn")?.addEventListener("click", () => showScreen("landing"));
document.getElementById("signup-back-btn")?.addEventListener("click", () => showScreen("landing"));

// Guest launch buttons
document.getElementById("login-guest-btn")?.addEventListener("click", () => {
  setUser({ name: "Guest User", email: "guest@finai.local" });
  showScreen("app");
});
document.getElementById("signup-guest-btn")?.addEventListener("click", () => {
  setUser({ name: "Guest User", email: "guest@finai.local" });
  showScreen("app");
});

// Login submit
document.getElementById("login-submit-btn")?.addEventListener("click", () => {
  const email = (document.getElementById("login-email")?.value || "").trim().toLowerCase();
  const pass  = document.getElementById("login-password")?.value || "";
  const errEl = document.getElementById("login-error");
  errEl.classList.add("hidden");

  const accts = getStoredAccounts();
  if (!accts[email]) {
    errEl.textContent = "No account found with this email. Please sign up or continue as guest.";
    errEl.classList.remove("hidden");
    return;
  }
  if (accts[email].password !== pass) {
    errEl.textContent = "Incorrect password. Please try again.";
    errEl.classList.remove("hidden");
    return;
  }
  setUser(accts[email]);
  showScreen("app");
});

// Signup submit
document.getElementById("signup-submit-btn")?.addEventListener("click", () => {
  const name  = (document.getElementById("signup-name")?.value || "").trim();
  const email = (document.getElementById("signup-email")?.value || "").trim().toLowerCase();
  const pass  = document.getElementById("signup-password")?.value || "";
  const errEl = document.getElementById("signup-error");
  errEl.classList.add("hidden");

  if (!name || !email || !pass) {
    errEl.textContent = "Please fill in all fields.";
    errEl.classList.remove("hidden");
    return;
  }
  if (pass.length < 6) {
    errEl.textContent = "Password must be at least 6 characters.";
    errEl.classList.remove("hidden");
    return;
  }
  const accts = getStoredAccounts();
  if (accts[email]) {
    errEl.textContent = "An account with this email already exists. Please log in.";
    errEl.classList.remove("hidden");
    return;
  }
  const newUser = { name, email, password: pass };
  accts[email] = newUser;
  saveStoredAccounts(accts);
  setUser(newUser);
  showScreen("app");
});

// App logout / exit
document.getElementById("app-logout-btn")?.addEventListener("click", () => {
  setUser(null);
  showScreen("landing");
});
document.getElementById("brand-home-link")?.addEventListener("click", () => switchView("dashboard"));


// ----------------------------------------------------------------
// Sidebar & View Navigation
// ----------------------------------------------------------------
const navButtons = document.querySelectorAll(".nav-item[data-view]");
const viewSections = document.querySelectorAll(".view");

function switchView(name) {
  viewSections.forEach((v) => v.classList.toggle("view-active", v.id === `view-${name}`));
  navButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.view === name));

  if (name === "dashboard") {
    setTimeout(() => {
      categoryChart?.resize();
      monthlyChart?.resize();
    }, 60);
  }
  if (name === "analytics") {
    setTimeout(() => {
      analyticsMonthlyChart?.resize();
      analyticsSavingsChart?.resize();
    }, 60);
  }

  // Collapse sidebar on small screens
  if (window.innerWidth < 820) {
    document.getElementById("sidebar")?.classList.remove("open");
  }
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

const sidebar = document.getElementById("sidebar");
const toggleDashboard = document.getElementById("toggleDashboard");
toggleDashboard?.addEventListener("click", () => sidebar.classList.toggle("open"));

document.addEventListener("click", (e) => {
  if (window.innerWidth < 820 && sidebar?.classList.contains("open")) {
    if (!sidebar.contains(e.target) && e.target !== toggleDashboard && !toggleDashboard.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  }
});

document.getElementById("dash-view-all-txns")?.addEventListener("click", () => switchView("transactions"));
document.getElementById("topbar-add-quick-btn")?.addEventListener("click", () => {
  switchView("transactions");
  document.getElementById("addTxnHeading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("txnDate")?.focus();
});


// ----------------------------------------------------------------
// Data Loaders (Connected to FinAI Flask REST Endpoints)
// ----------------------------------------------------------------
async function loadStatus() {
  const s = await apiGet("/api/status");
  const badge = document.getElementById("aiStatusBadge");
  if (!badge) return;
  const dot  = badge.querySelector(".status-dot");
  const text = badge.querySelector(".status-text");
  if (s.gemini_status === "configured") {
    dot.classList.add("online");
    text.textContent = "AI Connected";
  } else {
    dot.classList.remove("online");
    text.textContent = "Fallback Mode";
  }
}

async function loadSummary() {
  const s = await apiGet("/api/summary");
  state.summary = s;

  document.getElementById("metricIncome").textContent   = formatINR0(s.total_income);
  document.getElementById("metricExpenses").textContent = formatINR0(s.total_expenses);
  document.getElementById("metricBalance").textContent  = formatINR0(s.balance);
  document.getElementById("metricRate").textContent     = (s.savings_rate ?? 0) + "%";

  const rateEl = document.getElementById("metricRate");
  const rate = Number(s.savings_rate) || 0;
  if (rate >= 20) rateEl.style.color = "var(--income)";
  else if (rate >= 10) rateEl.style.color = "var(--accent2)";
  else rateEl.style.color = "var(--expense)";

  const landingBal = document.getElementById("landing-hero-balance");
  if (landingBal) landingBal.textContent = formatINR(s.balance);

  const badge = document.getElementById("dataSourceBadge");
  const src = s.source === "uploaded" ? `📂 ${s.filename || "Uploaded CSV"}` : "📊 Sample Data";
  if (badge) badge.textContent = `${src} · ${s.transaction_count || 0} txns`;
}

async function loadCategories() {
  const c = await apiGet("/api/categories");
  state.categories = c.categories || {};

  const catCount = Object.keys(state.categories).length;
  const badge = document.getElementById("categoryCountBadge");
  if (badge) badge.textContent = `${catCount} categories`;

  renderCategoryChart();
  renderTopCategories();
  renderCategoryBreakdown();
}

async function loadMonthly() {
  const m = await apiGet("/api/monthly-summary");
  state.monthly = m.months || [];

  const badge = document.getElementById("monthCountBadge");
  if (badge) badge.textContent = `${state.monthly.length} months`;

  renderMonthlyChart();
  renderAnalyticsCharts();
  renderAnalyticsSummary();
}

async function loadTransactions() {
  const t = await apiGet("/api/transactions");
  state.transactions = t.transactions || [];

  const badge = document.getElementById("tableCountBadge");
  if (badge) badge.textContent = `${state.transactions.length} rows`;
  const sideBadge = document.getElementById("sideCountBadge");
  if (sideBadge) sideBadge.textContent = state.transactions.length;

  const incCount = state.transactions.filter(x => x.type === "income").length;
  const expCount = state.transactions.filter(x => x.type === "expense").length;
  const incSub = document.getElementById("metricIncomeSub");
  const expSub = document.getElementById("metricExpenseSub");
  if (incSub) incSub.textContent = `${incCount} entries`;
  if (expSub) expSub.textContent = `${expCount} entries`;

  populateCategoryFilter();
  renderTable();
  renderRecentTable();
}

async function refreshAll() {
  await Promise.all([loadStatus(), loadSummary(), loadCategories(), loadMonthly(), loadTransactions()]);
}

document.getElementById("dash-refresh-btn")?.addEventListener("click", async () => {
  const btn = document.getElementById("dash-refresh-btn");
  btn.textContent = "Updating…";
  await refreshAll();
  btn.textContent = "⟳ Refresh";
});


// ----------------------------------------------------------------
// Chart.js Visualizations
// ----------------------------------------------------------------
function renderCategoryChart() {
  const canvas = document.getElementById("categoryChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const labels = Object.keys(state.categories);
  const values = Object.values(state.categories);

  categoryChart?.destroy();
  if (labels.length === 0) { categoryChart = null; return; }

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: PALETTE.slice(0, labels.length),
        borderWidth: 2,
        borderColor: "#181923",
        hoverOffset: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              const val = ctx.raw || 0;
              const total = values.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${formatINR0(val)} (${pct}%)`;
            },
          },
        },
      },
      cutout: "58%",
    },
  });
}

function renderMonthlyChart() {
  const canvas = document.getElementById("monthlyChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const labels   = state.monthly.map((m) => m.month);
  const income   = state.monthly.map((m) => m.income);
  const expenses = state.monthly.map((m) => m.expenses);

  monthlyChart?.destroy();
  if (labels.length === 0) { monthlyChart = null; return; }

  monthlyChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        { label: "Income", data: income, backgroundColor: "#3ecf8e", borderRadius: 4, maxBarThickness: 20 },
        { label: "Expenses", data: expenses, backgroundColor: "#ef6f6f", borderRadius: 4, maxBarThickness: 20 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 9 }, color: "#9ca0b0" } },
        tooltip: {
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatINR0(ctx.raw)}` },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 9 }, color: "#63677a",
            callback: (val) => val >= 100000 ? (val/100000) + "L" : val >= 1000 ? (val/1000) + "k" : val,
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        x: { ticks: { font: { size: 9 }, color: "#63677a" }, grid: { display: false } },
      },
    },
  });
}

function renderAnalyticsCharts() {
  const mCanvas = document.getElementById("analyticsMonthlyChart");
  const sCanvas = document.getElementById("analyticsSavingsChart");
  if (!mCanvas || !sCanvas) return;

  const labels = state.monthly.map((m) => m.month);
  const income = state.monthly.map((m) => m.income);
  const exp    = state.monthly.map((m) => m.expenses);
  const rates  = state.monthly.map((m) => m.income > 0 ? Math.round(((m.income - m.expenses)/m.income)*100) : 0);

  analyticsMonthlyChart?.destroy();
  if (labels.length > 0) {
    analyticsMonthlyChart = new Chart(mCanvas.getContext("2d"), {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Income", data: income, backgroundColor: "#3ecf8e", borderRadius: 4, maxBarThickness: 20 },
          { label: "Expenses", data: exp, backgroundColor: "#ef6f6f", borderRadius: 4, maxBarThickness: 20 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 10, color: "#9ca0b0" } } },
        scales: {
          y: { beginAtZero: true, grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#63677a" } },
          x: { grid: { display: false }, ticks: { color: "#63677a" } },
        },
      },
    });
  }

  analyticsSavingsChart?.destroy();
  if (labels.length > 0) {
    analyticsSavingsChart = new Chart(sCanvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Savings Rate %",
          data: rates,
          borderColor: "#c9a35a",
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: "#c9a35a",
          fill: true,
          backgroundColor: "rgba(201,163,90,0.08)",
          tension: 0.3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            grid: { color: "rgba(255,255,255,0.05)" },
            ticks: { color: "#63677a", callback: (v) => v + "%" },
          },
          x: { grid: { display: false }, ticks: { color: "#63677a" } },
        },
      },
    });
  }
}

function renderTopCategories() {
  const list = document.getElementById("topCategoriesList");
  if (!list) return;
  list.innerHTML = "";

  const entries = Object.entries(state.categories);
  if (entries.length === 0) {
    list.innerHTML = "<li><span class='hint'>No expense data loaded yet.</span></li>";
    return;
  }
  const totalExp = entries.reduce((s, [_, amt]) => s + amt, 0);

  for (const [cat, amt] of entries.slice(0, 6)) {
    const pct = totalExp > 0 ? ((amt / totalExp) * 100).toFixed(1) : 0;
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${escHtml(cat)} <small style="color:var(--text-dim);">(${pct}%)</small></span>
      <span class="top-cat-amount">${formatINR0(amt)}</span>
    `;
    list.appendChild(li);
  }
}

function renderCategoryBreakdown() {
  const container = document.getElementById("catBreakdownList");
  if (!container) return;

  const entries = Object.entries(state.categories);
  if (entries.length === 0) {
    container.innerHTML = "<p class='empty-hint'>No expense data available.</p>";
    return;
  }
  const totalExp = entries.reduce((s, [_, a]) => s + a, 0);

  container.innerHTML = entries.map(([cat, amt], idx) => {
    const pct = totalExp > 0 ? ((amt / totalExp) * 100).toFixed(1) : 0;
    const color = PALETTE[idx % PALETTE.length];
    return `
      <div class="cat-breakdown-item">
        <div class="cat-breakdown-header">
          <span>${escHtml(cat)}</span>
          <span>${formatINR0(amt)} <small style="color:var(--text-dim)">(${pct}%)</small></span>
        </div>
        <div class="cat-progress-bar">
          <div class="cat-progress-fill" style="width:${pct}%; background:${color};"></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderAnalyticsSummary() {
  const entries = Object.entries(state.categories);
  const months = state.monthly;

  const topEl = document.getElementById("analyticsTopCat");
  if (topEl) {
    topEl.textContent = entries.length > 0 ? `${entries[0][0]} (${formatINR0(entries[0][1])})` : "—";
  }

  const avgEl = document.getElementById("analyticsAvgExp");
  if (avgEl) {
    if (months.length > 0) {
      const avg = months.reduce((s, m) => s + m.expenses, 0) / months.length;
      avgEl.textContent = formatINR0(avg) + " / mo";
    } else avgEl.textContent = "—";
  }

  const bestEl = document.getElementById("analyticsBestMonth");
  if (bestEl) {
    if (months.length > 0) {
      let best = months[0];
      let bestRate = -Infinity;
      months.forEach(m => {
        const r = m.income > 0 ? (m.income - m.expenses) / m.income : -Infinity;
        if (r > bestRate) { bestRate = r; best = m; }
      });
      bestEl.textContent = best.month;
    } else bestEl.textContent = "—";
  }
}

function renderRecentTable() {
  const body = document.getElementById("recentTxnsBody");
  if (!body) return;
  const recent = [...state.transactions].slice(0, 5);
  if (recent.length === 0) {
    body.innerHTML = "<tr><td colspan='4' class='empty-hint'>No transactions recorded.</td></tr>";
    return;
  }
  body.innerHTML = recent.map((t) => `
    <tr>
      <td>${t.date || ""}</td>
      <td><strong>${escHtml(t.description || "")}</strong></td>
      <td>${escHtml(t.category || "")}</td>
      <td class="${t.type === 'expense' ? 'amount-expense' : 'amount-income'}">${t.type === 'expense' ? '-' : '+'}${formatINR0(t.amount)}</td>
    </tr>
  `).join("");
}


// ----------------------------------------------------------------
// Transaction Management (Search, Sort, Add, Edit, Delete)
// ----------------------------------------------------------------
let sortKey = "date";
let sortDir = -1;

function populateCategoryFilter() {
  const select = document.getElementById("txnCategoryFilter");
  if (!select) return;
  const cur = select.value;
  const cats = [...new Set(state.transactions.map((t) => t.category))].sort();
  select.innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join("");
  select.value = cur;
}

function renderTable() {
  const body = document.getElementById("txnTableBody");
  if (!body) return;

  const searchInput = document.getElementById("txnSearch");
  const catSelect   = document.getElementById("txnCategoryFilter");
  const typeSelect  = document.getElementById("txnTypeFilter");

  const search = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const catFilter  = catSelect ? catSelect.value : "";
  const typeFilter = typeSelect ? typeSelect.value : "";

  let rows = state.transactions.filter((t) => {
    const matchesSearch = !search ||
      (t.description && t.description.toLowerCase().includes(search)) ||
      (t.category && t.category.toLowerCase().includes(search));
    const matchesCat  = !catFilter  || t.category === catFilter;
    const matchesType = !typeFilter || t.type === typeFilter;
    return matchesSearch && matchesCat && matchesType;
  });

  rows = rows.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === "amount") { av = Number(av) || 0; bv = Number(bv) || 0; }
    if (av < bv) return -1 * sortDir;
    if (av > bv) return  1 * sortDir;
    return 0;
  });

  if (rows.length === 0) {
    body.innerHTML = "<tr><td colspan='6' style='text-align:center; color:var(--text-dim); padding:20px;'>No matching transactions found.</td></tr>";
    return;
  }

  body.innerHTML = rows.map((t) => `
    <tr>
      <td>${t.date || ""}</td>
      <td><strong>${escHtml(t.description || "")}</strong></td>
      <td>${escHtml(t.category || "")}</td>
      <td><span style="font-size:0.75rem; text-transform:uppercase; font-weight:700; color:${t.type === 'expense' ? 'var(--expense)' : 'var(--income)'}">${t.type}</span></td>
      <td class="${t.type === 'expense' ? 'amount-expense' : 'amount-income'}">${t.type === 'expense' ? '-' : '+'}${formatINR(t.amount)}</td>
      <td class="txn-actions">
        <button class="icon-btn edit-txn" data-id="${t.id}" title="Edit Transaction">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
        </button>
        <button class="icon-btn delete-txn" data-id="${t.id}" title="Delete Transaction">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
        </button>
      </td>
    </tr>
  `).join("");
}

document.getElementById("txnSearch")?.addEventListener("input", renderTable);
document.getElementById("txnCategoryFilter")?.addEventListener("change", renderTable);
document.getElementById("txnTypeFilter")?.addEventListener("change", renderTable);

document.querySelectorAll("#txnTable th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = th.dataset.sort;
    if (sortKey === key) sortDir *= -1;
    else { sortKey = key; sortDir = 1; }
    th.textContent = `${th.dataset.sort.charAt(0).toUpperCase() + th.dataset.sort.slice(1)} ${sortDir === 1 ? "▴" : "▾"}`;
    renderTable();
  });
});

// Form: Add / Edit Transaction
const submitTxnBtn  = document.getElementById("submitTxnBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const txnFormStatus = document.getElementById("txnFormStatus");
const addTxnHeading = document.getElementById("addTxnHeading");

function readTxnForm() {
  return {
    date: document.getElementById("txnDate").value,
    description: document.getElementById("txnDesc").value.trim(),
    category: document.getElementById("txnCategory").value.trim(),
    type: document.getElementById("txnType").value,
    amount: parseFloat(document.getElementById("txnAmount").value),
  };
}

function clearTxnForm() {
  document.getElementById("txnDate").value = "";
  document.getElementById("txnDesc").value = "";
  document.getElementById("txnCategory").value = "";
  document.getElementById("txnType").value = "expense";
  document.getElementById("txnAmount").value = "";
}

function enterEditMode(t) {
  state.editingTxnId = t.id;
  document.getElementById("txnDate").value = t.date;
  document.getElementById("txnDesc").value = t.description;
  document.getElementById("txnCategory").value = t.category;
  document.getElementById("txnType").value = t.type;
  document.getElementById("txnAmount").value = t.amount;
  addTxnHeading.textContent = "Edit Transaction";
  submitTxnBtn.textContent = "Save Changes";
  cancelEditBtn.classList.remove("hidden");
  document.getElementById("txnDate").scrollIntoView({ behavior: "smooth", block: "center" });
}

function exitEditMode() {
  state.editingTxnId = null;
  addTxnHeading.textContent = "Add a Transaction";
  submitTxnBtn.textContent = "Add Transaction";
  cancelEditBtn.classList.add("hidden");
  clearTxnForm();
}

cancelEditBtn?.addEventListener("click", exitEditMode);

submitTxnBtn?.addEventListener("click", async () => {
  const payload = readTxnForm();
  if (!payload.date || !payload.description || !payload.category || !payload.amount || payload.amount <= 0) {
    txnFormStatus.textContent = "Please fill in date, description, category, and a positive amount.";
    txnFormStatus.style.color = "var(--expense)";
    return;
  }

  txnFormStatus.style.color = "";
  txnFormStatus.textContent = state.editingTxnId !== null ? "Saving changes…" : "Adding…";

  // If in edit mode, delete old row then insert updated row
  if (state.editingTxnId !== null) {
    const delRes = await apiDelete(`/api/transactions/${state.editingTxnId}`);
    if (!delRes.ok) {
      txnFormStatus.textContent = delRes.data.error || "Could not update transaction.";
      txnFormStatus.style.color = "var(--expense)";
      return;
    }
  }

  const { ok, data } = await apiPost("/api/transactions", payload);
  if (!ok) {
    txnFormStatus.textContent = data.error || "Could not save transaction.";
    txnFormStatus.style.color = "var(--expense)";
    return;
  }

  txnFormStatus.style.color = "var(--income)";
  txnFormStatus.textContent = state.editingTxnId !== null ? "✓ Transaction updated." : "✓ Transaction added.";
  exitEditMode();
  await refreshAll();
  setTimeout(() => { txnFormStatus.textContent = ""; }, 3000);
});

// Edit & Delete delegation
document.getElementById("txnTableBody")?.addEventListener("click", async (e) => {
  const editBtn   = e.target.closest(".edit-txn");
  const deleteBtn = e.target.closest(".delete-txn");

  if (editBtn) {
    const id = Number(editBtn.dataset.id);
    const t  = state.transactions.find((x) => x.id === id);
    if (t) enterEditMode(t);
    return;
  }

  if (deleteBtn) {
    const id = Number(deleteBtn.dataset.id);
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    const { ok, data } = await apiDelete(`/api/transactions/${id}`);
    if (!ok) {
      alert(data.error || "Could not delete transaction.");
      return;
    }
    await refreshAll();
  }
});


// ----------------------------------------------------------------
// AI Assistant (Chat Engine)
// ----------------------------------------------------------------
function renderMarkdown(text) {
  if (window.marked) {
    try { return window.marked.parse(text || "", { breaks: true, gfm: true }); }
    catch (_) {}
  }
  const d = document.createElement("div");
  d.textContent = text || "";
  return d.innerHTML.replace(/\n/g, "<br>");
}

function buildSourceBadges(data) {
  const chips = [];
  if (data.rag_used) chips.push("📚 Knowledge Base");
  const seen = new Set();
  (data.tools_used || []).forEach((t) => {
    if (t === "rag_retrieve_context" || seen.has(t)) return;
    seen.add(t);
    chips.push("🔧 " + (TOOL_LABELS[t] || t));
  });
  return chips;
}

function appendChatMessage(role, content, chips = []) {
  const container = document.getElementById("chatMessages");
  const msgEl = document.createElement("div");
  msgEl.className = `msg ${role}`;

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    const d = document.createElement("div");
    d.textContent = content;
    bubble.innerHTML = `<p>${d.innerHTML}</p>`;
  }
  msgEl.appendChild(bubble);

  const meta = document.createElement("div");
  meta.className = "msg-meta";
  meta.innerHTML = `<span>${nowTime()}</span>`;
  chips.forEach((c) => {
    const s = document.createElement("span");
    s.className = "msg-meta-chip";
    s.textContent = c;
    meta.appendChild(s);
  });
  msgEl.appendChild(meta);

  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
  return msgEl;
}

function appendChatLoading() {
  const container = document.getElementById("chatMessages");
  const msgEl = document.createElement("div");
  msgEl.className = "msg assistant";
  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = `<div class="msg-loading"><span></span><span></span><span></span></div>`;
  msgEl.appendChild(bubble);
  container.appendChild(msgEl);
  container.scrollTop = container.scrollHeight;
  return msgEl;
}

async function sendChatMessage(query) {
  const text = (query || "").trim();
  if (!text || isSendingChat) return;
  isSendingChat = true;

  const input   = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendChatBtn");
  if (input) input.value = "";
  if (input) input.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  appendChatMessage("user", text);
  const loading = appendChatLoading();

  try {
    const { data } = await apiPost("/api/chat", { message: text });
    loading.remove();
    appendChatMessage(
      "assistant",
      data.answer || "I could not generate an answer. Please try again.",
      buildSourceBadges(data)
    );
  } catch (err) {
    loading.remove();
    appendChatMessage("assistant", "⚠️ Connection error. Please make sure the FinAI server is active.");
  } finally {
    isSendingChat = false;
    if (input) {
      input.disabled = false;
      input.focus();
    }
    if (sendBtn) sendBtn.disabled = false;
  }
}

document.getElementById("sendChatBtn")?.addEventListener("click", () => {
  sendChatMessage(document.getElementById("chatInput")?.value);
});

document.getElementById("chatInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage(e.target.value);
  }
});

// Quick prompt chips
document.querySelectorAll(".quick-chip").forEach((btn) => {
  btn.addEventListener("click", () => {
    sendChatMessage(btn.dataset.query);
  });
});

// Clear chat
document.getElementById("clearChatBtn")?.addEventListener("click", async () => {
  await apiPost("/api/clear-chat");
  const container = document.getElementById("chatMessages");
  if (container) {
    container.innerHTML = `
      <div class="msg assistant">
        <div class="msg-bubble">
          <p class="welcome-title">Fin<em>AI</em></p>
          <p class="welcome-subtitle">Chat History Cleared</p>
          <p class="welcome-desc">Ask a new question or use one of the quick prompts below.</p>
          <div class="chat-quick-prompts">
            <span class="quick-prompts-label">Quick Prompts:</span>
            <div class="quick-chips">
              <button class="quick-chip" data-query="What is my savings rate?">💰 Savings Rate</button>
              <button class="quick-chip" data-query="Show me my expense by category">📊 Category Breakdown</button>
              <button class="quick-chip" data-query="Show me my recent transactions">📋 Recent Transactions</button>
              <button class="quick-chip" data-query="How is my financial health?">❤️ Financial Health</button>
            </div>
          </div>
        </div>
      </div>
    `;
    // Re-attach listeners for newly added chips
    container.querySelectorAll(".quick-chip").forEach((btn) => {
      btn.addEventListener("click", () => sendChatMessage(btn.dataset.query));
    });
  }
});


// ----------------------------------------------------------------
// Finance Tools (Budget, Goal, Loan, Investment, Insights)
// ----------------------------------------------------------------

// Budget Planner
function initBudgetInputs() {
  const container = document.getElementById("budgetInputs");
  if (!container) return;
  container.innerHTML = BUDGET_CATEGORIES.map((cat) => `
    <label>${cat} (₹)<input type="number" data-cat="${cat}" placeholder="e.g. 5000"></label>
  `).join("");
}
initBudgetInputs();

document.getElementById("checkBudgetBtn")?.addEventListener("click", async () => {
  const inputs = document.querySelectorAll("#budgetInputs input");
  const budgets = {};
  inputs.forEach((inp) => {
    const val = parseFloat(inp.value);
    if (val > 0) budgets[inp.dataset.cat] = val;
  });

  const box = document.getElementById("budgetResult");
  box.classList.remove("hidden");

  if (Object.keys(budgets).length === 0) {
    box.textContent = "Please enter a monthly budget for at least one category.";
    return;
  }

  const { ok, data } = await apiPost("/api/budget", { budgets });
  if (!ok) {
    box.textContent = data.error || "Could not check budget.";
    return;
  }

  box.innerHTML = data.results.map((r) => `
    <div class="result-row">
      <span>${r.category}: limit ${formatINR(r.budget)}, spent ${formatINR(r.actual)}</span>
      <strong class="${r.status === 'Over budget' ? 'status-over' : 'status-within'}">${r.status}</strong>
    </div>
  `).join("");
});

// Savings Goal
document.getElementById("analyzeGoalBtn")?.addEventListener("click", async () => {
  const target   = parseFloat(document.getElementById("goalTarget").value);
  const timeline = parseFloat(document.getElementById("goalTimeline").value);
  const current  = parseFloat(document.getElementById("goalCurrent").value) || 0;
  const box      = document.getElementById("goalResult");
  box.classList.remove("hidden");

  if (!target || !timeline) {
    box.textContent = "Please provide both a target amount and timeline in months.";
    return;
  }

  const { ok, data } = await apiPost("/api/goal", {
    target_amount: target, timeline_months: timeline, current_savings: current,
  });
  if (!ok) {
    box.textContent = data.error || "Could not analyze goal.";
    return;
  }

  box.innerHTML = `
    <div class="result-row"><span>Required Monthly Savings</span><strong>${formatINR(data.required_monthly_saving)}</strong></div>
    <div class="result-row"><span>Estimated Current Capacity</span><strong>${formatINR(data.estimated_current_monthly_savings_capacity)}</strong></div>
    <div class="result-row"><span>Monthly Savings Gap</span><strong class="${data.savings_gap > 0 ? 'status-over' : 'status-within'}">${formatINR(data.savings_gap)}</strong></div>
    <div class="result-row"><span>Progress Toward Target</span><strong>${data.progress_percent}%</strong></div>
    <div class="result-row"><span>On Track?</span><strong>${data.is_currently_on_track ? '✅ Yes' : '⚠️ Adjustment Recommended'}</strong></div>
  `;
});

// Loan / EMI Calculator
document.getElementById("calculateEmiBtn")?.addEventListener("click", () => {
  const principal = parseFloat(document.getElementById("loanPrincipal").value);
  const rate      = parseFloat(document.getElementById("loanRate").value);
  const tenure    = parseFloat(document.getElementById("loanTenure").value);
  const box       = document.getElementById("loanResult");
  box.classList.remove("hidden");

  if (!principal || !rate || !tenure) {
    box.textContent = "Please enter principal, interest rate, and tenure.";
    return;
  }

  const n = Math.round(tenure * 12);
  const r = rate / 12 / 100;
  const emi = r === 0
    ? principal / n
    : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayment = emi * n;
  const totalInterest = totalPayment - principal;

  let affordabilityLine = "";
  const avgIncome = state.summary && state.summary.total_income
    ? state.summary.total_income / Math.max(1, state.monthly.length || 1)
    : 0;
  if (avgIncome > 0) {
    const pct = (emi / avgIncome) * 100;
    const isSafe = pct <= 40;
    affordabilityLine = `
      <div class="result-row"><span>EMI as % of your monthly income</span><strong>${pct.toFixed(1)}%</strong></div>
      <div class="result-row"><span>Affordability Flag</span><strong>${isSafe ? '✅ Safe (under 40%)' : '⚠️ Heavy (over 40%)'}</strong></div>
    `;
  }

  box.innerHTML = `
    <div class="result-row"><span>Monthly EMI</span><strong>${formatINR(emi)}</strong></div>
    <div class="result-row"><span>Total Interest Payable</span><strong>${formatINR(totalInterest)}</strong></div>
    <div class="result-row"><span>Total Amount Payable</span><strong>${formatINR(totalPayment)}</strong></div>
    ${affordabilityLine}
  `;
});

// Investment Calculator
const investMode = document.getElementById("investMode");
investMode?.addEventListener("change", () => {
  const lbl = document.getElementById("investAmountLabel");
  if (lbl) lbl.childNodes[0].textContent = investMode.value === "sip" ? "Monthly investment (₹)" : "Lump-sum deposit (₹)";
});

document.getElementById("calculateInvestmentBtn")?.addEventListener("click", () => {
  const mode   = document.getElementById("investMode").value;
  const amt    = parseFloat(document.getElementById("investAmount").value);
  const rate   = parseFloat(document.getElementById("investRate").value);
  const years  = parseFloat(document.getElementById("investYears").value);
  const box    = document.getElementById("investmentResult");
  box.classList.remove("hidden");

  if (!amt || !rate || !years) {
    box.textContent = "Please enter investment amount, rate, and years.";
    return;
  }

  let fv = 0, invested = 0;
  if (mode === "sip") {
    const n = Math.round(years * 12);
    const i = rate / 12 / 100;
    fv = i === 0 ? amt * n : amt * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
    invested = amt * n;
  } else {
    fv = amt * Math.pow(1 + rate / 100, years);
    invested = amt;
  }
  const wealthGained = fv - invested;

  box.innerHTML = `
    <div class="result-row"><span>Total Invested</span><strong>${formatINR(invested)}</strong></div>
    <div class="result-row"><span>Estimated Wealth Gained</span><strong>${formatINR(wealthGained)}</strong></div>
    <div class="result-row"><span>Projected Future Value</span><strong>${formatINR(fv)}</strong></div>
  `;
});

// Insights Engine
async function loadInsightQuestion(message) {
  const box = document.getElementById("insightsResult");
  box.innerHTML = `<div class="msg-loading"><span></span><span></span><span></span></div>`;
  const { data } = await apiPost("/api/chat", { message });
  const chips = buildSourceBadges(data);
  box.innerHTML = `
    <div>${renderMarkdown(data.answer || "Could not generate insights.")}</div>
    ${chips.length ? `<div class="msg-meta" style="margin-top:12px;">${chips.map(c => `<span class="msg-meta-chip">${c}</span>`).join("")}</div>` : ""}
  `;
}
document.getElementById("loadHealthInsightBtn")?.addEventListener("click", () => {
  loadInsightQuestion("How is my financial health? Give me a detailed breakdown and insights.");
});
document.getElementById("loadSpendingInsightBtn")?.addEventListener("click", () => {
  loadInsightQuestion("Where am I spending the most? Show me my spending patterns.");
});


// ----------------------------------------------------------------
// Currency Converter
// ----------------------------------------------------------------
const POPULAR_CURRENCIES = {
  INR: "Indian Rupee", USD: "US Dollar", EUR: "Euro",
  GBP: "British Pound", JPY: "Japanese Yen", AUD: "Australian Dollar",
  CAD: "Canadian Dollar", CHF: "Swiss Franc", SGD: "Singapore Dollar",
  AED: "UAE Dirham", SAR: "Saudi Riyal",
};

async function initExchangeRates() {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await res.json();
    if (data.result === "success") {
      convRates = data.rates;
    }
  } catch (_) {
    convRates = { INR: 83.5, USD: 1, EUR: 0.93, GBP: 0.79, JPY: 149.5, AUD: 1.54 };
  }
  populateCurrencies();
}

function populateCurrencies() {
  const fromEl = document.getElementById("convFrom");
  const toEl   = document.getElementById("convTo");
  if (!fromEl || !toEl) return;

  const codes = [...new Set([...Object.keys(POPULAR_CURRENCIES), ...Object.keys(convRates)])].filter(c => convRates[c]);
  const opts = codes.map(c => `<option value="${c}">${c}${POPULAR_CURRENCIES[c] ? ' — ' + POPULAR_CURRENCIES[c] : ''}</option>`).join("");
  fromEl.innerHTML = opts;
  toEl.innerHTML   = opts;
  fromEl.value = "INR";
  toEl.value   = "USD";
}

document.getElementById("convSwapBtn")?.addEventListener("click", () => {
  const f = document.getElementById("convFrom");
  const t = document.getElementById("convTo");
  [f.value, t.value] = [t.value, f.value];
});

document.getElementById("convConvertBtn")?.addEventListener("click", () => {
  const amt = parseFloat(document.getElementById("convAmount").value) || 1;
  const f   = document.getElementById("convFrom").value;
  const t   = document.getElementById("convTo").value;

  if (!convRates[f] || !convRates[t]) return;
  const inUSD = amt / convRates[f];
  const converted = inUSD * convRates[t];
  const rate = convRates[t] / convRates[f];

  document.getElementById("convResultVal").textContent = converted.toLocaleString("en-IN", { maximumFractionDigits: 3 }) + " " + t;
  document.getElementById("convResultRate").textContent = `1 ${f} = ${rate.toFixed(4)} ${t}`;
});


// ----------------------------------------------------------------
// Upload CSV Modal
// ----------------------------------------------------------------
const uploadModalOverlay = document.getElementById("uploadModalOverlay");
const openUploadBtn      = document.getElementById("openUploadModal");
const closeUploadBtn     = document.getElementById("closeUploadModal");
const txnOpenUploadBtn   = document.getElementById("txn-open-upload-btn");

function openModal() { uploadModalOverlay.classList.remove("hidden"); }
function closeModal() { uploadModalOverlay.classList.add("hidden"); }

openUploadBtn?.addEventListener("click", openModal);
txnOpenUploadBtn?.addEventListener("click", openModal);
closeUploadBtn?.addEventListener("click", closeModal);
uploadModalOverlay?.addEventListener("click", (e) => {
  if (e.target === uploadModalOverlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !uploadModalOverlay?.classList.contains("hidden")) closeModal();
});

const csvInput = document.getElementById("csvInput");
const dropZone = document.getElementById("dropZone");

async function handleFileUpload(file) {
  if (!file) return;
  const statusEl = document.getElementById("uploadStatus");
  statusEl.textContent = "Processing CSV…";
  statusEl.style.color = "";

  const formData = new FormData();
  formData.append("file", file);

  const res  = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();

  if (!res.ok) {
    statusEl.textContent = "Error: " + (data.error || "Upload failed") + (data.details ? " — " + data.details.join("; ") : "");
    statusEl.style.color = "var(--expense)";
    return;
  }

  statusEl.style.color = "var(--income)";
  statusEl.textContent = "✓ " + data.message;
  await refreshAll();
  setTimeout(closeModal, 1200);
}

csvInput?.addEventListener("change", (e) => handleFileUpload(e.target.files[0]));

if (dropZone) {
  ["dragenter", "dragover"].forEach(evt => dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add("dragover"); }));
  ["dragleave", "drop"].forEach(evt => dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); }));
  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  });
}

document.getElementById("resetDataBtn")?.addEventListener("click", async () => {
  const statusEl = document.getElementById("uploadStatus");
  statusEl.textContent = "Resetting to sample data…";
  await apiPost("/api/clear-data");
  statusEl.style.color = "var(--income)";
  statusEl.textContent = "✓ Reverted to default sample dataset.";
  await refreshAll();
  setTimeout(closeModal, 1000);
});


// ----------------------------------------------------------------
// Initialization
// ----------------------------------------------------------------
(function init() {
  const stored = localStorage.getItem("finTrack_currentUser");
  if (stored) {
    try { setUser(JSON.parse(stored)); }
    catch (_) { setUser(null); }
  }

  initExchangeRates();
  // Check if user is already logged in or wants to start at landing
  if (state.currentUser) {
    showScreen("app");
  } else {
    showScreen("landing");
  }
})();

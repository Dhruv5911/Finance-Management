// ============================================================
// FinTrack — main app script
// This file is written to be readable if you're learning JS:
// each section below is a self-contained chunk you can study
// on its own. Search for the "SECTION:" labels to jump around.
// ============================================================

// SECTION: Storage keys
// We save data in the browser's localStorage so it survives a
// page refresh. Each key is just a string "bucket name" we use
// to store/retrieve one piece of data.
const STORAGE_KEY = 'finTrack_v2_transactions';
const THEME_KEY   = 'finTrack_v2_theme';
const BUDGET_STORAGE_KEY = 'finTrack_v2_budgets';

// SECTION: App state
// "State" just means the data our app is currently working with.
// transactions: an array of objects, one per income/expense entry.
// budgets: an object mapping category name -> monthly limit ($).
let transactions  = [];
let budgets = {
  Food: 300,
  Transport: 100,
  Shopping: 200,
  Bills: 400,
  Entertainment: 150,
  Other: 150
};

const CATEGORY_ICONS = {
  Food: '🍔', Transport: '🚗', Shopping: '🛍️',
  Bills: '📄', Entertainment: '🎬', Salary: '💼', Other: '📦'
};
const BAR_COLORS = [
  '#c9a35a','#3ecf8e','#ef6f6f','#d9a441','#6f92b8','#e2c583','#b98d6f'
];

const DEMO_TRANSACTIONS = [
  { id: 101, desc: 'Web Development Freelance', amount: 3200, date: '2026-07-15', type: 'income', category: 'Salary' },
  { id: 102, desc: 'Organic Groceries', amount: 164.50, date: '2026-07-16', type: 'expense', category: 'Food' },
  { id: 103, desc: 'Electric Bill', amount: 92.40, date: '2026-07-18', type: 'expense', category: 'Bills' },
  { id: 104, desc: 'Premium Coffee Maker', amount: 89.99, date: '2026-07-20', type: 'expense', category: 'Shopping' },
  { id: 105, desc: 'Gym Monthly Membership', amount: 45.00, date: '2026-07-21', type: 'expense', category: 'Other' },
  { id: 106, desc: 'Gas Station Fuel', amount: 55.00, date: '2026-07-22', type: 'expense', category: 'Transport' },
  { id: 107, desc: 'Design System Consulting', amount: 1800, date: '2026-07-25', type: 'income', category: 'Salary' },
  { id: 108, desc: 'Fine Dining Dinner', amount: 142.00, date: '2026-07-26', type: 'expense', category: 'Food' },
  { id: 109, desc: 'Weekly Supermarket Run', amount: 110.25, date: '2026-07-28', type: 'expense', category: 'Food' },
  { id: 110, desc: 'Cinema Tickets & Snacks', amount: 34.50, date: '2026-07-29', type: 'expense', category: 'Entertainment' },
  { id: 111, desc: 'High-speed Fiber Internet', amount: 79.99, date: '2026-08-01', type: 'expense', category: 'Bills' },
  { id: 112, desc: 'Regular Monthly Salary', amount: 5000, date: '2026-08-01', type: 'income', category: 'Salary' },
  { id: 113, desc: 'Trendy Shoes Sale', amount: 120.00, date: '2026-08-02', type: 'expense', category: 'Shopping' },
  { id: 114, desc: 'Uber ride to Office', amount: 18.50, date: '2026-08-04', type: 'expense', category: 'Transport' },
  { id: 115, desc: 'Coffee Shop with Friends', amount: 15.75, date: '2026-08-05', type: 'expense', category: 'Food' },
  { id: 116, desc: 'Streaming Subscription', amount: 14.99, date: '2026-08-06', type: 'expense', category: 'Entertainment' },
  { id: 117, desc: 'Car Maintenance Repair', amount: 280.00, date: '2026-08-08', type: 'expense', category: 'Transport' },
  { id: 118, desc: 'E-commerce Books', amount: 48.30, date: '2026-08-10', type: 'expense', category: 'Shopping' },
  { id: 119, desc: 'Software License SaaS', amount: 29.00, date: '2026-08-12', type: 'expense', category: 'Bills' },
  { id: 120, desc: 'Bistro Lunch Special', amount: 24.50, date: '2026-08-14', type: 'expense', category: 'Food' },
];

// SECTION: Loading & saving data
// localStorage only stores strings, so we convert our JS array/object
// to a string with JSON.stringify() before saving, and back with
// JSON.parse() when reading it out.
function loadTransactions() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    transactions = JSON.parse(stored);
  } else {
    transactions = [...DEMO_TRANSACTIONS];
    saveTransactions();
  }

  const storedBudgets = localStorage.getItem(BUDGET_STORAGE_KEY);
  if (storedBudgets) {
    budgets = JSON.parse(storedBudgets);
  } else {
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgets));
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

// SECTION: DOM references
// We grab every HTML element we'll need to read from or write to,
// once, up front. document.getElementById(id) finds the single
// element with that id="" attribute in index.html.
const form            = document.getElementById('transaction-form');
const descInput       = document.getElementById('desc');
const amountInput     = document.getElementById('amount');
const dateInput       = document.getElementById('date');
const categorySelect  = document.getElementById('category');
const recentList      = document.getElementById('recent-list');
const fullList        = document.getElementById('transaction-list');
const categoryChart   = document.getElementById('category-chart');
const filterType      = document.getElementById('filter-type');
const filterCategory  = document.getElementById('filter-category');
const sortBy          = document.getElementById('sort-by');
const searchInput     = document.getElementById('search-input');
const themeToggle     = document.getElementById('theme-toggle');

// SECTION: Navigation (switching between pages)
// This app is a "single page app": every page (Dashboard,
// Transactions, etc.) already exists in the HTML, hidden with
// CSS. navigateTo() just shows the one we want and hides the rest.
const navItems    = document.querySelectorAll('.nav-item');
const pages       = document.querySelectorAll('.page');
const topbarTitle = document.getElementById('topbar-title');
const PAGE_TITLES = { dashboard: 'Dashboard', transactions: 'Transactions', analytics: 'Analytics', converter: 'Currency Converter' };

function navigateTo(pageId) {
  navItems.forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
  pages.forEach(p => p.classList.toggle('active', p.id === `page-${pageId}`));
  topbarTitle.textContent = PAGE_TITLES[pageId] || pageId;
  if (pageId === 'analytics') renderAnalytics();
  closeSidebar();
}

navItems.forEach(n => n.addEventListener('click', e => {
  e.preventDefault();
  navigateTo(n.dataset.page);
}));

document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.goto));
});

// SECTION: Mobile nav toggle
// On small screens, the nav links are hidden until the hamburger
// button is tapped, which adds an "open" CSS class the stylesheet
// uses to slide/reveal them.
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const hamburger = document.getElementById('hamburger');

hamburger.addEventListener('click', () => sidebar.classList.add('open'));
overlay.addEventListener('click', closeSidebar);
function closeSidebar() { sidebar.classList.remove('open'); }

// SECTION: Light/dark theme
// The whole theme is controlled by one CSS class ("light") on
// <body>. Every color in style.css is a CSS variable that changes
// value depending on whether that class is present — so toggling
// one class instantly re-themes the entire app.
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light') applyTheme('light');
  else applyTheme('dark');
}

function applyTheme(t) {
  document.body.classList.toggle('light', t === 'light');
  const btn = themeToggle;
  btn.querySelector('.icon-moon').classList.toggle('hidden', t === 'light');
  btn.querySelector('.icon-sun').classList.toggle('hidden', t === 'dark');
  btn.querySelector('span').textContent = t === 'light' ? 'Dark Mode' : 'Light Mode';
  localStorage.setItem(THEME_KEY, t);
}

themeToggle.addEventListener('click', () => {
  const isLight = document.body.classList.contains('light');
  applyTheme(isLight ? 'dark' : 'light');
});

// SECTION: Formatting helpers
// Small, reusable functions that turn raw numbers/dates into the
// text we actually want to show on screen. Keeping this logic in
// one place means every part of the app formats money the same way.
function fmt(amount) {
  return '$' + Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// SECTION: Dashboard summary (the 4 KPI cards + the card balance)
// reduce() walks the array once and builds up a single running
// result (here: totals.income and totals.expense) — it's the
// go-to tool whenever you want to turn "many items" into "one number".
function updateSummary(data) {
  const totals = data.reduce((acc, tx) => {
    acc[tx.type] += tx.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const netBalance = totals.income - totals.expense;
  document.getElementById('total-balance').textContent  = fmt(netBalance);
  document.getElementById('total-income').textContent   = fmt(totals.income);
  document.getElementById('total-expense').textContent  = fmt(totals.expense);
  document.getElementById('transaction-count').textContent = data.length;

  const cardBalVal = document.getElementById('card-balance-val');
  if (cardBalVal) {
    cardBalVal.textContent = fmt(netBalance);
  }

  renderBalanceTrend(data);
}

// Compares this calendar month's net (income - expense) against
// last month's, and shows a small "up X%" / "down X%" badge.
// This is a genuinely useful signal — not just decoration — since
// it tells you at a glance whether you're trending better or worse.
function renderBalanceTrend(data) {
  const trendEl = document.getElementById('balance-trend');
  if (!trendEl) return;

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthKey  = `${lastMonthDate.getFullYear()}-${lastMonthDate.getMonth()}`;

  const netForMonth = (monthKey) => data.reduce((sum, tx) => {
    const d = new Date(tx.date + 'T00:00:00');
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key !== monthKey) return sum;
    return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
  }, 0);

  const thisNet = netForMonth(thisMonthKey);
  const lastNet = netForMonth(lastMonthKey);

  if (lastNet === 0) {
    trendEl.innerHTML = '';
    return;
  }

  const change = ((thisNet - lastNet) / Math.abs(lastNet)) * 100;
  const isUp = change >= 0;
  trendEl.innerHTML = `
    <span class="trend-pill ${isUp ? 'trend-up' : 'trend-down'}">
      ${isUp ? '↑' : '↓'} ${Math.abs(change).toFixed(0)}% vs last month
    </span>`;
}

// SECTION: Rendering transactions to HTML
// This function takes one transaction object and returns an HTML
// string for it. Template literals (the backtick `` `...` `` syntax)
// let us mix plain text with ${variables} — much easier to read
// than gluing strings together with +.
function txHTML(tx, mini = false) {
  const icon = CATEGORY_ICONS[tx.category] || '💰';
  const sign = tx.type === 'income' ? '+' : '-';
  return `
    <div class="transaction-item animate-enter" data-id="${tx.id}">
      <div class="tx-icon">${icon}</div>
      <div class="tx-info">
        <div class="tx-desc">${tx.desc}</div>
        <div class="tx-meta">
          <span class="category-badge">${tx.category}</span>
          <span>${fmtDate(tx.date)}</span>
        </div>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${tx.type}">${sign}${fmt(tx.amount)}</span>
        ${mini ? '' : `
        <button class="btn-delete" onclick="deleteTransaction(${tx.id})" aria-label="Delete">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>`}
      </div>
    </div>`;
}

function renderRecent() {
  const recent = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  if (!recent.length) {
    recentList.innerHTML = '<div class="empty-state">No transactions yet. Add one!</div>';
  } else {
    recentList.innerHTML = recent.map(tx => txHTML(tx, true)).join('');
  }
}

// SECTION: Filtering & sorting the Transactions page
// filter() returns a new array containing only the items that
// pass a test — here we chain three filters (type, category,
// search text), then sort() re-orders whatever's left.
function getFiltered() {
  let data = [...transactions];
  const typeVal = filterType.value;
  const catVal  = filterCategory.value;
  const sortVal = sortBy.value;
  const query   = (searchInput.value || '').toLowerCase().trim();

  if (typeVal !== 'all') data = data.filter(tx => tx.type === typeVal);
  if (catVal  !== 'all') data = data.filter(tx => tx.category === catVal);
  if (query)             data = data.filter(tx => tx.desc.toLowerCase().includes(query));

  data.sort((a, b) => {
    if (sortVal === 'newest')  return new Date(b.date) - new Date(a.date);
    if (sortVal === 'oldest')  return new Date(a.date) - new Date(b.date);
    if (sortVal === 'highest') return b.amount - a.amount;
    if (sortVal === 'lowest')  return a.amount - b.amount;
    return 0;
  });
  return data;
}

function renderFullList() {
  const data = getFiltered();
  if (!data.length) {
    fullList.innerHTML = '<div class="empty-state">No transactions match your filters.</div>';
  } else {
    fullList.innerHTML = data.map(tx => txHTML(tx, false)).join('');
  }
}

// SECTION: Analytics page
// Same reduce() pattern as updateSummary(), just building more
// interesting shapes: a per-category totals object, then a ring
// chart percentage, then a full table grouped by category+type.
function renderAnalytics() {
  const expenses = transactions.filter(tx => tx.type === 'expense');
  const totalIncome  = transactions.reduce((s,tx) => tx.type === 'income'  ? s+tx.amount : s, 0);
  const totalExpense = transactions.reduce((s,tx) => tx.type === 'expense' ? s+tx.amount : s, 0);
  const savings = totalIncome - totalExpense;
  const savingsPct = totalIncome > 0 ? Math.max(0, Math.min(100, (savings / totalIncome) * 100)) : 0;

  document.getElementById('ana-income').textContent  = fmt(totalIncome);
  document.getElementById('ana-expense').textContent = fmt(totalExpense);
  document.getElementById('ana-savings').textContent = fmt(savings);
  document.getElementById('savings-pct').textContent = savingsPct.toFixed(1) + '%';

  const circumference = 301.6;
  const offset = circumference - (savingsPct / 100) * circumference;
  document.getElementById('savings-ring').style.strokeDashoffset = offset;

  if (!expenses.length) {
    categoryChart.innerHTML = '<div class="empty-state">No expense data.</div>';
  } else {
    const cats = expenses.reduce((acc, tx) => {
      acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
      return acc;
    }, {});
    const sorted = Object.entries(cats).sort((a,b) => b[1]-a[1]);
    const max = sorted[0][1];
    categoryChart.innerHTML = sorted.map(([cat, amt], i) => {
      const pct = ((amt / max) * 100).toFixed(1);
      const color = BAR_COLORS[i % BAR_COLORS.length];
      return `
        <div class="bar-row">
          <div class="bar-header">
            <span>${CATEGORY_ICONS[cat] || ''} ${cat}</span>
            <span>${fmt(amt)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${pct}%; background:${color}"></div>
          </div>
        </div>`;
    }).join('');
  }

  const allCats = transactions.reduce((acc, tx) => {
    const key = tx.category + '|' + tx.type;
    if (!acc[key]) acc[key] = { category: tx.category, type: tx.type, count: 0, total: 0 };
    acc[key].count++;
    acc[key].total += tx.amount;
    return acc;
  }, {});

  const rows = Object.values(allCats).sort((a,b) => b.total - a.total);
  const tbody = document.getElementById('category-table-body');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No data yet.</td></tr>';
  } else {
    tbody.innerHTML = rows.map(r => `
      <tr>
        <td>${CATEGORY_ICONS[r.category] || ''} ${r.category}</td>
        <td>${r.count}</td>
        <td><strong>${fmt(r.total)}</strong></td>
        <td><span class="type-pill ${r.type}">${r.type}</span></td>
      </tr>`).join('');
  }
}

// SECTION: Form validation
// Simple, explicit validation: check each field, collect whether
// anything failed, and only proceed if `valid` is still true.
// This pattern (loop/check each rule, track one boolean) scales
// to almost any form.
function clearErrors() {
  document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
}

function showError(id, msg) {
  const el = document.getElementById(`error-${id}`);
  if (el) el.textContent = msg;
}

form.addEventListener('submit', function(e) {
  e.preventDefault();
  clearErrors();

  const desc     = descInput.value.trim();
  const amount   = parseFloat(amountInput.value);
  const date     = dateInput.value;
  const type     = document.querySelector('input[name="type"]:checked').value;
  const category = categorySelect.value;
  let valid = true;

  if (!desc)              { showError('desc',   'Description is required.'); valid = false; }
  if (isNaN(amount) || amount <= 0) { showError('amount', 'Enter a valid amount.'); valid = false; }
  if (!date)              { showError('date',   'Date is required.'); valid = false; }

  if (valid) {
    transactions = [{ id: Date.now(), desc, amount, date, type, category }, ...transactions];
    saveTransactions();
    refreshAll();
    form.reset();
    dateInput.value = new Date().toISOString().split('T')[0];
    const incomeTypeRadio = document.querySelector('input[name="type"][value="income"]');
    if (incomeTypeRadio) incomeTypeRadio.checked = true;
    closeModal();
    showToast('Transaction Added', `"${desc}" was successfully recorded!`, 'success');
  }
});

filterType.addEventListener('change', renderFullList);
filterCategory.addEventListener('change', renderFullList);
sortBy.addEventListener('change', renderFullList);
searchInput.addEventListener('input', () => {
  clearTimeout(window._searchTimer);
  window._searchTimer = setTimeout(renderFullList, 250);
});

// SECTION: Deleting a transaction
// We attach this to `window` (instead of a plain function) because
// the delete button's HTML uses inline onclick="deleteTransaction(...)",
// and inline handlers can only call functions that exist as global
// (window-level) names.
window.deleteTransaction = function(id) {
  const item = document.querySelector(`.transaction-item[data-id="${id}"]`);
  const tx = transactions.find(t => t.id === id);
  const doDelete = () => {
    transactions = transactions.filter(tx => tx.id !== id);
    saveTransactions();
    refreshAll();
    if (tx) {
      showToast('Transaction Deleted', `"${tx.desc}" was removed.`, 'info');
    }
  };
  if (item) { item.classList.add('fade-out'); setTimeout(doDelete, 300); }
  else doDelete();
};

// SECTION: Quick-add modal
// Rather than having two separate forms (one in the sidebar, one
// in the modal), we physically move the *same* <form> element
// back and forth between two containers with appendChild(). Its
// values and event listeners come along with it automatically.
const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose    = document.getElementById('modal-close');
const quickAddBtn   = document.getElementById('quick-add-btn');

quickAddBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function openModal() {
  const modalTitle = document.querySelector('#modal h3');
  const modalHint = document.querySelector('.modal-hint');
  if (modalTitle) modalTitle.textContent = 'New Transaction';
  if (modalHint) modalHint.textContent = 'Fill in the details below and hit Add.';

  modalBackdrop.classList.remove('hidden');
  document.getElementById('modal-form-target').innerHTML = '';
  document.getElementById('modal-form-target').appendChild(form);
}

function closeModal() {
  modalBackdrop.classList.add('hidden');
  const target = document.getElementById('quick-form-section');
  if (target && !target.contains(form)) target.appendChild(form);
}

const manageBudgetBtn = document.getElementById('btn-manage-budget');
if (manageBudgetBtn) {
  manageBudgetBtn.addEventListener('click', openBudgetModal);
}

function openBudgetModal() {
  const modalTitle = document.querySelector('#modal h3');
  const modalHint = document.querySelector('.modal-hint');
  const target = document.getElementById('modal-form-target');
  
  if (modalTitle) modalTitle.textContent = 'Set Monthly Budget';
  if (modalHint) modalHint.textContent = 'Configure your target monthly spending limit for each category.';
  
  let optionsHTML = Object.keys(CATEGORY_ICONS)
    .filter(cat => cat !== 'Salary')
    .map(cat => `<option value="${cat}">${CATEGORY_ICONS[cat]} ${cat}</option>`).join('');
    
  target.innerHTML = `
    <form id="budget-form" style="padding: 1.25rem 1.5rem;">
      <div class="form-group">
        <label for="budget-cat">Category</label>
        <select id="budget-cat" class="form-control">${optionsHTML}</select>
      </div>
      <div class="form-group">
        <label for="budget-limit">Limit Amount ($)</label>
        <input type="number" id="budget-limit" class="form-control" placeholder="300" min="0" step="10">
        <span class="error-msg" id="error-budget-limit"></span>
      </div>
      <button type="submit" class="btn-submit">Save Budget</button>
    </form>
  `;
  
  modalBackdrop.classList.remove('hidden');
  
  const bForm = document.getElementById('budget-form');
  const catSel = document.getElementById('budget-cat');
  const limitIn = document.getElementById('budget-limit');
  
  catSel.addEventListener('change', () => {
    limitIn.value = budgets[catSel.value] || '';
  });
  limitIn.value = budgets[catSel.value] || '';
  
  bForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const cat = catSel.value;
    const limit = parseFloat(limitIn.value);
    if (isNaN(limit) || limit < 0) {
      document.getElementById('error-budget-limit').textContent = 'Please enter a valid amount.';
      return;
    }
    budgets[cat] = limit;
    localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgets));
    showToast('Success', `Budget for ${cat} set to $${limit.toFixed(2)}`, 'success');
    closeModal();
    renderBudgets();
  });
}

const demoDataBtn = document.getElementById('demo-data-btn');
if (demoDataBtn) {
  demoDataBtn.addEventListener('click', () => {
    transactions = [...DEMO_TRANSACTIONS];
    saveTransactions();
    refreshAll();
    showToast('Demo Data Loaded', 'Beautiful multi-month transactions have been loaded successfully!', 'success');
  });
}

const exportCsvBtn = document.getElementById('export-csv-btn');
if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', () => {
    if (!transactions.length) {
      showToast('Export Failed', 'There are no transactions to export.', 'error');
      return;
    }
    
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'ID,Description,Amount,Date,Type,Category\n';
    
    transactions.forEach(tx => {
      const row = [
        tx.id,
        `"${tx.desc.replace(/"/g, '""')}"`,
        tx.amount,
        tx.date,
        tx.type,
        tx.category
      ].join(',');
      csvContent += row + '\n';
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'fintrack_transactions.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Export Successful', 'Your transactions have been exported to a CSV file.', 'success');
  });
}

// SECTION: Currency converter
// This is the only part of the app that talks to a real external
// API. fetch() sends a network request and returns a Promise; we
// `await` it inside an `async function` so the code reads top-to-
// bottom like normal code, even though it's actually asynchronous.
const convAmountInput = document.getElementById('converter-amount');
const convFrom        = document.getElementById('conv-from');
const convTo          = document.getElementById('conv-to');
const convertBtn      = document.getElementById('convert-btn');
const swapBtn         = document.getElementById('swap-btn');
const convOutput      = document.getElementById('converter-output');
const convLoading     = document.getElementById('converter-loading');
const convError       = document.getElementById('converter-error');
const ratesList       = document.getElementById('rates-list');

const POPULAR_CURRENCIES = ['EUR','GBP','JPY','AUD','CAD','INR','CNY','CHF'];
let cachedRates = null;
let cacheTime   = 0;

async function fetchRates(base = 'USD') {
  const now = Date.now();
  // Simple caching: if we fetched this same base currency in the
  // last 5 minutes (300000ms), reuse it instead of hitting the
  // network again.
  if (cachedRates && (now - cacheTime) < 300000 && cachedRates.base === base) return cachedRates;
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  cachedRates = { base, rates: data.rates };
  cacheTime = now;
  return cachedRates;
}

async function convertCurrency() {
  const amount = parseFloat(convAmountInput.value);
  const from   = convFrom.value;
  const to     = convTo.value;

  if (!amount || isNaN(amount) || amount <= 0) {
    convOutput.textContent = 'Enter a valid amount above.';
    convOutput.classList.remove('hidden');
    return;
  }

  convOutput.classList.add('hidden');
  convError.classList.add('hidden');
  convLoading.classList.remove('hidden');

  try {
    const data   = await fetchRates(from);
    const rate   = data.rates[to];
    const result = (amount * rate).toFixed(to === 'JPY' ? 0 : 2);
    convOutput.innerHTML = `
      <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.3rem">Result</div>
      ${amount.toLocaleString()} ${from} = <strong>${parseFloat(result).toLocaleString()} ${to}</strong>
      <div style="font-size:0.75rem;color:var(--text2);margin-top:0.4rem">1 ${from} = ${rate.toFixed(4)} ${to}</div>`;
    convOutput.classList.remove('hidden');

    const popularRates = POPULAR_CURRENCIES.filter(c => c !== from).map(c => ({
      code: c, rate: data.rates[c]
    }));
    const flags = { EUR:'🇪🇺',GBP:'🇬🇧',JPY:'🇯🇵',AUD:'🇦🇺',CAD:'🇨🇦',INR:'🇮🇳',CNY:'🇨🇳',CHF:'🇨🇭',USD:'🇺🇸' };
    ratesList.innerHTML = popularRates.map(r => `
      <div class="rate-row">
        <span class="rate-currency">${flags[r.code] || ''} ${r.code}</span>
        <span class="rate-value">${r.rate.toFixed(4)}</span>
      </div>`).join('');
  } catch {
    convError.textContent = 'Failed to fetch exchange rates. Please try again.';
    convError.classList.remove('hidden');
  } finally {
    convLoading.classList.add('hidden');
  }
}

convertBtn.addEventListener('click', convertCurrency);
swapBtn.addEventListener('click', () => {
  const tmp = convFrom.value;
  convFrom.value = convTo.value;
  convTo.value = tmp;
});
convAmountInput.addEventListener('keydown', e => { if (e.key === 'Enter') convertCurrency(); });

// SECTION: Toast notifications
// A "toast" is a small message that pops up and disappears on its
// own. We build the element, add it to the page, then use
// setTimeout() twice: once to trigger the entrance animation
// (after a 50ms delay, so the browser registers the starting
// state first), and once to auto-dismiss it after 4 seconds.
function showToast(title, message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️'
  };
  const icon = icons[type] || '🔔';

  toast.innerHTML = `
    <div class="toast-head">
      <div class="toast-title"><span>${icon}</span> <span>${title}</span></div>
      <button class="toast-close">✕</button>
    </div>
    <div class="toast-body">${message}</div>
  `;

  container.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 50);

  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });
  }

  setTimeout(() => {
    if (toast.parentNode) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// SECTION: Budgets
// For each budgeted category, work out spent-vs-limit as a
// percentage, then pick a color class (normal/warning/danger)
// based on how close to (or over) the limit it is.
function renderBudgets() {
  const budgetList = document.getElementById('budget-list');
  if (!budgetList) return;

  const expenses = transactions.filter(tx => tx.type === 'expense');
  const catExpenses = expenses.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});

  let html = '';
  const categories = Object.keys(budgets);

  categories.forEach(cat => {
    const limit = budgets[cat];
    if (limit <= 0) return;

    const spent = catExpenses[cat] || 0;
    const pct = Math.min(100, (spent / limit) * 100);
    
    let colorClass = 'normal';
    if (pct >= 90) colorClass = 'danger';
    else if (pct >= 70) colorClass = 'warning';

    const warningClass = pct >= 90 ? 'warning' : '';

    html += `
      <div class="budget-item">
        <div class="budget-meta">
          <span class="budget-cat">${CATEGORY_ICONS[cat] || ''} ${cat}</span>
          <span class="budget-amounts ${warningClass}">
            <strong>$${spent.toFixed(0)}</strong> / $${limit}
          </span>
        </div>
        <div class="budget-bar-track">
          <div class="budget-bar-fill ${colorClass}" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  });

  if (!html) {
    budgetList.innerHTML = '<div class="empty-state">No budgets configured. Click Set Budget!</div>';
  } else {
    budgetList.innerHTML = html;
  }
}

// SECTION: Balance trend chart (hand-drawn SVG)
// There's no charting library here — we're computing pixel
// coordinates ourselves and building an <svg> path string. It
// looks like a lot of math, but it's really just two conversions
// repeated for every point: "which date -> which x pixel" and
// "which balance -> which y pixel".
function renderLineChart() {
  const trendChart = document.getElementById('trend-chart');
  if (!trendChart) return;

  if (!transactions || !transactions.length) {
    trendChart.innerHTML = `
      <text x="300" y="110" fill="var(--text2)" font-size="14" font-family="Inter" text-anchor="middle">
        No transactions recorded yet.
      </text>
    `;
    return;
  }

  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = 0;
  const points = [];

  sorted.forEach(tx => {
    if (tx.type === 'income') running += tx.amount;
    else running -= tx.amount;
    points.push({ date: tx.date, balance: running, desc: tx.desc });
  });

  const N = points.length;
  if (N === 0) return;

  const minX = 40;
  const maxX = 560;
  const minY = 190;
  const maxY = 30;

  const balances = points.map(p => p.balance);
  let maxBal = Math.max(...balances, 100);
  let minBal = Math.min(...balances, 0);

  const range = maxBal - minBal;
  maxBal += range * 0.15;
  minBal -= range * 0.15;
  if (maxBal === minBal) {
    maxBal += 100;
    minBal -= 100;
  }

  const steps = 3;
  let gridHTML = '';
  for (let i = 0; i <= steps; i++) {
    const y = maxY + (minY - maxY) * (i / steps);
    const val = maxBal - (maxBal - minBal) * (i / steps);
    gridHTML += `
      <line x1="${minX}" y1="${y}" x2="${maxX}" y2="${y}" class="chart-grid-line" />
      <text x="${minX - 8}" y="${y + 4}" fill="var(--text2)" font-size="9" font-family="Inter" text-anchor="end">${fmt(val).split('.')[0]}</text>
    `;
  }

  let pathD = '';
  let areaD = '';
  let pointsHTML = '';

  const getX = (index) => {
    if (N === 1) return (minX + maxX) / 2;
    return minX + (index / (N - 1)) * (maxX - minX);
  };

  const getY = (bal) => {
    return minY - ((bal - minBal) / (maxBal - minBal)) * (minY - maxY);
  };

  points.forEach((p, i) => {
    const x = getX(i);
    const y = getY(p.balance);

    if (i === 0) {
      pathD = `M ${x} ${y}`;
      areaD = `M ${x} ${minY} L ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
      areaD += ` L ${x} ${y}`;
    }

    if (i === N - 1) {
      areaD += ` L ${x} ${minY} Z`;
    }

    pointsHTML += `
      <circle cx="${x}" cy="${y}" r="4.5" class="chart-point" data-balance="${p.balance}" data-date="${p.date}" data-desc="${p.desc}"></circle>
    `;
  });

  const defsHTML = `
    <defs>
      <linearGradient id="chart-gradient-area" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0"/>
      </linearGradient>
      <linearGradient id="chart-gradient-stroke" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="var(--accent)"/>
        <stop offset="100%" stop-color="var(--blue)"/>
      </linearGradient>
    </defs>
  `;

  let timelineHTML = '';
  if (N >= 2) {
    timelineHTML = `
      <text x="${minX}" y="${minY + 20}" fill="var(--text2)" font-size="9" font-family="Inter" text-anchor="start">${fmtDate(points[0].date)}</text>
      <text x="${maxX}" y="${minY + 20}" fill="var(--text2)" font-size="9" font-family="Inter" text-anchor="end">${fmtDate(points[N - 1].date)}</text>
    `;
  }

  trendChart.innerHTML = `
    ${defsHTML}
    ${gridHTML}
    <path d="${areaD}" class="chart-area" />
    <path d="${pathD}" class="chart-line" stroke="url(#chart-gradient-stroke)" />
    ${pointsHTML}
    ${timelineHTML}
  `;

  const container = document.querySelector('.chart-container-wrapper');
  const tooltip = document.getElementById('chart-tooltip');
  
  if (container && tooltip) {
    trendChart.querySelectorAll('.chart-point').forEach(circle => {
      circle.addEventListener('mouseenter', (e) => {
        const bal = parseFloat(e.target.dataset.balance);
        const date = e.target.dataset.date;
        const desc = e.target.dataset.desc;

        tooltip.innerHTML = `
          <div class="tooltip-date">${fmtDate(date)}</div>
          <div class="tooltip-desc">${desc}</div>
          <div class="tooltip-val">${fmt(bal)}</div>
        `;
        tooltip.style.opacity = '1';

        const containerRect = container.getBoundingClientRect();
        const circleRect = e.target.getBoundingClientRect();
        const tooltipX = circleRect.left - containerRect.left - tooltip.offsetWidth / 2 + 4.5;
        const tooltipY = circleRect.top - containerRect.top - tooltip.offsetHeight - 12;

        tooltip.style.left = `${tooltipX}px`;
        tooltip.style.top = `${tooltipY}px`;
      });

      circle.addEventListener('mouseleave', () => {
        tooltip.style.opacity = '0';
      });
    });
  }
}

// SECTION: Refresh & init
// refreshAll() is the one function that re-renders everything —
// call it any time the underlying data changes (add, delete, load
// demo data) so the whole UI stays in sync with `transactions`.
function refreshAll() {
  updateSummary(transactions);
  renderRecent();
  renderFullList();
  renderLineChart();
  renderBudgets();
}

// init() runs once when the page loads — it's the entry point
// that sets everything else in motion (see the init() call at
// the very bottom of this file).
function init() {
  const today = new Date().toISOString().split('T')[0];
  if (dateInput) dateInput.value = today;

  initTheme();
  loadTransactions();
  refreshAll();
  navigateTo('dashboard');
}

init();
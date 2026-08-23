const STORAGE_KEY_BASE = 'finTrack_v2_transactions';
const THEME_KEY = 'finTrack_v2_theme';
const BUDGET_STORAGE_KEY_BASE = 'finTrack_v2_budgets';
const BALANCE_STORAGE_KEY_BASE = 'finTrack_v2_startingBalance';
const ACCOUNTS_KEY = 'finTrack_v2_accounts';
const USER_KEY = 'finTrack_v2_user';

let currentUserEmail = null;
const scopedKey = base => currentUserEmail ? `${base}::${currentUserEmail}` : base;

let transactions = [];
let startingBalance = 0;
let budgets = {};
let pendingUser = null;

const CATEGORY_ICONS = { Food:'🍔', Transport:'🚗', Shopping:'🛍️', Bills:'📄', Entertainment:'🎬', Salary:'💼', Other:'📦' };
const BAR_COLORS = ['#c9a35a','#3ecf8e','#ef6f6f','#d9a441','#6f92b8','#e2c583','#b98d6f'];
const POPULAR_CURRENCIES = ['EUR','GBP','JPY','AUD','CAD','INR','CNY','CHF'];
const CURRENCY_FLAGS = { EUR:'🇪🇺',GBP:'🇬🇧',JPY:'🇯🇵',AUD:'🇦🇺',CAD:'🇨🇦',INR:'🇮🇳',CNY:'🇨🇳',CHF:'🇨🇭',USD:'🇺🇸' };
const PAGE_TITLES = { dashboard:'Dashboard', transactions:'Transactions', analytics:'Analytics', converter:'Currency Converter' };

const getDefaultBudgets = () => ({ Food:300, Transport:100, Shopping:200, Bills:400, Entertainment:150, Other:150 });

// ---------- storage ----------
const hasStartingBalance = () => localStorage.getItem(scopedKey(BALANCE_STORAGE_KEY_BASE)) !== null;

function loadStartingBalance() {
  const stored = localStorage.getItem(scopedKey(BALANCE_STORAGE_KEY_BASE));
  startingBalance = stored ? parseFloat(stored) : 0;
}
function saveStartingBalance(amount) {
  startingBalance = amount;
  localStorage.setItem(scopedKey(BALANCE_STORAGE_KEY_BASE), String(amount));
}
function loadTransactions() {
  const stored = localStorage.getItem(scopedKey(STORAGE_KEY_BASE));
  transactions = stored ? JSON.parse(stored) : [];
  loadStartingBalance();
  const storedBudgets = localStorage.getItem(scopedKey(BUDGET_STORAGE_KEY_BASE));
  budgets = storedBudgets ? JSON.parse(storedBudgets) : getDefaultBudgets();
  if (!storedBudgets) localStorage.setItem(scopedKey(BUDGET_STORAGE_KEY_BASE), JSON.stringify(budgets));
}
const saveTransactions = () => localStorage.setItem(scopedKey(STORAGE_KEY_BASE), JSON.stringify(transactions));
const getAccounts = () => JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || '[]');
const saveAccounts = accounts => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

// ---------- DOM refs ----------
const $ = id => document.getElementById(id);
const form = $('transaction-form'), descInput = $('desc'), amountInput = $('amount'), dateInput = $('date'),
  categorySelect = $('category'), recentList = $('recent-list'), fullList = $('transaction-list'),
  categoryChart = $('category-chart'), filterType = $('filter-type'), filterCategory = $('filter-category'),
  sortBy = $('sort-by'), searchInput = $('search-input'), themeToggle = $('theme-toggle');

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const topbarTitle = $('topbar-title');

function navigateTo(pageId) {
  navItems.forEach(n => n.classList.toggle('active', n.dataset.page === pageId));
  pages.forEach(p => p.classList.toggle('active', p.id === `page-${pageId}`));
  topbarTitle.textContent = PAGE_TITLES[pageId] || pageId;
  if (pageId === 'analytics') renderAnalytics();
  closeSidebar();
}
navItems.forEach(n => n.addEventListener('click', e => { e.preventDefault(); navigateTo(n.dataset.page); }));
document.querySelectorAll('[data-goto]').forEach(btn => btn.addEventListener('click', () => navigateTo(btn.dataset.goto)));

const sidebar = $('sidebar'), overlay = $('sidebar-overlay'), hamburger = $('hamburger');
hamburger.addEventListener('click', () => sidebar.classList.add('open'));
overlay.addEventListener('click', closeSidebar);
function closeSidebar() { sidebar.classList.remove('open'); }

// ---------- theme ----------
function applyTheme(t) {
  document.body.classList.toggle('light', t === 'light');
  themeToggle.querySelector('.icon-moon').classList.toggle('hidden', t === 'light');
  themeToggle.querySelector('.icon-sun').classList.toggle('hidden', t === 'dark');
  themeToggle.querySelector('span').textContent = t === 'light' ? 'Dark Mode' : 'Light Mode';
  localStorage.setItem(THEME_KEY, t);
}
const initTheme = () => applyTheme(localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark');
themeToggle.addEventListener('click', () => applyTheme(document.body.classList.contains('light') ? 'dark' : 'light'));

// ---------- helpers ----------
const emptyStateHTML = (title, sub) => `
  <div class="empty-state-rich">
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
      <circle cx="36" cy="36" r="35" stroke="var(--card-border)" stroke-width="1.5"/>
      <rect x="20" y="28" width="32" height="22" rx="4" stroke="var(--accent2)" stroke-width="2" fill="none"/>
      <path d="M20 34h32" stroke="var(--accent2)" stroke-width="2"/>
      <circle cx="28" cy="42" r="2" fill="var(--accent2)"/>
      <path d="M36 20v-4M30 22l-3-4M42 22l3-4" stroke="var(--card-border)" stroke-width="2" stroke-linecap="round"/>
    </svg>
    <p class="empty-state-title">${title}</p>
    ${sub ? `<p class="empty-state-sub">${sub}</p>` : ''}
  </div>`;

const fmt = amount => '₹' + Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = dateStr => new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function animateNumber(el, targetValue, formatter) {
  if (!el) return;
  const duration = 700, start = performance.now();
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatter(targetValue * eased);
    if (progress < 1) requestAnimationFrame(tick); else el.textContent = formatter(targetValue);
  }
  requestAnimationFrame(tick);
}

// ---------- summary / trend ----------
function updateSummary(data) {
  const totals = data.reduce((acc, tx) => { acc[tx.type] += tx.amount; return acc; }, { income: 0, expense: 0 });
  const netBalance = startingBalance + totals.income - totals.expense;
  animateNumber($('total-balance'), netBalance, fmt);
  animateNumber($('total-income'), totals.income, fmt);
  animateNumber($('total-expense'), totals.expense, fmt);
  animateNumber($('transaction-count'), data.length, v => Math.round(v));
  const cardBalVal = $('card-balance-val');
  if (cardBalVal) animateNumber(cardBalVal, netBalance, fmt);
  renderBalanceTrend(data);
}

function renderBalanceTrend(data) {
  const trendEl = $('balance-trend');
  if (!trendEl) return;
  const now = new Date();
  const keyOf = d => `${d.getFullYear()}-${d.getMonth()}`;
  const thisKey = keyOf(now), lastKey = keyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const netForMonth = monthKey => data.reduce((sum, tx) => {
    const key = keyOf(new Date(tx.date + 'T00:00:00'));
    return key !== monthKey ? sum : sum + (tx.type === 'income' ? tx.amount : -tx.amount);
  }, 0);
  const thisNet = netForMonth(thisKey), lastNet = netForMonth(lastKey);
  if (lastNet === 0) { trendEl.innerHTML = ''; return; }
  const change = ((thisNet - lastNet) / Math.abs(lastNet)) * 100;
  const isUp = change >= 0;
  trendEl.innerHTML = `<span class="trend-pill ${isUp ? 'trend-up' : 'trend-down'}">${isUp ? '↑' : '↓'} ${Math.abs(change).toFixed(0)}% vs last month</span>`;
}

// ---------- transaction rendering ----------
function txHTML(tx, mini = false) {
  const icon = CATEGORY_ICONS[tx.category] || '💰', sign = tx.type === 'income' ? '+' : '-';
  return `
    <div class="transaction-item animate-enter" data-id="${tx.id}">
      <div class="tx-icon">${icon}</div>
      <div class="tx-info">
        <div class="tx-desc">${tx.desc}</div>
        <div class="tx-meta"><span class="category-badge">${tx.category}</span><span>${fmtDate(tx.date)}</span></div>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${tx.type}">${sign}${fmt(tx.amount)}</span>
        ${mini ? '' : `<button class="btn-delete" onclick="deleteTransaction(${tx.id})" aria-label="Delete">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg></button>`}
      </div>
    </div>`;
}

function renderRecent() {
  const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  recentList.innerHTML = recent.length
    ? recent.map(tx => txHTML(tx, true)).join('')
    : emptyStateHTML('No transactions yet', 'Add your first income or expense to see it here.');
}

function getFiltered() {
  let data = [...transactions];
  const typeVal = filterType.value, catVal = filterCategory.value, sortVal = sortBy.value;
  const query = (searchInput.value || '').toLowerCase().trim();
  if (typeVal !== 'all') data = data.filter(tx => tx.type === typeVal);
  if (catVal !== 'all') data = data.filter(tx => tx.category === catVal);
  if (query) data = data.filter(tx => tx.desc.toLowerCase().includes(query));
  const sorters = {
    newest: (a, b) => new Date(b.date) - new Date(a.date),
    oldest: (a, b) => new Date(a.date) - new Date(b.date),
    highest: (a, b) => b.amount - a.amount,
    lowest: (a, b) => a.amount - b.amount,
  };
  data.sort(sorters[sortVal] || (() => 0));
  return data;
}

function renderFullList() {
  const data = getFiltered();
  fullList.innerHTML = data.length
    ? data.map(tx => txHTML(tx, false)).join('')
    : emptyStateHTML('No matching transactions', 'Try adjusting your filters or search.');
}

// ---------- analytics ----------
function renderAnalytics() {
  const expenses = transactions.filter(tx => tx.type === 'expense');
  const totalIncome = transactions.reduce((s, tx) => tx.type === 'income' ? s + tx.amount : s, 0);
  const totalExpense = transactions.reduce((s, tx) => tx.type === 'expense' ? s + tx.amount : s, 0);
  const savings = totalIncome - totalExpense;
  const savingsPct = totalIncome > 0 ? Math.max(0, Math.min(100, (savings / totalIncome) * 100)) : 0;

  $('ana-income').textContent = fmt(totalIncome);
  $('ana-expense').textContent = fmt(totalExpense);
  $('ana-savings').textContent = fmt(savings);
  $('savings-pct').textContent = savingsPct.toFixed(1) + '%';

  const circumference = 301.6;
  $('savings-ring').style.strokeDashoffset = circumference - (savingsPct / 100) * circumference;

  if (!expenses.length) {
    categoryChart.innerHTML = '<div class="empty-state">No expense data.</div>';
  } else {
    const cats = expenses.reduce((acc, tx) => { acc[tx.category] = (acc[tx.category] || 0) + tx.amount; return acc; }, {});
    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const max = sorted[0][1];
    categoryChart.innerHTML = sorted.map(([cat, amt], i) => `
      <div class="bar-row">
        <div class="bar-header"><span>${CATEGORY_ICONS[cat] || ''} ${cat}</span><span>${fmt(amt)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${((amt / max) * 100).toFixed(1)}%; background:${BAR_COLORS[i % BAR_COLORS.length]}"></div></div>
      </div>`).join('');
  }

  const allCats = transactions.reduce((acc, tx) => {
    const key = tx.category + '|' + tx.type;
    (acc[key] ??= { category: tx.category, type: tx.type, count: 0, total: 0 });
    acc[key].count++; acc[key].total += tx.amount;
    return acc;
  }, {});
  const rows = Object.values(allCats).sort((a, b) => b.total - a.total);
  $('category-table-body').innerHTML = rows.length
    ? rows.map(r => `<tr><td>${CATEGORY_ICONS[r.category] || ''} ${r.category}</td><td>${r.count}</td><td><strong>${fmt(r.total)}</strong></td><td><span class="type-pill ${r.type}">${r.type}</span></td></tr>`).join('')
    : '<tr><td colspan="4" class="empty-state">No data yet.</td></tr>';
}

// ---------- form validation ----------
const clearErrors = () => document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
const showError = (id, msg) => { const el = $(`error-${id}`); if (el) el.textContent = msg; };

form.addEventListener('submit', e => {
  e.preventDefault();
  clearErrors();
  const desc = descInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const date = dateInput.value;
  const type = document.querySelector('input[name="type"]:checked').value;
  const category = categorySelect.value;
  let valid = true;
  if (!desc) { showError('desc', 'Description is required.'); valid = false; }
  if (isNaN(amount) || amount <= 0) { showError('amount', 'Enter a valid amount.'); valid = false; }
  if (!date) { showError('date', 'Date is required.'); valid = false; }
  if (!valid) return;

  transactions = [{ id: Date.now(), desc, amount, date, type, category }, ...transactions];
  saveTransactions();
  refreshAll();
  form.reset();
  dateInput.value = new Date().toISOString().split('T')[0];
  const incomeRadio = document.querySelector('input[name="type"][value="income"]');
  if (incomeRadio) incomeRadio.checked = true;
  closeModal();
  showToast('Transaction Added', `"${desc}" was successfully recorded!`, 'success');
});

filterType.addEventListener('change', renderFullList);
filterCategory.addEventListener('change', renderFullList);
sortBy.addEventListener('change', renderFullList);
searchInput.addEventListener('input', () => {
  clearTimeout(window._searchTimer);
  window._searchTimer = setTimeout(renderFullList, 250);
});

window.deleteTransaction = function (id) {
  const item = document.querySelector(`.transaction-item[data-id="${id}"]`);
  const tx = transactions.find(t => t.id === id);
  const doDelete = () => {
    transactions = transactions.filter(t => t.id !== id);
    saveTransactions();
    refreshAll();
    if (tx) showToast('Transaction Deleted', `"${tx.desc}" was removed.`, 'info');
  };
  if (item) { item.classList.add('fade-out'); setTimeout(doDelete, 300); } else doDelete();
};

// ---------- modal ----------
const modalBackdrop = $('modal-backdrop'), modalClose = $('modal-close'), quickAddBtn = $('quick-add-btn');
quickAddBtn.addEventListener('click', openModal);
$('dash-add-tx-btn')?.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function openModal() {
  document.querySelector('#modal h3').textContent = 'New Transaction';
  document.querySelector('.modal-hint').textContent = 'Fill in the details below and hit Add.';
  modalBackdrop.classList.remove('hidden');
  $('modal-form-target').innerHTML = '';
  $('modal-form-target').appendChild(form);
}
function closeModal() {
  modalBackdrop.classList.add('hidden');
  const target = $('quick-form-section');
  if (target && !target.contains(form)) target.appendChild(form);
}

$('btn-manage-budget')?.addEventListener('click', openBudgetModal);

function openBudgetModal() {
  document.querySelector('#modal h3').textContent = 'Set Monthly Budget';
  document.querySelector('.modal-hint').textContent = 'Configure your target monthly spending limit for each category.';
  const target = $('modal-form-target');
  const optionsHTML = Object.keys(CATEGORY_ICONS).filter(c => c !== 'Salary')
    .map(cat => `<option value="${cat}">${CATEGORY_ICONS[cat]} ${cat}</option>`).join('');

  target.innerHTML = `
    <form id="budget-form" style="padding: 1.25rem 1.5rem;">
      <div class="form-group">
        <label for="budget-cat">Category</label>
        <select id="budget-cat" class="form-control">${optionsHTML}</select>
      </div>
      <div class="form-group">
        <label for="budget-limit">Limit Amount (₹)</label>
        <input type="number" id="budget-limit" class="form-control" placeholder="300" min="0" step="10">
        <span class="error-msg" id="error-budget-limit"></span>
      </div>
      <button type="submit" class="btn-submit">Save Budget</button>
    </form>`;
  modalBackdrop.classList.remove('hidden');

  const bForm = $('budget-form'), catSel = $('budget-cat'), limitIn = $('budget-limit');
  catSel.addEventListener('change', () => limitIn.value = budgets[catSel.value] || '');
  limitIn.value = budgets[catSel.value] || '';

  bForm.addEventListener('submit', e => {
    e.preventDefault();
    const cat = catSel.value, limit = parseFloat(limitIn.value);
    if (isNaN(limit) || limit < 0) { $('error-budget-limit').textContent = 'Please enter a valid amount.'; return; }
    budgets[cat] = limit;
    localStorage.setItem(scopedKey(BUDGET_STORAGE_KEY_BASE), JSON.stringify(budgets));
    showToast('Success', `Budget for ${cat} set to ₹${limit.toFixed(2)}`, 'success');
    closeModal();
    renderBudgets();
  });
}

// ---------- CSV export ----------
$('export-csv-btn')?.addEventListener('click', () => {
  if (!transactions.length) { showToast('Export Failed', 'There are no transactions to export.', 'error'); return; }
  let csv = 'data:text/csv;charset=utf-8,ID,Description,Amount,Date,Type,Category\n';
  transactions.forEach(tx => {
    csv += [tx.id, `"${tx.desc.replace(/"/g, '""')}"`, tx.amount, tx.date, tx.type, tx.category].join(',') + '\n';
  });
  const link = document.createElement('a');
  link.href = encodeURI(csv);
  link.download = 'fintrack_transactions.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Export Successful', 'Your transactions have been exported to a CSV file.', 'success');
});

// ---------- currency converter ----------
const convAmountInput = $('converter-amount'), convFrom = $('conv-from'), convTo = $('conv-to'),
  convertBtn = $('convert-btn'), swapBtn = $('swap-btn'), convOutput = $('converter-output'),
  convLoading = $('converter-loading'), convError = $('converter-error'), ratesList = $('rates-list');

let cachedRates = null, cacheTime = 0;

async function fetchRates(base = 'USD') {
  const now = Date.now();
  if (cachedRates && (now - cacheTime) < 300000 && cachedRates.base === base) return cachedRates;
  const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
  if (!res.ok) throw new Error('Failed to fetch');
  const data = await res.json();
  cachedRates = { base, rates: data.rates };
  cacheTime = now;
  return cachedRates;
}

async function convertCurrency() {
  const amount = parseFloat(convAmountInput.value), from = convFrom.value, to = convTo.value;
  if (!amount || isNaN(amount) || amount <= 0) {
    convOutput.textContent = 'Enter a valid amount above.';
    convOutput.classList.remove('hidden');
    return;
  }
  convOutput.classList.add('hidden');
  convError.classList.add('hidden');
  convLoading.classList.remove('hidden');
  try {
    const data = await fetchRates(from);
    const rate = data.rates[to];
    const result = (amount * rate).toFixed(to === 'JPY' ? 0 : 2);
    convOutput.innerHTML = `
      <div style="font-size:0.8rem;color:var(--text2);margin-bottom:0.3rem">Result</div>
      ${amount.toLocaleString()} ${from} = <strong>${parseFloat(result).toLocaleString()} ${to}</strong>
      <div style="font-size:0.75rem;color:var(--text2);margin-top:0.4rem">1 ${from} = ${rate.toFixed(4)} ${to}</div>`;
    convOutput.classList.remove('hidden');

    const ratesTitle = $('rates-title');
    if (ratesTitle) ratesTitle.textContent = `Popular Rates (vs ${from})`;
    ratesList.innerHTML = POPULAR_CURRENCIES.filter(c => c !== from).map(c => `
      <div class="rate-row"><span class="rate-currency">${CURRENCY_FLAGS[c] || ''} ${c}</span><span class="rate-value">${data.rates[c].toFixed(4)}</span></div>`).join('');
  } catch {
    convError.textContent = 'Failed to fetch exchange rates. Please try again.';
    convError.classList.remove('hidden');
  } finally {
    convLoading.classList.add('hidden');
  }
}
convertBtn.addEventListener('click', convertCurrency);
swapBtn.addEventListener('click', () => { [convFrom.value, convTo.value] = [convTo.value, convFrom.value]; });
convAmountInput.addEventListener('keydown', e => { if (e.key === 'Enter') convertCurrency(); });

// ---------- toast ----------
function showToast(title, message, type = 'success') {
  const container = $('toast-container');
  if (!container) return;
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-head">
      <div class="toast-title"><span>${icons[type] || '🔔'}</span> <span>${title}</span></div>
      <button class="toast-close">✕</button>
    </div>
    <div class="toast-body">${message}</div>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 50);
  const remove = () => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); };
  toast.querySelector('.toast-close')?.addEventListener('click', remove);
  setTimeout(() => toast.parentNode && remove(), 4000);
}

// ---------- budgets ----------
function renderBudgets() {
  const budgetList = $('budget-list');
  if (!budgetList) return;
  const catExpenses = transactions.filter(tx => tx.type === 'expense')
    .reduce((acc, tx) => { acc[tx.category] = (acc[tx.category] || 0) + tx.amount; return acc; }, {});

  let html = '';
  Object.keys(budgets).forEach(cat => {
    const limit = budgets[cat];
    if (limit <= 0) return;
    const spent = catExpenses[cat] || 0;
    const pct = Math.min(100, (spent / limit) * 100);
    const colorClass = pct >= 90 ? 'danger' : pct >= 70 ? 'warning' : 'normal';
    const warningClass = pct >= 90 ? 'warning' : '';
    html += `
      <div class="budget-item">
        <div class="budget-meta">
          <span class="budget-cat">${CATEGORY_ICONS[cat] || ''} ${cat}</span>
          <span class="budget-amounts ${warningClass}"><strong>₹${spent.toFixed(0)}</strong> / ₹${limit}</span>
        </div>
        <div class="budget-bar-track"><div class="budget-bar-fill ${colorClass}" style="width: ${pct}%"></div></div>
      </div>`;
  });
  budgetList.innerHTML = html || '<div class="empty-state">No budgets configured. Click Set Budget!</div>';
}

// ---------- line chart ----------
function renderLineChart() {
  const trendChart = $('trend-chart');
  if (!trendChart) return;
  if (!transactions.length) {
    trendChart.innerHTML = `<text x="300" y="110" fill="var(--text2)" font-size="14" font-family="Inter" text-anchor="middle">No transactions recorded yet.</text>`;
    return;
  }

  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  let running = startingBalance;
  const points = sorted.map(tx => {
    running += tx.type === 'income' ? tx.amount : -tx.amount;
    return { date: tx.date, balance: running, desc: tx.desc };
  });

  const N = points.length;
  const minX = 40, maxX = 560, minY = 190, maxY = 30;
  const balances = points.map(p => p.balance);
  let maxBal = Math.max(...balances, 100), minBal = Math.min(...balances, 0);
  const range = maxBal - minBal;
  maxBal += range * 0.15; minBal -= range * 0.15;
  if (maxBal === minBal) { maxBal += 100; minBal -= 100; }

  let gridHTML = '';
  for (let i = 0; i <= 3; i++) {
    const y = maxY + (minY - maxY) * (i / 3);
    const val = maxBal - (maxBal - minBal) * (i / 3);
    gridHTML += `<line x1="${minX}" y1="${y}" x2="${maxX}" y2="${y}" class="chart-grid-line" />
      <text x="${minX - 8}" y="${y + 4}" fill="var(--text2)" font-size="9" font-family="Inter" text-anchor="end">${fmt(val).split('.')[0]}</text>`;
  }

  const getX = i => N === 1 ? (minX + maxX) / 2 : minX + (i / (N - 1)) * (maxX - minX);
  const getY = bal => minY - ((bal - minBal) / (maxBal - minBal)) * (minY - maxY);

  let pathD = '', areaD = '', pointsHTML = '';
  points.forEach((p, i) => {
    const x = getX(i), y = getY(p.balance);
    if (i === 0) { pathD = `M ${x} ${y}`; areaD = `M ${x} ${minY} L ${x} ${y}`; }
    else { pathD += ` L ${x} ${y}`; areaD += ` L ${x} ${y}`; }
    if (i === N - 1) areaD += ` L ${x} ${minY} Z`;
    pointsHTML += `<circle cx="${x}" cy="${y}" r="4.5" class="chart-point" data-balance="${p.balance}" data-date="${p.date}" data-desc="${p.desc}"></circle>`;
  });

  const defsHTML = `<defs>
    <linearGradient id="chart-gradient-area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.0"/>
    </linearGradient>
    <linearGradient id="chart-gradient-stroke" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="var(--accent)"/><stop offset="100%" stop-color="var(--blue)"/>
    </linearGradient></defs>`;

  const timelineHTML = N >= 2 ? `
    <text x="${minX}" y="${minY + 20}" fill="var(--text2)" font-size="9" font-family="Inter" text-anchor="start">${fmtDate(points[0].date)}</text>
    <text x="${maxX}" y="${minY + 20}" fill="var(--text2)" font-size="9" font-family="Inter" text-anchor="end">${fmtDate(points[N - 1].date)}</text>` : '';

  trendChart.innerHTML = `${defsHTML}${gridHTML}<path d="${areaD}" class="chart-area" /><path d="${pathD}" class="chart-line" stroke="url(#chart-gradient-stroke)" />${pointsHTML}${timelineHTML}`;

  const container = document.querySelector('.chart-container-wrapper');
  const tooltip = $('chart-tooltip');
  if (container && tooltip) {
    trendChart.querySelectorAll('.chart-point').forEach(circle => {
      circle.addEventListener('mouseenter', e => {
        const { balance, date, desc } = e.target.dataset;
        tooltip.innerHTML = `<div class="tooltip-date">${fmtDate(date)}</div><div class="tooltip-desc">${desc}</div><div class="tooltip-val">${fmt(parseFloat(balance))}</div>`;
        tooltip.style.opacity = '1';
        const cRect = container.getBoundingClientRect(), circRect = e.target.getBoundingClientRect();
        tooltip.style.left = `${circRect.left - cRect.left - tooltip.offsetWidth / 2 + 4.5}px`;
        tooltip.style.top = `${circRect.top - cRect.top - tooltip.offsetHeight - 12}px`;
      });
      circle.addEventListener('mouseleave', () => tooltip.style.opacity = '0');
    });
  }
}

function refreshAll() {
  updateSummary(transactions);
  renderRecent();
  renderFullList();
  renderLineChart();
  renderBudgets();
}

// ---------- auth ----------
const loginScreen = $('login-screen'), onboardScreen = $('onboard-screen'), onboardForm = $('onboard-form'),
  signinForm = $('signin-form'), signupForm = $('signup-form'), logoutBtn = $('logout-btn'),
  authTabs = document.querySelectorAll('.auth-tab'), authSwitches = document.querySelectorAll('.auth-switch'),
  authPanels = document.querySelectorAll('.auth-panel');

function switchAuthTab(tab) {
  authTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  authPanels.forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
}
authTabs.forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.tab)));
authSwitches.forEach(a => a.addEventListener('click', e => { e.preventDefault(); switchAuthTab(a.dataset.tab); }));

function showApp(user) {
  currentUserEmail = user?.email ? user.email.toLowerCase() : null;
  document.body.classList.add('authed');
  loginScreen.classList.add('hidden');
  const greetEl = document.querySelector('.page-heading h1');
  if (greetEl && user?.name) greetEl.childNodes[0].textContent = `Welcome, ${user.name.trim().split(' ')[0]} `;
}
function showLogin() {
  document.body.classList.remove('authed');
  loginScreen.classList.remove('hidden');
  onboardScreen.classList.add('hidden');
}
function enterApp(user) {
  currentUserEmail = user?.email ? user.email.toLowerCase() : null;
  if (hasStartingBalance()) { showApp(user); init(); }
  else {
    pendingUser = user;
    loginScreen.classList.add('hidden');
    onboardScreen.classList.remove('hidden');
  }
}

onboardForm.addEventListener('submit', e => {
  e.preventDefault();
  $('error-onboard-balance').textContent = '';
  const amount = parseFloat($('onboard-balance').value);
  saveStartingBalance(isNaN(amount) || amount < 0 ? 0 : amount);
  onboardScreen.classList.add('hidden');
  showApp(pendingUser);
  init();
  pendingUser = null;
});

signupForm.addEventListener('submit', e => {
  e.preventDefault();
  ['signup-name', 'signup-email', 'signup-password', 'signup-confirm'].forEach(id => $(`error-${id}`).textContent = '');

  const name = $('signup-name').value.trim();
  const email = $('signup-email').value.trim().toLowerCase();
  const password = $('signup-password').value;
  const confirm = $('signup-confirm').value;
  let valid = true;

  if (!name) { $('error-signup-name').textContent = 'Enter your name.'; valid = false; }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) { $('error-signup-email').textContent = 'Enter a valid email.'; valid = false; }
  if (!password || password.length < 6) { $('error-signup-password').textContent = 'At least 6 characters.'; valid = false; }
  if (confirm !== password) { $('error-signup-confirm').textContent = 'Passwords don\u2019t match.'; valid = false; }

  const accounts = getAccounts();
  if (valid && accounts.some(a => a.email === email)) {
    $('error-signup-email').textContent = 'An account with this email already exists.';
    valid = false;
  }
  if (!valid) return;

  accounts.push({ name, email, password });
  saveAccounts(accounts);
  const user = { name, email };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  enterApp(user);
});

signinForm.addEventListener('submit', e => {
  e.preventDefault();
  $('error-signin-email').textContent = '';
  $('error-signin-password').textContent = '';

  const email = $('signin-email').value.trim().toLowerCase();
  const password = $('signin-password').value;
  if (!email) { $('error-signin-email').textContent = 'Enter your email.'; return; }
  if (!password) { $('error-signin-password').textContent = 'Enter your password.'; return; }

  const account = getAccounts().find(a => a.email === email);
  if (!account) { $('error-signin-email').textContent = 'No account found with this email.'; return; }
  if (account.password !== password) { $('error-signin-password').textContent = 'Incorrect password.'; return; }

  const user = { name: account.name, email: account.email };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  enterApp(user);
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(USER_KEY);
  currentUserEmail = null;
  pendingUser = null;
  signinForm.reset();
  signupForm.reset();
  onboardForm.reset();
  switchAuthTab('signin');
  showLogin();
});

function init() {
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  initTheme();
  loadTransactions();
  refreshAll();
  navigateTo('dashboard');
}

localStorage.removeItem(USER_KEY);
showLogin();
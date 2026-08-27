const STORAGE_KEY_BASE = 'finTrack_v2_transactions';
const THEME_KEY   = 'finTrack_v2_theme';
const BUDGET_STORAGE_KEY_BASE = 'finTrack_v2_budgets';
const BALANCE_STORAGE_KEY_BASE = 'finTrack_v2_startingBalance';
const TOTAL_BUDGET_KEY_BASE = 'finTrack_v2_totalBudget';

let currentUserEmail = null;
function scopedKey(base) {
  return currentUserEmail ? `${base}::${currentUserEmail}` : base;
}

let transactions  = [];
let startingBalance = 0;
let totalBudget = 0;
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

function getDefaultBudgets() {
  return { Food: 300, Transport: 100, Shopping: 200, Bills: 400, Entertainment: 150, Other: 150 };
}

function hasStartingBalance() {
  return localStorage.getItem(scopedKey(BALANCE_STORAGE_KEY_BASE)) !== null;
}

function loadStartingBalance() {
  const stored = localStorage.getItem(scopedKey(BALANCE_STORAGE_KEY_BASE));
  startingBalance = stored ? parseFloat(stored) : 0;
}

function saveStartingBalance(amount) {
  startingBalance = amount;
  localStorage.setItem(scopedKey(BALANCE_STORAGE_KEY_BASE), String(amount));
}

function loadTotalBudget() {
  const stored = localStorage.getItem(scopedKey(TOTAL_BUDGET_KEY_BASE));
  totalBudget = stored ? parseFloat(stored) : 0;
}

function saveTotalBudget(amount) {
  totalBudget = amount;
  localStorage.setItem(scopedKey(TOTAL_BUDGET_KEY_BASE), String(amount));
}

function loadTransactions() {
  const stored = localStorage.getItem(scopedKey(STORAGE_KEY_BASE));
  transactions = stored ? JSON.parse(stored) : [];
  loadStartingBalance();
  loadTotalBudget();

  const storedBudgets = localStorage.getItem(scopedKey(BUDGET_STORAGE_KEY_BASE));
  if (storedBudgets) {
    budgets = JSON.parse(storedBudgets);
  } else {
    budgets = getDefaultBudgets();
    localStorage.setItem(scopedKey(BUDGET_STORAGE_KEY_BASE), JSON.stringify(budgets));
  }
}

function saveTransactions() {
  localStorage.setItem(scopedKey(STORAGE_KEY_BASE), JSON.stringify(transactions));
}

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

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const hamburger = document.getElementById('hamburger');

hamburger.addEventListener('click', () => sidebar.classList.add('open'));
overlay.addEventListener('click', closeSidebar);
function closeSidebar() { sidebar.classList.remove('open'); }

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

function emptyStateHTML(title, sub) {
  return `
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
}

function fmt(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function animateNumber(el, targetValue, formatter) {
  if (!el) return;
  const duration = 700;
  const start = performance.now();
  const from = 0;
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = from + (targetValue - from) * eased;
    el.textContent = formatter(current);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = formatter(targetValue);
  }
  requestAnimationFrame(tick);
}

function updateSummary(data) {
  const totals = data.reduce((acc, tx) => {
    acc[tx.type] += tx.amount;
    return acc;
  }, { income: 0, expense: 0 });

  const netBalance = startingBalance + totals.income - totals.expense;
  animateNumber(document.getElementById('total-balance'), netBalance, fmt);
  animateNumber(document.getElementById('total-income'), totals.income, fmt);
  animateNumber(document.getElementById('total-expense'), totals.expense, fmt);
  animateNumber(document.getElementById('transaction-count'), data.length, v => Math.round(v));

  const cardBalVal = document.getElementById('card-balance-val');
  if (cardBalVal) {
    animateNumber(cardBalVal, netBalance, fmt);
  }

  renderBalanceTrend(data);
}

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
    recentList.innerHTML = emptyStateHTML('No transactions yet', 'Add your first income or expense to see it here.');
  } else {
    recentList.innerHTML = recent.map(tx => txHTML(tx, true)).join('');
  }
}

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
    fullList.innerHTML = emptyStateHTML('No matching transactions', 'Try adjusting your filters or search.');
  } else {
    fullList.innerHTML = data.map(tx => txHTML(tx, false)).join('');
  }
}

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

  const budgetRow = document.getElementById('ana-budget-row');
  if (budgetRow) {
    if (totalBudget > 0) {
      const remaining = totalBudget - totalExpense;
      budgetRow.classList.remove('hidden');
      document.getElementById('ana-budget-remaining').textContent = fmt(remaining);
      document.getElementById('ana-budget-remaining').style.color = remaining < 0 ? 'var(--red)' : '';
    } else {
      budgetRow.classList.add('hidden');
    }
  }

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

  if (valid && type === 'expense') {
    const currentIncome  = transactions.reduce((s, tx) => tx.type === 'income'  ? s + tx.amount : s, 0);
    const currentExpense = transactions.reduce((s, tx) => tx.type === 'expense' ? s + tx.amount : s, 0);
    const currentBalance = startingBalance + currentIncome - currentExpense;
    if (amount > currentBalance) {
      showError('amount', currentBalance > 0
        ? `Insufficient balance. You only have ₹${currentBalance.toFixed(2)}.`
        : `Insufficient balance. Your balance is ₹${currentBalance.toFixed(2)}.`);
      valid = false;
    }
  }

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

const modalBackdrop = document.getElementById('modal-backdrop');
const modalClose    = document.getElementById('modal-close');
const quickAddBtn   = document.getElementById('quick-add-btn');

quickAddBtn.addEventListener('click', openModal);
const dashAddTxBtn = document.getElementById('dash-add-tx-btn');
if (dashAddTxBtn) dashAddTxBtn.addEventListener('click', openModal);
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
        <label for="budget-limit">Limit Amount (₹)</label>
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
    localStorage.setItem(scopedKey(BUDGET_STORAGE_KEY_BASE), JSON.stringify(budgets));
    showToast('Success', `Budget for ${cat} set to ₹${limit.toFixed(2)}`, 'success');
    closeModal();
    renderBudgets();
  });
}

function openTotalBudgetModal() {
  const modalTitle = document.querySelector('#modal h3');
  const modalHint = document.querySelector('.modal-hint');
  const target = document.getElementById('modal-form-target');

  if (modalTitle) modalTitle.textContent = 'Change Monthly Budget';
  if (modalHint) modalHint.textContent = 'This is your overall spending limit for the month.';

  target.innerHTML = `
    <form id="total-budget-form" style="padding: 1.25rem 1.5rem;">
      <div class="form-group">
        <label for="total-budget-input">Monthly Budget (₹)</label>
        <input type="number" id="total-budget-input" class="form-control" placeholder="e.g. 50000" min="0" step="100">
        <span class="error-msg" id="error-total-budget-input"></span>
      </div>
      <button type="submit" class="btn-submit">Save Budget</button>
    </form>
  `;

  modalBackdrop.classList.remove('hidden');

  const tbForm = document.getElementById('total-budget-form');
  const input  = document.getElementById('total-budget-input');
  input.value = totalBudget || '';

  tbForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseFloat(input.value);
    if (isNaN(amount) || amount < 0) {
      document.getElementById('error-total-budget-input').textContent = 'Please enter a valid amount.';
      return;
    }
    const currentExpense = transactions.reduce((s, tx) => tx.type === 'expense' ? s + tx.amount : s, 0);
    if (amount > 0 && amount < currentExpense) {
      document.getElementById('error-total-budget-input').textContent =
        `You've already spent ₹${currentExpense.toFixed(2)} this period \u2014 set a budget of at least that.`;
      return;
    }
    saveTotalBudget(amount);
    showToast('Budget Updated', `Monthly budget set to ₹${amount.toFixed(2)}`, 'success');
    closeModal();
    renderBudgets();
  });
}

const changeBudgetBtn = document.getElementById('change-budget-btn');
if (changeBudgetBtn) {
  changeBudgetBtn.addEventListener('click', openTotalBudgetModal);
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
    const ratesTitle = document.getElementById('rates-title');
    if (ratesTitle) ratesTitle.textContent = `Popular Rates (vs ${from})`;
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

function renderBudgets() {
  const budgetList = document.getElementById('budget-list');
  if (!budgetList) return;

  const expenses = transactions.filter(tx => tx.type === 'expense');
  const catExpenses = expenses.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});

  let html = '';

  if (totalBudget > 0) {
    const totalSpent = expenses.reduce((s, tx) => s + tx.amount, 0);
    const pct = Math.min(100, (totalSpent / totalBudget) * 100);
    let colorClass = 'normal';
    if (pct >= 90) colorClass = 'danger';
    else if (pct >= 70) colorClass = 'warning';
    const warningClass = pct >= 90 ? 'warning' : '';

    html += `
      <div class="budget-item budget-item-total">
        <div class="budget-meta">
          <span class="budget-cat">💰 Total Monthly Budget</span>
          <span class="budget-amounts ${warningClass}">
            <strong>₹${totalSpent.toFixed(0)}</strong> / ₹${totalBudget}
          </span>
        </div>
        <div class="budget-bar-track">
          <div class="budget-bar-fill ${colorClass}" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  }

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
            <strong>₹${spent.toFixed(0)}</strong> / ₹${limit}
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
  let running = startingBalance;
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

function refreshAll() {
  updateSummary(transactions);
  renderRecent();
  renderFullList();
  renderLineChart();
  renderBudgets();
}

const ACCOUNTS_KEY = 'finTrack_v2_accounts';
const USER_KEY      = 'finTrack_v2_user';

const landingScreen = document.getElementById('landing-screen');
const loginScreen  = document.getElementById('login-screen');
const onboardScreen = document.getElementById('onboard-screen');
const onboardForm  = document.getElementById('onboard-form');
const signinForm   = document.getElementById('signin-form');
const signupForm   = document.getElementById('signup-form');
const logoutBtn    = document.getElementById('logout-btn');
const authTabs     = document.querySelectorAll('.auth-tab');
const authSwitches = document.querySelectorAll('.auth-switch');
const authPanels   = document.querySelectorAll('.auth-panel');
let pendingUser = null;

function getAccounts() {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function switchAuthTab(tab) {
  authTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  authPanels.forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
}

authTabs.forEach(t => t.addEventListener('click', () => switchAuthTab(t.dataset.tab)));
authSwitches.forEach(a => a.addEventListener('click', (e) => {
  e.preventDefault();
  switchAuthTab(a.dataset.tab);
}));

function showApp(user) {
  currentUserEmail = user && user.email ? user.email.toLowerCase() : null;
  document.body.classList.add('authed');
  landingScreen.classList.add('hidden');
  loginScreen.classList.add('hidden');
  const greetEl = document.querySelector('.page-heading h1');
  if (greetEl && user && user.name) {
    const firstName = user.name.trim().split(' ')[0];
    greetEl.childNodes[0].textContent = `Welcome, ${firstName} `;
  }
}

function showLanding() {
  document.body.classList.remove('authed');
  landingScreen.classList.remove('hidden');
  loginScreen.classList.add('hidden');
  onboardScreen.classList.add('hidden');
}

function showLogin() {
  document.body.classList.remove('authed');
  landingScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  onboardScreen.classList.add('hidden');
}

function enterApp(user) {
  currentUserEmail = user && user.email ? user.email.toLowerCase() : null;
  if (hasStartingBalance()) {
    showApp(user);
    init();
  } else {
    pendingUser = user;
    landingScreen.classList.add('hidden');
    loginScreen.classList.add('hidden');
    onboardScreen.classList.remove('hidden');
  }
}

const ONBOARD_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Entertainment', 'Other'];

onboardForm.addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('error-onboard-balance').textContent = '';
  document.getElementById('error-onboard-budget').textContent = '';

  const balanceInput = document.getElementById('onboard-balance');
  const balance = parseFloat(balanceInput.value);
  saveStartingBalance(isNaN(balance) || balance < 0 ? 0 : balance);

  const newBudgets = {};
  let sum = 0;
  let hasInvalid = false;
  ONBOARD_CATEGORIES.forEach(cat => {
    const input = document.getElementById(`onboard-budget-${cat}`);
    const raw = parseFloat(input.value);
    if (input.value.trim() !== '' && (isNaN(raw) || raw < 0)) hasInvalid = true;
    const value = isNaN(raw) || raw < 0 ? 0 : raw;
    newBudgets[cat] = value;
    sum += value;
  });

  if (hasInvalid) {
    document.getElementById('error-onboard-budget').textContent = 'Enter valid amounts (0 or more) for each category.';
    return;
  }

  budgets = newBudgets;
  localStorage.setItem(scopedKey(BUDGET_STORAGE_KEY_BASE), JSON.stringify(budgets));
  saveTotalBudget(sum);

  onboardScreen.classList.add('hidden');
  showApp(pendingUser);
  init();
  pendingUser = null;
});

signupForm.addEventListener('submit', (e) => {
  e.preventDefault();
  ['signup-name', 'signup-email', 'signup-password', 'signup-confirm'].forEach(id => {
    document.getElementById(`error-${id}`).textContent = '';
  });

  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  const confirm  = document.getElementById('signup-confirm').value;
  let valid = true;

  if (!name) { document.getElementById('error-signup-name').textContent = 'Enter your name.'; valid = false; }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) { document.getElementById('error-signup-email').textContent = 'Enter a valid email.'; valid = false; }
  if (!password || password.length < 6) { document.getElementById('error-signup-password').textContent = 'At least 6 characters.'; valid = false; }
  if (confirm !== password) { document.getElementById('error-signup-confirm').textContent = 'Passwords don\u2019t match.'; valid = false; }

  const accounts = getAccounts();
  if (valid && accounts.some(a => a.email === email)) {
    document.getElementById('error-signup-email').textContent = 'An account with this email already exists.';
    valid = false;
  }
  if (!valid) return;

  accounts.push({ name, email, password });
  saveAccounts(accounts);

  const user = { name, email };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  enterApp(user);
});

signinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  document.getElementById('error-signin-email').textContent = '';
  document.getElementById('error-signin-password').textContent = '';

  const email    = document.getElementById('signin-email').value.trim().toLowerCase();
  const password = document.getElementById('signin-password').value;
  let valid = true;

  if (!email) { document.getElementById('error-signin-email').textContent = 'Enter your email.'; valid = false; }
  if (!password) { document.getElementById('error-signin-password').textContent = 'Enter your password.'; valid = false; }
  if (!valid) return;

  const account = getAccounts().find(a => a.email === email);
  if (!account) {
    document.getElementById('error-signin-email').textContent = 'No account found with this email.';
    return;
  }
  if (account.password !== password) {
    document.getElementById('error-signin-password').textContent = 'Incorrect password.';
    return;
  }

  const user = { name: account.name, email: account.email };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  enterApp(user);
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem(USER_KEY);
  currentUserEmail = null;
  pendingUser = null;
  startingBalance = 0;
  totalBudget = 0;
  signinForm.reset();
  signupForm.reset();
  onboardForm.reset();
  switchAuthTab('signin');
  showLanding();
});

function init() {
  const today = new Date().toISOString().split('T')[0];
  if (dateInput) dateInput.value = today;

  initTheme();
  loadTransactions();
  refreshAll();
  navigateTo('dashboard');
}

localStorage.removeItem(USER_KEY);
showLanding();
# FinAI — React Frontend

## 🚀 Running the Full Stack

You need **two terminals**:

### Terminal 1 — Flask Backend (port 5000)
```bash
cd e:\FinAI
python run.py
```

### Terminal 2 — React Dev Server (port 5173)
```bash
cd e:\FinAI\frontend
npm run dev
```

Then open: **http://localhost:5173**

---

## 📦 Build for Production

```bash
cd e:\FinAI\frontend
npm run build
```

The build output goes to `frontend/dist/`. You can serve it with any static file server, or configure Flask to serve it.

---

## 🗂 Project Structure

```
frontend/
├── src/
│   ├── App.jsx           # Root app with context & routing
│   ├── App.css           # All component styles
│   ├── index.css         # Global CSS variables & base
│   ├── components/
│   │   ├── Sidebar.jsx   # Left navigation sidebar
│   │   ├── Topbar.jsx    # Top navigation bar
│   │   ├── Toast.jsx     # Toast notifications
│   │   └── UploadModal.jsx # CSV upload modal
│   ├── screens/
│   │   ├── Landing.jsx   # Landing/marketing page
│   │   └── AuthScreen.jsx # Login/signup
│   └── views/
│       ├── Dashboard.jsx    # KPIs, charts, transactions
│       ├── ChatView.jsx     # AI Assistant chat
│       ├── Transactions.jsx # Full transaction CRUD
│       ├── Analytics.jsx    # Deep analytics charts
│       ├── BudgetPlanner.jsx
│       ├── SavingsGoal.jsx
│       ├── LoanEMI.jsx
│       ├── Investment.jsx
│       ├── CurrencyConverter.jsx
│       └── AIInsights.jsx
└── vite.config.js        # Proxies /api to localhost:5000
```

## 🎨 Design System

- **Dark theme** with CSS variables in `index.css`
- **Orange accent** (`#e8621a`) inspired by the dashboard screenshot
- **Card-based** layout with subtle borders and hover effects
- **Responsive** grid system for all screen sizes

# FinAI — Authentication & Setup Guide

This guide covers setting up **Email OTP Verification** (via Gmail SMTP) and **Continue with Google** (OAuth 2.0) for FinAI.

---

## 1. Gmail SMTP Setup (Email OTP)

FinAI uses standard Python `smtplib` with Gmail STARTTLS (`smtp.gmail.com:587`). It requires a 16-character **Google App Password** (not your personal Gmail password).

### Step-by-Step:
1. Open your Google Account at [myaccount.google.com](https://myaccount.google.com/).
2. In the left navigation, click **Security**.
3. Under **"How you sign in to Google"**, verify that **2-Step Verification** is turned **ON** (required for App Passwords).
4. In the search bar at the top or under 2-Step Verification, search for **App passwords** (or go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)).
5. Under **App name**, enter `FinAI` and click **Create**.
6. Google will display a **16-character password** (e.g., `abcd efgh ijkl mnop`).
7. Copy this password (spaces can be removed or kept) and paste it into your `.env` file:
   ```env
   MAIL_USERNAME=your_email@gmail.com
   MAIL_APP_PASSWORD=abcdefghijklmnop
   ```

> **Developer Note:** If `MAIL_USERNAME` and `MAIL_APP_PASSWORD` are not configured in `.env`, FinAI will automatically print the 6-digit OTP code directly to your terminal console so you can test registration without sending emails.

---

## 2. Google OAuth 2.0 Setup ("Continue with Google")

FinAI uses Google's Authorization Code flow. When users click "Continue with Google", they authenticate on Google's consent screen, which redirects back to verify and link their account.

### Step-by-Step:
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one) named `FinAI`.
3. Configure the OAuth Consent Screen:
   - Navigate to **APIs & Services** → **OAuth consent screen**.
   - User Type: Select **External** and click **Create**.
   - App Information:
     - **App name**: `FinAI`
     - **User support email**: Select your Gmail.
     - **Developer contact information**: Enter your email.
   - Click **Save and Continue**.
   - **Scopes**: Click **Add or Remove Scopes**, select `openid`, `.../auth/userinfo.email`, and `.../auth/userinfo.profile`, then click **Update** and **Save and Continue**.
   - **Test users**: Click **+ Add Users**, enter your Google email address (and any other test accounts), then click **Save and Continue**.
4. Create OAuth Client ID:
   - Navigate to **APIs & Services** → **Credentials**.
   - Click **+ Create Credentials** → **OAuth client ID**.
   - Application type: Select **Web application**.
   - Name: `FinAI Web Client`.
   - **Authorized JavaScript origins**:
     - `http://localhost:5173`
   - **Authorized redirect URIs**:
     - `http://localhost:5000/api/auth/google/callback`
   - Click **Create**.
5. Copy your credentials into `.env`:
   ```env
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
   ```

---

## 3. Database Schema

FinAI includes a safe automatic SQLite migration on startup that checks existing columns and automatically adds:
- `email_verified` (Boolean)
- `google_id` (String)
- `avatar_url` (String)
- Table `email_otps`

> If you ever want to reset your local database and start fresh with sample data, simply stop the server, delete `finai.db`, and start the backend again.

---

## 4. How to Run the App (Windows PowerShell)

### Terminal 1: Backend (Flask on Port 5000)

```powershell
# Navigate to the project root
cd E:\FInance

# Activate virtual environment if using one (optional):
# .\.venv\Scripts\Activate.ps1

# Install required Python packages
pip install -r requirements.txt

# Run the Flask backend
python run.py
```

The backend starts on `http://localhost:5000`.

### Terminal 2: Frontend (Vite on Port 5173)

```powershell
# Navigate to the frontend directory
cd E:\FInance\frontend

# Install dependencies if not already installed
npm.cmd install

# Start the Vite development server
npm.cmd run dev
```

The frontend will be available at `http://localhost:5173`. Any requests to `/api/*` are automatically proxied to `http://localhost:5000`.

---

## 5. Testing the Flows

1. **Sign Up with Email**:
   - Go to `http://localhost:5173`, click **Get Started** or **Sign In** → **Sign up**.
   - Fill in name, email, password and submit.
   - You will see the 6-digit OTP verification card.
   - Enter the code received in your email (or terminal console).
   - Once verified, you are automatically logged in!

2. **Login with Unverified Account**:
   - If an account is not yet verified, logging in will automatically send a fresh OTP and prompt for verification.

3. **Rate Limiting & Attempts**:
   - Resend code enforces a 60-second cooldown timer.
   - Maximum 5 attempts allowed per code before requiring a new one.

4. **Continue with Google**:
   - Click **Continue with Google**.
   - Authenticate on Google's consent screen.
   - Google redirects back to `http://localhost:5000/api/auth/google/callback`, links or creates your account, and redirects to `http://localhost:5173/?login=google` where your session is restored immediately.

5. **Guest Mode**:
   - Click **Continue as Guest (No Login)** to use FinAI without an account.

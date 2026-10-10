"""
FinAI — Intelligent Personal Finance Assistant
Flask backend: API routes, SQLite storage, auth, and wiring together the agent, tools, and RAG engine.
"""
import os
import traceback
import smtplib
import secrets
from datetime import datetime, timedelta
from urllib.parse import quote
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import pandas as pd
import requests
from authlib.integrations.flask_client import OAuth
from flask import Flask, request, jsonify, render_template, session, send_file, redirect, url_for
from flask_cors import CORS

from config import Config
from models import db, User, Transaction, Budget, EmailOTP
from rag.rag_engine import RAGEngine
from agent.finance_agent import FinanceAgent
from agent.autonomous_monitor import AutonomousMonitor
from tools import transaction_tools as txn
from tools import goal_tools as goal_tools_mod

app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = Config.SECRET_KEY
app.config.update(
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=False,
    SESSION_COOKIE_HTTPONLY=True,
)
CORS(app, supports_credentials=True, origins=[Config.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"])

# Google OAuth setup
oauth = OAuth(app)
oauth.register(
    name="google",
    client_id=Config.GOOGLE_CLIENT_ID,
    client_secret=Config.GOOGLE_CLIENT_SECRET,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

# ---------------------------------------------------------------------------
# Database (SQLite): created automatically on first run -> FinAI/finai.db
# ---------------------------------------------------------------------------

db.init_app(app)

def _run_sqlite_migrations():
    """Ensure newly added columns and tables exist in an existing SQLite database."""
    with app.app_context():
        db.create_all()
        try:
            with db.engine.connect() as conn:
                res = conn.execute(db.text("PRAGMA table_info(users)")).fetchall()
                cols = {row[1] for row in res}
                if "email_verified" not in cols:
                    conn.execute(db.text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 0"))
                if "google_id" not in cols:
                    conn.execute(db.text("ALTER TABLE users ADD COLUMN google_id VARCHAR(255)"))
                if "avatar_url" not in cols:
                    conn.execute(db.text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))
                conn.commit()
        except Exception as e:
            print(f"[FinAI] SQLite migration notice: {e}")

_run_sqlite_migrations()

# ---------------------------------------------------------------------------
# Startup: Gemini client, then RAG index (embeddings need the client), then
# the autonomous scheduler that watches for budget/health alerts on its own.
# ---------------------------------------------------------------------------

gemini_client = None
gemini_status = "not_configured"
if Config.GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=Config.GEMINI_API_KEY)
        gemini_status = "configured"
        print("[FinAI] Gemini client initialized.")
    except Exception as e:
        gemini_status = f"error: {e}"
        print(f"[FinAI] WARNING: Gemini client failed to initialize: {e}")
else:
    print("[FinAI] WARNING: GEMINI_API_KEY not set. Chat will use fallback (non-AI) responses "
          "until you add a key to .env.")

print("[FinAI] Building RAG index from knowledge base...")
rag_engine = RAGEngine(
    Config.KNOWLEDGE_BASE_PATH,
    gemini_client=gemini_client,
    embedding_model=Config.EMBEDDING_MODEL,
)
print(f"[FinAI] RAG index ready with {len(rag_engine.chunks)} chunks (backend: {rag_engine.backend}).")

agent = FinanceAgent(rag_engine=rag_engine, gemini_client=gemini_client, gemini_model=Config.GEMINI_MODEL)

# ---------------------------------------------------------------------------
# Helpers: current user, DataFrame loading, budgets
# ---------------------------------------------------------------------------

# The background monitor has no web request, so it checks whichever user was active last.
LAST_ACTIVE = {"uid": None}


def _empty_dataframe() -> pd.DataFrame:
    """A typed, zero-row transactions frame so every tool works with no data."""
    return pd.DataFrame({
        "id": pd.Series(dtype="int64"),
        "date": pd.Series(dtype="datetime64[ns]"),
        "description": pd.Series(dtype="object"),
        "category": pd.Series(dtype="object"),
        "type": pd.Series(dtype="object"),
        "amount": pd.Series(dtype="float64"),
    })


def _current_user(create: bool = True):
    """Logged-in user, or a per-browser guest user.

    create=False is for read-only routes: if nobody is logged in and no guest
    exists yet, return None (callers show empty data) instead of inserting a new
    guest row on every page load. Guests are only created when data is saved.
    """
    uid = session.get("uid")
    user = db.session.get(User, uid) if uid else None
    if user is None and create:
        user = User(name="Guest", is_guest=True)
        db.session.add(user)
        db.session.commit()
        session["uid"] = user.id
        session.permanent = True
    if user is not None:
        LAST_ACTIVE["uid"] = user.id
    return user


def _load_df(user_id: int) -> pd.DataFrame:
    rows = Transaction.query.filter_by(user_id=user_id).all()
    if not rows:
        return _empty_dataframe()
    df = pd.DataFrame([{
        "id": r.id, "date": r.date, "description": r.description,
        "category": r.category, "type": r.type, "amount": r.amount,
    } for r in rows])
    df["date"] = pd.to_datetime(df["date"])
    return df


def _df_for(user) -> pd.DataFrame:
    return _load_df(user.id) if user is not None else _empty_dataframe()


def _load_budgets(user_id: int) -> dict:
    return {b.category: b.limit_amount for b in Budget.query.filter_by(user_id=user_id).all()}


def _save_budgets(user_id: int, budgets: dict):
    Budget.query.filter_by(user_id=user_id).delete()
    for cat, limit in budgets.items():
        try:
            db.session.add(Budget(user_id=user_id, category=str(cat), limit_amount=float(limit)))
        except (TypeError, ValueError):
            continue
    db.session.commit()


def _monitor_state():
    uid = LAST_ACTIVE["uid"]
    if uid is None:
        return {"df": _empty_dataframe(), "budgets": {}}
    with app.app_context():
        return {"df": _load_df(uid), "budgets": _load_budgets(uid)}


# Autonomous background monitor: checks budgets/health on a timer and raises
# alerts on its own, without the user having to ask in chat.
monitor = AutonomousMonitor(
    get_state=_monitor_state,
    gemini_client=gemini_client,
    gemini_model=Config.GEMINI_MODEL,
)
monitor.start(interval_minutes=Config.AUTONOMOUS_CHECK_MINUTES)


def _load_dataframe_from_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]

    # Only coerce columns that are actually present — missing columns are
    # reported clearly by _validate_dataframe() instead of raising here.
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    if "amount" in df.columns:
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    if "type" in df.columns:
        df["type"] = df["type"].astype(str).str.strip().str.lower()
    if "category" in df.columns:
        df["category"] = df["category"].astype(str).str.strip()
    if "description" in df.columns:
        df["description"] = df["description"].astype(str).str.strip()
    return df


def _validate_dataframe(df: pd.DataFrame):
    errors = []
    missing_cols = [c for c in Config.REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        errors.append(f"Missing required column(s): {', '.join(missing_cols)}")
        return errors  # can't validate further without columns

    if df.empty:
        errors.append("The CSV file has no data rows.")
        return errors

    if df["date"].isna().any():
        errors.append("Some rows have an invalid or unparseable date. Use format YYYY-MM-DD.")

    if df["amount"].isna().any():
        errors.append("Some rows have a missing or non-numeric amount.")

    invalid_types = df[~df["type"].isin(Config.VALID_TYPES)]
    if not invalid_types.empty:
        errors.append("Some rows have an invalid 'type' value. Must be 'income' or 'expense'.")

    empty_desc = df["description"].isna() | (df["description"].str.strip() == "")
    if empty_desc.any():
        errors.append("Some rows are missing a description.")

    return errors


# ---------------------------------------------------------------------------
# Routes — pages
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# Helpers — Email OTP (Gmail SMTP)
# ---------------------------------------------------------------------------

def send_otp_email(to_email: str, otp_code: str) -> bool:
    """Send a 6-digit OTP verification code via Gmail SMTP (smtp.gmail.com:587 STARTTLS)."""
    username = Config.MAIL_USERNAME
    password = Config.MAIL_APP_PASSWORD

    if not username or not password:
        print(f"\n[FinAI DEV OTP] MAIL_USERNAME / MAIL_APP_PASSWORD not set in .env.")
        print(f"[FinAI DEV OTP] Verification code for {to_email} is: {otp_code}\n")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Your FinAI verification code is {otp_code}"
    msg["From"] = f"FinAI <{username}>"
    msg["To"] = to_email

    text_body = (
        f"Your FinAI verification code is: {otp_code}\n\n"
        f"This code will expire in 10 minutes.\n"
        f"If you did not request this code, please ignore this email."
    )

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f6fc; margin: 0; padding: 28px; color: #17142b; }}
    .card {{ max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 36px 32px; box-shadow: 0 16px 40px rgba(123,92,255,0.08); border: 1px solid #ebe7ff; }}
    .logo {{ display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 20px; color: #17142b; margin-bottom: 24px; }}
    .logo-badge {{ width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, #f2571d, #ff8a52); color: #fff; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; }}
    h1 {{ font-size: 22px; font-weight: 700; color: #17142b; margin: 0 0 12px; }}
    p {{ font-size: 14.5px; line-height: 1.6; color: #58556f; margin: 0 0 20px; }}
    .otp-box {{ background: linear-gradient(160deg, #f3efff 0%, #ece5ff 100%); border: 1.5px dashed #7b5cff; border-radius: 16px; padding: 20px 24px; text-align: center; margin: 24px 0; }}
    .otp-code {{ font-family: 'Space Grotesk', monospace, sans-serif; font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #5c35eb; }}
    .hint {{ font-size: 12px; color: #8e8b9f; margin-top: 8px; }}
    .footer {{ margin-top: 32px; padding-top: 20px; border-top: 1px solid #f0edf9; font-size: 12px; color: #9c99ad; text-align: center; }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <span class="logo-badge">F</span> FinAI
    </div>
    <h1>Your FinAI verification code is {otp_code}</h1>
    <p>Thank you for choosing FinAI! Enter the 6-digit verification code below to verify your email and activate your account.</p>
    <div class="otp-box">
      <div class="otp-code">{otp_code}</div>
      <div class="hint">Expires in 10 minutes &bull; Do not share this code</div>
    </div>
    <p style="font-size: 13px;">If you did not request this verification code, no action is needed.</p>
    <div class="footer">
      &copy; FinAI &bull; Intelligent Personal Finance Assistant
    </div>
  </div>
</body>
</html>"""

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(Config.MAIL_SERVER, Config.MAIL_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(username, password)
            server.sendmail(username, to_email, msg.as_string())
        print(f"[FinAI] Verification email sent to {to_email}")
        return True
    except Exception as e:
        print(f"[FinAI] Failed to send email via Gmail SMTP: {e}")
        print(f"[FinAI DEV OTP FALLBACK] Code for {to_email} is: {otp_code}")
        return False


def generate_and_save_otp(email: str) -> str:
    """Generate 6-digit OTP, store only code_hash with 10-minute expiry, and send email."""
    code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Any new code replaces old
    EmailOTP.query.filter_by(email=email).delete()

    otp_rec = EmailOTP(
        email=email,
        expires_at=expires_at,
        attempts=0,
        created_at=datetime.utcnow(),
    )
    otp_rec.set_code(code)
    db.session.add(otp_rec)
    db.session.commit()

    send_otp_email(email, code)
    return code


# ---------------------------------------------------------------------------
# Routes — auth
# ---------------------------------------------------------------------------

@app.route("/api/register", methods=["POST"])
def register():
    try:
        p = request.get_json(force=True) or {}
        name = str(p.get("name", "")).strip()
        email = str(p.get("email", "")).strip().lower()
        password = str(p.get("password", ""))

        if not name:
            return jsonify({"error": "Name is required."}), 400
        if "@" not in email or "." not in email.split("@")[-1]:
            return jsonify({"error": "Enter a valid email address."}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters."}), 400

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            if existing_user.email_verified:
                return jsonify({"error": "An account with this email already exists."}), 409
            else:
                # Update info on unverified existing registration
                existing_user.name = name[:80]
                existing_user.set_password(password)
        else:
            user = User(name=name[:80], email=email, is_guest=False, email_verified=False)
            user.set_password(password)
            db.session.add(user)

        db.session.commit()

        # Generate 6-digit OTP, store hash with 10-minute expiry, email it
        generate_and_save_otp(email)

        # Do NOT log the user in yet. Return {needs_verification: true, email}
        return jsonify({
            "needs_verification": True,
            "email": email,
            "message": f"Verification code sent to {email}.",
        }), 201
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not create the account."}), 500


@app.route("/api/verify-otp", methods=["POST"])
def verify_otp():
    try:
        p = request.get_json(force=True) or {}
        email = str(p.get("email", "")).strip().lower()
        otp = str(p.get("otp", "")).strip()

        if not email or not otp:
            return jsonify({"error": "Email and 6-digit code are required."}), 400

        otp_rec = EmailOTP.query.filter_by(email=email).order_by(EmailOTP.id.desc()).first()
        if not otp_rec:
            return jsonify({"error": "No verification code found. Please request a new code."}), 400

        # Max 5 attempts
        if otp_rec.attempts >= 5:
            return jsonify({"error": "Too many failed attempts. Please request a new code."}), 400

        # Check expiry (10-minute expiry)
        if datetime.utcnow() > otp_rec.expires_at:
            return jsonify({"error": "Verification code has expired. Please request a new code."}), 400

        # Compare hash
        if not otp_rec.check_code(otp):
            otp_rec.attempts += 1
            db.session.commit()
            rem = max(0, 5 - otp_rec.attempts)
            if rem == 0:
                return jsonify({"error": "Too many failed attempts. Please request a new code."}), 400
            return jsonify({"error": f"Invalid verification code. {rem} attempt{'s' if rem != 1 else ''} remaining."}), 400

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "Account not found."}), 404

        # On success set email_verified=True, delete OTP rows, log in (session uid), return user
        user.email_verified = True
        EmailOTP.query.filter_by(email=email).delete()

        session["uid"] = user.id
        session.permanent = True
        LAST_ACTIVE["uid"] = user.id
        db.session.commit()

        return jsonify({"message": "Email verified successfully.", "user": user.to_public()})
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not verify code."}), 500


@app.route("/api/resend-otp", methods=["POST"])
def resend_otp():
    try:
        p = request.get_json(force=True) or {}
        email = str(p.get("email", "")).strip().lower()

        if not email:
            return jsonify({"error": "Email is required."}), 400

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "No account found with this email."}), 404

        if user.email_verified:
            return jsonify({"error": "This email is already verified. Please sign in."}), 400

        # Rate limit 1 per 60 seconds
        last_otp = EmailOTP.query.filter_by(email=email).order_by(EmailOTP.id.desc()).first()
        if last_otp:
            elapsed = (datetime.utcnow() - last_otp.created_at).total_seconds()
            if elapsed < 60:
                wait_sec = int(60 - elapsed)
                return jsonify({"error": f"Please wait {wait_sec}s before requesting a new code."}), 429

        generate_and_save_otp(email)
        return jsonify({"message": f"A new verification code was sent to {email}."})
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not resend verification code."}), 500


@app.route("/api/login", methods=["POST"])
def login():
    try:
        p = request.get_json(force=True) or {}
        email = str(p.get("email", "")).strip().lower()
        password = str(p.get("password", ""))

        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({"error": "Incorrect email or password."}), 401

        # If account is Google-only (no password), return clear error
        if user.google_id and not user.password_hash:
            return jsonify({"error": "Use Continue with Google"}), 400

        if not user.check_password(password):
            return jsonify({"error": "Incorrect email or password."}), 401

        # If email_verified is False, send a fresh OTP and return {needs_verification: true}
        if not user.email_verified:
            generate_and_save_otp(email)
            return jsonify({
                "needs_verification": True,
                "email": user.email,
                "message": "Please verify your email address to sign in.",
            }), 200

        session["uid"] = user.id
        session.permanent = True
        LAST_ACTIVE["uid"] = user.id
        return jsonify({"message": "Logged in.", "user": user.to_public()})
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not log in."}), 500


@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("uid", None)
    session["chat_history"] = []
    return jsonify({"message": "Logged out."})


@app.route("/api/me", methods=["GET"])
def me():
    """Who is logged in? Used by the frontend to restore the session on refresh."""
    uid = session.get("uid")
    user = db.session.get(User, uid) if uid else None
    if user is None or user.is_guest:
        return jsonify({"user": None})
    return jsonify({"user": user.to_public()})


# ---------------------------------------------------------------------------
# Routes — Google OAuth
# ---------------------------------------------------------------------------

def _frontend_url():
    ref = request.headers.get("Referer") or request.headers.get("Origin")
    if ref:
        try:
            from urllib.parse import urlparse
            p = urlparse(ref)
            if p.scheme and p.netloc:
                return f"{p.scheme}://{p.netloc}"
        except Exception:
            pass
    return Config.FRONTEND_URL


@app.route("/api/auth/google")
def auth_google():
    front_url = _frontend_url()
    session["oauth_frontend"] = front_url

    if not Config.GOOGLE_CLIENT_ID or not Config.GOOGLE_CLIENT_SECRET:
        err = quote("Google OAuth is not configured yet. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.")
        return redirect(f"{front_url}/?error={err}")

    redirect_uri = Config.GOOGLE_REDIRECT_URI or url_for("auth_google_callback", _external=True)
    if not Config.GOOGLE_REDIRECT_URI and "localhost" in redirect_uri:
        redirect_uri = "http://localhost:5000/api/auth/google/callback"

    return oauth.google.authorize_redirect(redirect_uri)


@app.route("/api/auth/google/callback")
def auth_google_callback():
    front_url = session.pop("oauth_frontend", None) or _frontend_url()

    error = request.args.get("error")
    if error:
        desc = request.args.get("error_description", "Google sign-in was canceled.")
        return redirect(f"{front_url}/?error={quote(desc)}")

    redirect_uri = Config.GOOGLE_REDIRECT_URI or "http://localhost:5000/api/auth/google/callback"
    user_info = None

    try:
        token = oauth.google.authorize_access_token()
        user_info = token.get("userinfo")
        if not user_info:
            user_info = oauth.google.userinfo()
    except Exception as e:
        print(f"[FinAI] Authlib exchange note: {e}. Attempting direct token exchange...")
        code = request.args.get("code")
        if code:
            try:
                resp = requests.post(
                    "https://oauth2.googleapis.com/token",
                    data={
                        "client_id": Config.GOOGLE_CLIENT_ID,
                        "client_secret": Config.GOOGLE_CLIENT_SECRET,
                        "code": code,
                        "grant_type": "authorization_code",
                        "redirect_uri": redirect_uri,
                    },
                    timeout=10,
                )
                tdata = resp.json()
                acc_tok = tdata.get("access_token")
                if acc_tok:
                    uresp = requests.get(
                        "https://openidconnect.googleapis.com/v1/userinfo",
                        headers={"Authorization": f"Bearer {acc_tok}"},
                        timeout=10,
                    )
                    user_info = uresp.json()
            except Exception as ex:
                print(f"[FinAI] Direct token exchange failed: {ex}")

    if not user_info or not user_info.get("email"):
        return redirect(f"{front_url}/?error={quote('Could not retrieve account info from Google.')}")

    google_id = user_info.get("sub")
    email = str(user_info.get("email", "")).strip().lower()
    name = user_info.get("name") or email.split("@")[0]
    picture = user_info.get("picture")

    try:
        # If a user with that email exists, link google_id and set email_verified=True; else create a new user
        user = User.query.filter((User.google_id == google_id) | (User.email == email)).first()
        if user:
            user.google_id = google_id
            user.email_verified = True
            if picture:
                user.avatar_url = picture
            if not user.name or user.name == "Guest":
                user.name = name[:80]
        else:
            user = User(
                name=name[:80],
                email=email,
                google_id=google_id,
                avatar_url=picture,
                email_verified=True,  # Google users skip OTP because Google already verified email
                is_guest=False,
            )
            db.session.add(user)

        db.session.commit()
        session["uid"] = user.id
        session.permanent = True
        LAST_ACTIVE["uid"] = user.id

        return redirect(f"{front_url}/?login=google")
    except Exception as e:
        db.session.rollback()
        traceback.print_exc()
        return redirect(f"{front_url}/?error={quote('Database error during Google sign-in.')}")


# ---------------------------------------------------------------------------
# Routes — API
# ---------------------------------------------------------------------------

@app.route("/api/upload", methods=["POST"])
def upload_csv():
    try:
        user = _current_user()

        if "file" not in request.files:
            return jsonify({"error": "No file was provided."}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "No file was selected."}), 400

        if not file.filename.lower().endswith(".csv"):
            return jsonify({"error": "Only .csv files are supported."}), 400

        save_path = os.path.join(Config.UPLOAD_FOLDER, f"upload_user_{user.id}.csv")
        file.save(save_path)

        try:
            df = _load_dataframe_from_csv(save_path)
        except Exception:
            return jsonify({"error": "Could not parse this file as a CSV. Please check its formatting."}), 400

        errors = _validate_dataframe(df)
        if errors:
            return jsonify({"error": "CSV validation failed.", "details": errors}), 400

        # Drop rows that failed to parse (shouldn't happen if validation passed, but stay safe)
        df = df.dropna(subset=["date", "amount"]).reset_index(drop=True)

        # Replace this user's data with the uploaded rows
        Transaction.query.filter_by(user_id=user.id).delete()
        db.session.add_all([
            Transaction(
                user_id=user.id,
                date=r["date"].to_pydatetime(),
                description=str(r["description"])[:255],
                category=str(r["category"])[:80],
                type=str(r["type"]),
                amount=float(r["amount"]),
            )
            for _, r in df.iterrows()
        ])
        user.data_source = "uploaded"
        user.data_filename = file.filename
        db.session.commit()

        return jsonify({
            "message": f"Successfully loaded {len(df)} transactions from {file.filename}.",
            "row_count": len(df),
        })
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while processing the upload."}), 500


@app.route("/api/clear-data", methods=["POST"])
def clear_data():
    try:
        user = _current_user()
        Transaction.query.filter_by(user_id=user.id).delete()
        user.data_source = "empty"
        user.data_filename = None
        db.session.commit()
        return jsonify({"message": "All data cleared.", "row_count": 0})
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not reset data."}), 500


@app.route("/api/download-sample", methods=["GET"])
def download_sample():
    try:
        return send_file(
            Config.SAMPLE_CSV_PATH,
            as_attachment=True,
            download_name="sample_transactions.csv",
            mimetype="text/csv"
        )
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not download sample file."}), 500


@app.route("/api/summary", methods=["GET"])
def summary():
    user = _current_user(create=False)
    df = _df_for(user)
    if df.empty:
        return jsonify({"total_income": 0, "total_expenses": 0, "balance": 0, "savings_rate": 0,
                         "transaction_count": 0, "source": "empty"})
    return jsonify({
        "total_income": txn.get_total_income(df),
        "total_expenses": txn.get_total_expenses(df),
        "balance": txn.get_balance(df),
        "savings_rate": txn.get_savings_rate(df),
        "transaction_count": txn.get_transaction_count(df),
        "source": user.data_source if user.data_source != "empty" else "manual",
        "filename": user.data_filename,
    })


@app.route("/api/transactions", methods=["GET"])
def transactions():
    df = _df_for(_current_user(create=False))
    if df.empty:
        return jsonify({"transactions": []})
    cols = ["id", "date", "description", "category", "type", "amount"]
    out = df.sort_values(["date", "id"], ascending=[False, False])[cols]
    out = out.assign(date=lambda d: d["date"].dt.strftime("%Y-%m-%d"))
    return jsonify({"transactions": out.to_dict(orient="records")})


@app.route("/api/transactions", methods=["POST"])
def add_transaction():
    try:
        user = _current_user()
        payload = request.get_json(force=True) or {}
        date_str = str(payload.get("date", "")).strip()
        desc = str(payload.get("description", "")).strip()
        category = str(payload.get("category", "")).strip()
        txn_type = str(payload.get("type", "")).strip().lower()
        amount_raw = payload.get("amount")

        # Validation matching CSV rules
        if not date_str:
            return jsonify({"error": "Date is required (format: YYYY-MM-DD)."}), 400
        try:
            parsed_date = pd.to_datetime(date_str, format="%Y-%m-%d")
        except Exception:
            try:
                parsed_date = pd.to_datetime(date_str)
            except Exception:
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

        if not desc:
            return jsonify({"error": "Description cannot be empty."}), 400

        if not category:
            return jsonify({"error": "Category cannot be empty."}), 400

        if txn_type not in Config.VALID_TYPES:
            return jsonify({"error": f"Invalid type '{txn_type}'. Must be 'income' or 'expense'."}), 400

        try:
            amount = float(amount_raw)
            if amount <= 0:
                return jsonify({"error": "Amount must be a positive number greater than 0."}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Amount must be a valid numeric value."}), 400

        row = Transaction(
            user_id=user.id,
            date=parsed_date.to_pydatetime(),
            description=desc[:255],
            category=category[:80],
            type=txn_type,
            amount=round(amount, 2),
        )
        db.session.add(row)
        if user.data_source == "empty":
            user.data_source = "manual"
        db.session.commit()

        return jsonify({
            "message": "Transaction added successfully.",
            "transaction": {
                "id": row.id,
                "date": parsed_date.strftime("%Y-%m-%d"),
                "description": desc,
                "category": category,
                "type": txn_type,
                "amount": round(amount, 2),
            },
            "transaction_count": Transaction.query.filter_by(user_id=user.id).count(),
        }), 201
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while adding transaction."}), 500


@app.route("/api/transactions/<int:txn_id>", methods=["DELETE"])
def delete_transaction(txn_id):
    try:
        user = _current_user(create=False)
        row = Transaction.query.filter_by(id=txn_id, user_id=user.id).first() if user else None
        if row is None:
            return jsonify({"error": f"Transaction with ID {txn_id} not found."}), 404

        db.session.delete(row)
        db.session.commit()
        return jsonify({
            "message": "Transaction deleted.",
            "remaining_count": Transaction.query.filter_by(user_id=user.id).count(),
        })
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while deleting transaction."}), 500


@app.route("/api/categories", methods=["GET"])
def categories():
    df = _df_for(_current_user(create=False))
    if df.empty:
        return jsonify({"categories": {}})
    return jsonify({"categories": txn.get_category_spending(df)})


@app.route("/api/monthly-summary", methods=["GET"])
def monthly_summary():
    df = _df_for(_current_user(create=False))
    if df.empty:
        return jsonify({"months": []})
    return jsonify({"months": txn.get_monthly_summary(df)})


@app.route("/api/budget", methods=["GET"])
def get_budgets():
    """Budgets the user saved earlier (so they survive refresh/restart)."""
    user = _current_user(create=False)
    return jsonify({"budgets": _load_budgets(user.id) if user else {}})


@app.route("/api/budget", methods=["POST"])
def budget_status():
    try:
        from tools import budget_tools
        user = _current_user(create=False)
        df = _df_for(user)
        payload = request.get_json(force=True) or {}
        budgets = payload.get("budgets", {})
        if df.empty:
            return jsonify({"error": "No transaction data is loaded."}), 400
        if not budgets:
            return jsonify({"error": "No budgets were provided."}), 400
        _save_budgets(user.id, budgets)  # saved so the autonomous monitor and next visit can use it
        results = budget_tools.calculate_budget_status(df, budgets)
        return jsonify({"results": results})
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not calculate budget status."}), 500


@app.route("/api/goal", methods=["POST"])
def goal_endpoint():
    try:
        df = _df_for(_current_user(create=False))
        payload = request.get_json(force=True) or {}
        target_amount = payload.get("target_amount")
        timeline_months = payload.get("timeline_months")
        current_savings = payload.get("current_savings", 0)

        if target_amount is None or timeline_months is None:
            return jsonify({"error": "target_amount and timeline_months are required."}), 400
        if df.empty:
            return jsonify({"error": "No transaction data is loaded."}), 400

        result = goal_tools_mod.analyze_savings_goal(
            df, float(target_amount), float(timeline_months), float(current_savings)
        )
        return jsonify(result)
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not analyze savings goal."}), 500


@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        user = _current_user(create=False)
        payload = request.get_json(force=True) or {}
        message = (payload.get("message") or "").strip()
        budgets = payload.get("budgets") or (_load_budgets(user.id) if user else None) or None

        if not message:
            return jsonify({"error": "Message cannot be empty."}), 400

        if "chat_history" not in session:
            session["chat_history"] = []

        history = session["chat_history"]

        df = _df_for(user)
        result = agent.handle_message(message, df, history, budgets=budgets)

        history.append({"role": "user", "content": message[:200]})
        history.append({"role": "assistant", "content": result["answer"][:300]})
        session["chat_history"] = history[-6:]  # keep recent 6 turns for context
        session.modified = True

        return jsonify(result)
    except Exception:
        traceback.print_exc()
        return jsonify({
            "answer": "Something went wrong while processing your question. Please try again.",
            "sources": [], "tools_used": [], "data_used": False, "rag_used": False,
            "error": True,
        }), 500


@app.route("/api/clear-chat", methods=["POST"])
def clear_chat():
    session["chat_history"] = []
    return jsonify({"message": "Chat history cleared."})


@app.route("/api/status", methods=["GET"])
def status():
    user = _current_user(create=False)
    return jsonify({
        "gemini_status": gemini_status,
        "rag_backend": rag_engine.backend,
        "rag_chunks_loaded": len(rag_engine.chunks),
        "data_source": user.data_source if user else "empty",
        "transaction_count": Transaction.query.filter_by(user_id=user.id).count() if user else 0,
        "autonomous_monitor_last_checked": monitor.last_checked,
    })


@app.route("/api/alerts", methods=["GET"])
def alerts():
    """Alerts the autonomous monitor raised on its own, in the background —
    the frontend can poll this to show a notification without the user
    having to ask anything in chat first."""
    return jsonify({
        "alerts": monitor.latest_alerts,
        "last_checked": monitor.last_checked,
    })


@app.route("/api/alerts/dismiss", methods=["POST"])
def dismiss_alerts():
    monitor.latest_alerts = []
    return jsonify({"message": "Alerts cleared."})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
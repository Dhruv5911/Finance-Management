"""
Central configuration for FinAI.
Loads environment variables and defines app-wide constants.
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", os.environ.get("FLASK_SECRET_KEY", "finai-dev-secret-change-me"))
    FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    # Email OTP settings (Gmail SMTP)
    MAIL_SERVER = "smtp.gmail.com"
    MAIL_PORT = 587
    MAIL_USERNAME = os.environ.get("MAIL_USERNAME", "")
    MAIL_APP_PASSWORD = os.environ.get("MAIL_APP_PASSWORD", "")

    # Google OAuth 2.0 settings
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI = os.environ.get("GOOGLE_REDIRECT_URI", "")

    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "gemini-embedding-001")

    # How often the autonomous monitor re-checks budgets/health in the background.
    AUTONOMOUS_CHECK_MINUTES = int(os.environ.get("AUTONOMOUS_CHECK_MINUTES", "30"))

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
    SAMPLE_CSV_PATH = os.path.join(BASE_DIR, "data", "sample_transactions.csv")
    KNOWLEDGE_BASE_PATH = os.path.join(BASE_DIR, "data", "finance_knowledge.md")

    # SQLite database file (created automatically on first run)
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///" + os.path.join(BASE_DIR, "finai.db"))
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    ALLOWED_EXTENSIONS = {"csv"}
    REQUIRED_COLUMNS = ["date", "description", "category", "type", "amount"]
    VALID_TYPES = {"income", "expense"}

    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB upload limit

    RAG_TOP_K = 4
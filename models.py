"""
FinAI database models (SQLite via Flask-SQLAlchemy).

Tables:
  users         - login accounts (and one hidden "guest" row per guest browser session)
  transactions  - every income/expense row, owned by one user
  budgets       - per-user monthly budget limit for each category
"""
from datetime import datetime

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False, default="Guest")
    email = db.Column(db.String(120), unique=True, nullable=True)      # NULL for guests
    password_hash = db.Column(db.String(255), nullable=True)           # NULL for guests or Google OAuth users
    is_guest = db.Column(db.Boolean, nullable=False, default=False)
    email_verified = db.Column(db.Boolean, nullable=False, default=False)
    google_id = db.Column(db.String(255), unique=True, nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    # Where the current data came from: "empty" | "uploaded" | "manual"
    data_source = db.Column(db.String(20), nullable=False, default="empty")
    data_filename = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    transactions = db.relationship("Transaction", backref="user", cascade="all, delete-orphan", lazy="dynamic")
    budgets = db.relationship("Budget", backref="user", cascade="all, delete-orphan", lazy="dynamic")

    def set_password(self, raw: str):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw: str) -> bool:
        return bool(self.password_hash) and check_password_hash(self.password_hash, raw)

    def to_public(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "is_guest": self.is_guest,
            "email_verified": self.email_verified,
            "avatar_url": self.avatar_url,
        }


class EmailOTP(db.Model):
    __tablename__ = "email_otps"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), nullable=False, index=True)
    code_hash = db.Column(db.String(255), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    def set_code(self, plain_code: str):
        self.code_hash = generate_password_hash(str(plain_code).strip())

    def check_code(self, plain_code: str) -> bool:
        return check_password_hash(self.code_hash, str(plain_code).strip())


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    date = db.Column(db.DateTime, nullable=False)
    description = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    type = db.Column(db.String(10), nullable=False)       # "income" | "expense"
    amount = db.Column(db.Float, nullable=False)


class Budget(db.Model):
    __tablename__ = "budgets"
    __table_args__ = (db.UniqueConstraint("user_id", "category", name="uq_budget_user_category"),)

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    category = db.Column(db.String(80), nullable=False)
    limit_amount = db.Column(db.Float, nullable=False)
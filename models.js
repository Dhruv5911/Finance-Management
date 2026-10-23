/**
 * FinAI — Mongoose Models for MongoDB
 * Replaces SQLite tables: users, transactions, budgets, email_otps
 */

const mongoose = require('mongoose');

// ---------------------------------------------------------------------------
// User Schema
// ---------------------------------------------------------------------------
const userSchema = new mongoose.Schema({
  name:           { type: String, required: true, default: 'Guest' },
  email:          { type: String, unique: true, sparse: true, lowercase: true },
  password_hash:  { type: String },
  is_guest:       { type: Boolean, default: false },
  email_verified: { type: Boolean, default: false },
  google_id:      { type: String, unique: true, sparse: true },
  avatar_url:     { type: String },
  data_source:    { type: String, default: 'empty' },
  data_filename:  { type: String },
}, { timestamps: true });

// ---------------------------------------------------------------------------
// Transaction Schema
// ---------------------------------------------------------------------------
const transactionSchema = new mongoose.Schema({
  user_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:        { type: String, required: true },
  description: { type: String, required: true },
  category:    { type: String, required: true },
  type:        { type: String, enum: ['income', 'expense'], required: true },
  amount:      { type: Number, required: true },
}, { timestamps: true });

// ---------------------------------------------------------------------------
// Budget Schema
// ---------------------------------------------------------------------------
const budgetSchema = new mongoose.Schema({
  user_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category:     { type: String, required: true },
  limit_amount: { type: Number, required: true },
}, { timestamps: true });

budgetSchema.index({ user_id: 1, category: 1 }, { unique: true });

// ---------------------------------------------------------------------------
// Email OTP Schema
// ---------------------------------------------------------------------------
const emailOtpSchema = new mongoose.Schema({
  email:      { type: String, required: true },
  code_hash:  { type: String, required: true },
  expires_at: { type: Date, required: true },
  attempts:   { type: Number, default: 0 },
}, { timestamps: true });

// ---------------------------------------------------------------------------
// Export Models
// ---------------------------------------------------------------------------
const User        = mongoose.model('User', userSchema);
const Transaction = mongoose.model('Transaction', transactionSchema);
const Budget      = mongoose.model('Budget', budgetSchema);
const EmailOtp    = mongoose.model('EmailOtp', emailOtpSchema);

module.exports = { User, Transaction, Budget, EmailOtp };

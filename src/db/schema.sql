-- Centralized Payment Module Schema (PostgreSQL DDL)
-- Version 1.0

CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  code VARCHAR(10) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  state VARCHAR(50) DEFAULT 'Chhattisgarh',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('purchase_officer', 'ho_verifier', 'ca', 'admin')),
  branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  mobile VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  vendor_code VARCHAR(30) UNIQUE NOT NULL,
  legal_name VARCHAR(200) NOT NULL,
  trade_name VARCHAR(200),
  pan VARCHAR(20) NOT NULL,
  gstin VARCHAR(25) NOT NULL,
  msme_status VARCHAR(30) DEFAULT 'not_registered',
  address TEXT,
  contact_person VARCHAR(100),
  mobile VARCHAR(20),
  email VARCHAR(150),
  bank_name VARCHAR(100) NOT NULL,
  beneficiary_name VARCHAR(150) NOT NULL,
  bank_account_number VARCHAR(50) NOT NULL,
  ifsc VARCHAR(20) NOT NULL,
  vendor_category VARCHAR(50) DEFAULT 'Raw Material',
  status VARCHAR(50) DEFAULT 'pending_ho_verification',
  is_active BOOLEAN DEFAULT TRUE,
  created_by_user_id INTEGER REFERENCES users(id),
  ho_verification_remarks TEXT,
  ho_verified_by INTEGER REFERENCES users(id),
  ho_verified_at TIMESTAMP WITH TIME ZONE,
  ca_approved_by INTEGER REFERENCES users(id),
  ca_approved_at TIMESTAMP WITH TIME ZONE,
  ca_remarks TEXT,
  bank_details_authorized BOOLEAN DEFAULT TRUE,
  bank_authorized_by INTEGER REFERENCES users(id),
  bank_authorized_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  internal_bill_id VARCHAR(50) UNIQUE NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  project_id INTEGER NOT NULL REFERENCES projects(id),
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  bill_type VARCHAR(50) NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  invoice_amount NUMERIC(15, 2) NOT NULL,
  gst_amount NUMERIC(15, 2) DEFAULT 0,
  net_bill_amount NUMERIC(15, 2) NOT NULL,
  eway_bill_number VARCHAR(100),
  po_wo_number VARCHAR(100),
  material_service_desc TEXT NOT NULL,
  due_date DATE,
  bill_category VARCHAR(50),
  remarks TEXT,
  status VARCHAR(60) DEFAULT 'bill_received',
  total_paid_amount NUMERIC(15, 2) DEFAULT 0,
  balance_payable NUMERIC(15, 2) NOT NULL,
  is_duplicate_override BOOLEAN DEFAULT FALSE,
  duplicate_override_reason TEXT,
  linked_proforma_bill_id INTEGER REFERENCES bills(id),
  created_by_user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bill_documents (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_by_user_id INTEGER REFERENCES users(id),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS payment_requests (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  requested_amount NUMERIC(15, 2) NOT NULL,
  required_payment_date DATE NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'critical')),
  reason_remarks TEXT,
  verified_amount NUMERIC(15, 2),
  status VARCHAR(50) DEFAULT 'submitted',
  requested_by_user_id INTEGER REFERENCES users(id),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  verified_by_user_id INTEGER REFERENCES users(id),
  verified_at TIMESTAMP WITH TIME ZONE,
  verification_notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ho_queries (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  payment_request_id INTEGER REFERENCES payment_requests(id) ON DELETE CASCADE,
  query_reason_code VARCHAR(100) NOT NULL,
  query_text TEXT NOT NULL,
  raised_by_user_id INTEGER REFERENCES users(id),
  raised_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reply_text TEXT,
  replied_by_user_id INTEGER REFERENCES users(id),
  replied_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(30) DEFAULT 'open' CHECK (status IN ('open', 'resolved'))
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  payment_request_id INTEGER REFERENCES payment_requests(id),
  payment_amount NUMERIC(15, 2) NOT NULL,
  payment_date DATE NOT NULL,
  paying_bank_account VARCHAR(100) NOT NULL,
  payment_mode VARCHAR(30) NOT NULL CHECK (payment_mode IN ('NEFT', 'RTGS', 'IMPS', 'Cheque', 'Other')),
  utr_reference_number VARCHAR(100) NOT NULL,
  payment_remarks TEXT,
  proof_file_name VARCHAR(255),
  proof_file_path VARCHAR(500),
  paid_by_user_id INTEGER REFERENCES users(id),
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  user_name VARCHAR(100),
  user_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INTEGER,
  internal_bill_id VARCHAR(50),
  old_status VARCHAR(60),
  new_status VARCHAR(60),
  metadata JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  recipient_role VARCHAR(30),
  recipient_user_id INTEGER,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  internal_bill_id VARCHAR(50),
  bill_id INTEGER,
  type VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for rapid query performance
CREATE INDEX IF NOT EXISTS idx_bills_internal_id ON bills(internal_bill_id);
CREATE INDEX IF NOT EXISTS idx_bills_vendor_id ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_invoice_num ON bills(invoice_number);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_utr ON payment_transactions(utr_reference_number);
CREATE INDEX IF NOT EXISTS idx_audit_logs_bill_id ON audit_logs(internal_bill_id);
CREATE INDEX IF NOT EXISTS idx_ho_queries_bill_id ON ho_queries(bill_id);

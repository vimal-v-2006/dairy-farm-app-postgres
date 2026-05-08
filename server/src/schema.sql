-- PostgreSQL schema for Dairy Farm App
-- All tables from original SQLite, converted to PostgreSQL types

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cows (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  breed TEXT,
  age TEXT,
  status TEXT DEFAULT 'Active',
  purchase_date TEXT,
  status_date TEXT,
  purchase_price DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buyers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  default_rate DOUBLE PRECISION DEFAULT 0,
  contact TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_items (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  purchase_kg DOUBLE PRECISION DEFAULT 0,
  purchase_amount DOUBLE PRECISION DEFAULT 0,
  rate_per_kg DOUBLE PRECISION DEFAULT 0,
  unit_type TEXT DEFAULT 'kg',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_price_history (
  id SERIAL PRIMARY KEY,
  food_item_id INTEGER NOT NULL REFERENCES food_items(id) ON DELETE CASCADE,
  purchase_quantity DOUBLE PRECISION DEFAULT 0,
  purchase_amount DOUBLE PRECISION DEFAULT 0,
  unit_rate DOUBLE PRECISION DEFAULT 0,
  unit_type TEXT DEFAULT 'kg',
  effective_from TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_price_history_food_effective ON food_price_history(food_item_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS calves (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  breed TEXT,
  birth_date TEXT,
  source_type TEXT DEFAULT 'raised',
  expected_lactation_date TEXT,
  purchase_price DOUBLE PRECISION DEFAULT 0,
  paid_amount DOUBLE PRECISION DEFAULT 0,
  status TEXT DEFAULT 'Growing',
  notes TEXT,
  transferred_to_cow_id INTEGER REFERENCES cows(id) ON DELETE SET NULL,
  transferred_at TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calf_expenses (
  id SERIAL PRIMARY KEY,
  calf_id INTEGER NOT NULL REFERENCES calves(id) ON DELETE CASCADE,
  expense_date TEXT NOT NULL,
  expense_type TEXT DEFAULT 'food',
  category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  food_item_id INTEGER REFERENCES food_items(id) ON DELETE SET NULL,
  food_price_history_id INTEGER,
  food_name_snapshot TEXT,
  unit_type_snapshot TEXT DEFAULT 'kg',
  rate_effective_from TEXT,
  quantity_kg DOUBLE PRECISION DEFAULT 0,
  unit_rate DOUBLE PRECISION DEFAULT 0,
  amount DOUBLE PRECISION DEFAULT 0,
  entry_shift TEXT,
  description TEXT,
  payment_mode TEXT DEFAULT 'Cash',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_entries (
  id SERIAL PRIMARY KEY,
  entry_date TEXT NOT NULL UNIQUE,
  total_milk_litres DOUBLE PRECISION DEFAULT 0,
  remaining_milk_litres DOUBLE PRECISION DEFAULT 0,
  total_income DOUBLE PRECISION DEFAULT 0,
  total_expenses DOUBLE PRECISION DEFAULT 0,
  profit DOUBLE PRECISION DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cow_milk_entries (
  id SERIAL PRIMARY KEY,
  daily_entry_id INTEGER NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
  cow_id INTEGER NOT NULL REFERENCES cows(id) ON DELETE CASCADE,
  morning_litres DOUBLE PRECISION DEFAULT 0,
  evening_litres DOUBLE PRECISION DEFAULT 0,
  total_litres DOUBLE PRECISION DEFAULT 0,
  entry_shift TEXT,
  status TEXT DEFAULT 'Milked',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS milk_sales (
  id SERIAL PRIMARY KEY,
  daily_entry_id INTEGER NOT NULL REFERENCES daily_entries(id) ON DELETE CASCADE,
  buyer_id INTEGER REFERENCES buyers(id) ON DELETE SET NULL,
  litres DOUBLE PRECISION DEFAULT 0,
  rate_per_litre DOUBLE PRECISION DEFAULT 0,
  income DOUBLE PRECISION DEFAULT 0,
  payment_status TEXT DEFAULT 'Paid',
  payment_mode TEXT DEFAULT 'Cash',
  entry_shift TEXT DEFAULT 'Morning',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  daily_entry_id INTEGER REFERENCES daily_entries(id) ON DELETE SET NULL,
  category_id INTEGER REFERENCES expense_categories(id) ON DELETE SET NULL,
  expense_type TEXT DEFAULT 'common',
  cow_id INTEGER,
  food_item_id INTEGER,
  food_price_history_id INTEGER,
  food_name_snapshot TEXT,
  unit_type_snapshot TEXT DEFAULT 'kg',
  rate_effective_from TEXT,
  quantity_kg DOUBLE PRECISION DEFAULT 0,
  unit_rate DOUBLE PRECISION DEFAULT 0,
  amount DOUBLE PRECISION DEFAULT 0,
  entry_shift TEXT,
  description TEXT,
  payment_mode TEXT,
  bill_path TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS investments (
  id SERIAL PRIMARY KEY,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id INTEGER,
  title TEXT NOT NULL,
  investment_date TEXT NOT NULL,
  investment_amount DOUBLE PRECISION DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  completed_on TEXT,
  completed_income_amount DOUBLE PRECISION,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investments_status_date ON investments(status, investment_date);

CREATE TABLE IF NOT EXISTS cow_update_history (
  id SERIAL PRIMARY KEY,
  cow_id INTEGER NOT NULL REFERENCES cows(id) ON DELETE CASCADE,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  changes TEXT NOT NULL,
  snapshot TEXT NOT NULL
);

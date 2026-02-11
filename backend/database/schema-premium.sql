-- Premium/Werbefreiheit Schema
-- Erweitert die users-Tabelle um Premium-Status

-- Premium-Felder zur users-Tabelle hinzufügen
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_since TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMP; -- NULL = lebenslang
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_type VARCHAR(50); -- 'lifetime', 'yearly', 'monthly'

-- Index für Premium-Abfragen
CREATE INDEX IF NOT EXISTS idx_users_premium ON users(is_premium);

-- Zahlungs-History (für spätere Payment-Integration)
CREATE TABLE IF NOT EXISTS premium_transactions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    transaction_type VARCHAR(50) NOT NULL,  -- 'purchase', 'renewal', 'refund'
    premium_type VARCHAR(50) NOT NULL,      -- 'lifetime', 'yearly', 'monthly'
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'EUR',
    
    payment_provider VARCHAR(50),           -- 'stripe', 'paypal', 'apple', 'google'
    payment_id VARCHAR(255),                -- Externe Transaction-ID
    
    status VARCHAR(50) DEFAULT 'pending',   -- 'pending', 'completed', 'failed', 'refunded'
    
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_premium_transactions_user ON premium_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_premium_transactions_status ON premium_transactions(status);

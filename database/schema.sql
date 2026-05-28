-- Habilitar extensión para generación de UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUMs
CREATE TYPE merchant_status AS ENUM ('PENDING_KYC', 'ACTIVE', 'SUSPENDED', 'BLOCKED');
CREATE TYPE transaction_status AS ENUM ('PENDING', 'PROCESSING', 'SUCCESSFUL', 'FAILED', 'EXPIRED');

-- 2. Tabla de Comercios (Merchants)
CREATE TABLE merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name VARCHAR(200) NOT NULL,
    nit VARCHAR(20) NOT NULL UNIQUE,
    status merchant_status NOT NULL DEFAULT 'PENDING_KYC',
    commission_scheme JSONB NOT NULL,
    webhook_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Tabla de API Keys
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    key_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'merchant',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabla de Transacciones
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
    order_reference VARCHAR(100) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BOB',
    status transaction_status NOT NULL DEFAULT 'PENDING',
    qr_payload TEXT NOT NULL, -- Cifrado con AES-256
    bank_transaction_id VARCHAR(150),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Restricción para garantizar la idempotencia de order_reference activa por comercio
    CONSTRAINT unique_merchant_active_order UNIQUE (merchant_id, order_reference)
);

-- 5. Tabla de Historial de Estados de Transacciones (transaction_events)
CREATE TABLE transaction_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    from_status transaction_status,
    to_status transaction_status NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tabla de Logs de Webhooks (webhook_logs)
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    http_status INTEGER,
    response_payload TEXT,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Tabla de Logs de Auditoría Inmutables (audit_logs)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Tabla de Cierres de Liquidación (settlement_runs)
CREATE TABLE settlement_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date DATE NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    total_transactions INTEGER NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_commission NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_net_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    unreconciled_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Tabla de Detalles de Liquidación y Conciliación (settlement_details)
CREATE TABLE settlement_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_run_id UUID NOT NULL REFERENCES settlement_runs(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
    order_reference VARCHAR(100),
    bank_transaction_id VARCHAR(150),
    amount NUMERIC(12,2) NOT NULL,
    commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Índices para optimizar consultas de alta carga
CREATE INDEX idx_merchants_status ON merchants(status);
CREATE INDEX idx_api_keys_merchant_active ON api_keys(merchant_id) WHERE is_active = TRUE;
CREATE INDEX idx_transactions_merchant ON transactions(merchant_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_bank_tx ON transactions(bank_transaction_id) WHERE bank_transaction_id IS NOT NULL;
CREATE INDEX idx_webhook_logs_tx ON webhook_logs(transaction_id);
CREATE INDEX idx_transaction_events_tx ON transaction_events(transaction_id);
CREATE INDEX idx_audit_logs_merchant ON audit_logs(merchant_id) WHERE merchant_id IS NOT NULL;
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_settlement_details_run ON settlement_details(settlement_run_id);
CREATE INDEX idx_settlement_details_merchant ON settlement_details(merchant_id);

-- 11. Trigger para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_merchants_updated_at
BEFORE UPDATE ON merchants
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_api_keys_updated_at
BEFORE UPDATE ON api_keys
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

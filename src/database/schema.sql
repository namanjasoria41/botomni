-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_id VARCHAR(100) UNIQUE NOT NULL,
    customer_phone VARCHAR(20) REFERENCES customers(phone),
    shiprocket_order_id VARCHAR(100),
    awb VARCHAR(100),
    status VARCHAR(50),
    courier_name VARCHAR(100),
    product_name TEXT,
    order_date TIMESTAMP,
    expected_delivery TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table (for tracking multi-step interactions)
CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    customer_phone VARCHAR(20) REFERENCES customers(phone),
    state VARCHAR(50),
    context JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table (for tracking all sent messages)
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    customer_phone VARCHAR(20) REFERENCES customers(phone),
    message_type VARCHAR(50), -- 'incoming', 'outgoing', 'broadcast', 'offer'
    message_content TEXT,
    status VARCHAR(50), -- 'sent', 'delivered', 'read', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Broadcasts table (for tracking broadcast campaigns)
CREATE TABLE IF NOT EXISTS broadcasts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    message TEXT,
    segment VARCHAR(100), -- 'all', 'pending_orders', 'delivered', etc.
    total_recipients INTEGER,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Offers table
CREATE TABLE IF NOT EXISTS offers (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    discount_code VARCHAR(50),
    message TEXT,
    sent_to_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_customer_phone ON messages(customer_phone);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

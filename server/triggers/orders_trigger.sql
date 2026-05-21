-- =============================================================================
-- orders_trigger.sql
-- Run this file once against your database to set up the schema, trigger
-- function, and trigger.
--
-- Usage:
--   psql -U <user> -d realtime_orders -f server/triggers/orders_trigger.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create the orders table (idempotent)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    id            SERIAL PRIMARY KEY,
    customer_name VARCHAR(255)  NOT NULL,
    product_name  VARCHAR(255)  NOT NULL,
    status        VARCHAR(50)   NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'shipped', 'delivered')),
    updated_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. Trigger function – fired by PostgreSQL after each DML operation
--    Builds a JSON payload and calls pg_notify() on the "orders_channel".
--
--    Payload shape:
--    {
--      "operation": "INSERT" | "UPDATE" | "DELETE",
--      "data":      { ...row columns... },
--      "timestamp": "2024-01-01T00:00:00.000Z"
--    }
--
--    For DELETE operations NEW is NULL, so we send OLD instead.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION notify_orders_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    payload  JSON;
    row_data JSON;
BEGIN
    -- Choose the relevant row record
    IF (TG_OP = 'DELETE') THEN
        row_data := row_to_json(OLD);
    ELSE
        row_data := row_to_json(NEW);
    END IF;

    -- Build the notification payload
    payload := json_build_object(
        'operation', TG_OP,
        'data',      row_data,
        'timestamp', NOW()
    );

    -- Send the notification on the orders_channel
    PERFORM pg_notify('orders_channel', payload::text);

    -- Triggers must return a row; return the appropriate one
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Attach the trigger to the orders table
--    Drop first so this file is safely re-runnable.
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS orders_change_trigger ON orders;

CREATE TRIGGER orders_change_trigger
AFTER INSERT OR UPDATE OR DELETE
ON orders
FOR EACH ROW
EXECUTE FUNCTION notify_orders_change();

-- -----------------------------------------------------------------------------
-- 4. Sample seed data (optional – comment out if not needed)
-- -----------------------------------------------------------------------------
INSERT INTO orders (customer_name, product_name, status) VALUES
    ('Alice Johnson',  'Wireless Keyboard',  'pending'),
    ('Bob Smith',      'Mechanical Mouse',   'shipped'),
    ('Carol Williams', 'USB-C Hub',          'delivered'),
    ('David Brown',    '4K Monitor',         'pending'),
    ('Eva Martinez',   'Laptop Stand',       'shipped')
ON CONFLICT DO NOTHING;

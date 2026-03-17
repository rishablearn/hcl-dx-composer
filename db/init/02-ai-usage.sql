-- -----------------------------------------------------------------------------
-- AI Usage Tracking
-- Track credits and tokens consumed by AI providers
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    operation VARCHAR(50) NOT NULL DEFAULT 'image_generation',
    
    -- Token/Credit tracking
    credits_used DECIMAL(10,4) DEFAULT 0,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    
    -- Request details
    prompt_length INTEGER DEFAULT 0,
    images_generated INTEGER DEFAULT 1,
    image_size VARCHAR(20),
    
    -- Cost estimation (in USD)
    estimated_cost DECIMAL(10,6) DEFAULT 0,
    
    -- Metadata
    request_metadata JSONB DEFAULT '{}',
    response_metadata JSONB DEFAULT '{}',
    
    -- Status
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_usage_user ON ai_usage(user_id);
CREATE INDEX idx_ai_usage_provider ON ai_usage(provider);
CREATE INDEX idx_ai_usage_created ON ai_usage(created_at DESC);

-- -----------------------------------------------------------------------------
-- AI Provider Budgets
-- Set monthly budgets and limits per provider
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_provider_budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL UNIQUE,
    
    -- Monthly limits
    monthly_credit_limit DECIMAL(10,2) DEFAULT 100.00,
    monthly_request_limit INTEGER DEFAULT 1000,
    
    -- Current period usage
    current_period_start DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE),
    current_credits_used DECIMAL(10,4) DEFAULT 0,
    current_requests INTEGER DEFAULT 0,
    
    -- Alert thresholds (percentage)
    alert_threshold INTEGER DEFAULT 80,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default budgets for known providers
INSERT INTO ai_provider_budgets (provider, monthly_credit_limit, monthly_request_limit) VALUES
    ('openai', 50.00, 500),
    ('stability', 25.00, 250),
    ('pollinations', 0.00, 10000)  -- Free provider
ON CONFLICT (provider) DO NOTHING;

CREATE TRIGGER update_ai_provider_budgets_updated_at BEFORE UPDATE ON ai_provider_budgets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- View for usage summary
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW ai_usage_summary AS
SELECT 
    provider,
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as total_requests,
    SUM(credits_used) as total_credits,
    SUM(estimated_cost) as total_cost,
    SUM(images_generated) as total_images,
    COUNT(DISTINCT user_id) as unique_users
FROM ai_usage
WHERE success = true
GROUP BY provider, DATE_TRUNC('month', created_at)
ORDER BY month DESC, provider;

-- -----------------------------------------------------------------------------
-- View for user usage summary
-- -----------------------------------------------------------------------------

CREATE OR REPLACE VIEW ai_user_usage_summary AS
SELECT 
    u.id as user_id,
    u.username,
    au.provider,
    DATE_TRUNC('month', au.created_at) as month,
    COUNT(*) as total_requests,
    SUM(au.credits_used) as total_credits,
    SUM(au.estimated_cost) as total_cost,
    SUM(au.images_generated) as total_images
FROM ai_usage au
JOIN users u ON au.user_id = u.id
WHERE au.success = true
GROUP BY u.id, u.username, au.provider, DATE_TRUNC('month', au.created_at)
ORDER BY month DESC, total_credits DESC;

-- Enterprises / IMOs - organizations that can view assigned agents
CREATE TABLE enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Which agents are assigned to each enterprise
CREATE TABLE enterprise_agents (
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  PRIMARY KEY (enterprise_id, agent_id)
);

-- Enterprise users (Clerk users who can log in and view the enterprise)
CREATE TABLE enterprise_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enterprise_agents_enterprise ON enterprise_agents(enterprise_id);
CREATE INDEX idx_enterprise_agents_agent ON enterprise_agents(agent_id);
CREATE INDEX idx_enterprise_users_enterprise ON enterprise_users(enterprise_id);
CREATE INDEX idx_enterprise_users_clerk ON enterprise_users(clerk_user_id);

ALTER TABLE enterprises ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_users ENABLE ROW LEVEL SECURITY;

-- Allow all for development (same as other tables)
CREATE POLICY "Allow all on enterprises" ON enterprises FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on enterprise_agents" ON enterprise_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on enterprise_users" ON enterprise_users FOR ALL USING (true) WITH CHECK (true);

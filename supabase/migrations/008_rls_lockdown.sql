-- Lock down RLS: remove permissive "allow all" policies.
-- The app uses SUPABASE_SERVICE_ROLE_KEY on the server, which bypasses RLS.
-- Without policies, anon key gets no access (deny by default).
-- Run this before going live.

DROP POLICY IF EXISTS "Allow all on agents" ON agents;
DROP POLICY IF EXISTS "Allow all on rollups" ON rollups;
DROP POLICY IF EXISTS "Allow all on agent_rollups" ON agent_rollups;
DROP POLICY IF EXISTS "Allow all on appointments" ON appointments;
DROP POLICY IF EXISTS "Allow all on no_show_evidence" ON no_show_evidence;
DROP POLICY IF EXISTS "Allow all on enterprises" ON enterprises;
DROP POLICY IF EXISTS "Allow all on enterprise_agents" ON enterprise_agents;
DROP POLICY IF EXISTS "Allow all on enterprise_users" ON enterprise_users;

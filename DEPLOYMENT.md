# Step-by-Step Deployment Guide

Follow these steps in order. Do not skip steps.

---

## Part A: Supabase Setup

### Step A1: Get Supabase project URL and keys

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click your project (or create one).
3. In the left sidebar, click **Project Settings** (gear icon at the bottom).
4. Click **API** in the left menu.
5. Copy and save these three values:
   - **Project URL** (e.g. `https://abcdefgh.supabase.co`)
   - **anon public** key (starts with `eyJ...` – click "Reveal" if hidden)
   - **service_role** key (starts with `eyJ...` – click "Reveal" if hidden)

### Step A2: Run migration 001 (initial schema)

1. In Supabase Dashboard, click **SQL Editor** in the left sidebar.
2. Click **+ New query**.
3. Paste this SQL and run it:

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emails TEXT[] DEFAULT '{}',
  show_rate_override_threshold DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rollups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE agent_rollups (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  rollup_id UUID REFERENCES rollups(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, rollup_id)
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  prospect_email TEXT,
  appointment_datetime TIMESTAMPTZ NOT NULL,
  timezone TEXT DEFAULT 'UTC',
  age_raw TEXT,
  assets_raw TEXT,
  status TEXT NOT NULL DEFAULT 'Confirmed' CHECK (status IN (
    'Confirmed', 'Show', 'No-Show (Approved)', 'Rescheduled',
    'Canceled', 'Invalid', 'Duplicate', 'Test', 'Other'
  )),
  is_final_instance BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_agent_id ON appointments(agent_id);
CREATE INDEX idx_appointments_datetime ON appointments(appointment_datetime);
CREATE INDEX idx_appointments_status ON appointments(status);

CREATE TABLE no_show_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_no_show_evidence_appointment ON no_show_evidence(appointment_id);

ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE no_show_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on agents" ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on rollups" ON rollups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on agent_rollups" ON agent_rollups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on appointments" ON appointments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on no_show_evidence" ON no_show_evidence FOR ALL USING (true) WITH CHECK (true);
```

4. Click **Run** (or press Ctrl+Enter).
5. Confirm you see "Success. No rows returned."

### Step A3: Run migration 002

1. In SQL Editor, click **+ New query** again.
2. Paste this SQL and run it:

```sql
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT;
```

### Step A4: Run migration 004

1. New query, paste and run:

```sql
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN (
  'Confirmed', 'Show', 'No-Show (Approved)', 'No-Show (Pending)', 'Rescheduled',
  'Canceled', 'Invalid', 'Duplicate', 'Test', 'Other'
));
```

### Step A5: Run migration 005

1. New query, paste and run:

```sql
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true NOT NULL;
```

### Step A6: Run migration 006

1. New query, paste and run:

```sql
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS prospect_questions TEXT;
```

### Step A7: Run migration 007 (enterprises)

1. New query, paste and run this SQL:

```sql
CREATE TABLE enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE enterprise_agents (
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  PRIMARY KEY (enterprise_id, agent_id)
);

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

CREATE POLICY "Allow all on enterprises" ON enterprises FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on enterprise_agents" ON enterprise_agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on enterprise_users" ON enterprise_users FOR ALL USING (true) WITH CHECK (true);
```

### Step A8: Create storage bucket for no-show evidence

1. In Supabase, click **Storage** in the left sidebar.
2. Click **New bucket**.
3. Name: `no-show-evidence`
4. Toggle **Public bucket** ON.
5. Click **Create bucket**.

---

## Part B: Clerk Setup (Production)

### Step B1: Create or switch to production instance

1. Go to [https://dashboard.clerk.com](https://dashboard.clerk.com).
2. If you only have a development instance, create a production one: click your app → **Domains** → **Add production domain**.
3. Or use **Switch application** to select your production app.

### Step B2: Get production API keys

1. In Clerk Dashboard, click **API Keys** in the left sidebar.
2. Use the keys under **Production** (or your main instance):
   - Copy **Publishable key** (starts with `pk_live_`)
   - Copy **Secret key** (starts with `sk_live_`)

### Step B3: Add your production domain

1. In Clerk, click **Domains** (or **Configure** → **Paths**).
2. Add your production domain (e.g. `yourdomain.com` or `your-app.vercel.app`).
3. Save.

### Step B4: Make yourself an admin

1. Sign up or sign in to your app using your admin email.
2. In Clerk Dashboard, click **Users** in the left sidebar.
3. Click your user.
4. Scroll to **Public metadata**.
5. Click **Edit**.
6. Add this (exactly):

```json
{"role": "revenx_admin"}
```

7. Click **Save**.

---

## Part C: Vercel Deployment

### Step C1: Push code to GitHub

1. Create a repo on [github.com](https://github.com) if you have not.
2. In your project folder, run:
   ```bash
   git init
   git add .
   git commit -m "Initial deploy"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

### Step C2: Import project in Vercel

1. Go to [https://vercel.com](https://vercel.com) and sign in.
2. Click **Add New** → **Project**.
3. Import your GitHub repo.
4. Before deploying, click **Environment Variables**.

### Step C3: Add environment variables in Vercel

Add these one by one. For each: Name = left side, Value = right side. Select **Production** (and Preview if you want).

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Your Clerk publishable key (`pk_live_...`) |
| `CLERK_SECRET_KEY` | Your Clerk secret key (`sk_live_...`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service_role key |

Click **Save** after each. When done, click **Deploy**.

### Step C4: Get your deployment URL

1. After deploy finishes, Vercel shows your URL (e.g. `https://your-app-xxx.vercel.app`).
2. Copy it.

---

## Part D: Final Clerk and Supabase Config

### Step D1: Add Vercel URL to Clerk

1. In Clerk Dashboard, go to **Domains**.
2. Add your Vercel URL (e.g. `https://your-app-xxx.vercel.app`) if not already added.

### Step D2: Run migration 008 (RLS lockout)

**Important:** Only do this after `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel (Step C3).

1. In Supabase, open **SQL Editor**.
2. Click **+ New query**.
3. Paste and run:

```sql
DROP POLICY IF EXISTS "Allow all on agents" ON agents;
DROP POLICY IF EXISTS "Allow all on rollups" ON rollups;
DROP POLICY IF EXISTS "Allow all on agent_rollups" ON agent_rollups;
DROP POLICY IF EXISTS "Allow all on appointments" ON appointments;
DROP POLICY IF EXISTS "Allow all on no_show_evidence" ON no_show_evidence;
DROP POLICY IF EXISTS "Allow all on enterprises" ON enterprises;
DROP POLICY IF EXISTS "Allow all on enterprise_agents" ON enterprise_agents;
DROP POLICY IF EXISTS "Allow all on enterprise_users" ON enterprise_users;
```

---

## Part E: Verify Deployment

### Step E1: Test the live site

1. Open your Vercel URL in a browser.
2. Click **Sign In**.
3. Sign in with your admin email.
4. Confirm you see **Admin** on the home page.
5. Click **Admin** and confirm you can open the admin dashboard.

### Step E2: Test admin features

1. In Admin, go to the **Agents** tab.
2. Add a test agent (name + email).
3. Go to **Appointments** tab and confirm it loads.
4. Go to **Enterprises** tab and create a test enterprise.

### Step E3: Test agent access (optional)

1. In Admin → Agents, add an agent with your personal email (or another test email).
2. Sign out.
3. Sign in with that agent’s email.
4. Confirm you see **Agent Dashboard** and can open `/dashboard`.

---

## Troubleshooting

**"Missing Supabase env vars"**

- Check that all five Supabase/Clerk env vars are set in Vercel.
- Redeploy after changing env vars.

**"Unauthorized" or can’t access Admin**

- In Clerk Dashboard → Users → your user → Public metadata must contain exactly: `{"role": "revenx_admin"}`.

**Database errors after running migration 008**

- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel.
- Redeploy the app.

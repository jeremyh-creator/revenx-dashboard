# Supabase Storage Setup – No-Show Evidence

The evidence upload feature requires a storage bucket. Create it in Supabase:

## Steps

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) and open your project.
2. Click **Storage** in the left sidebar.
3. Click **New bucket**.
4. Enter:
   - **Name:** `no-show-evidence`
   - **Public bucket:** Toggle **ON** (so evidence links can be viewed)
5. Click **Create bucket**.

## Storage policies

After creating the bucket, add policies:

1. In the bucket row, click the **policies** icon (or go to Storage → Policies).
2. Add a policy to allow uploads, for example:
   - **Policy name:** Allow uploads
   - **Allowed operation:** INSERT
   - **Target roles:** `authenticated` or `anon` (depending on your RLS setup)
   - **Policy definition:** `bucket_id = 'no-show-evidence'` (or leave blank for development)

For development you can enable "Allow public access" on the bucket if uploads still fail.

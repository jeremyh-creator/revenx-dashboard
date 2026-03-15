import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export type Agent = {
  id: string;
  name: string;
  emails: string[] | null;
  show_rate_override_threshold: number | null;
  created_at: string;
};

export type AuthWithAgent = {
  userId: string;
  agent: Agent;
};

/**
 * Gets the current Clerk user and looks up their linked agent in Supabase.
 * Matches by checking if any of the user's Clerk emails are in the agent's emails array.
 *
 * Returns null if user is not signed in, or if no agent matches their emails.
 * Callers should redirect to /unauthorized when agent is null on protected routes.
 */
export async function getAuthWithAgent(): Promise<AuthWithAgent | null> {
  const user = await currentUser();
  if (!user) return null;

  const emails = user.emailAddresses
    .map((ea) => ea.emailAddress?.toLowerCase())
    .filter(Boolean) as string[];

  if (emails.length === 0) return null;

  const supabase = await createClient();

  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, name, emails, show_rate_override_threshold, created_at, is_active")
    .overlaps("emails", emails)
    .limit(1)
    .maybeSingle();

  if (error || !agent || agent.is_active === false) return null;

  return {
    userId: user.id,
    agent: agent as Agent,
  };
}

export type AdminAuth = {
  userId: string;
  role: string;
};

/**
 * Gets the current user if they have admin role (revenx_admin).
 * Check publicMetadata.role in Clerk Dashboard.
 */
export async function getAdminAuth(): Promise<AdminAuth | null> {
  const user = await currentUser();
  if (!user) return null;

  const role = (user.publicMetadata?.role as string) ?? "";
  if (role !== "revenx_admin") return null;

  return { userId: user.id, role };
}

export type EnterpriseAuth = {
  userId: string;
  enterpriseId: string;
  enterpriseName: string;
  agentIds: string[];
};

/**
 * Gets the current user if they have enterprise role.
 * publicMetadata.role === "enterprise" and enterprise_id set.
 * Returns enterprise info and assigned agent IDs.
 */
export async function getEnterpriseAuth(): Promise<EnterpriseAuth | null> {
  const user = await currentUser();
  if (!user) return null;

  const role = (user.publicMetadata?.role as string) ?? "";
  const enterpriseId = (user.publicMetadata?.enterprise_id as string) ?? "";
  if (role !== "enterprise" || !enterpriseId) return null;

  const supabase = await createClient();
  const { data: eu } = await supabase
    .from("enterprise_users")
    .select("enterprise_id")
    .eq("clerk_user_id", user.id)
    .maybeSingle();
  if (!eu) return null;

  const { data: enterprise } = await supabase
    .from("enterprises")
    .select("id, name")
    .eq("id", enterpriseId)
    .single();
  if (!enterprise) return null;

  const { data: agentRows } = await supabase
    .from("enterprise_agents")
    .select("agent_id")
    .eq("enterprise_id", enterpriseId);
  const agentIds = (agentRows ?? []).map((r) => r.agent_id);

  return {
    userId: user.id,
    enterpriseId: enterprise.id,
    enterpriseName: enterprise.name,
    agentIds,
  };
}

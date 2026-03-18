"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { getAdminAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const VALID_STATUSES = [
  "Confirmed",
  "Show",
  "No-Show (Approved)",
  "No-Show (Pending)",
  "Rescheduled",
  "Canceled",
  "Invalid",
  "Duplicate",
  "Test",
  "Other",
] as const;

export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: string
) {
  const admin = await getAdminAuth();
  if (!admin) {
    return { error: "Unauthorized" };
  }

  if (!VALID_STATUSES.includes(newStatus as (typeof VALID_STATUSES)[number])) {
    return { error: "Invalid status" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("appointments")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appointmentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function addAgent(name: string, emails: string[]) {
  const admin = await getAdminAuth();
  if (!admin) {
    return { error: "Unauthorized" };
  }

  if (!name.trim()) {
    return { error: "Name is required" };
  }
  if (emails.length === 0) {
    return { error: "At least one email is required" };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("agents").insert({
    name: name.trim(),
    emails,
    is_active: true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function updateAgent(
  agentId: string,
  updates: { name?: string; emails?: string[] }
) {
  const admin = await getAdminAuth();
  if (!admin) return { error: "Unauthorized" };

  const supabase = await createClient();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name != null && updates.name.trim()) {
    payload.name = updates.name.trim();
  }
  if (updates.emails != null) {
    payload.emails = updates.emails
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  if (Object.keys(payload).length <= 1) return { error: "No updates provided" };

  const { error } = await supabase
    .from("agents")
    .update(payload)
    .eq("id", agentId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function setAgentActive(agentId: string, isActive: boolean) {
  const admin = await getAdminAuth();
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("agents")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin");
  return { success: true };
}

export async function mergeAgents(
  primaryAgentId: string,
  secondaryAgentId: string
) {
  const admin = await getAdminAuth();
  if (!admin) return { error: "Unauthorized" };
  if (primaryAgentId === secondaryAgentId) {
    return { error: "Cannot merge an agent with itself" };
  }

  const supabase = await createClient();

  const { data: primary, error: primaryErr } = await supabase
    .from("agents")
    .select("id, name, emails")
    .eq("id", primaryAgentId)
    .single();
  const { data: secondary, error: secondaryErr } = await supabase
    .from("agents")
    .select("id, name, emails")
    .eq("id", secondaryAgentId)
    .single();

  if (primaryErr || !primary || secondaryErr || !secondary) {
    return { error: "One or both agents not found" };
  }

  const primaryEmails = new Set((primary.emails ?? []) as string[]);
  const secondaryEmails = (secondary.emails ?? []) as string[];
  secondaryEmails.forEach((e) => primaryEmails.add(e.toLowerCase().trim()));

  const { error: updateAppts } = await supabase
    .from("appointments")
    .update({ agent_id: primaryAgentId })
    .eq("agent_id", secondaryAgentId);

  if (updateAppts) return { error: updateAppts.message };

  const { data: secondaryRollups } = await supabase
    .from("agent_rollups")
    .select("rollup_id")
    .eq("agent_id", secondaryAgentId);

  for (const r of secondaryRollups ?? []) {
    await supabase.from("agent_rollups").upsert(
      { agent_id: primaryAgentId, rollup_id: r.rollup_id },
      { onConflict: "agent_id,rollup_id", ignoreDuplicates: true }
    );
  }
  await supabase.from("agent_rollups").delete().eq("agent_id", secondaryAgentId);

  const { error: updatePrimary } = await supabase
    .from("agents")
    .update({
      emails: Array.from(primaryEmails),
      updated_at: new Date().toISOString(),
    })
    .eq("id", primaryAgentId);

  if (updatePrimary) return { error: updatePrimary.message };

  const { error: deactivateSecondary } = await supabase
    .from("agents")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", secondaryAgentId);

  if (deactivateSecondary) return { error: deactivateSecondary.message };

  revalidatePath("/admin");
  return { success: true };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      current += c;
    } else if (c === "," || c === ";" || c === "\t") {
      result.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

export async function uploadAppointmentsCsv(
  csvText: string,
  columnMapping: Record<string, string>,
  externalSource: "calendly" | "custom"
): Promise<{ imported: number; errors: string[] }> {
  const admin = await getAdminAuth();
  if (!admin) {
    return { imported: 0, errors: ["Unauthorized"] };
  }

  const agentEmailKey = columnMapping["agent_email"];
  const agentNameKey = columnMapping["agent_name"];
  const datetimeKey = columnMapping["appointment_datetime"];
  if (!datetimeKey) {
    return { imported: 0, errors: ["appointment_datetime mapping is required"] };
  }
  const externalIdKey = columnMapping["external_id"];
  if (!externalIdKey) {
    return { imported: 0, errors: ["external_id mapping is required"] };
  }
  if (!agentEmailKey && !agentNameKey) {
    return { imported: 0, errors: ["Map either agent_email or agent_name"] };
  }
  if (externalSource !== "calendly" && externalSource !== "custom") {
    return { imported: 0, errors: ["Invalid externalSource"] };
  }

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { imported: 0, errors: ["CSV must have a header row and at least one data row"] };
  }

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine);
  const headerIndex = new Map(headers.map((h, i) => [h.trim(), i]));

  const supabase = await createClient();

  // Preload all agents once for fast in-memory lookups
  const { data: allAgents } = await supabase
    .from("agents")
    .select("id, name, emails")
    .order("name");
  const emailToAgentId = new Map<string, string>();
  const nameToAgentId = new Map<string, string>();
  for (const a of allAgents ?? []) {
    if (a.name) {
      nameToAgentId.set(String(a.name).toLowerCase().trim(), a.id as string);
    }
    for (const e of (a.emails ?? []) as string[]) {
      emailToAgentId.set(e.toLowerCase().trim(), a.id as string);
    }
  }

  function getAgentIdByEmail(email: string): string | null {
    const normalized = email.toLowerCase().trim();
    return emailToAgentId.get(normalized) ?? null;
  }

  function getAgentIdByName(name: string): string | null {
    const trimmed = name.toLowerCase().trim();
    return nameToAgentId.get(trimmed) ?? null;
  }

  const STATUS_MAP: Record<string, string> = {
    cancelled: "Canceled",
    canceled: "Canceled",
    noshow: "No-Show (Approved)",
    "no-show": "No-Show (Approved)",
    "no show": "No-Show (Approved)",
    showed: "Show",
    show: "Show",
    confirmed: "Confirmed",
    invalid: "Invalid",
    rescheduled: "Rescheduled",
    duplicate: "Duplicate",
    test: "Test",
    other: "Other",
  };

  let imported = 0;
  const errors: string[] = [];

  // Batch rows to reduce round-trips and handle large files better
  const batchSize = 500;
  let pendingRows: {
    row: {
      agent_id: string;
      prospect_email: string | null;
      first_name: string | null;
      last_name: string | null;
      name: string | null;
      appointment_datetime: string;
      age_raw: string | null;
      assets_raw: string | null;
      utm_source: string | null;
      prospect_questions: string | null;
      external_source: string;
      external_id: string;
      status: string;
      is_final_instance: boolean;
    };
    lineNumber: number;
  }[] = [];

  async function flushBatch() {
    if (pendingRows.length === 0) return;

    // Upsert by external_source+external_id so re-imports (or cancel updates) don't create duplicates.
    const { data, error } = await supabase
      .from("appointments")
      .upsert(pendingRows.map((p) => p.row), {
        onConflict: "external_source,external_id",
      })
      .select("id");
    if (error) {
      // If batch insert fails, fall back to per-row inserts to capture row-level errors
      for (const p of pendingRows) {
        const { error: rowError } = await supabase
          .from("appointments")
          .upsert(p.row, {
            onConflict: "external_source,external_id",
          });
        if (rowError) {
          errors.push(`Row ${p.lineNumber}: ${rowError.message}`);
        } else {
          imported++;
        }
      }
    } else {
      imported += data?.length ?? pendingRows.length;
    }
    pendingRows = [];
  }

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length && values.every((v) => !v)) continue;

    const getVal = (dbKey: string) => {
      const csvCol = columnMapping[dbKey];
      if (!csvCol) return null;
      const idx = headerIndex.get(csvCol);
      if (idx === undefined) return null;
      const v = values[idx];
      return v != null && v !== "" ? v : null;
    };

    const agentEmailRaw = getVal("agent_email");
    const agentNameRaw = getVal("agent_name");
    const datetimeRaw = getVal("appointment_datetime");
    const externalIdRaw = getVal("external_id");
    if (!datetimeRaw) {
      errors.push(`Row ${i + 1}: missing appointment date/time`);
      continue;
    }
    if (!agentEmailRaw && !agentNameRaw) {
      errors.push(`Row ${i + 1}: missing agent email or agent name`);
      continue;
    }

    let agentId: string | null = null;
    if (agentEmailRaw) {
      agentId = getAgentIdByEmail(agentEmailRaw);
    }
    if (!agentId && agentNameRaw) {
      agentId = getAgentIdByName(agentNameRaw);
    }
    if (!agentId) {
      errors.push(
        `Row ${i + 1}: agent not found for "${agentEmailRaw || agentNameRaw}" (create the agent first or use agent email to auto-create)`
      );
      continue;
    }
    if (!externalIdRaw) {
      errors.push(`Row ${i + 1}: missing external event ID (external_id)`);
      continue;
    }

    let appointmentDatetime: string;
    if (!/^\d{4}-\d{2}-\d{2}T/.test(datetimeRaw)) {
      const d = new Date(datetimeRaw);
      if (isNaN(d.getTime())) {
        errors.push(`Row ${i + 1}: invalid date "${datetimeRaw}"`);
        continue;
      }
      appointmentDatetime = d.toISOString();
    } else {
      appointmentDatetime = datetimeRaw;
    }

    const statusRaw = (getVal("status") ?? "").toLowerCase().trim();
    const status =
      STATUS_MAP[statusRaw] ??
      (statusRaw && VALID_STATUSES.includes(statusRaw as any) ? statusRaw : "Confirmed");

    const row = {
      agent_id: agentId,
      prospect_email: getVal("prospect_email"),
      first_name: getVal("prospect_first_name"),
      last_name: getVal("prospect_last_name"),
      name: getVal("prospect_name"),
      appointment_datetime: appointmentDatetime,
      age_raw: getVal("age_raw"),
      assets_raw: getVal("assets_raw"),
      utm_source: getVal("utm_source"),
      prospect_questions: getVal("prospect_questions"),
      external_source: externalSource,
      external_id: externalIdRaw,
      status,
      is_final_instance: true,
    };

    pendingRows.push({ row, lineNumber: i + 1 });
    if (pendingRows.length >= batchSize) {
      await flushBatch();
    }
  }

  await flushBatch();

  revalidatePath("/admin");
  return { imported, errors };
}

// ——— Enterprise / IMO ———

export async function createEnterprise(name: string) {
  const admin = await getAdminAuth();
  if (!admin) return { error: "Unauthorized" };
  if (!name.trim()) return { error: "Name is required" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enterprises")
    .insert({ name: name.trim() })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true, enterpriseId: data?.id };
}

export async function addEnterpriseAgent(enterpriseId: string, agentId: string) {
  const admin = await getAdminAuth();
  if (!admin) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("enterprise_agents")
    .upsert(
      { enterprise_id: enterpriseId, agent_id: agentId },
      { onConflict: "enterprise_id,agent_id", ignoreDuplicates: true }
    );

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function removeEnterpriseAgent(enterpriseId: string, agentId: string) {
  const admin = await getAdminAuth();
  if (!admin) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("enterprise_agents")
    .delete()
    .eq("enterprise_id", enterpriseId)
    .eq("agent_id", agentId);

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function createEnterpriseUser(
  enterpriseId: string,
  email: string,
  password: string
) {
  const admin = await getAdminAuth();
  if (!admin) return { error: "Unauthorized" };

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) return { error: "Email is required" };
  if (!password || password.length < 8) return { error: "Password must be at least 8 characters" };

  const supabase = await createClient();
  const { data: enterprise } = await supabase
    .from("enterprises")
    .select("id, name")
    .eq("id", enterpriseId)
    .single();
  if (!enterprise) return { error: "Enterprise not found" };

  const client = await clerkClient();
  let clerkUser;
  try {
    clerkUser = await client.users.createUser({
      emailAddress: [trimmedEmail],
      password,
      publicMetadata: {
        role: "enterprise",
        enterprise_id: enterpriseId,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create user in Clerk";
    return { error: msg };
  }

  const { error } = await supabase.from("enterprise_users").insert({
    enterprise_id: enterpriseId,
    clerk_user_id: clerkUser.id,
    email: trimmedEmail,
  });

  if (error) return { error: error.message };
  revalidatePath("/admin");
  return { success: true };
}

export async function deleteEnterpriseUser(enterpriseUserId: string) {
  const admin = await getAdminAuth();
  if (!admin) return { error: "Unauthorized" };

  const supabase = await createClient();
  const { data: eu, error: fetchErr } = await supabase
    .from("enterprise_users")
    .select("clerk_user_id")
    .eq("id", enterpriseUserId)
    .single();

  if (fetchErr || !eu) return { error: "Enterprise user not found" };

  const client = await clerkClient();
  try {
    await client.users.deleteUser(eu.clerk_user_id);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete user from Clerk";
    return { error: msg };
  }

  const { error: deleteErr } = await supabase
    .from("enterprise_users")
    .delete()
    .eq("id", enterpriseUserId);

  if (deleteErr) return { error: deleteErr.message };
  revalidatePath("/admin");
  return { success: true };
}

/**
 * Reconcile appointments older than N days:
 * - If status is still "Confirmed", update it to "Show".
 *
 * This is useful after bulk historical uploads, since the auto-flip only runs
 * when an agent visits their dashboard.
 */
export async function reconcileConfirmedToShow(
  windowDays: number = 14
): Promise<{ updated: number } | { error: string }> {
  const admin = await getAdminAuth();
  if (!admin) return { error: "Unauthorized" };

  const days = Number(windowDays);
  if (!Number.isFinite(days) || days < 0) {
    return { error: "Invalid windowDays" };
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("status", "Confirmed")
    .lt("appointment_datetime", cutoffDate.toISOString());

  if (countError) return { error: countError.message };

  const { error: updateError } = await supabase
    .from("appointments")
    .update({
      status: "Show",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "Confirmed")
    .lt("appointment_datetime", cutoffDate.toISOString());

  if (updateError) return { error: updateError.message };

  revalidatePath("/admin");
  return { updated: count ?? 0 };
}

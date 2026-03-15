import { createClient } from "@/lib/supabase/server";

export const GLOBAL_SHOW_RATE_THRESHOLD = 60; // percent
export const NO_SHOW_EVIDENCE_MIN_COUNT = 10; // evidence not required until agent has 10+ no-shows

export type ShowRateResult = {
  shows: number;
  noShows: number;
  showRatePercent: number | null;
  threshold: number;
  requiresEvidence: boolean;
};

/** Simplified show rate for a time window (no threshold/evidence). */
export type ShowRateWindow = {
  shows: number;
  noShows: number;
  showRatePercent: number | null;
};

export type ShowRatesRolling = {
  last30: ShowRateWindow;
  last60: ShowRateWindow;
  last90: ShowRateWindow;
};

export type Age50PlusWindow = {
  count: number;
  total: number;
  percent: number | null;
};

export type Age50PlusStats = {
  last30: Age50PlusWindow;
  last60: Age50PlusWindow;
  last90: Age50PlusWindow;
  lifetime: Age50PlusWindow;
};

/**
 * Returns true if age_raw indicates the prospect is 50 or older.
 * Handles: "52", "50", "50-55", "50+", "50 on up", "50 and up", "50+ only", etc.
 */
export function isAge50OrUp(ageRaw: string | null | undefined): boolean {
  if (ageRaw == null || String(ageRaw).trim() === "") return false;
  const s = String(ageRaw).trim().toLowerCase();
  // Explicit \"below\" -> always treat as under 50
  if (s.includes("below")) return false;
  // Explicit \"above\" -> always treat as 50+
  if (s.includes("above")) return true;
  // Explicit "50 on up" / "50 and up" / "50+"
  if (/\b50\s*(and|on)\s*up\b/.test(s) || /^50\+?$/.test(s) || s === "50+") return true;
  // Single number >= 50
  const single = /^\s*(\d+)\s*$/.exec(s);
  if (single) return parseInt(single[1], 10) >= 50;
  // Range: "50-55", "50 - 60", "50 to 65"
  const numbers = s.match(/\d+/g);
  if (numbers?.length) {
    const nums = numbers.map((n) => parseInt(n, 10));
    if (nums.some((n) => n >= 50)) return true;
  }
  return false;
}

/**
 * Get agent's show rate and whether evidence is required for no-shows.
 * Show rate = shows / (shows + no-shows). Agents with rate >= threshold don't need evidence.
 */
export async function getAgentShowRate(agentId: string): Promise<ShowRateResult> {
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("show_rate_override_threshold")
    .eq("id", agentId)
    .single();

  const threshold =
    agent?.show_rate_override_threshold ?? GLOBAL_SHOW_RATE_THRESHOLD;

  const { data: appointments } = await supabase
    .from("appointments")
    .select("status")
    .eq("agent_id", agentId)
    .in("status", ["Show", "No-Show (Approved)"]);

  const shows = appointments?.filter((a) => a.status === "Show").length ?? 0;
  const noShows =
    appointments?.filter((a) => a.status === "No-Show (Approved)").length ?? 0;
  const total = shows + noShows;

  const showRatePercent =
    total > 0 ? Math.round((shows / total) * 100) : null;

  // Evidence not required until agent has 10+ no-shows; then threshold applies
  const requiresEvidence =
    noShows >= NO_SHOW_EVIDENCE_MIN_COUNT &&
    (showRatePercent === null || showRatePercent < threshold);

  return {
    shows,
    noShows,
    showRatePercent,
    threshold,
    requiresEvidence,
  };
}

function toWindow(shows: number, noShows: number): ShowRateWindow {
  const total = shows + noShows;
  const showRatePercent = total > 0 ? Math.round((shows / total) * 100) : null;
  return { shows, noShows, showRatePercent };
}

/**
 * Get show rate for the last 30, 60, and 90 days (Show + No-Show Approved only).
 */
export async function getAgentShowRatesRolling(
  agentId: string
): Promise<ShowRatesRolling> {
  const supabase = await createClient();
  const now = new Date();

  const ranges = [
    { days: 30, key: "last30" as const },
    { days: 60, key: "last60" as const },
    { days: 90, key: "last90" as const },
  ];

  const result: ShowRatesRolling = {
    last30: { shows: 0, noShows: 0, showRatePercent: null },
    last60: { shows: 0, noShows: 0, showRatePercent: null },
    last90: { shows: 0, noShows: 0, showRatePercent: null },
  };

  for (const { days, key } of ranges) {
    const since = new Date(now);
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("appointments")
      .select("status")
      .eq("agent_id", agentId)
      .in("status", ["Show", "No-Show (Approved)"])
      .gte("appointment_datetime", since.toISOString())
      .lte("appointment_datetime", now.toISOString());

    const shows = data?.filter((a) => a.status === "Show").length ?? 0;
    const noShows =
      data?.filter((a) => a.status === "No-Show (Approved)").length ?? 0;
    result[key] = toWindow(shows, noShows);
  }

  return result;
}

/**
 * Get percentage of appointments that are 50+ (by age_raw) for last 30, 60, 90 days and lifetime.
 */
export async function getAgentAge50PlusStats(
  agentId: string
): Promise<Age50PlusStats> {
  const supabase = await createClient();
  const now = new Date();

  const ranges: { days: number | null; key: keyof Age50PlusStats }[] = [
    { days: 30, key: "last30" },
    { days: 60, key: "last60" },
    { days: 90, key: "last90" },
    { days: null, key: "lifetime" },
  ];

  const result: Age50PlusStats = {
    last30: { count: 0, total: 0, percent: null },
    last60: { count: 0, total: 0, percent: null },
    last90: { count: 0, total: 0, percent: null },
    lifetime: { count: 0, total: 0, percent: null },
  };

  for (const { days, key } of ranges) {
    let query = supabase
      .from("appointments")
      .select("age_raw")
      .eq("agent_id", agentId);

    if (days != null) {
      const since = new Date(now);
      since.setDate(since.getDate() - days);
      since.setHours(0, 0, 0, 0);
      query = query
        .gte("appointment_datetime", since.toISOString())
        .lte("appointment_datetime", now.toISOString());
    }

    const { data } = await query;
    const total = data?.length ?? 0;
    const count = data?.filter((a) => isAge50OrUp(a.age_raw)).length ?? 0;
    const percent = total > 0 ? Math.round((count / total) * 100) : null;
    result[key] = { count, total, percent };
  }

  return result;
}

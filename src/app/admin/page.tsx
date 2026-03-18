import { getAdminAuth } from "@/lib/auth";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminAgentsSection } from "./AdminAgentsSection";
import {
  AdminAppointmentsTable,
  type Appointment as AdminTableAppointment,
} from "./AdminAppointmentsTable";
import { AdminAppointmentsPagination } from "./AdminAppointmentsPagination";
import { AdminCsvUpload } from "./AdminCsvUpload";
import { AdminEnterprisesSection } from "./AdminEnterprisesSection";
import { isAge50OrUp } from "@/lib/showRate";

const ALL_STATUSES = [
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

const PAGE_SIZES = [20, 50, 100] as const;

type PageProps = {
  searchParams: Promise<{
    tab?: string;
    start?: string;
    end?: string;
    agentId?: string;
    activeOnly?: string;
    page?: string;
    pageSize?: string;
    rollupId?: string;
  }>;
};

export default async function AdminPage({ searchParams }: PageProps) {
  const adminAuth = await getAdminAuth();
  if (!adminAuth) return null;

  const params = await searchParams;
  const supabase = await createClient();

  const tab =
    params.tab === "agents"
      ? "agents"
      : params.tab === "enterprises"
        ? "enterprises"
        : params.tab === "reporting"
          ? "reporting"
          : "appointments";

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, emails, is_active")
    .order("name");

  let total = 0;
  let totalPages = 1;
  let page = 1;
  let pageSize = 20 as (typeof PAGE_SIZES)[number];
  let appointmentsWithAgent: AdminTableAppointment[] = [];
  let activeOnly = true;

  let enterprisesWithDetails: Array<{
    id: string;
    name: string;
    agents: { agent_id: string }[];
    users: { id: string; email: string }[];
  }> = [];

  let rollups: Array<{ id: string; name: string }> = [];
  let selectedRollupId: string | null = null;
  let reportingAppointments:
    | Array<{
        agent_id: string;
        status: string;
        appointment_datetime: string;
        age_raw: string | null;
      }>
    | null = null;

  type WindowMetric = {
    label: string;
    shows: number;
    noShows: number;
    showRatePercent: number | null;
    age50Count: number;
    age50Total: number;
    age50Percent: number | null;
  };

  let reportingMetrics: WindowMetric[] = [];

  if (tab === "enterprises") {
    const { data: enterprises } = await supabase
      .from("enterprises")
      .select("id, name")
      .order("name");
    for (const ent of enterprises ?? []) {
      const { data: ea } = await supabase
        .from("enterprise_agents")
        .select("agent_id")
        .eq("enterprise_id", ent.id);
      const { data: eu } = await supabase
        .from("enterprise_users")
        .select("id, email")
        .eq("enterprise_id", ent.id);
      enterprisesWithDetails.push({
        id: ent.id,
        name: ent.name,
        agents: ea ?? [],
        users: eu ?? [],
      });
    }
  }

  if (tab === "appointments") {
    const pageSizeRaw = params.pageSize ? parseInt(params.pageSize, 10) : 20;
    pageSize = PAGE_SIZES.includes(pageSizeRaw as (typeof PAGE_SIZES)[number])
      ? (pageSizeRaw as (typeof PAGE_SIZES)[number])
      : 20;
    page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
    activeOnly = params.activeOnly !== "false";

    let query = supabase
      .from("appointments")
      .select(
        "id, agent_id, appointment_datetime, prospect_email, first_name, last_name, name, status, age_raw, assets_raw, utm_source, prospect_questions",
        { count: "exact" }
      )
      .order("appointment_datetime", { ascending: false });

    if (params.agentId) {
      query = query.eq("agent_id", params.agentId);
    } else if (activeOnly) {
      const activeAgentIds = (agents ?? [])
        .filter((a: { is_active?: boolean }) => a.is_active !== false)
        .map((a: { id: string }) => a.id);
      if (activeAgentIds.length > 0) {
        query = query.in("agent_id", activeAgentIds);
      }
    }
    if (params.start) {
      const start = new Date(params.start);
      start.setHours(0, 0, 0, 0);
      query = query.gte("appointment_datetime", start.toISOString());
    }
    if (params.end) {
      const end = new Date(params.end);
      end.setHours(23, 59, 59, 999);
      query = query.lte("appointment_datetime", end.toISOString());
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data: appointments, count: totalCount } = await query.range(from, to);
    total = totalCount ?? 0;
    totalPages = Math.max(1, Math.ceil(total / pageSize));

    const agentMap = new Map((agents ?? []).map((a) => [a.id, a.name]));
    appointmentsWithAgent = (appointments ?? []).map((apt): AdminTableAppointment => ({
      id: apt.id,
      agent_id: apt.agent_id,
      agentName: agentMap.get(apt.agent_id) ?? "—",
      appointment_datetime: apt.appointment_datetime,
      prospect_email: apt.prospect_email ?? null,
      first_name: apt.first_name ?? null,
      last_name: apt.last_name ?? null,
      name: apt.name ?? null,
      status: apt.status,
      age_raw: apt.age_raw ?? null,
      assets_raw: apt.assets_raw ?? null,
      utm_source: apt.utm_source ?? null,
      prospect_questions: apt.prospect_questions ?? null,
    }));
  }

  if (tab === "reporting") {
    selectedRollupId = params.rollupId ? String(params.rollupId) : null;

    const { data: r } = await supabase
      .from("rollups")
      .select("id, name")
      .order("name");
    rollups = r ?? [];

    let query = supabase
      .from("appointments")
      .select("agent_id, status, appointment_datetime, age_raw");

    if (selectedRollupId) {
      const { data: agentRows } = await supabase
        .from("agent_rollups")
        .select("agent_id")
        .eq("rollup_id", selectedRollupId);
      const agentIds = (agentRows ?? []).map((row) => row.agent_id);
      if (agentIds.length === 0) {
        reportingAppointments = [];
      } else {
        query = query.in("agent_id", agentIds);
      }
    }

    // If we already determined we have 0 appointments for this scope, skip the query.
    if (reportingAppointments === null) {
      const { data } = await query;
      reportingAppointments = (data ?? []) as any;
    }

    const now = new Date();
    const showStatuses = new Set(["Show"]);
    const noShowStatuses = new Set([
      "No-Show (Approved)",
      "No-Show (Pending)",
    ]);

    const windows: Array<{ label: string; days: number | null }> = [
      { label: "Lifetime", days: null },
      { label: "Last 30 days", days: 30 },
      { label: "Last 60 days", days: 60 },
      { label: "Last 90 days", days: 90 },
    ];

    // Pre-parse timestamps once to keep per-window loops cheap.
    const parsed = (reportingAppointments ?? []).map((a) => {
      const dt = new Date(a.appointment_datetime);
      return {
        ...a,
        parsedTime: dt.getTime(),
      };
    });

    reportingMetrics = windows.map(({ label, days }) => {
      let shows = 0;
      let noShows = 0;

      let age50Count = 0;
      let age50Total = 0;

      for (const appt of parsed) {
        if (isNaN(appt.parsedTime)) continue;
        if (days != null) {
          const diffMs = now.getTime() - appt.parsedTime;
          if (diffMs < 0) continue; // future appointments shouldn't count in "last N days"
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          if (diffDays > days) continue;
        }

        if (showStatuses.has(appt.status)) shows++;
        if (noShowStatuses.has(appt.status)) noShows++;

        if (appt.age_raw != null && String(appt.age_raw).trim() !== "") {
          age50Total++;
          if (isAge50OrUp(appt.age_raw)) age50Count++;
        }
      }

      const showRatePercent =
        shows + noShows > 0
          ? Math.round((shows / (shows + noShows)) * 100)
          : null;

      const age50Percent =
        age50Total > 0 ? Math.round((age50Count / age50Total) * 100) : null;

      return {
        label,
        shows,
        noShows,
        showRatePercent,
        age50Count,
        age50Total,
        age50Percent,
      };
    });
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-semibold text-slate-900">
              Revenx Admin
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Agent Dashboard
            </Link>
          </div>
          <SignOutButton>
            <button className="text-slate-600 hover:text-slate-900 text-sm font-medium">
              Sign Out
            </button>
          </SignOutButton>
        </header>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Admin Dashboard
            </h2>
            <p className="text-slate-600 mb-4">
              Full access to all agents and appointments. Change any status.
            </p>
            <div className="flex gap-1 border-b border-slate-200 -mb-6 -mx-8 -px-8">
              <AdminTabLink active={tab === "appointments"} href="/admin">
                Appointments
              </AdminTabLink>
              <AdminTabLink
                active={tab === "agents"}
                href="/admin?tab=agents"
              >
                Agents
              </AdminTabLink>
              <AdminTabLink
                active={tab === "enterprises"}
                href="/admin?tab=enterprises"
              >
                Enterprises
              </AdminTabLink>
              <AdminTabLink
                active={tab === "reporting"}
                href="/admin?tab=reporting"
              >
                Reporting
              </AdminTabLink>
            </div>
          </div>

          {tab === "agents" ? (
            <AdminAgentsSection agents={agents ?? []} />
          ) : tab === "enterprises" ? (
            <AdminEnterprisesSection
              enterprises={enterprisesWithDetails}
              agents={agents ?? []}
            />
          ) : tab === "reporting" ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <h3 className="font-semibold text-slate-900">Reporting</h3>

                <form
                  method="get"
                  action="/admin"
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="tab" value="reporting" />
                  <label className="text-sm text-slate-600">Scope:</label>
                  <select
                    name="rollupId"
                    defaultValue={selectedRollupId ?? ""}
                    className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">All agents</option>
                    {rollups.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Apply
                  </button>
                </form>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {reportingMetrics.map((m) => (
                  <div
                    key={`show-${m.label}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      Show rate · {m.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {m.showRatePercent != null ? `${m.showRatePercent}%` : "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {m.shows} shows / {m.noShows} no-shows (Approved + Pending)
                    </p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {reportingMetrics.map((m) => (
                  <div
                    key={`age50-${m.label}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                      50+ age share · {m.label}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {m.age50Percent != null ? `${m.age50Percent}%` : "—"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {m.age50Count} of {m.age50Total} appointments with age
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <AdminCsvUpload agents={agents ?? []} />

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">All Appointments</h3>
                <p className="text-sm text-slate-500">
                  {total} total
                </p>
              </div>
              <AdminFilters
                agents={agents ?? []}
                defaultAgentId={params.agentId}
                defaultStart={params.start}
                defaultEnd={params.end}
                defaultActiveOnly={activeOnly}
                defaultPageSize={pageSize}
              />
            </div>

            <AdminAppointmentsPagination
              total={total}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              params={{
                agentId: params.agentId,
                start: params.start,
                end: params.end,
                activeOnly: params.activeOnly ?? "true",
              }}
            />

            <AdminAppointmentsTable
              appointments={appointmentsWithAgent}
              statuses={ALL_STATUSES}
            />

            <AdminAppointmentsPagination
              variant="bottom"
              total={total}
              page={page}
              pageSize={pageSize}
              totalPages={totalPages}
              params={{
                agentId: params.agentId,
                start: params.start,
                end: params.end,
                activeOnly: params.activeOnly ?? "true",
              }}
            />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function AdminTabLink({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-slate-900 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
      }`}
    >
      {children}
    </Link>
  );
}

function AdminFilters({
  agents,
  defaultAgentId,
  defaultStart,
  defaultEnd,
  defaultActiveOnly,
  defaultPageSize,
}: {
  agents: { id: string; name: string; is_active?: boolean }[];
  defaultAgentId?: string;
  defaultStart?: string;
  defaultEnd?: string;
  defaultActiveOnly?: boolean;
  defaultPageSize?: number;
}) {
  return (
    <form
      method="get"
      action="/admin"
      className="flex flex-wrap items-center gap-2"
    >
      {defaultPageSize != null && (
        <input type="hidden" name="pageSize" value={defaultPageSize} />
      )}
      <select
        name="activeOnly"
        defaultValue={defaultActiveOnly !== false ? "true" : "false"}
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="true">Active agents only</option>
        <option value="false">All agents</option>
      </select>
      <select
        name="agentId"
        defaultValue={defaultAgentId ?? ""}
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      >
        <option value="">All agents</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.is_active === false ? " (inactive)" : ""}
          </option>
        ))}
      </select>
      <input
        type="date"
        name="start"
        defaultValue={defaultStart}
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <input
        type="date"
        name="end"
        defaultValue={defaultEnd}
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
      >
        Filter
      </button>
      {(defaultAgentId || defaultStart || defaultEnd || !defaultActiveOnly) && (
        <Link
          href="/admin"
          className="text-sm text-slate-600 hover:text-slate-900 underline"
        >
          Clear
        </Link>
      )}
    </form>
  );
}

import { getEnterpriseAuth } from "@/lib/auth";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EnterpriseDateRangeSelector } from "./EnterpriseDateRangeSelector";

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, string> = {
  Show: "bg-green-100 text-green-800",
  "No-Show (Approved)": "bg-amber-100 text-amber-800",
  "No-Show (Pending)": "bg-yellow-100 text-yellow-800",
  Confirmed: "bg-blue-100 text-blue-800",
  Rescheduled: "bg-slate-100 text-slate-700",
  Canceled: "bg-slate-100 text-slate-600",
  Invalid: "bg-slate-100 text-slate-600",
  Duplicate: "bg-slate-100 text-slate-600",
  Test: "bg-slate-100 text-slate-600",
  Other: "bg-slate-100 text-slate-700",
};

type PageProps = {
  searchParams: Promise<{ start?: string; end?: string }>;
};

export default async function EnterprisePage({ searchParams }: PageProps) {
  const auth = await getEnterpriseAuth();
  if (!auth) return null;

  const params = await searchParams;
  const startParam = params.start;
  const endParam = params.end;

  const { enterpriseName, agentIds } = auth;

  const supabase = await createClient();

  let query = supabase
    .from("appointments")
    .select(
      "id, agent_id, appointment_datetime, prospect_email, first_name, last_name, name, status, age_raw, assets_raw, prospect_questions"
    )
    .order("appointment_datetime", { ascending: false });

  if (agentIds.length > 0) {
    query = query.in("agent_id", agentIds);
  } else {
    query = query.eq("agent_id", "00000000-0000-0000-0000-000000000000");
  }
  if (startParam) {
    const start = new Date(startParam);
    start.setHours(0, 0, 0, 0);
    query = query.gte("appointment_datetime", start.toISOString());
  }
  if (endParam) {
    const end = new Date(endParam);
    end.setHours(23, 59, 59, 999);
    query = query.lte("appointment_datetime", end.toISOString());
  }

  const { data: appointments } = await query;

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name")
    .in("id", agentIds);
  const agentMap = new Map((agents ?? []).map((a) => [a.id, a.name]));

  const appointmentsWithAgent = (appointments ?? []).map((apt) => ({
    ...apt,
    agentName: agentMap.get(apt.agent_id) ?? "—",
  }));

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-semibold text-slate-900">
              Revenx Enterprise
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
            <h2 className="text-2xl font-bold text-slate-900 mb-1">
              {enterpriseName}
            </h2>
            <p className="text-slate-500 text-sm">
              Appointments for your assigned agents
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">Appointments</h3>
                <p className="text-sm text-slate-500">
                  {appointmentsWithAgent.length} total
                </p>
              </div>
              <EnterpriseDateRangeSelector
                defaultStart={startParam}
                defaultEnd={endParam}
              />
            </div>

            {agentIds.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-500">
                No agents assigned yet. Contact your admin.
              </div>
            ) : !appointmentsWithAgent.length ? (
              <div className="px-6 py-12 text-center text-slate-500">
                No appointments in this date range.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-6 py-3 font-medium text-slate-700">
                        Date & Time
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-slate-700">
                        Agent
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-slate-700">
                        Prospect name
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-slate-700">
                        Age
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-slate-700">
                        Assets
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-slate-700">
                        Prospect questions
                      </th>
                      <th className="text-left px-6 py-3 font-medium text-slate-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointmentsWithAgent.map((apt) => {
                      const prospectName =
                        [apt.first_name, apt.last_name].filter(Boolean).join(
                          " "
                        ) ||
                        apt.name ||
                        apt.prospect_email ||
                        "—";
                      return (
                        <tr
                          key={apt.id}
                          className="border-b border-slate-100 hover:bg-slate-50/50"
                        >
                          <td className="px-6 py-4 text-slate-900">
                            {formatDateTime(apt.appointment_datetime)}
                          </td>
                          <td className="px-6 py-4 text-slate-600 font-medium">
                            {apt.agentName}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {prospectName}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {apt.age_raw || "—"}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {apt.assets_raw || "—"}
                          </td>
                          <td
                            className="px-6 py-4 text-slate-600 max-w-xs truncate"
                            title={apt.prospect_questions ?? ""}
                          >
                            {apt.prospect_questions || "—"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                STATUS_STYLES[apt.status] ??
                                "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {apt.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

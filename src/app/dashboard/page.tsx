import { getAdminAuth, getAuthWithAgent } from "@/lib/auth";
import {
  getAgentShowRate,
  getAgentShowRatesRolling,
  getAgentAge50PlusStats,
} from "@/lib/showRate";
import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppointmentRowActions } from "./AppointmentRowActions";
import { DateRangeSelector } from "./DateRangeSelector";

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

type PageProps = {
  searchParams: Promise<{ start?: string; end?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const auth = await getAuthWithAgent();
  if (!auth) return null;

  const params = await searchParams;
  const startParam = params.start;
  const endParam = params.end;

  const { agent } = auth;
  const supabase = await createClient();

  // Auto-update to Show only when past the 14-day no-show window
  // (Keeps Confirmed during 48h–14d so agent can still mark No-Show)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  await supabase
    .from("appointments")
    .update({ status: "Show", updated_at: new Date().toISOString() })
    .eq("agent_id", agent.id)
    .eq("status", "Confirmed")
    .lt("appointment_datetime", fourteenDaysAgo.toISOString());

  const adminAuth = await getAdminAuth();
  const [showRate, showRatesRolling, age50PlusStats] = await Promise.all([
    getAgentShowRate(agent.id),
    getAgentShowRatesRolling(agent.id),
    getAgentAge50PlusStats(agent.id),
  ]);

  let query = supabase
    .from("appointments")
    .select(
      "id, appointment_datetime, prospect_email, first_name, last_name, name, status, age_raw, assets_raw, prospect_questions"
    )
    .eq("agent_id", agent.id);

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

  const { data: appointments } = await query.order("appointment_datetime", {
    ascending: false,
  });

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xl font-semibold text-slate-900">
              Revenx Dashboard
            </Link>
            {adminAuth && (
              <Link
                href="/admin"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Admin
              </Link>
            )}
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
              Welcome, {agent.name}
            </h2>
            <p className="text-slate-500 text-sm mb-4">
              Your appointments for this agent
            </p>
            {showRate.showRatePercent !== null && (
              <p className="text-sm mb-4">
                <span className="font-medium text-slate-700">Show rate (all time): </span>
                <span className="text-slate-600">
                  {showRate.shows} shows / {showRate.noShows} no-shows (
                  {showRate.showRatePercent}%)
                </span>
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Show rate (30 days)</p>
                <p className="text-lg font-semibold text-slate-900">
                  {showRatesRolling.last30.showRatePercent != null
                    ? `${showRatesRolling.last30.showRatePercent}%`
                    : "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {showRatesRolling.last30.shows} shows / {showRatesRolling.last30.noShows} no-shows
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Show rate (60 days)</p>
                <p className="text-lg font-semibold text-slate-900">
                  {showRatesRolling.last60.showRatePercent != null
                    ? `${showRatesRolling.last60.showRatePercent}%`
                    : "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {showRatesRolling.last60.shows} shows / {showRatesRolling.last60.noShows} no-shows
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Show rate (90 days)</p>
                <p className="text-lg font-semibold text-slate-900">
                  {showRatesRolling.last90.showRatePercent != null
                    ? `${showRatesRolling.last90.showRatePercent}%`
                    : "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {showRatesRolling.last90.shows} shows / {showRatesRolling.last90.noShows} no-shows
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-3">Appointments 50+ (age)</h3>
            <p className="text-sm text-slate-500 mb-4">
              Share of appointments where prospect age is 50 or older
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Last 30 days</p>
                <p className="text-xl font-semibold text-slate-900">
                  {age50PlusStats.last30.percent != null ? `${age50PlusStats.last30.percent}%` : "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {age50PlusStats.last30.count} of {age50PlusStats.last30.total} appointments
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Last 60 days</p>
                <p className="text-xl font-semibold text-slate-900">
                  {age50PlusStats.last60.percent != null ? `${age50PlusStats.last60.percent}%` : "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {age50PlusStats.last60.count} of {age50PlusStats.last60.total} appointments
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Last 90 days</p>
                <p className="text-xl font-semibold text-slate-900">
                  {age50PlusStats.last90.percent != null ? `${age50PlusStats.last90.percent}%` : "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {age50PlusStats.last90.count} of {age50PlusStats.last90.total} appointments
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Lifetime</p>
                <p className="text-xl font-semibold text-slate-900">
                  {age50PlusStats.lifetime.percent != null ? `${age50PlusStats.lifetime.percent}%` : "—"}
                </p>
                <p className="text-xs text-slate-500">
                  {age50PlusStats.lifetime.count} of {age50PlusStats.lifetime.total} appointments
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-900">Appointments</h3>
                <p className="text-sm text-slate-500">
                  {appointments?.length ?? 0} total
                </p>
              </div>
              <DateRangeSelector
                defaultStart={startParam}
                defaultEnd={endParam}
              />
            </div>

            {!appointments?.length ? (
              <div className="px-6 py-12 text-center text-slate-500">
                No appointments yet. They will appear here when pushed from
                Zapier or added via CSV backfill.
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
                      <th className="text-left px-6 py-3 font-medium text-slate-700">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((apt) => {
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
                          <td className="px-6 py-4 text-slate-600">
                            {prospectName}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {apt.age_raw || "—"}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {apt.assets_raw || "—"}
                          </td>
                          <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={apt.prospect_questions ?? ""}>
                            {apt.prospect_questions || "—"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                                apt.status === "Show"
                                  ? "bg-green-100 text-green-800"
                                  :                                 apt.status === "No-Show (Approved)"
                                    ? "bg-amber-100 text-amber-800"
                                    : apt.status === "No-Show (Pending)"
                                      ? "bg-yellow-100 text-yellow-800"
                                    : apt.status === "Confirmed"
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {apt.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <AppointmentRowActions
                              appointmentId={apt.id}
                              appointmentDatetime={apt.appointment_datetime}
                              status={apt.status}
                              requiresEvidence={showRate.requiresEvidence}
                            />
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

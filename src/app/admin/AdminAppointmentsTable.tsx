"use client";

import { useState } from "react";
import { updateAppointmentStatus } from "./actions";

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

export type Appointment = {
  id: string;
  agent_id: string;
  agentName: string;
  appointment_datetime: string;
  prospect_email: string | null;
  first_name: string | null;
  last_name: string | null;
  name: string | null;
  status: string;
  age_raw: string | null;
  assets_raw: string | null;
  utm_source: string | null;
  prospect_questions: string | null;
};

type Props = {
  appointments: Appointment[];
  statuses: readonly string[];
};

export function AdminAppointmentsTable({
  appointments,
  statuses,
}: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleStatusChange = async (
    appointmentId: string,
    newStatus: string
  ) => {
    setPendingId(appointmentId);
    const result = await updateAppointmentStatus(appointmentId, newStatus);
    setPendingId(null);
    if (result.error) {
      alert(result.error);
    }
  };

  if (!appointments.length) {
    return (
      <div className="px-6 py-12 text-center text-slate-500">
        No appointments match the filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-6 py-3 font-medium text-slate-700">
              Agent
            </th>
            <th className="text-left px-6 py-3 font-medium text-slate-700">
              Date & Time
            </th>
            <th className="text-left px-6 py-3 font-medium text-slate-700">
              Prospect name
            </th>
            <th className="text-left px-6 py-3 font-medium text-slate-700">
              Prospect first name
            </th>
            <th className="text-left px-6 py-3 font-medium text-slate-700">
              Prospect last name
            </th>
            <th className="text-left px-6 py-3 font-medium text-slate-700">
              Age
            </th>
            <th className="text-left px-6 py-3 font-medium text-slate-700">
              Assets
            </th>
            <th className="text-left px-6 py-3 font-medium text-slate-700">
              Source
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
          {appointments.map((apt) => {
            const prospectName =
              [apt.first_name, apt.last_name].filter(Boolean).join(" ") ||
              apt.name ||
              apt.prospect_email ||
              "—";
            const isPending = pendingId === apt.id;

            return (
              <tr
                key={apt.id}
                className="border-b border-slate-100 hover:bg-slate-50/50"
              >
                <td className="px-6 py-4 text-slate-600 font-medium">
                  {apt.agentName}
                </td>
                <td className="px-6 py-4 text-slate-900">
                  {formatDateTime(apt.appointment_datetime)}
                </td>
                <td className="px-6 py-4 text-slate-600">{prospectName}</td>
                <td className="px-6 py-4 text-slate-600">
                  {apt.first_name || "—"}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {apt.last_name || "—"}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {apt.age_raw || "—"}
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {apt.assets_raw || "—"}
                </td>
                <td className="px-6 py-4 text-slate-500">
                  {apt.utm_source || "—"}
                </td>
                <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={apt.prospect_questions ?? ""}>
                  {apt.prospect_questions || "—"}
                </td>
                <td className="px-6 py-4">
                  <select
                    value={apt.status}
                    onChange={(e) => handleStatusChange(apt.id, e.target.value)}
                    disabled={isPending}
                    className={`rounded border border-slate-300 px-2 py-1 text-xs font-medium ${
                      STATUS_STYLES[apt.status] ?? "bg-slate-100 text-slate-700"
                    } disabled:opacity-50`}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

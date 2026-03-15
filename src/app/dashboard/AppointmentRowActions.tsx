"use client";

import { useState } from "react";
import { markAppointmentAsNoShow } from "./actions";
import { useTransition } from "react";
import { NoShowEvidenceModal } from "./NoShowEvidenceModal";

type Props = {
  appointmentId: string;
  appointmentDatetime: string;
  status: string;
  requiresEvidence: boolean;
};

function canMarkNoShow(appointmentDatetime: string): boolean {
  const appointmentTime = new Date(appointmentDatetime);
  const now = new Date();
  const minTime = new Date();
  minTime.setHours(minTime.getHours() - 48);
  const maxTime = new Date(appointmentTime);
  maxTime.setDate(maxTime.getDate() + 14);
  return appointmentTime <= minTime && now <= maxTime;
}

export function AppointmentRowActions({
  appointmentId,
  appointmentDatetime,
  status,
  requiresEvidence,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const showButton =
    (status === "Confirmed" || status === "Show") &&
    canMarkNoShow(appointmentDatetime);

  const handleMarkNoShow = () => {
    if (!showButton || isPending) return;
    if (requiresEvidence) {
      setShowEvidenceModal(true);
      return;
    }
    startTransition(async () => {
      const result = await markAppointmentAsNoShow(appointmentId);
      if (result.error) {
        alert(result.error);
      }
    });
  };

  if (!showButton) {
    return <span className="text-slate-400 text-xs">—</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleMarkNoShow}
        disabled={isPending}
        className="text-amber-600 hover:text-amber-700 text-sm font-medium disabled:opacity-50"
      >
        {isPending ? "Updating…" : "Mark as No-Show"}
      </button>
      {showEvidenceModal && (
        <NoShowEvidenceModal
          appointmentId={appointmentId}
          onClose={() => setShowEvidenceModal(false)}
          onSuccess={() => startTransition(() => {})}
        />
      )}
    </>
  );
}

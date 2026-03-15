"use client";

import { markAppointmentAsNoShowWithEvidence } from "./actions";
import { useTransition } from "react";

type Props = {
  appointmentId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function NoShowEvidenceModal({
  appointmentId,
  onClose,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("evidence") as HTMLInputElement;
    if (fileInput.files && fileInput.files.length > 10) {
      alert("Maximum 10 files allowed");
      return;
    }
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await markAppointmentAsNoShowWithEvidence(
        appointmentId,
        formData
      );
      if (result.error) {
        alert(result.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-slate-900 mb-2">
          Upload evidence for no-show
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          Your show rate is below the threshold. Please upload a screenshot or
          photo as evidence (max 10MB per file, up to 10 files). Include a
          picture of the call attempts at the scheduled time as well as the
          follow-up calls/texts.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="file"
            name="evidence"
            accept="image/*,.pdf"
            required
            multiple
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 mb-4"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? "Uploading…" : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

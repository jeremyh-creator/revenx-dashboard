"use client";

import { uploadAppointmentsCsv } from "./actions";
import { useState } from "react";

const DB_FIELDS = [
  { key: "agent_email", label: "Agent email (or use Agent name)", required: false },
  { key: "agent_name", label: "Agent name (or use Agent email)", required: false },
  { key: "appointment_datetime", label: "Appointment date/time", required: true },
  { key: "prospect_email", label: "Prospect email", required: false },
  { key: "prospect_first_name", label: "Prospect first name", required: false },
  { key: "prospect_last_name", label: "Prospect last name", required: false },
  { key: "prospect_name", label: "Prospect name", required: false },
  { key: "age_raw", label: "Age", required: false },
  { key: "assets_raw", label: "Assets", required: false },
  { key: "utm_source", label: "UTM source", required: false },
  { key: "prospect_questions", label: "Prospect questions", required: false },
  { key: "status", label: "Status (e.g. Outcome)", required: false },
] as const;

type Props = {
  agents: { id: string; name: string; emails: string[] | null }[];
};

export function AdminCsvUpload({ agents }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const text = await f.text();
    const firstLine = text.split("\n")[0];
    const headers = firstLine.split(/[,;\t]/).map((h) => h.trim().replace(/^["']|["']$/g, ""));
    setCsvHeaders(headers);
    setMapping({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const hasAgentEmail = !!mapping["agent_email"];
    const hasAgentName = !!mapping["agent_name"];
    if (!hasAgentEmail && !hasAgentName) {
      alert("Map either Agent email or Agent name");
      return;
    }
    setIsProcessing(true);
    setResult(null);
    const csvText = await file.text();
    const res = await uploadAppointmentsCsv(csvText, mapping);
    setIsProcessing(false);
    setResult(res);
    if (res.imported > 0) setFile(null);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Upload past data (CSV)</h3>
        <p className="text-sm text-slate-500">
          Map your CSV columns to database fields, then import
        </p>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            CSV file
          </label>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-slate-100 file:text-slate-700"
          />
        </div>

        {csvHeaders.length > 0 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm font-medium text-slate-700">Map columns:</p>
            <div className="grid gap-3 max-h-64 overflow-y-auto">
              {DB_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <label className="w-44 text-sm text-slate-600 shrink-0">
                    {field.label}
                    {field.required && " *"}
                  </label>
                  <select
                    value={mapping[field.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({
                        ...m,
                        [field.key]: e.target.value,
                      }))
                    }
                    className="rounded border border-slate-300 px-2 py-1.5 text-sm min-w-[140px]"
                  >
                    <option value="">— Skip —</option>
                    {csvHeaders.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <button
              type="submit"
              disabled={isProcessing}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isProcessing ? "Importing…" : "Import"}
            </button>
          </form>
        )}

        {result && (
          <div className="rounded border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="font-medium text-green-700">
              Imported {result.imported} row{result.imported !== 1 ? "s" : ""}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 text-amber-700 list-disc list-inside">
                {result.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 10 && (
                  <li>…and {result.errors.length - 10} more</li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

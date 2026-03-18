"use client";

import { uploadAppointmentsCsv } from "./actions";
import { useState } from "react";

const DB_FIELDS = [
  { key: "agent_email", label: "Agent email (or use Agent name)", required: false },
  { key: "agent_name", label: "Agent name (or use Agent email)", required: false },
  { key: "appointment_datetime", label: "Appointment date/time", required: true },
  { key: "external_id", label: "Event ID (required: Calendly UUID or Custom calendar ID)", required: true },
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
  const [estimatedRows, setEstimatedRows] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [externalSource, setExternalSource] = useState<"calendly" | "custom">("calendly");

  function buildInitialMapping(headers: string[]): Record<string, string> {
    const normalized = headers.map((h) => ({
      raw: h,
      norm: h.toLowerCase().replace(/[\s_\-]/g, ""),
    }));

    const mapping: Record<string, string> = {};
    const used = new Set<string>();

    function findHeader(candidates: string[]): string | null {
      for (const cand of candidates) {
        const found = normalized.find(
          (h) => h.norm === cand || h.norm.includes(cand) || cand.includes(h.norm)
        );
        if (found && !used.has(found.raw)) {
          used.add(found.raw);
          return found.raw;
        }
      }
      return null;
    }

    const agentEmails = ["agentemail", "email", "hostsemail", "hostemail"];
    const agentNames = ["agent", "agentname", "advisor", "host"];
    const startTimes = [
      "appointmentdatetime",
      "starttime",
      "eventstarttime",
      "eventtime",
      "datetime",
      "date",
      "scheduledat",
    ];
    const externalIds = [
      "eventuuid",
      "eventid",
      "uuid",
      "event id",
      "event uuid",
      "id",
    ];
    const prospectEmails = ["prospectemail", "inviteeemail", "clientemail"];
    const prospectNames = ["prospectname", "inviteename", "clientname"];
    const firstNames = ["firstname", "inviteefirstname", "clientfirstname"];
    const lastNames = ["lastname", "inviteelastname", "clientlastname"];

    const hAgentEmail = findHeader(agentEmails);
    if (hAgentEmail) mapping["agent_email"] = hAgentEmail;

    const hAgentName = findHeader(agentNames);
    if (hAgentName) mapping["agent_name"] = hAgentName;

    const hStart = findHeader(startTimes);
    if (hStart) mapping["appointment_datetime"] = hStart;

    const hExternalId = findHeader(externalIds);
    if (hExternalId) mapping["external_id"] = hExternalId;

    const hProspectEmail = findHeader(prospectEmails);
    if (hProspectEmail) mapping["prospect_email"] = hProspectEmail;

    const hProspectName = findHeader(prospectNames);
    if (hProspectName) mapping["prospect_name"] = hProspectName;

    const hFirstName = findHeader(firstNames);
    if (hFirstName) mapping["prospect_first_name"] = hFirstName;

    const hLastName = findHeader(lastNames);
    if (hLastName) mapping["prospect_last_name"] = hLastName;

    return mapping;
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    const text = await f.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const firstLine = lines[0] ?? "";
    const headers = firstLine.split(/[,;\t]/).map((h) => h.trim().replace(/^["']|["']$/g, ""));
    setCsvHeaders(headers);
    setMapping(buildInitialMapping(headers));
    setEstimatedRows(Math.max(0, lines.length - 1));
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
    const hasExternalId = !!mapping["external_id"];
    if (!hasExternalId) {
      alert("Map the Event ID column to 'Event ID (required)'");
      return;
    }
    setIsProcessing(true);
    setResult(null);
    setProgress(null);

    const csvText = await file.text();
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setIsProcessing(false);
      setResult({ imported: 0, errors: ["CSV must have a header row and at least one data row"] });
      return;
    }

    const header = lines[0];
    const dataLines = lines.slice(1);

    // Chunk uploads to avoid serverless timeouts (e.g. 9k+ rows)
    const chunkSize = 1000;
    const total = dataLines.length;
    setProgress({ done: 0, total });

    let importedTotal = 0;
    const errorsTotal: string[] = [];

    for (let offset = 0; offset < total; offset += chunkSize) {
      const chunk = dataLines.slice(offset, offset + chunkSize);
      const chunkCsv = [header, ...chunk].join("\n");
      const res = await uploadAppointmentsCsv(chunkCsv, mapping, externalSource);
      importedTotal += res.imported;
      errorsTotal.push(...res.errors);
      setProgress({ done: Math.min(offset + chunk.length, total), total });
    }

    const res = { imported: importedTotal, errors: errorsTotal };
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm font-medium text-slate-700">Calendar source</p>
              <select
                value={externalSource}
                onChange={(e) =>
                  setExternalSource(e.target.value as "calendly" | "custom")
                }
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="calendly">Calendly</option>
                <option value="custom">Revenx custom calendar</option>
              </select>
            </div>
            <p className="text-sm font-medium text-slate-700">Map columns:</p>
            {estimatedRows != null && (
              <p className="text-xs text-slate-500">
                Detected approximately {estimatedRows.toLocaleString()} data row
                {estimatedRows === 1 ? "" : "s"}. We prefilled close matches for you; adjust as
                needed.
              </p>
            )}
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
            {isProcessing && (
              <div className="mt-2 space-y-1">
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-2 bg-slate-700 transition-all"
                    style={{
                      width: progress
                        ? `${Math.max(
                            5,
                            Math.min(100, Math.round((progress.done / progress.total) * 100))
                          )}%`
                        : "33%",
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  {progress
                    ? `Imported chunks: ${progress.done.toLocaleString()} / ${progress.total.toLocaleString()} rows processed…`
                    : "Processing large file on the server. This may take a minute; keep this tab open."}
                </p>
              </div>
            )}
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

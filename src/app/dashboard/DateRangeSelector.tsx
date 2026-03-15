"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

type Props = {
  defaultStart?: string;
  defaultEnd?: string;
};

export function DateRangeSelector({ defaultStart, defaultEnd }: Props) {
  const router = useRouter();
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);

  const applyFilter = useCallback(() => {
    const start = startRef.current?.value || "";
    const end = endRef.current?.value || "";
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    router.push(`/dashboard?${params.toString()}`);
  }, [router]);

  const handleClear = () => {
    if (startRef.current) startRef.current.value = "";
    if (endRef.current) endRef.current.value = "";
    router.push("/dashboard");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm text-slate-600">From</label>
      <input
        ref={startRef}
        type="date"
        defaultValue={defaultStart}
        onBlur={applyFilter}
        onKeyDown={(e) => e.key === "Enter" && applyFilter()}
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <label className="text-sm text-slate-600">To</label>
      <input
        ref={endRef}
        type="date"
        defaultValue={defaultEnd}
        onBlur={applyFilter}
        onKeyDown={(e) => e.key === "Enter" && applyFilter()}
        className="rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        type="button"
        onClick={applyFilter}
        className="rounded bg-slate-100 px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
      >
        Apply
      </button>
      {(defaultStart || defaultEnd) && (
        <button
          type="button"
          onClick={handleClear}
          className="text-sm text-slate-600 hover:text-slate-900 underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}

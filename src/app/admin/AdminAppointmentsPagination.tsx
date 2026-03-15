"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

const PAGE_SIZES = [20, 50, 100] as const;

type Params = {
  agentId?: string;
  start?: string;
  end?: string;
  activeOnly?: string;
};

function buildQuery(params: Params, page: number, pageSize: number): string {
  const search = new URLSearchParams();
  if (params.agentId) search.set("agentId", params.agentId);
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);
  if (params.activeOnly != null) search.set("activeOnly", params.activeOnly);
  search.set("page", String(page));
  search.set("pageSize", String(pageSize));
  const q = search.toString();
  return q ? `?${q}` : "";
}

type Props = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  params: Params;
  variant?: "top" | "bottom";
};

export function AdminAppointmentsPagination({
  total,
  page,
  pageSize,
  totalPages,
  params,
  variant = "top",
}: Props) {
  const router = useRouter();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(e.target.value) as (typeof PAGE_SIZES)[number];
    router.push(`/admin${buildQuery(params, 1, newSize)}`);
  };

  return (
    <div className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50 ${variant === "bottom" ? "border-t border-slate-200" : "border-b border-slate-200"}`}>
      <div className="flex items-center gap-4 flex-wrap">
        <span className="text-sm text-slate-600">
          Showing {from}–{to} of {total}
        </span>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Per page
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/admin${buildQuery(params, page - 1, pageSize)}`}
          className={`rounded border border-slate-300 px-3 py-1.5 text-sm font-medium ${
            page <= 1
              ? "pointer-events-none opacity-50 text-slate-400"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Previous
        </Link>
        <span className="text-sm text-slate-600 px-2">
          Page {page} of {totalPages}
        </span>
        <Link
          href={`/admin${buildQuery(params, page + 1, pageSize)}`}
          className={`rounded border border-slate-300 px-3 py-1.5 text-sm font-medium ${
            page >= totalPages
              ? "pointer-events-none opacity-50 text-slate-400"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

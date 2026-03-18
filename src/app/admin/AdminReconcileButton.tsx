"use client";

import { useTransition, useState } from "react";
import { reconcileConfirmedToShow } from "./actions";

export function AdminReconcileButton() {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ updated: number } | null>(null);

  const handleClick = () => {
    setResult(null);
    startTransition(async () => {
      const res = await reconcileConfirmedToShow(14);
      if ("error" in res) {
        alert(res.error);
        return;
      }
      setResult(res);
    });
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={isPending}
        onClick={handleClick}
        className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
      >
        {isPending ? "Reconciling…" : "Reconcile Confirmed → Show (14d)"}
      </button>
      {result && (
        <p className="text-sm text-slate-600">
          Updated {result.updated.toLocaleString()} appointments
        </p>
      )}
    </div>
  );
}


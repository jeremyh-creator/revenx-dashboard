import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">
          Account not authorized
        </h1>
        <p className="text-slate-600">
          Your account isn&apos;t linked to an agent. Please contact your admin
          to get access.
        </p>
        <SignOutButton>
          <button className="px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition">
            Sign Out
          </button>
        </SignOutButton>
        <p className="text-sm text-slate-500">
          <Link href="/" className="hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}

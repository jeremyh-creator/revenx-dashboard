import { SignedIn, SignedOut } from "@clerk/nextjs";
import Link from "next/link";
import { getAdminAuth, getAuthWithAgent, getEnterpriseAuth } from "@/lib/auth";

export default async function Home() {
  const [adminAuth, agentAuth, enterpriseAuth] = await Promise.all([
    getAdminAuth(),
    getAuthWithAgent(),
    getEnterpriseAuth(),
  ]);
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-4xl font-bold text-slate-900">
          Revenx Dashboard
        </h1>
        <p className="text-slate-600 text-lg">
          Appointment tracking and show-rate management for agents.
        </p>

        <SignedOut>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/sign-in"
              className="px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition"
            >
              Sign Up
            </Link>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {agentAuth && (
              <Link
                href="/dashboard"
                className="inline-block px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition text-center"
              >
                Agent Dashboard
              </Link>
            )}
            {enterpriseAuth && (
              <Link
                href="/enterprise"
                className={`inline-block px-6 py-3 text-center transition ${
                  agentAuth
                    ? "border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                    : "bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800"
                }`}
              >
                Enterprise View
              </Link>
            )}
            {adminAuth && (
              <Link
                href="/admin"
                className="inline-block px-6 py-3 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition text-center"
              >
                Admin
              </Link>
            )}
            {!agentAuth && !enterpriseAuth && !adminAuth && (
              <Link
                href="/dashboard"
                className="inline-block px-6 py-3 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition text-center"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </SignedIn>
      </div>
    </main>
  );
}

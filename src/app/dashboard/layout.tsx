import { auth } from "@clerk/nextjs/server";
import { getAuthWithAgent } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const authWithAgent = await getAuthWithAgent();
  if (!authWithAgent) {
    redirect("/unauthorized");
  }
  return <>{children}</>;
}

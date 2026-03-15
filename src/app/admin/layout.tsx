import { auth } from "@clerk/nextjs/server";
import { getAdminAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const adminAuth = await getAdminAuth();
  if (!adminAuth) {
    redirect("/unauthorized");
  }
  return <>{children}</>;
}

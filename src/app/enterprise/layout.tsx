import { auth } from "@clerk/nextjs/server";
import { getEnterpriseAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function EnterpriseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const enterpriseAuth = await getEnterpriseAuth();
  if (!enterpriseAuth) {
    redirect("/unauthorized");
  }
  return <>{children}</>;
}

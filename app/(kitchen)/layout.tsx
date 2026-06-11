import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function KitchenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  return <>{children}</>;
}

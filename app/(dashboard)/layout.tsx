import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  return (
    <div className="flex h-screen">
      <nav aria-label="Dashboard navigation">
        {/* TODO: Implement sidebar with nav items */}
        {/* Nav items: Orders, Kitchen, Catalog, Customers, Inventory, Drivers, Settings, Reports */}
      </nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}

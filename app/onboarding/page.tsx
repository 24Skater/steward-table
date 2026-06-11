import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OnboardingFlow } from "@/components/onboarding";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const hasActiveMembership = session.user.memberships?.some(
    (m: { status: string }) => m.status === "ACTIVE",
  );
  if (hasActiveMembership) {
    redirect("/orders");
  }

  return <OnboardingFlow />;
}

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/sign-in");
  }

  const hasActiveMembership = session.user.memberships?.some(
    (m: { status: string }) => m.status === "ACTIVE",
  );
  if (hasActiveMembership) {
    redirect("/");
  }

  const displayName = session.user.name ?? "";

  return <OnboardingWizard initialDisplayName={displayName} />;
}

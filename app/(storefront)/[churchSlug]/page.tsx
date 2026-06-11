import { redirect } from "next/navigation";

interface StorefrontPageProps {
  params: Promise<{ churchSlug: string }>;
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { churchSlug } = await params;
  redirect(`/${churchSlug}/menu`);
}

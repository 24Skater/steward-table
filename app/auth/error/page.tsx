import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const messages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration. Please contact support.",
    AccessDenied: "You do not have permission to sign in.",
    Verification: "The sign-in link has expired or has already been used.",
    Default: "An error occurred during sign in. Please try again.",
  };

  const message = messages[error ?? "Default"] ?? messages.Default ?? messages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Steward Table</h1>
        </div>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-medium text-slate-800">Sign-in error</CardTitle>
            <CardDescription className="text-slate-500">{message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-slate-900 hover:bg-slate-800 text-white">
              <Link href="/auth/sign-in">Try again</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

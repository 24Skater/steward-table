import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { auth, signIn } from "@/lib/auth";
import type { Route } from "next";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

const DEFAULT_REDIRECT = "/orders" satisfies Route;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  const { callbackUrl, error } = await searchParams;

  const destination = (callbackUrl ?? DEFAULT_REDIRECT) as Route;

  if (session?.user?.id) {
    redirect(destination);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Wordmark */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Steward Table</h1>
          <p className="text-sm text-slate-500">Order management for churches and ministries</p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-medium text-slate-800">Sign in</CardTitle>
            <CardDescription className="text-slate-500">
              Use your email and password or continue with Google.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error banner */}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {error === "CredentialsSignin"
                  ? "Incorrect email or password."
                  : error === "OAuthAccountNotLinked"
                    ? "An account already exists with that email. Sign in with your original method."
                    : "Something went wrong. Please try again."}
              </div>
            )}

            {/* Credentials form */}
            <form
              action={async (formData: FormData) => {
                "use server";
                const email = formData.get("email") as string;
                const password = formData.get("password") as string;
                try {
                  await signIn("credentials", {
                    email,
                    password,
                    redirectTo: destination,
                  });
                } catch (error) {
                  if (error instanceof AuthError) {
                    redirect(
                      `/auth/sign-in?error=${error.type}&callbackUrl=${encodeURIComponent(destination)}` as Route,
                    );
                  }
                  throw error;
                }
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@church.org"
                  className="h-10 border-slate-300 focus:border-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="h-10 border-slate-300 focus:border-slate-500"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium"
              >
                Sign in
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400">or</span>
              </div>
            </div>

            {/* Google sign-in */}
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: destination });
              }}
            >
              <Button
                type="submit"
                variant="outline"
                className="w-full h-11 border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
              >
                Continue with Google
              </Button>
            </form>

            {/* Magic link */}
            <form
              action={async (formData: FormData) => {
                "use server";
                const email = formData.get("magic-email") as string;
                await signIn("resend", { email, redirectTo: destination });
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="magic-email" className="text-sm font-medium text-slate-700">
                  Or get a sign-in link by email
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="magic-email"
                    name="magic-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@church.org"
                    className="h-10 border-slate-300 focus:border-slate-500"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    className="h-10 px-4 border-slate-300 text-slate-700 hover:bg-slate-50 shrink-0"
                  >
                    Send link
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          Member access is by invitation only. Contact your church administrator.
        </p>
        <p className="text-center text-xs text-slate-400">
          Setting up a new church?{" "}
          <a
            href="/auth/sign-in?callbackUrl=%2Fonboarding"
            className="text-slate-600 underline underline-offset-2 hover:text-slate-800"
          >
            Register your organization
          </a>
        </p>
      </div>
    </div>
  );
}

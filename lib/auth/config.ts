import { db } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/notifications/email";
import { defaultSenderAddress } from "@/lib/platform-domain";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import type { NextAuthConfig } from "next-auth";
import type { Provider } from "next-auth/providers";
import Auth0 from "next-auth/providers/auth0";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { z } from "zod";
import {
  type SsoProfileClaims,
  decideSsoSignIn,
  isLocalPasswordLoginAllowed,
  ssoConfig,
} from "./sso";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const credentialsProvider = Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    const parsed = credentialsSchema.safeParse(credentials);
    if (!parsed.success) return null;

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      // @ts-expect-error _bypassTenancyCheck is custom middleware flag
      _bypassTenancyCheck: true,
    });

    if (!user?.passwordHash) return null;

    const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!isValid) return null;

    return user;
  },
});

/**
 * The providers this deployment offers.
 *
 * Built from the environment rather than listed flat, because two of them are
 * conditional and a provider that is registered but unconfigured fails at the
 * redirect rather than at boot - on somebody else's domain, with an error page
 * this codebase cannot improve.
 *
 * Single sign-on is additive. Google, the emailed link and email-and-password
 * all keep working, and email-and-password only leaves when somebody
 * deliberately sets ALLOW_LOCAL_PASSWORD_LOGIN=false.
 */
function buildProviders(): Provider[] {
  const providers: Provider[] = [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: `Steward · Table <${defaultSenderAddress("noreply")}>`,
    }),
  ];

  const sso = ssoConfig();
  if (sso) {
    providers.push(
      Auth0({
        issuer: sso.issuer,
        clientId: sso.clientId,
        clientSecret: sso.clientSecret,
        // Linking by address is safe here *only* because `signIn` below refuses
        // any profile whose address the provider has not verified. Removing
        // that check without also removing this flag would let anyone who can
        // assert an address take over the account that already owns it.
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (isLocalPasswordLoginAllowed()) {
    providers.push(credentialsProvider);
  }

  return providers;
}

export const authConfig: NextAuthConfig = {
  // The route handler lives at `app/auth/[...nextauth]`, not the Auth.js default
  // `app/api/auth/[...nextauth]`. Without this, Auth.js keeps its default
  // `/api/auth` basePath and every session / csrf / callback request 404s with
  // "UnknownAction: Cannot parse action at /auth/session" — sign-in cannot work
  // at all. The custom `pages` paths below are unrelated (those are UI routes).
  basePath: "/auth",
  adapter: PrismaAdapter(db),
  session: {
    strategy: "jwt",
  },
  providers: buildProviders(),
  callbacks: {
    async session({ session, user, token }) {
      // Auth.js uses database sessions with OAuth providers but JWT sessions
      // with the Credentials provider (even when adapter is configured).
      // Support both: database sessions supply `user`, JWT sessions supply `token.sub`.
      const userId = user?.id ?? (token?.sub as string | undefined);
      if (!userId) return session;

      // Attach memberships to session for downstream use
      const memberships = await db.membership.findMany({
        where: {
          userId,
          status: "ACTIVE",
          churchId: { not: undefined },
        },
        select: {
          id: true,
          churchId: true,
          roles: true,
          status: true,
        },
        // @ts-expect-error _bypassTenancyCheck is custom middleware flag
        _bypassTenancyCheck: true,
      });

      return {
        ...session,
        user: {
          ...session.user,
          id: userId,
          memberships,
        },
      };
    },
    async signIn({ account, profile, user }) {
      if (!user?.email) return false;

      // Single sign-on is the one path that can land on an account which
      // already exists, by matching an address. Everything downstream of that
      // match trusts the identity provider's word that the address belongs to
      // whoever is holding it, so refuse when it has not said so.
      if (account?.provider === "auth0") {
        const decision = decideSsoSignIn(profile as SsoProfileClaims | undefined);
        if (!decision.ok) {
          console.warn(`[sso] refused a sign-in: ${decision.reason}`);
          return false;
        }
      }

      return true;
    },
    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/auth/sign-in",
    error: "/auth/error",
    verifyRequest: "/auth/verify",
  },
  events: {
    async signIn({ user, isNewUser }) {
      if (isNewUser && user.id) {
        await sendWelcomeEmail(user.id);
      }
    },
  },
};

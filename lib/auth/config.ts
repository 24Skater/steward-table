import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/notifications/email";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(db),
  session: {
    strategy: "database",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: "Steward Table <noreply@table.steward.app>",
    }),
    Credentials({
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
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (!user?.id) return session;

      // Attach memberships to session for downstream use
      const memberships = await db.membership.findMany({
        where: {
          userId: user.id,
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
          id: user.id,
          memberships,
        },
      };
    },
    async signIn({ user, account }) {
      if (!user?.email) return false;
      // Allow sign-in for all valid users
      // Additional restrictions can be applied here (e.g., suspended users)
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

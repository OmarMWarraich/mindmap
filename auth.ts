import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import type { DefaultSession } from 'next-auth';

import { db } from './lib/db/index';
import { users, accounts, sessions, verificationTokens } from './lib/db/schema';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
    } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Account-linking decision: cross-provider email linking is intentionally OFF.
  // `allowDangerousEmailAccountLinking` would silently merge a GitHub and a Google
  // login that present the same email. Auth.js core performs that merge purely on
  // an email match — it does not verify the provider actually confirmed ownership
  // of that email (the default GitHub provider, for one, selects the primary email
  // without checking its `verified` flag). That makes it an account-takeover vector.
  // We follow Auth.js's recommended practice: never auto-link an unauthenticated
  // sign-in. A duplicate-email sign-in surfaces OAuthAccountNotLinked, which the
  // login page explains; users link providers by signing in with the original one.
  // See README "Authentication" for the full rationale.
  providers: [GitHub, Google],
  callbacks: {
    session: ({ session, user }) => ({
      ...session,
      user: {
        ...session.user,
        id: user.id,
      },
    }),
    authorized: async ({ auth: session }) => {
      return !!session;
    },
  },
  pages: {
    signIn: '/login',
  },
});

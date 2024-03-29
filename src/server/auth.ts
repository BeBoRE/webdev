import type { GetServerSidePropsContext } from 'next';
import {
  getServerSession,
  type NextAuthOptions,
  type DefaultSession,
} from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
// eslint-disable-next-line import/extensions
import { env } from '../env.mjs';
import prisma from './db';
import createLog from '../utils/auditLogger';

/**
 * Module augmentation for `next-auth` types.
 * Allows us to add custom properties to the `session` object and keep type
 * safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 * */
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      isAdmin: boolean;
      isBanned: boolean;
      isModerator: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    //   // ...other properties
    isAdmin: boolean;
    isBanned: boolean;
    isModerator: boolean;
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks,
 * etc.
 *
 * @see https://next-auth.js.org/configuration/options
 * */
export const authOptions: NextAuthOptions = {
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        // eslint-disable-next-line no-param-reassign
        session.user.id = user.id;
        // eslint-disable-next-line no-param-reassign
        session.user.isAdmin = user.isAdmin;
        // eslint-disable-next-line no-param-reassign
        session.user.isBanned = user.isBanned;
        // eslint-disable-next-line no-param-reassign
        session.user.isModerator = user.isModerator;
      }
      return session;
    },
  },
  logger: {
    error(code, ...message) {
      createLog({
        action: 'auth_error',
        targetType: 'json',
        target: JSON.stringify({
          code,
          message,
        }),
      });
    },
    warn(code, ...message) {
      createLog({
        action: 'auth_warning',
        targetType: 'json',
        target: JSON.stringify({
          code,
          message,
        }),
      });
    },
  },
  events: {
    linkAccount({ account, user }) {
      createLog({
        action: 'newAccount',
        user: {
          connect: {
            id: user.id,
          },
        },
        targetType: 'providerAccount',
        target: `${account.provider}:${account.providerAccountId}`,
      });
    },
    createUser({ user }) {
      createLog({
        action: 'newUser',
        user: {
          connect: {
            id: user.id,
          },
        },
        targetType: 'user',
        target: user.id,
      });
    },
    signIn({ user }) {
      createLog({
        action: 'signIn',
        user: {
          connect: {
            id: user.id,
          },
        },
        targetType: 'user',
        target: user.id,
      });
    },
  },
  adapter: PrismaAdapter(prisma),
  providers: [
    GithubProvider({
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    }),
    /**
     * ...add more providers here
     *
     * Most other providers require a bit more work than the Discord provider.
     * For example, the GitHub provider requires you to add the
     * `refresh_token_expires_in` field to the Account model. Refer to the
     * NextAuth.js docs for the provider you want to use. Example:
     * @see https://next-auth.js.org/providers/github
     * */
  ],
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the
 * `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 * */
export const getServerAuthSession = (ctx: {
  req: GetServerSidePropsContext['req'];
  res: GetServerSidePropsContext['res'];
}) => {
  return getServerSession(ctx.req, ctx.res, authOptions);
};

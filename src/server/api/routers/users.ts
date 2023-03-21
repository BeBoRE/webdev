import type { User } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { editUserSchema } from '../../../schemas/zodSchema';
import createLog from '../../../utils/auditLogger';
import userToSafeUser from '../../../utils/safeUser';
import {
  createTRPCRouter,
  protectedAdminProcedure,
  protectedProcedure,
} from '../trpc';

const usersRouter = createTRPCRouter({
  getAll: protectedAdminProcedure.query(({ ctx }) =>
    ctx.prisma.user.findMany(),
  ),
  get: protectedAdminProcedure
    .input(z.string())
    .query(async ({ ctx, input: id }) => {
      if (!ctx.session.user.isAdmin && ctx.session.user.id !== id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const user = await ctx.prisma.user.findUnique({
        where: {
          id,
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return userToSafeUser(user);
    }),
  edit: protectedProcedure
    .input(editUserSchema)
    .mutation(async ({ ctx, input }) => {
      if (!ctx.session.user.isAdmin && ctx.session.user.id !== input.id) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const user = await ctx.prisma.user.findUnique({
        where: {
          id: input.id,
        },
      });

      if (!user) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const newUser: User = {
        ...user,
        name: input.name ?? user.name,
      };

      if (ctx.session.user.isModerator || ctx.session.user.isAdmin) {
        newUser.isBanned = input.isBanned ?? user.isBanned;
      }

      if (ctx.session.user.isAdmin) {
        newUser.isModerator = input.isModerator ?? user.isModerator;
      }

      const updatedUser = await ctx.prisma.user.update({
        where: {
          id: input.id,
        },
        data: {
          ...newUser,
        },
      });

      createLog({
        action: 'edit',
        user: {
          connect: {
            id: ctx.session.user.id,
          },
        },
        target: JSON.stringify({ from: user, to: updatedUser }),
        targetType: 'json',
      });

      return userToSafeUser(updatedUser);
    }),
});

export default usersRouter;

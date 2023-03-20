import { z } from 'zod';
import { createTRPCRouter, protectedAdminProcedure } from '../trpc';

const usersRouter = createTRPCRouter({
  getAll: protectedAdminProcedure.query(({ ctx }) =>
    ctx.prisma.user.findMany(),
  ),
  get: protectedAdminProcedure.input(z.string()).query(({ ctx, input: id }) =>
    ctx.prisma.user.findUnique({
      where: {
        id,
      },
    }),
  ),
  ban: protectedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input: { id } }) => {
      const user = await ctx.prisma.user.update({
        where: {
          id,
        },
        data: {
          isBanned: true,
        },
      });

      ctx.prisma.audit
        .create({
          data: {
            action: 'ban',
            userId: ctx.session.user.id,
            target: id,
            targetType: 'user',
          },
        })
        .catch(() => {
          console.error('Failed to create audit log');
        });

      return user;
    }),
  unban: protectedAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input: { id } }) => {
      const user = await ctx.prisma.user.update({
        where: {
          id,
        },
        data: {
          isBanned: false,
        },
      });

      ctx.prisma.audit
        .create({
          data: {
            action: 'unban',
            userId: ctx.session.user.id,
            target: id,
            targetType: 'user',
          },
        })
        .catch(() => {
          console.error('Failed to create audit log');
        });

      return user;
    }),
});

export default usersRouter;

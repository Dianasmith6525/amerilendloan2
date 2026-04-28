import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { ZodError } from "zod";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    // Handle Zod validation errors
    if (error.cause instanceof ZodError) {
      const zodError = error.cause as ZodError<any>;
      const firstError = zodError.issues[0];
      
      // Map Zod errors to user-friendly messages
      if (firstError) {
        const field = firstError.path.join('.');
        const message = firstError.message;
        
        // Custom messages for common validation errors
        // Handle both Zod v3 ("Invalid email") and Zod v4 ("Invalid email address") formats
        if (message.toLowerCase().includes('email') || message.toLowerCase().includes('invalid email')) {
          return {
            ...shape,
            message: "Please enter a valid email address",
          };
        }
        
        // Handle both Zod v3 ("at least 8") and Zod v4 (">=8 characters", "Too small") formats
        if ((message.includes('at least') || message.includes('Too small') || message.includes('>=')) && field === 'password') {
          return {
            ...shape,
            message: "Password must be at least 8 characters long",
          };
        }
        
        // Handle Zod v4 "Too small" for non-password fields
        if (message.includes('Too small') || message.includes('too_small')) {
          return {
            ...shape,
            message: `${field ? field.charAt(0).toUpperCase() + field.slice(1) : 'Field'} is too short`,
          };
        }

        // Handle regex/pattern errors (Zod v4: "Invalid string: must match pattern ...")
        if (message.includes('must match pattern') || message.includes('Invalid string')) {
          return {
            ...shape,
            message: `${field ? field.charAt(0).toUpperCase() + field.slice(1) : 'Field'} has an invalid format`,
          };
        }

        if (message.includes('Required')) {
          return {
            ...shape,
            message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required`,
          };
        }
        
        // Return user-friendly version of the Zod message
        return {
          ...shape,
          message: field ? `${field.charAt(0).toUpperCase() + field.slice(1)}: ${message}` : message,
        };
      }
    }
    
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

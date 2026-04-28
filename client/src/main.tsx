import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";
import "./i18n/config";

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

const queryClient = new QueryClient();

// Public/auth routes that should never trigger an auto-redirect to /login
// when an unauthenticated query happens to fire (e.g. greeting widgets that
// call auth.me on the marketing page). Without this guard, an UNAUTHED error
// could bounce the user away from /login while they're trying to log in.
const PUBLIC_AUTH_PATHS = new Set([
  "/login",
  "/otp-login",
  "/forgot-password",
  "/auth/callback",
  "/auth/reset-password",
]);

function shouldSkipAuthRedirect(pathname: string): boolean {
  if (PUBLIC_AUTH_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/legal/")) return true;
  if (pathname.startsWith("/public/legal/")) return true;
  if (pathname === "/" || pathname === "") return true;
  return false;
}

function redirectToLoginIfUnauthorized(error: unknown) {
  if (!(error instanceof TRPCClientError)) return;
  if (error.message !== UNAUTHED_ERR_MSG) return;
  if (typeof window === "undefined") return;

  const { pathname, search } = window.location;
  if (shouldSkipAuthRedirect(pathname)) return;

  // Preserve the page the user was trying to reach so we can return them
  // there after a successful login.
  const next = encodeURIComponent(pathname + search);
  window.location.href = `/login?next=${next}`;
}

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.query.state.error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    redirectToLoginIfUnauthorized(event.mutation.state.error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: (input, init) => globalThis.fetch(input, { ...init, credentials: "include" }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>
);

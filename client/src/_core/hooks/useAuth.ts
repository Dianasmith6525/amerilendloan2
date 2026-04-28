import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useMemo, useRef } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/login" } =
    options ?? {};
  const utils = trpc.useUtils();
  const loggingOut = useRef(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logout = useCallback(() => {
    if (loggingOut.current) return;
    loggingOut.current = true;

    // Immediately clear cached user data so the UI reflects logged-out state
    utils.auth.me.setData(undefined, null);

    // Clear all client-side storage
    localStorage.clear();
    sessionStorage.clear();

    // Clear client-accessible cookies (consent, preferences, etc.)
    document.cookie.split(";").forEach((c) => {
      const name = c.split("=")[0].trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
    });

    // Navigate to the dedicated server-side logout endpoint.
    // This guarantees the httpOnly session cookie is cleared via Set-Cookie
    // header on a direct browser navigation (not a fetch/tRPC call that may
    // have its Set-Cookie headers stripped by Vercel's rewrite proxy).
    // The server redirects back to "/" after clearing the cookie.
    window.location.href = "/api/logout";
  }, [utils]);

  const state = useMemo(() => {
    // Treat as loading when no user yet AND a (re)fetch is in-flight.
    // This prevents the brief "not authenticated" flash between login and cache refresh.
    const isResolving =
      meQuery.isLoading ||
      loggingOut.current ||
      (!meQuery.data && meQuery.isFetching);
    return {
      user: meQuery.data ?? null,
      loading: isResolving,
      error: meQuery.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    meQuery.isFetching,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || loggingOut.current) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}

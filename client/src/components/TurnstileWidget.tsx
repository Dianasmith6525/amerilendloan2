import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * Cloudflare Turnstile widget wrapper.
 *
 * Configure VITE_TURNSTILE_SITE_KEY in the client env to enable. Without it,
 * the component renders nothing and `useTurnstile()` returns a stub that lets
 * forms submit normally (matching the server's soft-fail behavior).
 *
 * Usage:
 *   const { token, isReady, isEnabled, widget, reset } = useTurnstile();
 *   ...
 *   <form onSubmit={(e) => { e.preventDefault(); mutate({ ..., turnstileToken: token ?? undefined }); }}>
 *     {widget}
 *     <Button disabled={!isReady}>Submit</Button>
 *   </form>
 *
 * On submit-error, call `reset()` because Turnstile tokens are single-use.
 */

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      "timeout-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "invisible" | "flexible";
      action?: string;
      appearance?: "always" | "execute" | "interaction-only";
    },
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
  getResponse: (widgetId?: string) => string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      // Another caller already started loading; piggyback on its onload.
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile script failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null; // Allow retry on next mount
      reject(new Error("turnstile script failed to load"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export interface UseTurnstileOptions {
  /** Optional action label shown in Cloudflare analytics (e.g. "loan-submit"). */
  action?: string;
  /** Visual theme. Defaults to auto. */
  theme?: "light" | "dark" | "auto";
  /** Widget size. "flexible" fills container width; "invisible" runs without UI. */
  size?: "normal" | "compact" | "invisible" | "flexible";
}

export interface UseTurnstileResult {
  /** The verified token to send to the server. null until user solves the challenge. */
  token: string | null;
  /** True when verification is enabled (site key configured) AND a token is available, OR when verification is disabled. */
  isReady: boolean;
  /** True when VITE_TURNSTILE_SITE_KEY is configured. */
  isEnabled: boolean;
  /** Render this in your form to mount the challenge widget. */
  widget: React.ReactNode;
  /** Reset the widget. Call this after a failed submission since tokens are single-use. */
  reset: () => void;
}

const SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() || "";

export function useTurnstile(options: UseTurnstileOptions = {}): UseTurnstileResult {
  const { action, theme = "auto", size = "flexible" } = options;
  // Callback ref pattern (instead of useRef) so the render effect re-fires
  // whenever a *different* container DOM node attaches. The widget JSX is
  // commonly placed inside conditionally-rendered branches (login tabs,
  // signup form, reset form), so the same hook instance can see its
  // container unmount and a fresh one mount. With a plain useRef the render
  // effect would never re-run, and the new container would stay empty.
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const containerId = useId();

  const isEnabled = Boolean(SITE_KEY);

  // Load the Cloudflare script once per page.
  useEffect(() => {
    if (!isEnabled) return;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (!cancelled) setScriptReady(true);
      })
      .catch(() => {
        // Script failed to load (network issue, ad blocker, etc.). Leave
        // scriptReady=false so the form stays disabled rather than silently
        // accepting unverified submissions.
      });
    return () => {
      cancelled = true;
    };
  }, [isEnabled]);

  // Render the widget once the script is loaded *and* a container is
  // attached. Re-runs when the container element changes (e.g. user switches
  // login tabs and a fresh div mounts).
  useEffect(() => {
    if (!isEnabled || !scriptReady || !containerEl || !window.turnstile) return;

    // Stale widget id from a previous (now-unmounted) container. Tell
    // Turnstile to forget it before we render into the fresh container.
    if (widgetIdRef.current) {
      try {
        window.turnstile.remove(widgetIdRef.current);
      } catch {
        /* widget already gone with its old DOM node */
      }
      widgetIdRef.current = null;
    }

    // Tokens are scoped to a specific widget render; clear any cached one
    // since we are about to mount a brand-new challenge.
    setToken(null);

    try {
      const widgetId = window.turnstile.render(containerEl, {
        sitekey: SITE_KEY,
        action,
        theme,
        size,
        callback: (newToken) => setToken(newToken),
        "error-callback": () => setToken(null),
        "expired-callback": () => setToken(null),
        "timeout-callback": () => setToken(null),
      });
      widgetIdRef.current = widgetId;
    } catch (err) {
      // Render can throw if the container is reused; safe to ignore — the
      // existing widget is still functional.
      console.warn("[turnstile] render failed:", err);
    }

    return () => {
      const id = widgetIdRef.current;
      if (id && window.turnstile) {
        try {
          window.turnstile.remove(id);
        } catch {
          /* widget already removed */
        }
      }
      widgetIdRef.current = null;
    };
  }, [isEnabled, scriptReady, containerEl, action, theme, size]);

  const reset = useCallback(() => {
    setToken(null);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        /* no-op */
      }
    }
  }, []);

  const widget = isEnabled ? (
    <div
      ref={setContainerEl}
      id={`turnstile-${containerId}`}
      className="cf-turnstile my-3"
      aria-label="Verify you are human"
    />
  ) : null;

  return {
    token,
    // When disabled, treat as ready so forms aren't gated. When enabled, ready
    // requires a solved token.
    isReady: isEnabled ? token !== null : true,
    isEnabled,
    widget,
    reset,
  };
}

/**
 * Standalone widget for use outside hook callers (e.g. in a context provider).
 */
export function TurnstileWidget(props: UseTurnstileOptions & { onVerify: (token: string | null) => void }) {
  const { onVerify, ...opts } = props;
  const { token, widget } = useTurnstile(opts);
  useEffect(() => {
    onVerify(token);
  }, [token, onVerify]);
  return <>{widget}</>;
}

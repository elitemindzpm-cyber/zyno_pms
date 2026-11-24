import { kvStore } from "@/lib/kv-store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppDataProvider } from "../lib/app-data-context";
import { FinanceProvider } from "../lib/finance/finance-store";
import { authApi } from "../lib/api-client";
import { hydrateKv } from "../lib/kv-store";
import { IdleSessionGuard } from "../components/idle-session-guard";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-xl text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {error?.message && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive text-xs rounded-lg text-left font-mono overflow-auto max-h-40">
            {error.message}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Enterprise Property Management OS" },
      { name: "description", content: "Enterprise Property Management, Real Estate ERP & Tenant Experience Platform" },
      { name: "author", content: "Property Management OS" },
      { property: "og:title", content: "Enterprise Property Management OS" },
      { property: "og:description", content: "Enterprise Property Management, Real Estate ERP & Tenant Experience Platform" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


// The app no longer keeps any data in browser storage. Remove what earlier versions left behind.
if (typeof window !== "undefined") {
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    /* storage blocked: nothing to clear */
  }
  try {
    document.cookie = "sidebar_state=; path=/; max-age=0";
  } catch {
    /* ignore */
  }
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [ready, setReady] = useState(false);

  // Restore the session (tenant id) from the auth cookie, then load this tenant's saved data from the API.
  useEffect(() => {
    let alive = true;
    // Never hold the whole app behind a slow request: give up after a few seconds and render.
    const withTimeout = (p: Promise<unknown>, ms: number) =>
      Promise.race([p, new Promise((resolve) => setTimeout(resolve, ms))]);
    (async () => {
      try {
        await withTimeout(authApi.getSession(), 4000);
      } catch {
        /* not logged in */
      }
      try {
        await withTimeout(hydrateKv(), 6000);
      } catch (err) {
        console.error("[kv] failed to load saved data from the API", err);
      }
      if (alive) setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {/* AppDataProvider — single Db-backed real-time store shared across all roles */}
      <AppDataProvider>
        <FinanceProvider>
          {/* Required: nested routes render here */}
          <Outlet />
          <IdleSessionGuard />
          <Toaster position="top-center" richColors />
        </FinanceProvider>
      </AppDataProvider>
    </QueryClientProvider>
  );
}

// Idle-session guard. After VITE_IDLE_TIMEOUT_MINUTES (default 60) without mouse, keyboard, touch or
// scroll activity, the session is ended, a "Session Expired" dialog is shown, and the user is taken to
// /auth with the page they were on as a return URL.
import { useEffect, useRef, useState } from "react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { authApi } from "@/lib/api-client";

const configuredMinutes = Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? 60);
export const IDLE_TIMEOUT_MS = (Number.isFinite(configuredMinutes) && configuredMinutes > 0 ? configuredMinutes : 60) * 60_000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
const CHECK_EVERY_MS = 5_000;

/** "30 seconds", "1 minute", "1.5 minutes" — the configured timeout, stated as it really is. */
export function formatIdle(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} seconds`;
  const minutes = ms / 60_000;
  const shown = Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1);
  return `${shown} ${minutes === 1 ? "minute" : "minutes"}`;
}

export function IdleSessionGuard() {
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [expired, setExpired] = useState(false);
  const lastActivity = useRef(Date.now());
  const returnPath = useRef(pathname);

  // Keep the return URL current while the user is signed in.
  useEffect(() => {
    if (!expired) returnPath.current = pathname;
  }, [pathname, expired]);

  useEffect(() => {
    if (pathname.startsWith("/auth")) return;
    lastActivity.current = Date.now();
    let checking = false;
    const mark = () => { lastActivity.current = Date.now(); };
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = window.setInterval(async () => {
      if (checking || Date.now() - lastActivity.current < IDLE_TIMEOUT_MS) return;
      checking = true;
      window.clearInterval(timer);
      // Only a signed-in user gets the dialog; visitors who were never signed in are left alone.
      const session: any = await authApi.getSession().catch(() => null);
      if (session?.user) {
        setExpired(true);
        await authApi.logout();
      }
    }, CHECK_EVERY_MS);
    return () => {
      window.clearInterval(timer);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, mark));
    };
  }, [pathname]);

  const signInAgain = () => {
    const redirect = returnPath.current && !returnPath.current.startsWith("/auth") ? returnPath.current : "/";
    void router.navigate({ to: "/auth", search: { redirect } as any });
  };

  return (
    <Dialog open={expired} onOpenChange={() => { /* must sign in again; not dismissible */ }}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Session Expired</DialogTitle>
          <DialogDescription>
            You were signed out after {formatIdle(IDLE_TIMEOUT_MS)} of inactivity. Sign in again to continue.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={signInAgain}>Sign in again</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

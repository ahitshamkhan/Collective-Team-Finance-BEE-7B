"use client";
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCheck, LockKeyhole, ShieldCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { SelfView } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Badge } from "./primitives";
import { Brand } from "./portal-shell";
type Challenge = {
  next_step: string;
  expires_in_seconds: number;
  resend_after_seconds: number;
};
type Timing = { expires: number; resend: number };
const ChallengeContext = createContext<{
  timing: Timing | null;
  setTiming: (t: Timing) => void;
}>({ timing: null, setTiming: () => {} });
export function AuthLayout({ children }: { children: ReactNode }) {
  const [timing, setTiming] = useState<Timing | null>(null);
  return (
    <ChallengeContext.Provider value={{ timing, setTiming }}>
      <main className="grid min-h-dvh lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="relative flex flex-col justify-between bg-sidebar p-7 text-sidebar-foreground lg:p-12 xl:p-16">
          <Link href="/login" className="w-fit">
            <Brand />
          </Link>
          <div className="my-12 max-w-lg lg:my-20">
            <p className="mb-5 text-xs font-medium tracking-[0.25em] text-sidebar-foreground/65">
              A SHARED PURPOSE
            </p>
            <h1 className="font-heading text-4xl leading-tight sm:text-5xl">
              Every contribution.
              <br />
              One collective.
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-sidebar-foreground/75">
              A private workspace for transparent team finances. Keep
              contributions, expenses and decisions together in one clear
              record.
            </p>
            <div className="mt-9 grid gap-4 text-sm">
              {[
                "One shared collective fund",
                "Clear records for approved members",
                "Verified administrator access",
              ].map((t) => (
                <p key={t} className="flex items-center gap-3">
                  <CheckCheck
                    aria-hidden
                    className="size-5 text-sidebar-foreground/70"
                  />
                  {t}
                </p>
              ))}
            </div>
          </div>
          <p className="hidden text-xs text-sidebar-foreground/60 lg:block">
            Collective Finance Portal · PKR · Asia/Karachi
          </p>
        </aside>
        <section className="flex items-center justify-center p-6 py-12 sm:p-12">
          <div className="w-full max-w-md">{children}</div>
        </section>
      </main>
    </ChallengeContext.Provider>
  );
}
export type AuthMode =
  | "login"
  | "register"
  | "verify"
  | "pending"
  | "forgot-password"
  | "reset-password";
const titles: Record<AuthMode, string> = {
  login: "Welcome back",
  register: "Request your account",
  verify: "Check your email",
  pending: "Your account status",
  "forgot-password": "Recover your account",
  "reset-password": "Set a new password",
};
const descriptions: Record<AuthMode, string> = {
  login: "Sign in to your collective finance workspace.",
  register:
    "Verify your email, then wait for an administrator to match your account to the authorized roster.",
  verify:
    "Enter the six digit code sent for your current verification request. Never share this code.",
  pending:
    "Only your own account status is available until access is approved.",
  "forgot-password":
    "If an eligible account exists, a recovery code will be sent to its email address.",
  "reset-password":
    "Enter your recovery code and a new password. Existing sessions will be revoked.",
};
export function AuthScreen({
  mode,
  development = false,
}: {
  mode: AuthMode;
  development?: boolean;
}) {
  const router = useRouter();
  const { timing, setTiming } = useContext(ChallengeContext);
  const [now, setNow] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<SelfView | null>(null);
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);
  const resendSeconds = now
    ? Math.max(0, Math.ceil(((timing?.resend || 0) - now) / 1000))
    : 0;
  const blocked = now && cooldown > now;
  function challenge(result: Challenge) {
    if (
      !Number.isFinite(result.expires_in_seconds) ||
      !Number.isFinite(result.resend_after_seconds)
    )
      throw new Error("The verification service returned an invalid response.");
    setTiming({
      expires: Date.now() + result.expires_in_seconds * 1000,
      resend: Date.now() + result.resend_after_seconds * 1000,
    });
  }
  function signedIn(result: SelfView) {
    if (!result.user_id || !["full", "status"].includes(result.session_kind))
      throw new Error("The sign in service returned an invalid response.");
    router.replace(
      result.status === "approved" && result.session_kind === "full"
        ? "/overview"
        : "/pending",
    );
  }
  function failed(e: unknown) {
    setError((e as Error).message);
    if (e instanceof ApiError && e.retryAfter)
      setCooldown(Date.now() + e.retryAfter * 1000);
  }
  async function status() {
    setBusy(true);
    setError("");
    try {
      setProfile(await api<SelfView>("/auth/me"));
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (mode !== "pending") return;
    const abort = new AbortController();
    const unauthorized = () => {
      abort.abort();
      setProfile(null);
      router.replace("/login");
    };
    window.addEventListener("portal:unauthorized", unauthorized);
    api<SelfView>("/auth/me", { signal: abort.signal })
      .then((p) => {
        if (!abort.signal.aborted) setProfile(p);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError((e as Error).message);
      });
    return () => {
      abort.abort();
      window.removeEventListener("portal:unauthorized", unauthorized);
    };
  }, [mode, router]);
  async function resend() {
    setBusy(true);
    setError("");
    try {
      const result = await api<Challenge>("/auth/otp/resend", {
        method: "POST",
        body: "{}",
      });
      challenge(result);
      setNotice(
        "A new verification request was accepted. If delivered, use the latest code.",
      );
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError("");
    setNotice("");
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) || "");
    if (
      (mode === "register" || mode === "reset-password") &&
      get("password") !== get("confirm")
    ) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const result = await api<SelfView | Challenge>("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: get("email").trim(),
            password: get("password"),
          }),
        });
        if ("next_step" in result) {
          challenge(result);
          router.push("/verify");
        } else signedIn(result);
      }
      if (mode === "register") {
        challenge(
          await api<Challenge>("/auth/register", {
            method: "POST",
            body: JSON.stringify({
              name: get("name").trim(),
              email: get("email").trim(),
              password: get("password"),
            }),
          }),
        );
        router.push("/verify");
      }
      if (mode === "verify")
        signedIn(
          await api<SelfView>("/auth/otp/verify", {
            method: "POST",
            body: JSON.stringify({ code: get("code") }),
          }),
        );
      if (mode === "forgot-password") {
        challenge(
          await api<Challenge>("/auth/password/recovery", {
            method: "POST",
            body: JSON.stringify({ email: get("email").trim() }),
          }),
        );
        router.push("/reset-password");
      }
      if (mode === "reset-password") {
        await api("/auth/password/reset", {
          method: "POST",
          body: JSON.stringify({
            code: get("code"),
            new_password: get("password"),
          }),
        });
        form.reset();
        setNotice(
          "Your password has been reset. Sign in with your new password.",
        );
      }
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await api("/auth/logout", { method: "POST", body: "{}" });
      setProfile(null);
      router.replace("/login");
    } catch (e) {
      failed(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="mb-7">
        <span className="mb-5 flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {mode === "verify" ? (
            <ShieldCheck aria-hidden />
          ) : (
            <LockKeyhole aria-hidden />
          )}
        </span>
        <h2 className="font-heading text-3xl">{titles[mode]}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {descriptions[mode]}
        </p>
      </div>
      {mode === "pending" ? (
        <div className="grid gap-5">
          {profile ? (
            <div className="rounded-xl border bg-card p-5">
              <p className="mb-3 break-words text-sm font-medium">
                {profile.name}
              </p>
              <Badge
                tone={profile.status === "approved" ? "success" : "warning"}
              >
                {profile.status}
              </Badge>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {profile.status === "approved"
                  ? "Your account is approved. Sign out and sign in again to open a full session."
                  : profile.status === "rejected"
                    ? "Your request was not approved. Contact your administrator for guidance."
                    : profile.status === "suspended"
                      ? "Access is suspended. Contact your administrator."
                      : "Your account does not yet have access to shared financial records. You can refresh this status after administrator review."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Account status is shown only after the secure service confirms
              your session.
            </p>
          )}
          <Button onClick={status} disabled={busy}>
            Refresh account status
          </Button>
          <Button variant="outline" onClick={logout} disabled={busy}>
            Sign out
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-5">
          {mode === "register" && (
            <Field label="Full name" id="auth-name">
              <Input
                id="auth-name"
                name="name"
                autoComplete="name"
                required
                maxLength={140}
              />
            </Field>
          )}
          {["login", "register", "forgot-password"].includes(mode) && (
            <Field label="Email address" id="auth-email">
              <Input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={254}
              />
            </Field>
          )}
          {["verify", "reset-password"].includes(mode) && (
            <>
              <Field label="Verification code" id="auth-code">
                <Input
                  id="auth-code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.35em]"
                />
              </Field>
              {timing && now > 0 && (
                <p className="text-xs text-muted-foreground">
                  {timing.expires > now
                    ? `Code request expires in ${Math.ceil((timing.expires - now) / 1000)} seconds.`
                    : "This code request has expired. Request another code."}
                </p>
              )}
            </>
          )}
          {["login", "register", "reset-password"].includes(mode) && (
            <Field
              label={mode === "reset-password" ? "New password" : "Password"}
              id="auth-password"
              hint={mode !== "login" ? "Use 12 to 128 characters." : undefined}
            >
              <Input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={mode === "login" ? 1 : 12}
                maxLength={128}
              />
            </Field>
          )}
          {["register", "reset-password"].includes(mode) && (
            <Field label="Confirm password" id="auth-confirm">
              <Input
                id="auth-confirm"
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </Field>
          )}
          {mode === "login" && (
            <Link
              href="/forgot-password"
              className="justify-self-end text-sm font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          )}
          <Button type="submit" className="w-full" disabled={busy || !!blocked}>
            {busy
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Request account"
                  : mode === "verify"
                    ? "Verify code"
                    : mode === "forgot-password"
                      ? "Request recovery code"
                      : "Reset password"}
          </Button>
          {["verify", "reset-password"].includes(mode) && (
            <Button
              type="button"
              variant="outline"
              disabled={busy || !!blocked || resendSeconds > 0}
              onClick={resend}
            >
              {resendSeconds > 0
                ? `Resend available in ${resendSeconds}s`
                : "Resend code"}
            </Button>
          )}
        </form>
      )}
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {!!blocked && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Please wait {Math.ceil((cooldown - now) / 1000)} seconds before trying
          again.
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm"
        >
          {notice}
        </p>
      )}
      <div className="mt-7 border-t pt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            New to the workspace?{" "}
            <Link
              className="font-medium text-primary hover:underline"
              href="/register"
            >
              Request an account
            </Link>
          </>
        ) : (
          <Link
            className="inline-flex min-h-11 items-center gap-2 font-medium text-primary hover:underline"
            href="/login"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to sign in
          </Link>
        )}
      </div>
      {development && mode === "login" && (
        <Link
          href="/dev/preview/overview"
          className="mt-5 block rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground hover:bg-muted"
        >
          Open synthetic interface preview (development only)
        </Link>
      )}
    </>
  );
}

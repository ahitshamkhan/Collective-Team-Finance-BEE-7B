"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { SelfView } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Field, Panel } from "./primitives";
export function AccountPanel({
  profile,
  preview,
}: {
  profile: SelfView;
  preview: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function change(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("new_password") !== f.get("confirm")) {
      setMessage("The new passwords do not match.");
      return;
    }
    await action("/auth/password/change", {
      current_password: f.get("current_password"),
      new_password: f.get("new_password"),
    });
  }
  async function action(path: string, body: unknown) {
    setMessage("");
    if (preview) {
      setMessage("Preview only. No password or session was changed.");
      return;
    }
    setBusy(true);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      window.dispatchEvent(new Event("portal:unauthorized"));
      router.replace("/login");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Panel
        title="Account information"
        description="Your identity and workspace access."
      >
        <dl className="grid gap-5 p-6">
          {Object.entries({
            Name: profile.name,
            Email: profile.email,
            Access: profile.role === "admin" ? "FIP Lead" : "Read only member",
            "Linked member": profile.member_id || "Not yet linked",
          }).map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
            </div>
          ))}
          <div>
            <dt className="mb-2 text-xs text-muted-foreground">Status</dt>
            <dd>
              <Badge tone="success">{profile.status}</Badge>
            </dd>
          </div>
        </dl>
        <div className="border-t p-6">
          <h3 className="mb-2 font-medium">Session security</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Sign out on every device. Your next sign in will require the
            applicable verification steps.
          </p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => action("/auth/logout-all", {})}
          >
            Sign out of all sessions
          </Button>
        </div>
      </Panel>
      <Panel
        title="Change password"
        description="Use at least 12 characters. You will sign in again after changing it."
      >
        <form onSubmit={change} className="grid gap-5 p-6">
          <Field label="Current password" id="current-password">
            <Input
              id="current-password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="New password" id="new-password">
            <Input
              id="new-password"
              name="new_password"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Confirm new password" id="confirm-password">
            <Input
              id="confirm-password"
              name="confirm"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Update password"}
          </Button>
        </form>
      </Panel>
      {message && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-card p-4 text-sm xl:col-span-2"
        >
          {message}
        </p>
      )}
    </div>
  );
}

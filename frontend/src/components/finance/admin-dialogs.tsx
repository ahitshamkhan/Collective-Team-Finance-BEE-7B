"use client";
import { useState, type FormEvent } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import type {
  WorkspaceData,
  MemberView,
  GroupView,
  RegistrationView,
} from "@/lib/contracts";
import { Field } from "./primitives";
import { MemberSelect } from "./financial-forms";
export type AdminAction =
  | {
      kind: "approve" | "reject" | "suspend" | "restore";
      record: RegistrationView;
    }
  | { kind: "member"; record: MemberView }
  | { kind: "group"; record: GroupView };
export function AdminActionDialog({
  action,
  data,
  preview,
  onClose,
  onSaved,
}: {
  action: AdminAction;
  data: WorkspaceData;
  preview: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const titles = {
    approve: "Approve registration",
    reject: "Reject registration",
    suspend: "Suspend account",
    restore: "Restore account",
    member: "Edit member",
    group: "Edit group",
  };
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (preview) {
      setError("Preview only. No account or roster record was changed.");
      return;
    }
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const value = (k: string) => String(f.get(k) || "").trim();
    let path = "";
    let body: Record<string, unknown> = {
      expected_version: action.record.version,
    };
    let method = "POST";
    if (action.kind === "member") {
      path = `/admin/members/${action.record.id}`;
      method = "PATCH";
      body = { ...body, name: value("name"), group_id: value("group_id") };
    } else if (action.kind === "group") {
      path = `/admin/groups/${action.record.id}`;
      method = "PATCH";
      body = { ...body, name: value("name") };
    } else {
      path =
        action.kind === "approve" || action.kind === "reject"
          ? `/admin/registrations/${action.record.id}/${action.kind}`
          : `/admin/users/${action.record.id}/${action.kind}`;
      body = {
        ...body,
        ...(action.kind === "approve"
          ? { member_id: value("member_id") }
          : { reason: value("reason") }),
      };
    }
    try {
      await api(path, { method, body: JSON.stringify(body) });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={titles[action.kind]}
      description={action.record.name}
    >
      <form onSubmit={submit} className="grid gap-5">
        {action.kind === "approve" ? (
          <>
            <p className="text-sm leading-6 text-muted-foreground">
              Link this verified applicant to one available roster member. This
              grants member access only, never administrator privileges.
            </p>
            <Field label="Roster member" id="approval-member">
              <MemberSelect id="approval-member" members={data.available} />
            </Field>
          </>
        ) : action.kind === "member" || action.kind === "group" ? (
          <>
            <Field label="Name" id="edit-name">
              <Input
                id="edit-name"
                name="name"
                required
                maxLength={140}
                defaultValue={action.record.name}
              />
            </Field>
            {action.kind === "member" && (
              <>
                <Field label="Current group" id="edit-group">
                  <Select
                    id="edit-group"
                    name="group_id"
                    defaultValue={action.record.current_group.id}
                  >
                    {data.groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.code} · {g.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-sm text-muted-foreground">
                  Changing this assignment does not rewrite historical
                  transaction attribution.
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {action.kind === "suspend"
                ? "Suspension revokes active sessions. Administrator suspension policies must be enforced by the secure service."
                : action.kind === "restore"
                  ? "Restore the previous account status. This does not automatically approve an applicant."
                  : "This registration will not receive access to financial records."}
            </p>
            <Field label="Reason" id="action-reason">
              <Textarea
                id="action-reason"
                name="reason"
                minLength={5}
                maxLength={500}
                required
              />
            </Field>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Submitting…" : titles[action.kind]}
        </Button>
      </form>
    </Dialog>
  );
}

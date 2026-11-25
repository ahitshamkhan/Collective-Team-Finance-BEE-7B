"use client";
import { useId, useRef, useState, type FormEvent } from "react";
import type { GroupView, MemberView, TransactionView } from "@/lib/contracts";
import { api, ApiError } from "@/lib/api";
import { businessToday } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Field, Panel } from "./primitives";
export type WriteAttempt = {
  key: string | null;
  body: string;
  uncertain: boolean;
};
const newAttempt = (): WriteAttempt => ({
  key: null,
  body: "",
  uncertain: false,
});
function rejectedWithoutWrite(error: unknown) {
  return (
    error instanceof ApiError &&
    [400, 403, 404, 409, 422, 429].includes(error.status)
  );
}
export function MemberSelect({
  members,
  id = "member_id",
  name = "member_id",
  optional = false,
  defaultValue,
  disabled = false,
}: {
  members: Pick<MemberView, "id" | "name">[];
  id?: string;
  name?: string;
  optional?: boolean;
  defaultValue?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      id={id}
      name={name}
      required={!optional}
      defaultValue={defaultValue || ""}
      disabled={disabled}
    >
      <option value="">
        {optional ? "No associated member" : "Select a member"}
      </option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
        </option>
      ))}
    </Select>
  );
}
export function FinancialForm({
  kind,
  members,
  groups,
  preview,
  onSaved,
  original,
  reason,
  mode = "create",
  getAttempt,
  onBusyChange,
}: {
  kind: "deposit" | "expense";
  members: MemberView[];
  groups: GroupView[];
  preview: boolean;
  onSaved: () => void;
  original?: TransactionView;
  reason?: string;
  mode?: "create" | "replace";
  getAttempt?: () => WriteAttempt;
  onBusyChange?: (busy: boolean) => void;
}) {
  const formId = useId();
  const fieldId = (name: string) => `${formId}-${name}`;
  const [category, setCategory] = useState(
    original?.expense_category || "group",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const localAttempt = useRef<WriteAttempt>(newAttempt());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const attempt = getAttempt?.() ?? localAttempt.current;
    setError("");
    setSuccess("");
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) || "").trim();
    if (
      !/^\d+(\.\d{1,2})?$/.test(get("amount")) ||
      /^0+(\.0{1,2})?$/.test(get("amount"))
    ) {
      setError(
        "Enter a positive PKR amount with no more than two decimal places.",
      );
      return;
    }
    if (get("amount").split(".")[0].replace(/^0+/, "").length > 12) {
      setError("The amount cannot exceed PKR 999,999,999,999.99.");
      return;
    }
    if (!get("description") || (kind === "expense" && !get("title"))) {
      setError(
        "Enter a description and, for expenses, a title with nonblank text.",
      );
      return;
    }
    if (preview) {
      setError(
        "Preview only. No transaction was saved. Connect the secure API to record financial changes.",
      );
      return;
    }
    const payload =
      kind === "deposit"
        ? {
            member_id: get("member_id"),
            amount: get("amount"),
            payment_date: get("date"),
            description: get("description"),
          }
        : {
            title: get("title"),
            amount: get("amount"),
            expense_date: get("date"),
            category,
            group_id: category === "group" ? get("group_id") : null,
            associated_member_id: get("member_id") || null,
            description: get("description"),
          };
    const body = JSON.stringify(
      mode === "replace" ? { reason, replacement: payload } : payload,
    );
    if (attempt.key && attempt.body !== body) {
      setError(
        "The previous request may have reached the server. Restore its values and retry, or check the ledger before starting a new transaction.",
      );
      return;
    }
    attempt.key ??= crypto.randomUUID();
    attempt.body = body;
    setBusy(true);
    onBusyChange?.(true);
    try {
      await api(
        mode === "replace"
          ? `/transactions/${original!.id}/replace`
          : kind === "deposit"
            ? "/deposits"
            : "/expenses",
        { method: "POST", headers: { "Idempotency-Key": attempt.key }, body },
      );
      attempt.key = null;
      attempt.body = "";
      attempt.uncertain = false;
      form.reset();
      setSuccess("Transaction recorded.");
      onSaved();
    } catch (err) {
      if (rejectedWithoutWrite(err) && !attempt.uncertain) {
        attempt.key = null;
        attempt.body = "";
      }
      if (!rejectedWithoutWrite(err)) attempt.uncertain = true;
      setError((err as Error).message);
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <form onSubmit={submit} className="grid gap-5">
      <fieldset disabled={busy} className="contents">
        <p className="rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground">
          {kind === "deposit"
            ? "Confirm receipt in your external bank or payment account before recording a deposit."
            : "Verify the expense evidence externally. Expenses reduce the collective fund, not individual contributions."}
        </p>
        {kind === "expense" && (
          <Field id={fieldId("title")} label="Expense title">
            <Input
              id={fieldId("title")}
              name="title"
              required
              maxLength={160}
              defaultValue={original?.title || ""}
            />
          </Field>
        )}
        {kind === "deposit" ? (
          <Field id={fieldId("member_id")} label="Depositing member">
            <MemberSelect
              id={fieldId("member_id")}
              members={members}
              defaultValue={original?.member_id || ""}
            />
          </Field>
        ) : (
          <>
            <Field id={fieldId("category")} label="Expense attribution">
              <Select
                id={fieldId("category")}
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value === "collective" ? "collective" : "group",
                  )
                }
              >
                <option value="group">Technical group</option>
                <option value="collective">Collective expense</option>
              </Select>
            </Field>
            {category === "group" && (
              <Field id={fieldId("group_id")} label="Relevant group">
                <Select
                  id={fieldId("group_id")}
                  name="group_id"
                  required
                  defaultValue={original?.group_id || ""}
                >
                  <option value="">Select a group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.code} · {g.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Field
              id={fieldId("member_id")}
              label="Associated member (optional)"
              hint="Context only. This does not allocate expenses to the member."
            >
              <MemberSelect
                id={fieldId("member_id")}
                members={members}
                optional
                defaultValue={original?.member_id || ""}
              />
            </Field>
          </>
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={fieldId("amount")} label="Amount (PKR)">
            <Input
              id={fieldId("amount")}
              name="amount"
              inputMode="decimal"
              placeholder="0.00"
              required
              pattern="[0-9]+(\.[0-9]{1,2})?"
              defaultValue={original?.amount}
            />
          </Field>
          <Field
            id={fieldId("date")}
            label={kind === "deposit" ? "Payment date" : "Expense date"}
          >
            <Input
              id={fieldId("date")}
              name="date"
              type="date"
              required
              defaultValue={original?.business_date || businessToday()}
            />
          </Field>
        </div>
        <Field id={fieldId("description")} label="Description">
          <Textarea
            id={fieldId("description")}
            name="description"
            required
            maxLength={1000}
            defaultValue={original?.description}
          />
        </Field>
        <p className="text-xs leading-5 text-muted-foreground">
          The secure service supplies the transaction identifier, administrator,
          creation timestamp and historical attribution. Date and correction
          policies are validated by the backend.
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="text-sm text-primary">
            {success}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy
            ? "Submitting…"
            : mode === "replace"
              ? "Void original & save replacement"
              : `Record ${kind}`}
        </Button>
      </fieldset>
    </form>
  );
}
export function CorrectionDialog({
  transaction,
  onClose,
  members,
  groups,
  preview,
  onSaved,
  getAttempt,
}: {
  transaction: TransactionView | null;
  onClose: () => void;
  members: MemberView[];
  groups: GroupView[];
  preview: boolean;
  onSaved: () => void;
  getAttempt: (operation: "void" | "replace") => WriteAttempt;
}) {
  const [mode, setMode] = useState("void");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function voidRecord(e: FormEvent) {
    e.preventDefault();
    if (!transaction) return;
    if (preview) {
      setError("Preview only. The original record has not been changed.");
      return;
    }
    const attempt = getAttempt("void");
    const body = JSON.stringify({ reason: reason.trim() });
    if (attempt.key && attempt.body !== body) {
      setError(
        "Retry with the same reason or check the ledger before making another correction.",
      );
      return;
    }
    attempt.key ??= crypto.randomUUID();
    attempt.body = body;
    setBusy(true);
    try {
      await api(`/transactions/${transaction.id}/void`, {
        method: "POST",
        headers: { "Idempotency-Key": attempt.key },
        body,
      });
      attempt.key = null;
      attempt.body = "";
      attempt.uncertain = false;
      onSaved();
      onClose();
    } catch (e) {
      if (rejectedWithoutWrite(e) && !attempt.uncertain) {
        attempt.key = null;
        attempt.body = "";
      }
      if (!rejectedWithoutWrite(e)) attempt.uncertain = true;
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!transaction}
      onOpenChange={(open) => !open && !busy && onClose()}
      title="Correct financial record"
      description="The original stays in history. A correction requires a reason and an administrator audit record."
    >
      <div className="grid gap-5">
        <Field id="correction-mode" label="Correction method">
          <Select
            disabled={busy}
            id="correction-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="void">Void this record</option>
            <option value="replace">Void and replace</option>
          </Select>
        </Field>
        <Field id="correction-reason" label="Reason for correction">
          <Textarea
            disabled={busy}
            id="correction-reason"
            required
            minLength={5}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        {mode === "replace" && transaction ? (
          reason.trim().length >= 5 ? (
            <FinancialForm
              getAttempt={() => getAttempt("replace")}
              onBusyChange={setBusy}
              kind={transaction.kind}
              original={transaction}
              mode="replace"
              reason={reason.trim()}
              members={members}
              groups={groups}
              preview={preview}
              onSaved={() => {
                onSaved();
                onClose();
              }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Enter a reason of at least five characters to prepare the
              replacement.
            </p>
          )
        ) : (
          <form onSubmit={voidRecord} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Voiding excludes this record from active totals. It does not
              delete the original.
            </p>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button
              variant="destructive"
              type="submit"
              disabled={busy || reason.trim().length < 5}
            >
              {busy ? "Submitting…" : "Confirm void"}
            </Button>
          </form>
        )}
      </div>
    </Dialog>
  );
}
export function FinancialFormPanel(props: Parameters<typeof FinancialForm>[0]) {
  return (
    <Panel
      title={
        props.kind === "deposit"
          ? "Record a verified deposit"
          : "Record a verified expense"
      }
    >
      <div className="p-5 sm:p-6">
        <FinancialForm {...props} />
      </div>
    </Panel>
  );
}

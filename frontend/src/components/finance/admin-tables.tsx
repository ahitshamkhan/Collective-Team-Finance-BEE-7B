"use client";
import { useState } from "react";
import type { AuditView, RegistrationView } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge, EmptyState } from "./primitives";
import type { AdminAction } from "./admin-dialogs";
export function ApprovalTable({
  rows,
  onAction,
}: {
  rows: RegistrationView[];
  onAction: (a: AdminAction) => void;
}) {
  if (!rows.length)
    return (
      <EmptyState
        title="No applications in this view"
        description="Verified applications awaiting review will appear here."
      />
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Registration and account administration
        </caption>
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            {["Applicant", "Verification", "Status", "Actions"].map((h) => (
              <th key={h} scope="col" className="px-5 py-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="min-w-56 px-5 py-4">
                <p className="font-medium">{r.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.email}</p>
              </td>
              <td className="px-5 py-4">
                {r.email_verified_at ? "Email verified" : "Not verified"}
              </td>
              <td className="px-5 py-4">
                <Badge tone={r.status === "approved" ? "success" : "neutral"}>
                  {r.status}
                </Badge>
              </td>
              <td className="px-5 py-4">
                <div className="flex gap-2">
                  {r.status === "pending" && (
                    <>
                      <Button
                        disabled={!r.email_verified_at}
                        onClick={() => onAction({ kind: "approve", record: r })}
                      >
                        Review & approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => onAction({ kind: "reject", record: r })}
                      >
                        Reject
                      </Button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <Button
                      variant="outline"
                      onClick={() => onAction({ kind: "suspend", record: r })}
                    >
                      Suspend
                    </Button>
                  )}
                  {r.status === "suspended" && (
                    <Button
                      variant="outline"
                      onClick={() => onAction({ kind: "restore", record: r })}
                    >
                      Restore
                    </Button>
                  )}
                  {["unverified", "rejected"].includes(r.status) && (
                    <span className="text-muted-foreground">
                      No available action
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function AuditDiff({ row }: { row: AuditView }) {
  return (
    <div className="grid gap-5">
      <p className="break-all text-sm">
        Entity: {row.entity_type} / {row.entity_id}
      </p>
      <p className="text-sm">Reason: {row.reason || "Not applicable"}</p>
      {(["before_values", "after_values"] as const).map((key) => (
        <div key={key}>
          <h3 className="mb-2 text-sm font-medium">
            {key === "before_values" ? "Before" : "After"}
          </h3>
          <pre className="max-h-64 overflow-auto rounded-xl bg-muted p-4 text-xs">
            {JSON.stringify(row[key], null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}
export function AuditTable({ rows }: { rows: AuditView[] }) {
  const [detail, setDetail] = useState<AuditView | null>(null);
  if (!rows.length) return <EmptyState title="No audit events found" />;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Administrator audit events</caption>
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              {["Operation", "Actor", "Time (UTC)", "Entity", "Details"].map(
                (h) => (
                  <th key={h} scope="col" className="px-5 py-4">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-4 font-medium">{r.operation}</td>
                <td className="min-w-40 px-5 py-4">{r.actor_label}</td>
                <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                  {r.occurred_at.replace("T", " ").replace("Z", " UTC")}
                </td>
                <td className="px-5 py-4">{r.entity_type}</td>
                <td className="px-5 py-4">
                  <Button variant="outline" onClick={() => setDetail(r)}>
                    Inspect event
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={!!detail}
        onOpenChange={(v) => !v && setDetail(null)}
        title="Audit event"
        description={detail?.operation}
      >
        {detail && <AuditDiff row={detail} />}
      </Dialog>
    </>
  );
}

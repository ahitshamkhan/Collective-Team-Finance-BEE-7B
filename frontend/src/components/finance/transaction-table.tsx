"use client";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { TransactionView } from "@/lib/contracts";
import { displayDate } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge, EmptyState, MoneyText } from "./primitives";
export function TransactionTable({
  rows,
  canCorrect = false,
  onCorrect,
}: {
  rows: TransactionView[];
  canCorrect?: boolean;
  onCorrect?: (row: TransactionView) => void;
}) {
  const [detail, setDetail] = useState<TransactionView | null>(null);
  if (!rows.length) return <EmptyState />;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">
            Financial history, including member, amount, date, accepting or
            recording administrator and description
          </caption>
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              {[
                "Transaction / description",
                "Member / group",
                "Date",
                "Administrator",
                "Amount",
                "Status",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap px-5 py-3 font-medium"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/40">
                <td className="min-w-60 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1 rounded-lg p-2 ${row.kind === "deposit" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"}`}
                    >
                      {row.kind === "deposit" ? (
                        <ArrowDownLeft aria-hidden className="size-4" />
                      ) : (
                        <ArrowUpRight aria-hidden className="size-4" />
                      )}
                    </span>
                    <div>
                      <p className="font-medium">
                        {row.title || "Member deposit"}
                      </p>
                      <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                        {row.description}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="min-w-40 px-5 py-4">
                  <p>
                    {row.member_name_snapshot ||
                      (row.expense_category === "collective"
                        ? "Collective fund"
                        : row.group_name_snapshot)}
                  </p>
                  {row.group_code_snapshot && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.group_code_snapshot}
                    </p>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-muted-foreground">
                  {displayDate(row.business_date)}
                </td>
                <td className="min-w-36 px-5 py-4">
                  {row.recorded_by_name_snapshot}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {row.kind === "deposit"
                      ? "Accepted & recorded"
                      : "Recorded expense"}
                  </p>
                </td>
                <td
                  className={`px-5 py-4 ${row.kind === "deposit" ? "text-primary" : "text-foreground"}`}
                >
                  <MoneyText value={row.amount} />
                </td>
                <td className="px-5 py-4">
                  <Badge tone={row.status === "active" ? "success" : "neutral"}>
                    {row.status === "active" ? "Recorded" : "Voided"}
                  </Badge>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-1">
                    <Button variant="ghost" onClick={() => setDetail(row)}>
                      Details
                    </Button>
                    {canCorrect && row.status === "active" && (
                      <Button
                        variant="outline"
                        onClick={() => onCorrect?.(row)}
                      >
                        Correct
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={!!detail}
        onOpenChange={(open) => !open && setDetail(null)}
        title="Transaction details"
        description="Original attribution and correction history."
      >
        {detail && (
          <dl className="grid gap-4 text-sm">
            {Object.entries({
              Reference: detail.id,
              Amount: <MoneyText value={detail.amount} />,
              Date: displayDate(detail.business_date),
              Description: detail.description,
              Administrator: detail.recorded_by_name_snapshot,
              Status: detail.status,
              "Historical group": detail.group_name_snapshot || "Collective",
              "Void reason": detail.void_reason || "Not voided",
              Replaces: detail.replaces_id || "None",
              Replacement: detail.replacement_id || "None",
            }).map(([key, value]) => (
              <div key={key} className="grid grid-cols-3 gap-3 border-b pb-3">
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="col-span-2 break-words">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Dialog>
    </>
  );
}

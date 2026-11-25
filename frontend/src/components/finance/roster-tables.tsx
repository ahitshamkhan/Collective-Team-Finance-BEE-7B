"use client";
import Link from "next/link";
import type { GroupView, MemberView } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import { EmptyState, MoneyText } from "./primitives";
export function MemberTable({
  members,
  href,
  onEdit,
}: {
  members: MemberView[];
  href: (path: string) => string;
  onEdit?: (m: MemberView) => void;
}) {
  if (!members.length) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Members and active contributions</caption>
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            {["Member", "Current group", "Contribution", "Actions"].map((h) => (
              <th scope="col" key={h} className="px-5 py-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {members.map((m) => (
            <tr key={m.id}>
              <td className="min-w-48 px-5 py-4 font-medium">
                <Link
                  className="hover:underline"
                  href={href(`/members/${m.id}`)}
                >
                  {m.name}
                </Link>
              </td>
              <td className="min-w-40 px-5 py-4">
                <Link
                  href={href(`/groups/${m.current_group.id}`)}
                  className="text-muted-foreground hover:underline"
                >
                  {m.current_group.code} · {m.current_group.name}
                </Link>
              </td>
              <td className="px-5 py-4">
                <MoneyText value={m.contribution} />
              </td>
              <td className="px-5 py-4">
                {onEdit ? (
                  <Button variant="outline" onClick={() => onEdit(m)}>
                    Edit member
                  </Button>
                ) : (
                  <Link
                    className="inline-flex min-h-11 items-center text-primary hover:underline"
                    href={href(`/members/${m.id}`)}
                  >
                    View record
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function GroupTable({
  groups,
  href,
  onEdit,
}: {
  groups: GroupView[];
  href: (path: string) => string;
  onEdit?: (g: GroupView) => void;
}) {
  if (!groups.length) return <EmptyState />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Technical groups, contributions and expenditure
        </caption>
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            {[
              "Technical group",
              "Members",
              "Contributions",
              "Expenditure",
              "Actions",
            ].map((h) => (
              <th key={h} scope="col" className="px-5 py-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {groups.map((g) => (
            <tr key={g.id}>
              <td className="min-w-52 px-5 py-4">
                <Link
                  href={href(`/groups/${g.id}`)}
                  className="font-medium hover:underline"
                >
                  {g.name}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">{g.code}</p>
              </td>
              <td className="px-5 py-4">{g.member_count}</td>
              <td className="px-5 py-4">
                <MoneyText value={g.contribution} />
              </td>
              <td className="px-5 py-4">
                <MoneyText value={g.expenditure} />
              </td>
              <td className="px-5 py-4">
                {onEdit ? (
                  <Button variant="outline" onClick={() => onEdit(g)}>
                    Edit group
                  </Button>
                ) : (
                  <Link
                    className="inline-flex min-h-11 items-center text-primary hover:underline"
                    href={href(`/groups/${g.id}`)}
                  >
                    View group
                  </Link>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

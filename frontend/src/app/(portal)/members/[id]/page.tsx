import { Suspense } from "react";
import { connection } from "next/server";
import { LoadingState } from "@/components/finance/primitives";
import { Workspace } from "@/components/finance/workspace";
async function Detail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  return <Workspace screen="member-detail" id={id} />;
}

export default function Page(props: Parameters<typeof Detail>[0]) {
  return (
    <Suspense fallback={<LoadingState />}>
      <Detail {...props} />
    </Suspense>
  );
}

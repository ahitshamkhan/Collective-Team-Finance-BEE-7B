"use client";
import { ErrorState } from "@/components/finance/primitives";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl p-6 py-20">
      <ErrorState
        message="Something went wrong while rendering this page. Please try again."
        retry={reset}
      />
    </main>
  );
}

import { Suspense } from "react";
import { LoadingState } from "@/components/finance/primitives";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

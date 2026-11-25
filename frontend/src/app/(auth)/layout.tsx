import { AuthLayout } from "@/components/finance/auth-screen";
export default function Layout({ children }: { children: React.ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}

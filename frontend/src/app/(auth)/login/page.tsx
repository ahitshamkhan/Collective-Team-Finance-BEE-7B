import { AuthScreen } from "@/components/finance/auth-screen";
export default function Page() {
  return (
    <AuthScreen
      mode="login"
      development={process.env.NODE_ENV === "development"}
    />
  );
}

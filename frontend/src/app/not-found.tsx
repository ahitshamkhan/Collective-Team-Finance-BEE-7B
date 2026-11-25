import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-6 py-24">
      <p className="text-sm text-primary">404</p>
      <h1 className="mt-3 font-heading text-3xl">Page not found</h1>
      <p className="my-5 text-muted-foreground">This page is unavailable.</p>
      <Link href="/login" className="text-primary underline">
        Return to sign in
      </Link>
    </main>
  );
}

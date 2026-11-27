import { NextRequest } from "next/server";
import { endpoint } from "@/server/http";
import { authApi } from "@/server/auth-api";
import { financeApi } from "@/server/finance-api";
import { AppError } from "@/server/errors/app-error";

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return endpoint(request, async (c) => {
    const response =
      (await authApi(c, path.join("/"))) ??
      (await financeApi(c, path.join("/")));
    if (response) return response;
    throw AppError.notFound();
  });
}
export { handle as GET, handle as POST, handle as PATCH };

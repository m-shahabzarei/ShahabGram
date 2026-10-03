import { getSessionUser } from "@/lib/auth";
import { errorResponse, ok } from "@/lib/api";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return errorResponse("Unauthorized", 401);
  return ok({ user });
}

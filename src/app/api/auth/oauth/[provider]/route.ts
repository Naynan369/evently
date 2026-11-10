import { NextRequest } from "next/server";
import { socialProvider, startSocialSignIn } from "@/lib/social-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const provider = socialProvider((await context.params).provider);
  if (!provider) return new Response("Unknown sign-in provider.", { status: 404 });
  return startSocialSignIn(request, provider);
}

import { NextRequest } from "next/server";
import { finishSocialSignIn, socialProvider } from "@/lib/social-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ provider: string }> };

export async function GET(request: NextRequest, context: Context) {
  const provider = socialProvider((await context.params).provider);
  if (!provider || provider !== "google")
    return new Response("Unknown sign-in callback.", { status: 404 });
  return finishSocialSignIn(request, provider);
}

export async function POST(request: NextRequest, context: Context) {
  const provider = socialProvider((await context.params).provider);
  if (!provider || provider !== "apple")
    return new Response("Unknown sign-in callback.", { status: 404 });
  return finishSocialSignIn(request, provider);
}

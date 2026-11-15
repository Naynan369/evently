import { dispatchMessages } from "@/lib/operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await dispatchMessages(20), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Evently message delivery retry failed:", error);
    return Response.json({ error: "Message delivery failed." }, { status: 500 });
  }
}

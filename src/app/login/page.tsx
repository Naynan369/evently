import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";
import { safeNext } from "@/lib/format";
export const metadata = { title: "Sign in" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; oauthError?: string }>;
}) {
  const { next, oauthError } = await searchParams;
  if (await currentUser()) redirect(safeNext(next));
  return <AuthForm next={next} oauthError={oauthError} />;
}

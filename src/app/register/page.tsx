import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";
import { safeNext } from "@/lib/format";
import { emailDeliveryMode } from "@/lib/mail";
export const metadata = { title: "Create an account" };
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; oauthError?: string }>;
}) {
  const { next, oauthError } = await searchParams;
  if (await currentUser()) redirect(safeNext(next));
  return <AuthForm register next={next} oauthError={oauthError} emailDelivery={emailDeliveryMode()} />;
}

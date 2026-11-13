import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";
import { safeNext } from "@/lib/format";
import { accountHome } from "@/lib/account-home";
export const metadata = { title: "Sign in" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; oauthError?: string }>;
}) {
  const { next, oauthError } = await searchParams;
  const user = await currentUser();
  if (user) redirect(next ? safeNext(next) : await accountHome(user.id));
  return <AuthForm next={next} oauthError={oauthError} />;
}

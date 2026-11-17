import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";
import { safeNext } from "@/lib/format";
import { isOrganizerRoute } from "@/lib/organizer-routes";
import { emailDeliveryMode } from "@/lib/mail";
import { accountHome } from "@/lib/account-home";
import { isOperator } from "@/lib/operations";
export const metadata = { title: "Create an account" };
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; oauthError?: string; type?: string }>;
}) {
  const { next, oauthError, type } = await searchParams;
  const user = await currentUser();
  if (user)
    redirect(
      isOperator(user)
        ? "/admin"
        : next
          ? safeNext(next)
          : type === "organizer"
            ? "/organizer"
            : await accountHome(user.id),
    );
  const organizerDestination = isOrganizerRoute(safeNext(next));
  const initialAccountType =
    type === "attendee"
      ? "attendee"
      : type === "organizer" || organizerDestination
        ? "organizer"
        : "attendee";
  return (
    <AuthForm
      register
      next={next}
      oauthError={oauthError}
      emailDelivery={emailDeliveryMode()}
      initialAccountType={initialAccountType}
    />
  );
}

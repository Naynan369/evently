import EmailActions from "@/components/EmailActions";
import { currentUser } from "@/lib/auth";
import { emailDeliveryMode } from "@/lib/mail";
export const metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Verify({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; delivery?: string }>;
}) {
  const { token, delivery } = await searchParams;
  const user = await currentUser();
  return (
    <EmailActions
      mode="verify"
      token={token}
      email={user?.email}
      deliveryFailed={delivery === "failed"}
      emailDelivery={emailDeliveryMode()}
    />
  );
}

import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { intentMatchesForUser, intentMonthOptions, intentsForUser } from "@/lib/intents";
import IntentStudio from "@/components/IntentStudio";

export const metadata = { title: "Your event ideas", robots: { index: false, follow: false } };

export default async function IntentPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/intent");
  if (!user.emailVerified) redirect("/verify-email");
  if (user.isOrganizer) redirect("/organizer/demand");
  const [intents, matches] = await Promise.all([
    intentsForUser(user.id), intentMatchesForUser(user.id),
  ]);
  return <IntentStudio initialIntents={intents} initialMatches={matches} months={intentMonthOptions()} />;
}

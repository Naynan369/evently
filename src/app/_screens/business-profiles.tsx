import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { businessProfilesForOwner } from "@/lib/db";
import BusinessProfileStudio from "@/components/organizer/BusinessProfileStudio";
import { isOperator } from "@/lib/operations";

export const metadata = { title: "Business profiles" };

export default async function BusinessProfilesPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/business-profiles");
  if (!user.emailVerified) redirect("/verify-email");
  if (isOperator(user)) redirect("/admin");
  if (!user.isOrganizer) redirect("/account");

  return (
    <main id="main" className="container page-main business-profile-page">
      <BusinessProfileStudio initialProfiles={await businessProfilesForOwner(user.id)} />
    </main>
  );
}

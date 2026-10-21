import Link from "next/link";
import { redirect } from "next/navigation";
import { FiArrowUpRight } from "react-icons/fi";
import { currentUser } from "@/lib/auth";
import { organizerData } from "@/lib/db";
import OrganizerStudio from "@/components/OrganizerStudio";
export const metadata = { title: "Organizer studio" };
export default async function Organizer() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/organizer");
  if (!user.emailVerified) redirect("/verify-email");
  const data = await organizerData(user.id);
  return (
    <main id="main" className="container page-main">
      <div className="page-heading studio-top">
        <div>
          <span className="eyebrow">BIG IDEAS. GOOD COMPANY.</span>
          <h1>Your organizer studio.</h1>
          <p>Everything you need to bring your next experience to life.</p>
        </div>
        <Link href="/create-event" className="button button-primary">
          Create an event <FiArrowUpRight />
        </Link>
      </div>
      <OrganizerStudio events={data.events} bookings={data.bookings} />
    </main>
  );
}

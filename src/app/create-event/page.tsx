import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getEvent } from "@/lib/db";
import EventForm from "@/components/EventForm";
export const metadata = { title: "Create an event" };
export default async function CreateEvent({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  const user = await currentUser();
  if (!user)
    redirect(
      "/login?next=" +
        encodeURIComponent("/create-event" + (edit ? "?edit=" + edit : "")),
    );
  if (!user.emailVerified) redirect("/verify-email");
  const initial = edit ? await getEvent(edit) : undefined;
  if (edit && (!initial || initial.ownerId !== user.id)) notFound();
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">GOOD THINGS START WITH AN IDEA</span>
        <h1>{edit ? "Fine-tune the details." : "Bring people together."}</h1>
        <p>
          {edit
            ? "Keep your event page clear and up to date."
            : "A little planning. A great experience. Let’s make your event happen."}
        </p>
      </div>
      <EventForm initial={initial || undefined} />
    </main>
  );
}

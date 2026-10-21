import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listEvents } from "@/lib/db";
import SavedEvents from "@/components/SavedEvents";
export const metadata = { title: "Saved events" };
export default async function Saved() {
  if (!(await currentUser())) redirect("/login?next=/saved");
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">THE MAYBE. THE DEFINITELY. THE WHY NOT.</span>
        <h1>Your saved plans.</h1>
        <p>A little collection of things you don’t want to miss.</p>
      </div>
      <SavedEvents events={await listEvents()} />
    </main>
  );
}

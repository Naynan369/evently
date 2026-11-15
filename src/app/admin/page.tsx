import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { isOperator, operatorSnapshot } from "@/lib/operations";
import AdminConsole from "@/components/AdminConsole";

export const metadata = { title: "Evently operations", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isOperator(user)) notFound();
  return <AdminConsole initial={await operatorSnapshot()} />;
}

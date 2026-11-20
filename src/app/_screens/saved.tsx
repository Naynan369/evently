import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { listEvents } from "@/lib/db";
import SavedEvents from "@/components/SavedEvents";
import { getLanguage } from "@/lib/i18n-server";
import { localizePublicEvents } from "@/lib/google-translation-server";
import { translate } from "@/lib/i18n";
export const metadata = { title: "Saved events" };
export default async function Saved() {
  const language = await getLanguage();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  if (!(await currentUser())) redirect("/login?next=/saved");
  return (
    <main id="main" className="container page-main">
      <div className="page-heading">
        <span className="eyebrow">{t("saved.eyebrow")}</span>
        <h1>{t("saved.title")}</h1>
        <p>{t("saved.intro")}</p>
      </div>
      <SavedEvents events={await localizePublicEvents(await listEvents(), language)} />
    </main>
  );
}

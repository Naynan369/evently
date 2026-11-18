import EmailActions from "@/components/EmailActions";
import { emailDeliveryMode } from "@/lib/mail";
export const metadata = {
  title: "Forgot password",
  robots: { index: false, follow: false },
};
export default function Forgot() {
  return <EmailActions mode="forgot" emailDelivery={emailDeliveryMode()} />;
}

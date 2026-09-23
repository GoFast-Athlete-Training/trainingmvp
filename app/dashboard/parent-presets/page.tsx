import { redirect } from "next/navigation";

export default function ParentPresetsRedirect() {
  redirect("/dashboard/presets");
}

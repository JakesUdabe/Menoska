import { redirect } from "next/navigation";
import { modules } from "@/lib/workspace";

export default function WorkspaceHome() {
  redirect(`/app/${modules[0].slug}`);
}

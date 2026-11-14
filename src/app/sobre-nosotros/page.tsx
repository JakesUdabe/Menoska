import { TeamView } from "@/components/team-view";
import { loadSite } from "@/lib/content";

export default async function AboutPage() {
  const site = await loadSite();
  return <TeamView employees={site.employees} />;
}

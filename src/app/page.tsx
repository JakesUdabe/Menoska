import fs from "node:fs";
import path from "node:path";
import { Home } from "@/components/home";
import type { Organization } from "@/data/organizations";
import { landingAbout, loadSite } from "@/lib/content";

const logoExtensions = ["svg", "png", "webp", "jpg", "jpeg"] as const;

function resolveLogo(id: string): string | undefined {
  const dir = path.join(process.cwd(), "public", "logos");
  for (const ext of logoExtensions) {
    if (fs.existsSync(path.join(dir, `${id}.${ext}`))) return `/logos/${id}.${ext}`;
  }
  return undefined;
}

export default async function HomePage() {
  const site = await loadSite();
  const items: Organization[] = site.organizations.map((org) => ({
    ...org,
    logo: org.logo ?? resolveLogo(org.id),
  }));
  return (
    <Home
      organizations={items}
      heroImage={site.heroImage}
      aboutImage={landingAbout(site.aboutImage, site.employees[0]?.image)}
      stats={site.stats}
    />
  );
}

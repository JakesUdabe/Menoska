import fs from "node:fs";
import path from "node:path";
import { Home } from "@/components/home";
import { organizations, type Organization } from "@/data/organizations";

const logoExtensions = ["svg", "png", "webp", "jpg", "jpeg"] as const;

function resolveLogo(id: string): string | undefined {
  const dir = path.join(process.cwd(), "public", "logos");
  for (const ext of logoExtensions) {
    if (fs.existsSync(path.join(dir, `${id}.${ext}`))) return `/logos/${id}.${ext}`;
  }
  return undefined;
}

export default function HomePage() {
  const items: Organization[] = organizations.map((org) => ({
    ...org,
    logo: resolveLogo(org.id),
  }));
  return <Home organizations={items} />;
}

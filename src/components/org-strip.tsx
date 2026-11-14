import type { Organization } from "@/data/organizations";

export function OrgStrip({ organizations, kicker }: { organizations: Organization[]; kicker: string }) {
  const row = repeat(organizations, 8);

  return (
    <section className="orgs" aria-labelledby="orgs-kicker">
      <div className="wrap">
        <p className="kicker" id="orgs-kicker">
          {kicker}
        </p>
      </div>
      <div className="org-marquee">
        <div className="org-track">
          <OrgSet organizations={row} />
          <OrgSet organizations={row} hidden />
        </div>
      </div>
    </section>
  );
}

function OrgSet({ organizations, hidden = false }: { organizations: Organization[]; hidden?: boolean }) {
  return (
    <ul className="org-row" aria-hidden={hidden || undefined}>
      {organizations.map((org, index) => (
        <li key={`${org.id}-${index}`}>
          <a href={org.href} target="_blank" rel="noreferrer">
            {org.logo ? <img src={org.logo} alt={hidden ? "" : org.name} /> : <span>{org.name}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}

function repeat(organizations: Organization[], minimum: number) {
  const row: Organization[] = [];
  if (organizations.length === 0) return row;
  while (row.length < minimum) row.push(...organizations);
  return row;
}

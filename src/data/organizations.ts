/**
 * Logos: guarda el archivo en public/logos/{id}.svg (también .png, .webp, .jpg).
 * Si el archivo existe, la página lo muestra. El clic abre siempre `href`.
 */
export type Organization = {
  id: string;
  name: string;
  href: string;
  logo?: string;
};

export const organizations: Organization[] = [
  { id: "cidetec", name: "CIDETEC", href: "https://www.cidetec.es/" },
  { id: "bantec", name: "Bantec", href: "https://www.bantec.es/" },
  { id: "polymat", name: "POLYMAT", href: "https://polymat.eu/" },
  {
    id: "cic-biomagune",
    name: "CIC biomaGUNE",
    href: "https://www.cicbiomagune.es/",
  },
  { id: "ehu", name: "EHU", href: "https://www.ehu.eus/" },
];

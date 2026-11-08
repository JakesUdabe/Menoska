import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Menoska Consulting",
    short_name: "Menoska",
    description:
      "De la vigilancia tecnológica a la decisión financiera. Scouting, inteligencia de mercado, fit estratégico y motor financiero.",
    start_url: "/",
    display: "standalone",
    background_color: "#394A51",
    theme_color: "#00895B",
    icons: [
      {
        src: "/mark.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

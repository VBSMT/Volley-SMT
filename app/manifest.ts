import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Volley SMT",
    short_name: "Volley SMT",
    start_url: "/accueil",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#111111",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

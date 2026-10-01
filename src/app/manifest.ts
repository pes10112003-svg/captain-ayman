import type { MetadataRoute } from "next";
import { APP_NAME, APP_NAME_AR } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME_AR} · ${APP_NAME}`,
    short_name: APP_NAME_AR,
    description: "التمارين والوجبات ومتابعة التقدم مع الكابتن · Workouts, meals and progress with your coach.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f6f3",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

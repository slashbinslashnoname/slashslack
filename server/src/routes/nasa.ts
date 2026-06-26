import type { FastifyInstance } from "fastify";

// A photo of the International Space Station from NASA's open image library
// (keyless). Fetched server-side (avoids CORS), cached 6h.
let cache: { at: number; data: { imageUrl: string | null; title: string | null } } | null = null;
const TTL = 6 * 60 * 60 * 1000;

export async function nasaRoutes(app: FastifyInstance) {
  app.get("/api/hero-image", async () => {
    if (cache && Date.now() - cache.at < TTL) return cache.data;
    try {
      const res = await fetch(
        "https://images-api.nasa.gov/search?q=International%20Space%20Station&media_type=image",
        { headers: { "user-agent": "SlashSlackBot/1.0" } },
      );
      const json: any = await res.json();
      const items: any[] = json?.collection?.items ?? [];
      const withImg = items.filter((it) => it?.links?.[0]?.href);
      const pick = withImg[Math.floor((Date.now() / TTL) % Math.max(withImg.length, 1))] ?? withImg[0];
      const data = {
        imageUrl: pick?.links?.[0]?.href ?? null,
        title: pick?.data?.[0]?.title ?? "International Space Station",
      };
      cache = { at: Date.now(), data };
      return data;
    } catch {
      return { imageUrl: null, title: null };
    }
  });
}

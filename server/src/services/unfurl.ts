import ogs from "open-graph-scraper";
import { eq } from "drizzle-orm";
import { SocketEvents } from "@slashslack/shared";
import { db } from "../db/index.js";
import { linkPreviews, messages } from "../db/schema.js";
import { emitToChannel, emitToDm } from "../realtime/index.js";
import { extractUrls } from "../lib/text.js";

/**
 * Fetch Open Graph metadata for any URLs in a message, store the previews,
 * then push them to the relevant room so clients render the card live.
 */
export async function unfurlMessage(messageId: number, body: string) {
  const urls = extractUrls(body);
  if (urls.length === 0) return;

  const msg = db.select().from(messages).where(eq(messages.id, messageId)).get();
  if (!msg) return;

  for (const url of urls) {
    try {
      const { result } = await ogs({
        url,
        timeout: 6000,
        fetchOptions: { headers: { "user-agent": "SlashSlackBot/1.0" } },
      });
      const image =
        Array.isArray(result.ogImage) && result.ogImage.length
          ? result.ogImage[0].url
          : null;
      const row = db
        .insert(linkPreviews)
        .values({
          messageId,
          url,
          title: result.ogTitle || result.twitterTitle || null,
          description: result.ogDescription || result.twitterDescription || null,
          image: image || null,
          siteName: result.ogSiteName || null,
        })
        .returning()
        .get();

      const payload = {
        messageId,
        preview: {
          id: row.id,
          messageId,
          url: row.url,
          title: row.title,
          description: row.description,
          image: row.image,
          siteName: row.siteName,
        },
      };
      if (msg.channelId) emitToChannel(msg.channelId, SocketEvents.PreviewReady, payload);
      else if (msg.dmId) emitToDm(msg.dmId, SocketEvents.PreviewReady, payload);
    } catch {
      // ignore unfurl failures — preview is best-effort
    }
  }
}

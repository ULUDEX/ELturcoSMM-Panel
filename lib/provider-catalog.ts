import { env } from "cloudflare:workers";

type ProviderService = {
  id: number | string;
  name?: string;
  description?: string;
  platform?: string;
  category?: { name?: string; slug?: string } | string;
  pricing?: { rate?: string | number; currency?: string };
  rate?: string | number;
  min?: number;
  max?: number;
  limits?: { min?: number; max?: number };
  is_active?: boolean;
};

const PAGE_SIZE = 100;
const MARKUP = 1.5;

function apiBase() {
  const configured = String((env as any).SMM_PROVIDER_API_URL || "https://panelfollows.com/api/v3");
  return configured.replace(/\/api\/v2\/?$/i, "/api/v3").replace(/\/$/, "");
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("tr-TR"))
    .trim();
}

function inferPlatform(service: ProviderService) {
  const haystack = `${service.platform || ""} ${service.name || ""}`.toLowerCase();
  const platforms: Array<[RegExp, string]> = [
    [/instagram/, "Instagram"], [/tiktok/, "TikTok"], [/youtube/, "YouTube"],
    [/telegram/, "Telegram"], [/facebook/, "Facebook"], [/(twitter|\bx\b)/, "X / Twitter"],
    [/whatsapp/, "WhatsApp"], [/twitch/, "Twitch"], [/spotify/, "Spotify"],
    [/kick/, "Kick"], [/discord/, "Discord"], [/linkedin/, "LinkedIn"],
    [/threads/, "Threads"], [/soundcloud/, "SoundCloud"], [/pinterest/, "Pinterest"],
  ];
  return platforms.find(([pattern]) => pattern.test(haystack))?.[1] || titleCase(service.platform || "Diğer");
}

function inferCategory(service: ProviderService, platform: string) {
  const supplied = typeof service.category === "string" ? service.category : service.category?.name || service.category?.slug;
  if (supplied?.trim()) return titleCase(supplied);
  const name = (service.name || "").toLocaleLowerCase("tr-TR");
  const kinds: Array<[RegExp, string]> = [
    [/(takipçi|followers?)/, "Takipçi"], [/(beğeni|likes?)/, "Beğeni"],
    [/(izlenme|görüntülenme|views?|plays?)/, "İzlenme"], [/(abone|subscribers?)/, "Abone"],
    [/(yorum|comments?)/, "Yorum"], [/(üye|members?)/, "Üye"],
    [/(paylaşım|shares?|repost)/, "Paylaşım"], [/(kaydetme|saves?)/, "Kaydetme"],
    [/(reaksiyon|reactions?)/, "Reaksiyon"], [/(canlı|live)/, "Canlı Yayın"],
    [/(hikaye|story)/, "Hikâye"], [/(trafik|traffic)/, "Trafik"],
  ];
  const kind = kinds.find(([pattern]) => pattern.test(name))?.[1] || "Diğer Hizmetler";
  return `${platform} ${kind}`;
}

async function usdTryRate() {
  const override = Number((env as any).SMM_PROVIDER_USD_TRY_RATE || 0);
  if (override > 0) return override;
  try {
    const xml = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", { cf: { cacheTtl: 3600 } as any }).then((response) => response.text());
    const block = xml.match(/<Currency[^>]+CurrencyCode="USD"[\s\S]*?<\/Currency>/i)?.[0] || "";
    const value = block.match(/<ForexSelling>([\d.]+)<\/ForexSelling>/i)?.[1];
    return Number(value) || 1;
  } catch { return 1; }
}

export async function fetchProviderCatalog() {
  const key = String((env as any).SMM_PROVIDER_API_KEY || "");
  if (!key) throw new Error("PanelFollows API anahtarı tanımlı değil.");
  const collected: ProviderService[] = [];
  let cursor = "";
  for (let page = 0; page < 100; page += 1) {
    const url = new URL(`${apiBase()}/services`);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("lang", "tr");
    if (cursor) url.searchParams.set("starting_after", cursor);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}`, "Accept-Language": "tr" } });
    if (!response.ok) throw new Error(`PanelFollows katalog hatası (${response.status}).`);
    const payload: any = await response.json();
    const data: ProviderService[] = Array.isArray(payload) ? payload : payload.data || [];
    collected.push(...data);
    const next = payload.next_cursor || payload.next || payload.cursor;
    if (!data.length || (!payload.has_more && data.length < PAGE_SIZE)) break;
    cursor = String(next || data[data.length - 1]?.id || "");
    if (!cursor) break;
  }
  const fx = await usdTryRate();
  return collected.filter((item) => item.is_active !== false).map((item) => {
    const platform = inferPlatform(item);
    const category = inferCategory(item, platform);
    const rawRate = Number(item.pricing?.rate ?? item.rate ?? 0);
    const currency = String(item.pricing?.currency || "USD").toUpperCase();
    const costTry = currency === "TRY" ? rawRate : rawRate * fx;
    return {
      providerServiceId: String(item.id), platform, category,
      name: item.name?.trim() || `${platform} ${category}`,
      description: item.description?.trim() || `${platform} için otomatik teslimat hizmeti.`,
      minOrder: Number(item.limits?.min ?? item.min ?? 10) || 10,
      maxOrder: Number(item.limits?.max ?? item.max ?? 10000) || 10000,
      costPrice: Math.max(0, Math.round(costTry * 100)),
      salePrice: Math.max(0, Math.round(costTry * MARKUP * 100)),
    };
  });
}


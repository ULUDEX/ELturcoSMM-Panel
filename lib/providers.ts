import { env } from "cloudflare:workers";

export const PROVIDER_IDS = ["panelfollows", "smmxserver"] as const;
export type ProviderId = typeof PROVIDER_IDS[number];
export function providerId(value: unknown): ProviderId {
  if (value === undefined || value === null || value === "") return "panelfollows";
  if (value === "panelfollows" || value === "smmxserver") return value;
  throw new Error("Geçersiz tedarikçi.");
}
export function providerConfig(value?: unknown) {
  const id = providerId(value);
  return id === "smmxserver"
    ? { id, name: "SMMXServer", key: String((env as any).SMMXSERVER_API_KEY || ""), url: "https://smmxserver.com/api/v2", version: 2 as const }
    : { id, name: "PanelFollows", key: String((env as any).SMM_PROVIDER_API_KEY || ""), url: String((env as any).SMM_PROVIDER_API_URL || "https://panelfollows.com/api/v2").replace(/\/$/, ""), version: String((env as any).SMM_PROVIDER_API_VERSION || "3") === "2" ? 2 as const : 3 as const };
}
export function providerSummaries() {
  return PROVIDER_IDS.map(id => { const p = providerConfig(id); return { id, name: p.name, configured: Boolean(p.key), url: p.url, version: p.version }; });
}

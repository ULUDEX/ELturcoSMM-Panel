import { env } from "cloudflare:workers";

// Set only on the isolated owner-private Site. Never reuse production bindings.
export function privatePreview() {
  return String((env as any).PRIVATE_PREVIEW || "") === "1";
}

export function previewAccountVerification(request: Request) {
  return privatePreview() && Boolean(request.headers.get("oai-authenticated-user-id"));
}

import handler from "vinext/server/fetch-handler";
import { runCatalogSchedule } from "./lib/catalog-schedule";

export default {
  fetch: handler.fetch,
  scheduled(_event: unknown, _env: unknown, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    ctx.waitUntil(runCatalogSchedule());
  },
};

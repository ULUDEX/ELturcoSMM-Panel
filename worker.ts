import { privatePreview } from "./lib/private-preview";
import handler from "vinext/server/fetch-handler";
import { runAutomationJobs } from "./lib/automation-jobs";
import { runCatalogSchedule } from "./lib/catalog-schedule";
import { runTranslationQueue } from "./lib/localization";

export default {
  fetch: handler.fetch,
  scheduled(_event: unknown, _env: unknown, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    if(privatePreview())return;
    ctx.waitUntil(Promise.allSettled([runCatalogSchedule(),runAutomationJobs(),runTranslationQueue()]));
  },
};

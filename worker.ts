import { privatePreview } from "./lib/private-preview";
import handler from "vinext/server/fetch-handler";
import { runAutomationJobs } from "./lib/automation-jobs";
import { runCatalogSchedule } from "./lib/catalog-schedule";
import { runTranslationQueue } from "./lib/localization";
import { runApiWebhookDeliveries } from "./lib/api-webhooks";
import { syncApiOrders } from "./lib/api-resources";

export default {
  async fetch(request:Request,bindings:unknown,ctx:{waitUntil(promise:Promise<unknown>):void}) {
    const response=await handler.fetch(request,bindings,ctx);
    const path=new URL(request.url).pathname,apiWrite=['POST','PATCH','DELETE'].includes(request.method)&&/^\/api\/(v[123](\/|$)|orders$|account\/webhooks$)/.test(path),orderRead=request.method==='GET'&&/^\/api\/(orders$|v3\/orders\/\d+$)/.test(path);
    if(!privatePreview()&&response.ok&&(apiWrite||orderRead))ctx.waitUntil(runApiWebhookDeliveries().catch(()=>{}));
    return response;
  },
  scheduled(_event: unknown, _env: unknown, ctx: { waitUntil(promise: Promise<unknown>): void }) {
    if(privatePreview())return;
    ctx.waitUntil(Promise.allSettled([runCatalogSchedule(),runAutomationJobs(),runTranslationQueue(),syncApiOrders().then(()=>runApiWebhookDeliveries())]));
  },
};

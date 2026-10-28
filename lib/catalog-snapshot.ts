import { privatePreview } from "@/lib/private-preview";

// Public catalog reads only. Never forward cookies, API keys, balances or orders.
export async function privateCatalogSnapshot():Promise<any[]|null> {
 if(!privatePreview())return null;
 for(const url of ['https://elturko-smm.uludex-tr.workers.dev/api/services?catalog=public-v2','https://elturcosmm.com/api/services?catalog=public-v2'])try {
  const response=await fetch(url,{
   headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(5000),cf:{cacheTtl:300},
  } as RequestInit);
  if(!response.ok||!response.headers.get('content-type')?.includes('json'))continue;
  const data=await response.json() as any;if(!Array.isArray(data)||data.length>50000)continue;
  return data.filter(s=>s&&(s.active===true||s.active===1)&&Number.isSafeInteger(s.id)&&Number.isSafeInteger(s.salePrice)&&s.salePrice>=0)
   .map(s=>({id:s.id,name:String(s.name||''),platform:String(s.platform||''),category:String(s.category||''),description:String(s.description||''),minOrder:Number(s.minOrder)||1,maxOrder:Number(s.maxOrder)||1,salePrice:s.salePrice,priceUnit:s.priceUnit==='per_order'?'per_order':'per_1000',providerFeatures:s.providerFeatures&&typeof s.providerFeatures==='object'?s.providerFeatures:{},providerFields:Array.isArray(s.providerFields)?s.providerFields:[],averageTimeSeconds:Number(s.averageTimeSeconds)||0,active:1,createdAt:Number(s.createdAt)||0,isNew:Boolean(s.isNew),orderCount:Number(s.orderCount)||0}));
 }catch{continue;}
 return null;
}

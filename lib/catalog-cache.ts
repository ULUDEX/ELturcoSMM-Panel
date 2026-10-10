// Only the anonymous catalog is cached. Admin reads and all order/balance
// operations always reach the database. Regional entries expire after 5 minutes.
const key=()=>new Request('https://elturcosmm.com/api/services?cache=public-catalog-v3');
export async function cachedCatalog(){if(typeof caches==='undefined')return null;try{return await caches.default.match(key())||null}catch{return null}}
export async function cacheCatalog(response:Response){if(typeof caches==='undefined'||!response.ok)return;try{const copy=new Response(response.clone().body,{headers:response.headers,status:response.status});copy.headers.set('cache-control','public, max-age=300');copy.headers.delete('cdn-cache-control');await caches.default.put(key(),copy)}catch{}}
export async function invalidateCatalogCache(){if(typeof caches==='undefined')return;try{await caches.default.delete(key())}catch{}}

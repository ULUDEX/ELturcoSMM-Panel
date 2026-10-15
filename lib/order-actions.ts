const enabled=(value:unknown)=>value===true||value===1||value==="1"||value==="true";
export function orderFeatures(row:any){
 try{const raw=row.providerFeatures??row.provider_features??row.features;const value=typeof raw==="string"?JSON.parse(raw):raw;return{refill:enabled(value?.refill),cancel:enabled(value?.cancel)}}catch{return{refill:false,cancel:false}}
}
export function refillEligibility(row:any,status:string){
 const supported=orderFeatures(row).refill,action=String(row.providerAction||"");
 const labels:Record<string,string>={refill_sending:"Telafi talebi gönderiliyor.",refill_requested:"Telafi talebin işleniyor.",refill_completed:"Bu siparişin telafisi tamamlandı.",refill_uncertain:"Talebin sonucu doğrulanamadı. Yeniden göndermeden önce destekle görüş."};
 const reason=!supported?"Bu hizmet telafi desteklemiyor.":!row.providerOrderId?"Sipariş henüz sağlayıcıya iletilmedi.":status!=="completed"?"Telafi, sipariş tamamlandıktan sonra istenebilir.":labels[action]||"";
 return{supported,eligible:!reason,reason};
}

import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";

export async function POST(r:Request){
 if(!await isAdmin(r))return NextResponse.json({error:"Yetkisiz"},{status:403});
 let form:FormData;
 try{form=await r.formData()}catch{return NextResponse.json({error:"Dosya okunamadı. Tekrar seç."},{status:400})}
 const file=form.get("file");
 if(!(file instanceof File))return NextResponse.json({error:"Dosya seçilmedi."},{status:400});
 if(!file.type.startsWith("audio/")&&!file.name.toLowerCase().endsWith(".mp3"))return NextResponse.json({error:"Yalnızca ses dosyası yükleyebilirsin."},{status:400});
 if(!file.size||file.size>30*1024*1024)return NextResponse.json({error:"Dosya boş olmamalı ve en fazla 30 MB olabilir."},{status:400});
 const safe=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"track.mp3",key=`music-${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
 const url="/api/media/"+encodeURIComponent(key);let stored=false;
 try{
  await (env as any).MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type||"audio/mpeg"}});stored=true;
  if(form.get("playlist")==="1"){
   const title=file.name.replace(/\.[^.]+$/,"").trim().slice(0,200)||"Yeni parça";
   const result=await env.DB.prepare("INSERT INTO music_tracks(title,artist,src,position,active,created_at) SELECT ?,?,?,COALESCE(MAX(position),0)+1,1,? FROM music_tracks").bind(title,"",url,Math.floor(Date.now()/1000)).run();
   return NextResponse.json({url,addedToPlaylist:true,id:result.meta.last_row_id},{status:201});
  }
  return NextResponse.json({url});
 }catch{
  if(stored)try{await (env as any).MEDIA.delete(key)}catch{}
  return NextResponse.json({error:"Dosya kaydedilemedi. Listeyi kontrol edip tekrar dene."},{status:500});
 }
}

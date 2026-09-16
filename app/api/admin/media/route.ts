import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";

export async function POST(r:Request){
 if(!await isAdmin())return NextResponse.json({error:"Yetkisiz"},{status:403});
 const form=await r.formData(),file=form.get("file");
 if(!(file instanceof File))return NextResponse.json({error:"Dosya seçilmedi."},{status:400});
 if(!file.type.startsWith("audio/")&&!file.name.toLowerCase().endsWith(".mp3"))return NextResponse.json({error:"Yalnızca ses dosyası yükleyebilirsin."},{status:400});
 if(file.size>30*1024*1024)return NextResponse.json({error:"Dosya en fazla 30 MB olabilir."},{status:400});
 const safe=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-").replace(/^-+|-+$/g,"")||"track.mp3",key=`music-${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;
 await (env as any).MEDIA.put(key,file.stream(),{httpMetadata:{contentType:file.type||"audio/mpeg"}});
 return NextResponse.json({url:"/api/media/"+encodeURIComponent(key)});
}

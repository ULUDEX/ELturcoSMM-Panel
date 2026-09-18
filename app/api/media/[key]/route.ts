import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function GET(request:Request,{params}:{params:Promise<{key:string}>}){
 const {key}=await params,object=await (env as any).MEDIA.get(decodeURIComponent(key));
 if(!object)return NextResponse.json({error:"Dosya bulunamadı"},{status:404});
 const size=Number(object.size||0),range=request.headers.get("range"),contentType=object.httpMetadata?.contentType||"audio/mpeg";
 if(range&&size){const match=/bytes=(\d+)-(\d*)/.exec(range);if(match){const start=Number(match[1]),end=match[2]?Math.min(Number(match[2]),size-1):size-1;if(start>=size||end<start)return new Response(null,{status:416,headers:{"content-range":`bytes */${size}`}});const part=await (env as any).MEDIA.get(decodeURIComponent(key),{range:{offset:start,length:end-start+1}});return new Response(part.body,{status:206,headers:{"content-type":contentType,"content-length":String(end-start+1),"content-range":`bytes ${start}-${end}/${size}`,"accept-ranges":"bytes","cache-control":"public, max-age=31536000, immutable"}})}}
 return new Response(object.body,{headers:{"content-type":contentType,"content-length":String(size),"cache-control":"public, max-age=31536000, immutable","accept-ranges":"bytes"}});
}
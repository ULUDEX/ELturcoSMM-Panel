import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function GET(_:Request,{params}:{params:Promise<{key:string}>}){const {key}=await params;const object=await (env as any).MEDIA.get(decodeURIComponent(key));if(!object)return NextResponse.json({error:"Dosya bulunamadı"},{status:404});return new Response(object.body,{headers:{"content-type":object.httpMetadata?.contentType||"audio/mpeg","cache-control":"public, max-age=31536000, immutable","accept-ranges":"bytes"}})}

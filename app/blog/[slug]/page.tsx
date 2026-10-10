import { records,moduleEnabled } from "@/lib/admin-controls";
import { notFound } from "next/navigation";
export const dynamic="force-dynamic";
export default async function Post({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;if(!await moduleEnabled("blog"))notFound();const post=(await records("blog-posts")).find((r:any)=>r.active&&r.data.slug===slug);if(!post)notFound();
 return <main style={{minHeight:'100vh',background:'#080a0e',color:'#eee',padding:'48px 24px',fontFamily:'Arial'}}><article style={{maxWidth:800,margin:'auto'}}><a href="/blog" style={{color:'#ff7a45'}}>← ElTurco Blog</a><h1>{post.data.title}</h1><p style={{whiteSpace:'pre-wrap',lineHeight:1.9}}>{post.data.body}</p></article></main>;
}

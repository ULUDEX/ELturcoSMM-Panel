import { records,moduleEnabled } from "@/lib/admin-controls";
export const dynamic="force-dynamic";
export default async function Blog(){
 const enabled=await moduleEnabled("blog"),posts=enabled?(await records("blog-posts")).filter((r:any)=>r.active):[];
 return <><link rel="stylesheet" href="/site/localization.css"/><script src="/site/localization.js" defer/><header style={{padding:16,background:"#080a0e",color:"white"}}><a href="/site/">ElTurco SMM</a></header><main style={{minHeight:'100vh',background:'#080a0e',color:'#eee',padding:'48px 24px',fontFamily:'Arial'}}><div style={{maxWidth:900,margin:'auto'}}><a href="/site/" style={{color:'#ff7a45'}}>ElTurco SMM ↗</a><h1>ElTurco Blog</h1>{posts.length?posts.map((p:any)=><article key={p.id} style={{padding:24,border:'1px solid #333',borderRadius:16,marginTop:20}}><small>{p.data.category}</small><h2><a style={{color:'#ff7a45'}} href={`/blog/${p.data.slug}`}>{p.data.title}</a></h2><p>{String(p.data.body).slice(0,220)}…</p></article>):<p>Henüz yayınlanmış yazı yok.</p>}</div></main></>;
}

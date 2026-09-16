import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function GET(){
 const [settings,tracks]=await env.DB.batch([
  env.DB.prepare("SELECT key,value FROM site_settings"),
  env.DB.prepare("SELECT id,title,artist,src,position FROM music_tracks WHERE active=1 ORDER BY position ASC,id ASC")
 ]);
 const values:any=Object.fromEntries((settings.results as any[]).map(x=>[x.key,x.value]));
 if(!values.brand_name||values.brand_name==="KIVIL")values.brand_name="ELTURKO";
 if(!values.panel_label||values.panel_label==="GROWTH PANEL")values.panel_label="SMM PANEL";
 if(!values.radio_title||values.radio_title==="KIVIL RADIO")values.radio_title="ELTURKO RADIO";
 return NextResponse.json({settings:values,tracks:tracks.results});
}

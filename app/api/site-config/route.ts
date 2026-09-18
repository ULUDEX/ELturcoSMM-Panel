import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";

export async function GET(){
 const [settings,tracks]=await env.DB.batch([
  env.DB.prepare("SELECT key,value FROM site_settings"),
  env.DB.prepare("SELECT id,title,artist,src,position FROM music_tracks WHERE active=1 ORDER BY position ASC,id ASC")
 ]);
 const values:any=Object.fromEntries((settings.results as any[]).map(x=>[x.key,x.value]));
 if(!values.brand_name||["KIVIL","ELTURKO","ELTURCO"].includes(values.brand_name.toUpperCase()))values.brand_name="ElTurco";
 if(!values.panel_label||values.panel_label==="GROWTH PANEL")values.panel_label="SMM PANEL";
 if(!values.radio_title||/^(KIVIL|ELTURKO|ELTURCO) RADIO$/i.test(values.radio_title))values.radio_title="ElTurco RADIO";
 return NextResponse.json({settings:values,tracks:tracks.results});
}

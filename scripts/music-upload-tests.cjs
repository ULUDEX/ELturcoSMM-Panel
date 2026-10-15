const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
const compile=path=>ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
async function serverTests(){
 const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync('drizzle/0005_dashing_wolverine.sql','utf8').split('--> statement-breakpoint')[0]);
 let allowed=true,dbFail=false;const media=new Map();
 const env={
  DB:{prepare:sql=>({bind:(...values)=>({run:async()=>{
   if(dbFail)throw Error('database');
   const result=db.prepare(sql).run(...values);
   return{meta:{last_row_id:Number(result.lastInsertRowid)}};
  }})})},
  MEDIA:{put:async(key,value)=>media.set(key,value),delete:async key=>media.delete(key)}
 };
 const module={exports:{}};const context={exports:module.exports,module,File,FormData,Date,crypto,encodeURIComponent,require:name=>name==='cloudflare:workers'?{env}:name==='next/server'?{NextResponse:{json:(body,init)=>Response.json(body,init)}}:name==='@/lib/admin-auth'?{isAdmin:async()=>allowed}:null};
 vm.runInNewContext(compile('app/api/admin/media/route.ts'),context);
 const post=module.exports.POST;
 const request=(file,playlist=true)=>({formData:async()=>{const form=new FormData();if(file)form.set('file',file);if(playlist)form.set('playlist','1');return form}});
 allowed=false;assert.equal((await post(request(new File(['x'],'song.mp3')))).status,403);assert.equal(media.size,0);allowed=true;
 for(const file of [null,new File(['x'],'video.mp4',{type:'video/mp4'}),new File([],'empty.mp3')])assert.equal((await post(request(file))).status,400);
 const large=new File(['x'],'big.mp3');Object.defineProperty(large,'size',{value:31*1024*1024});
 assert.equal((await post({formData:async()=>({get:key=>key==='file'?large:'1'})})).status,400);
 assert.equal((await post({formData:async()=>{throw Error('malformed')}})).status,400);
 let response=await post(request(new File(['audio'],'Gece Şarkısı.mp3',{type:'audio/mpeg'})));assert.equal(response.status,201);
 const saved=await response.json(),row=db.prepare('SELECT * FROM music_tracks').get();assert.equal(row.title,'Gece Şarkısı');assert.equal(row.src,saved.url);assert.equal(row.position,1);assert.equal(row.active,1);assert.equal(saved.addedToPlaylist,true);
 await post(request(new File(['audio'],'second.mp3')));assert.equal(db.prepare('SELECT MAX(position) AS n FROM music_tracks').get().n,2);
 await post(request(new File(['audio'],'upload-only.mp3'),false));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM music_tracks').get().n,2,'legacy upload-only call must not publish');
 const before=media.size;dbFail=true;assert.equal((await post(request(new File(['audio'],'failed.mp3')))).status,500);assert.equal(media.size,before,'failed playlist save cleans up its uploaded object');
 db.close();
}
async function clientTests(){
 let states=[],cursor=0,ref={current:false},requests=0,refreshed=0,release;
 const jsx=(type,props)=>({type,props});
 const react={useId:()=> 'music-upload',useRef:()=>ref,useState:initial=>{const index=cursor++;if(!(index in states))states[index]=initial;return[states[index],value=>states[index]=value]}};
 const module={exports:{}};
 const context={exports:module.exports,module,FormData,File,Node:class{},require:name=>name==='react'?react:{jsx,jsxs:jsx},fetch:async()=>{requests++;if(requests===1)await new Promise(resolve=>release=resolve);return{ok:true,json:async()=>({addedToPlaylist:true})}}};
 vm.runInNewContext(compile('app/admin/music-upload.tsx'),context);
 const render=()=>{cursor=0;return module.exports.default({onUploaded:async()=>refreshed++})};
 const find=(node,predicate)=>{if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match}return null};
 const input=find(render(),node=>node.type==='input');
 const select=files=>input.props.onChange({currentTarget:{files,value:'chosen'}});
 select([new File(['audio'],'first.mp3'),new File(['x'],'bad.txt'),new File(['audio'],'second.mp3')]);assert.equal(requests,1);
 select([new File(['audio'],'duplicate.mp3')]);assert.equal(requests,1,'repeated selection during upload is locked');release();
 for(let i=0;i<30&&!refreshed;i++)await Promise.resolve();
 assert.equal(refreshed,1);assert.equal(requests,2,'invalid files are skipped and later valid files still upload');
 assert.equal(states[2].filter(row=>row.status==='done').length,2);assert.equal(states[2].filter(row=>row.status==='error').length,1);
 for(let i=0;i<30&&ref.current;i++)await Promise.resolve();
 const drop=find(render(),node=>typeof node.props?.onDrop==='function');drop.props.onDrop({preventDefault(){},dataTransfer:{files:[new File(['audio'],'drop.mp3')]}});
 for(let i=0;i<30&&refreshed<2;i++)await Promise.resolve();assert.equal(requests,3);assert.equal(refreshed,2,'dropping uploads and refreshes the playlist automatically');
}
Promise.all([serverTests(),clientTests()]).then(()=>console.log('PASS: music drop/select, queue locking, validation, automatic playlist insertion, authorization and failure cleanup.')).catch(error=>{console.error(error);process.exit(1)});

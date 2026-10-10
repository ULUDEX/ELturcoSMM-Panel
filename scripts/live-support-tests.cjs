const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function scenario(){
 const listeners={},nodes=new Map(),head=[],body=[];let timeout,maximized=0,assigned='';
 class Element{constructor(){this.style={}}closest(){return this}setAttribute(){}append(...children){this.children=children}remove(){nodes.delete(this.id)}}
 const document={addEventListener:(event,fn)=>listeners[event]=fn,querySelector:()=>null,getElementById:id=>nodes.get(id),createElement:()=>new Element(),head:{appendChild:node=>head.push(node)},body:{append:node=>{body.push(node);nodes.set(node.id,node)}}};
 const context={document,Element,localStorage:{getItem:()=> 'fr'},window:{Tawk_API:{maximize:()=>maximized++},location:{assign:url=>assigned=url}},Date,setTimeout:fn=>{timeout=fn;return 1},clearTimeout(){}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('public/live-support.js','utf8'),context);
 const click=()=>listeners.click({target:new Element(),preventDefault(){}});
 return{context,head,body,click,timeout:()=>timeout(),maximized:()=>maximized,assigned:()=>assigned};
}
let s=scenario();s.click();assert.equal(s.maximized(),0,'API method before onLoad must not swallow clicks');s.timeout();assert.equal(s.body.length,1);assert.match(s.body[0].children[1].href,/1k4iokblt/,'fallback uses French widget');s.click();assert.match(s.assigned(),/tawk.to\/chat/);s=scenario();s.click();s.context.window.Tawk_API.onLoad();assert.equal(s.maximized(),1,'pending click opens on ready');s.click();assert.equal(s.maximized(),2);assert.equal(s.head.length,1);console.log('PASS: delayed/blocked support provides localized direct chat and loaded widget opens immediately.');

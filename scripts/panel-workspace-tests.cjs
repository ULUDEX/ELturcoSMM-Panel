const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('public/site/app-20260927.js','utf8');
const handler=source.slice(source.indexOf('let orderSubmitting=false;'),source.indexOf('\nfunction updateLocalCount'));
async function submitTests(){
 let complete,requests=0;const button={disabled:false},form={querySelectorAll:()=>[button],setAttribute(){},removeAttribute(){}};
 const context={account:{},selectedService:{name:'Test'},document:{querySelectorAll:()=>[]},FormData:class{*[Symbol.iterator](){}},toast(){},renderLocalOrders(){},fetch:()=>{requests++;return new Promise(resolve=>{complete=resolve})},$:()=>form};
 vm.createContext(context);vm.runInContext(handler,context);
 const event={preventDefault(){},target:form};const first=form.onsubmit(event);assert.equal(button.disabled,true);await form.onsubmit(event);assert.equal(requests,1,'double click must send once');complete({ok:false,json:async()=>({error:'test'})});await first;assert.equal(button.disabled,false,'failed response releases controls');
 context.fetch=async()=>{throw Error('network')};await form.onsubmit(event);assert.equal(button.disabled,false,'network failure releases controls');
}
function priceTests(){const start=source.indexOf('function updatePrice()'),end=source.indexOf('setOrderStep(1)',start);const nodes={'#quantity':{value:1},'#amount':{},'#amount-input':{}};const context={selectedService:{salePrice:12},$:id=>nodes[id],money:n=>n};vm.createContext(context);vm.runInContext(source.slice(start,end),context);vm.runInContext('updatePrice()',context);assert.equal(nodes['#amount-input'].value,'0.01');nodes['#quantity'].value=11;vm.runInContext('updatePrice()',context);assert.equal(nodes['#amount-input'].value,'0.01');context.selectedService={salePrice:123,priceUnit:'per_order'};vm.runInContext('updatePrice()',context);assert.equal(nodes['#amount-input'].value,'1.23');}
priceTests();submitTests().then(()=>console.log('PASS: order double clicks, failed requests and integer-cent display match order API.')).catch(e=>{console.error(e);process.exit(1)});

import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const require=createRequire(resolve(process.env.ALVO_PHOTO_TEST_DEPS??'../photo-test-deps','package.json'));
const {chromium}=require('playwright-core');
const file=name=>readFile(new URL('../'+name,import.meta.url));
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const getId=n=>'MLB'+n;
const shot=process.env.ALVO_PHOTO_SCREENSHOT;
const kinds={'meli-photos.html':'text/html','meli-photos.css':'text/css','meli-photos.js':'text/javascript'};
const server=createServer(async(req,res)=>{
 const p=req.url?.split('?')[0].slice(1);
 if(p==='frame'){res.writeHead(200,{'content-type':'text/html'}).end('<iframe src="/meli-photos.html"></iframe>');return}
 if(!Object.hasOwn(kinds,p)){res.writeHead(404).end();return}
 res.writeHead(200,{'content-type':kinds[p]});res.end(await file(p));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.ALVO_PHOTO_CHROME??'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const failures=[];page.on('pageerror',e=>failures.push(e.message));
 await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:"export const createClient=()=>({auth:{signInWithPassword:async()=>({data:{session:{access_token:'fake-browser-test'}}}),signOut:async()=>({})}})"}));
 let received=[],approved=[],checked=[],proposals=[];
 const model={item:{id:getId(123),sku:'PILOTO-TESTE',title:'Balão Rosa Forte · anúncio simulado',user_product_id:'MLBU1',status:'active',sold_quantity:2,pictures:[{id:'1-MLB1_1'}]},processing_enabled:true,publication_enabled:true};
 await page.route('https://syrpumcyhacyypxzrynh.supabase.co/**',async r=>{
  const url=new URL(r.request().url()),act=url.pathname.split('/').at(-1);
  const p=r.request().postData();
  const data=p&&act!=='stage'?JSON.parse(p):{};
  let reply={};
  if(act==='shops')reply={shops:[{id:id(10),nickname:'Casal Cardoso',seller_id:'1809328863'}]};
  else if(act==='search')reply={items:[model.item]};
  else if(act==='status')reply={...model,images:received,reviews:approved,publications:proposals,events:checked};
  else if(act==='stage'){
   const slot=Number(url.searchParams.get('slot'));
   assert.equal(r.request().headers()['content-type'],'image/jpeg');
   const image={id:id(slot),slot,version:1,sha256:String(slot).repeat(64),bytes:18000,staged:true,upload_state:'none'};
   received.push(image);reply={image};
  }
  else if(act==='review'){assert(data.attested);assert.equal(data.ids[0],id(2));approved=[{id:id(41),ids:data.ids}];reply=approved[0]}
  else if(act==='upload'){assert.deepEqual(data.ids,approved[0].ids);const image=received.find(i=>i.id===data.ids[data.index]);image.upload_state='uploaded';reply={passed:true,codes:[]};checked.push({event_type:'photo_marketplace_diagnostic',created_at:new Date().toISOString(),payload:{...reply,image_id:image.id,index:data.index}})}
  else if(act==='preview'){assert.equal(checked.length,9);assert.deepEqual(data.ids,approved[0].ids);proposals=[{proposal_id:id(51),hash:'a'.repeat(64),state:'pending_approval'}];reply={id:id(51)}}
  else throw Error('Unexpected call '+act);
  await r.fulfill({json:reply,headers:{'access-control-allow-origin':'*'}});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/meli-photos.html');
 await page.locator('#email').fill('fixture@example.invalid');await page.locator('#password').fill('fixture-password');await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await page.locator('#query').fill('PILOTO-TESTE');await page.getByRole('button',{name:'Buscar',exact:true}).click();await page.getByRole('button',{name:/MLB123 ·/}).click();
 await page.locator('#files').setInputFiles(Array.from({length:9},(_,i)=>({name:(i+1)+'.jpg',mimeType:'image/jpeg',buffer:Buffer.from([255,216,i,255,217])})));
 await page.getByRole('button',{name:'Validar e guardar'}).click();await page.getByText('9 imagens guardadas.').waitFor();
 assert.equal(await page.locator('#ordered li').count(),9);
 await page.getByRole('button',{name:'Mover depois'}).first().click();
 await page.locator('#attest').check();
 await page.getByRole('button',{name:'Registrar revisão visual'}).click();
 await page.getByText('Revisão visual registrada para as nove fotos nesta ordem.').waitFor();
 await page.getByRole('button',{name:'Enviar e validar no Mercado Livre'}).click();
 await page.getByText('9 fotos aprovadas pelo diagnóstico do Mercado Livre.').waitFor();
 await page.getByRole('button',{name:'Gerar proposta para aprovação'}).click();
 const review=page.getByRole('link',{name:'Revisar e aprovar no portal'});await review.waitFor();
 assert.equal(await review.getAttribute('href'),'meli-review.html?proposal_id='+id(51));
 assert.equal(await page.getByRole('button',{name:'Publicar fotos aprovadas'}).count(),0);
 await page.setViewportSize({width:400,height:850});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 assert.deepEqual(failures,[]);
 if(shot)await page.screenshot({path:shot,fullPage:true});
 await page.goto('http://127.0.0.1:'+server.address().port+'/frame');
 await page.frameLocator('iframe').getByText('Abra o Photo Publisher diretamente no portal ALVO.').waitFor();
 assert.equal(await page.frameLocator('iframe').locator('#login').count(),0);
 console.log('Portal verificado em desktop e celular: busca, nove arquivos, ordem, revisão, diagnóstico e encaminhamento para aprovação.');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}

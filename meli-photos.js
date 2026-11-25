import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';

if(window.top!==window.self){
 document.body.replaceChildren(document.createTextNode('Abra o Photo Publisher diretamente no portal ALVO.'));
 throw Error('photo_embedded_page_blocked');
}

const origin='https://syrpumcyhacyypxzrynh.supabase.co';
const supabase=createClient(origin,'sb_publishable_4ejlMxxKKssMRf3KTGfhrA_6cz95NHc',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const $=id=>document.getElementById(id);
const msg=value=>$('message').textContent=value;
const make=(tag,content,cls)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(content)el.textContent=content;return el};
let session,listing,selected=[],model,busy=false;
const states={none:'Aguardando envio',uploaded:'Enviada',sending:'Envio em andamento ou sem confirmação',unknown:'Resultado incerto',rejected:'Recusada',pending_approval:'Aguardando aprovação',approved:'Aprovada',applied:'Publicada',conflict:'Conflito',failed:'Falhou',draft:'Rascunho',executing:'Em execução'};
const errorMessages={
 photo_publisher_disabled:'O Photo Publisher ainda não foi habilitado neste ambiente.',
 photo_processing_disabled:'O recebimento de imagens está bloqueado para este cliente.',
 photo_publication_disabled:'O envio ao Mercado Livre está bloqueado para este cliente.',
 user_product_scope_unverified:'Não foi possível confirmar todos os anúncios vinculados.',
 catalog_content_locked:'Este anúncio de catálogo tem as imagens bloqueadas.',
 photo_independent_reviewer_required:'A revisão visual precisa ser feita por outra pessoa com permissão para aprovar.',
 photo_cover_background_review:'Os cantos da primeira imagem não passaram na checagem de fundo branco.',
 photo_marketplace_validation_required:'Valide no Mercado Livre as nove fotos nessa ordem antes de gerar a proposta.',
 photo_jpeg_invalid:'Selecione um arquivo JPG válido.',
 photo_jpeg_corrupt:'Não foi possível decodificar o JPG sem erros.',
 photo_color_invalid:'O JPG precisa estar em RGB, com três componentes.',
 photo_dimensions_invalid:'A imagem precisa medir 1.200 × 1.200 pixels.',
 photo_size_invalid:'A imagem excede o tamanho aceito ou está vazia.',
 photo_upload_unknown:'O Mercado Livre não confirmou o envio. Consulte a auditoria.',
 photo_duplicate_bytes:'Este arquivo já foi cadastrado em outra posição.',
 refresh_busy_retry_later:'A conexão da loja precisa renovar o acesso. Tente novamente quando estiver disponível.',
 photo_invalid_request:'Confira o anúncio, o arquivo e a posição.',
 photo_forbidden:'Sua conta não tem acesso à operação nesta loja.'
};
async function api(action,options={}){
 if(!session)throw Error('Entre na sua conta para continuar.');
 const q=new URLSearchParams(options.params??{});
 if(action!=='shops')q.set('shop_id',$('shop').value);
 if(listing&&action!=='search')q.set('item_id',listing);
 const response=await fetch(origin+'/functions/v1/alvo-meli-hub-mcp/photos/'+action+'?'+q,{method:options.body?'POST':'GET',headers:{Authorization:'Bearer '+session.access_token,...(options.body?{'Content-Type':options.file?'image/jpeg':'application/json'}:{})},body:options.body?(options.file?options.body:JSON.stringify(options.body)):undefined,redirect:'error',cache:'no-store'});
 const data=await response.json();
 if(!response.ok)throw Error(errorMessages[data.error]??('Operação indisponível ('+(data.error??response.status)+').'));
 return data;
}
function control(){
 const complete=selected.length===9;
 const itemEligible=['active','paused'].includes(model?.item?.status)&&!model?.item?.catalog_listing;
 $('shop').disabled=busy;
 $('query').disabled=busy;
 const approved=model?.reviews?.some(r=>r.ids.join()===selected.join());
 $('review').disabled=busy||!complete||!model?.processing_enabled||!$('attest').checked;
 $('upload').disabled=busy||!approved||!model?.publication_enabled||!itemEligible;
 $('preview').disabled=busy||!approved||!model?.publication_enabled||!itemEligible;
 $('stage').querySelector('button').disabled=busy||!model?.processing_enabled;
}
async function run(task){if(busy)return;busy=true;control();msg('Consultando…');try{await task()}catch(e){msg(e.message)}finally{busy=false;control()}}
function imageTile(url,label){
 const li=make('li','','tile');
 if(url){
  const u=new URL(url,origin);
  const allowed=u.protocol==='https:'&&(u.origin===origin&&u.pathname.startsWith('/storage/v1/object/sign/alvo-studio-images/')||/^(?:[a-z0-9-]+\.)?mlstatic\.com$/.test(u.hostname));
  if(allowed){const img=make('img');img.src=u.href;img.alt=label;img.referrerPolicy='no-referrer';li.append(img)}
 }
 li.append(make('small',label));return li;
}
function click(label,task){const button=make('button',label);button.type='button';button.onclick=()=>run(task);return button}
function draw(){
 $('title').textContent=model.item.title;
 $('scope').textContent=[model.item.id,model.item.sku,model.item.user_product_id,model.processing_enabled?'Recebimento habilitado':'Recebimento bloqueado'].filter(Boolean).join(' · ');
 $('eligibility').textContent=model.item.catalog_listing?'Envio bloqueado para este anúncio de catálogo.':!['active','paused'].includes(model.item.status)?'Este anúncio está indisponível para edição.':!model.publication_enabled?'Envio desabilitado para este cliente.':model.item.user_product_id?'As fotos podem ser sincronizadas em outros anúncios vinculados a este User Product.':'';
 $('current').replaceChildren(...model.item.pictures.map((p,i)=>imageTile(p.secure_url,i+1+' · '+p.id)));
 const get=id=>model.images.find(i=>i.id===id);
 $('ordered').replaceChildren(...selected.map((id,i)=>{
  const photo=get(id);const tile=imageTile(photo.url,(i+1)+' · Versão '+photo.version);
  const validation=model.events.find(e=>e.event_type==='photo_marketplace_diagnostic'&&e.payload.image_id===id&&e.payload.index===i);
  tile.append(make('small','JPG RGB · 1.200 × 1.200 · '+photo.bytes.toLocaleString('pt-BR')+' bytes'),make('small',validation?(validation.payload.passed?'Validação Mercado Livre aprovada':validation.payload.codes.join(', ')):(states[photo.upload_state]??photo.upload_state)));
  for(const [label,shift] of [['Mover antes',-1],['Mover depois',1]])if(i+shift>=0&&i+shift<selected.length){
   const button=make('button',label);button.type='button';button.onclick=()=>{if(busy)return;[selected[i],selected[i+shift]]=[selected[i+shift],selected[i]];$('attest').checked=false;draw();control()};tile.append(button);
  }
  return tile;
 }));
 $('versionList').replaceChildren(...model.images.filter(i=>i.staged).map(i=>{
  const row=make('div','','record');row.append(make('span','Posição '+i.slot+' · Versão '+i.version+' · '+i.sha256.slice(0,12)+' '));
  if(!selected.includes(i.id)){const button=make('button','Usar esta versão');button.type='button';button.onclick=()=>{if(busy)return;const index=selected.findIndex(id=>get(id).slot===i.slot);if(index<0&&selected.length<9)selected.push(i.id);else if(index>=0)selected[index]=i.id;$('attest').checked=false;draw();control()};row.append(button)}
  return row;
 }));
 $('publications').replaceChildren(...model.publications.map(p=>{
  const row=make('div','','record');row.append(make('p',(states[p.state]??p.state)+' · '+p.proposal_id));
  row.append(make('code',p.hash));
  if(p.state==='pending_approval'){
   const a=make('a','Revisar e aprovar no portal');a.href='meli-review.html?proposal_id='+encodeURIComponent(p.proposal_id);const line=make('p');line.append(a);row.append(line);
  }
  if(p.state==='approved'&&Date.parse(p.expires_at)>Date.now()){
   row.append(click('Publicar fotos aprovadas',async()=>{
    const result=await api('execute',{body:{proposal_id:p.proposal_id,content_hash:p.hash}});
    await refresh();msg((states[result.state]??result.state)+(result.cause?' · '+result.cause:''));
   }));
  }
  if(['applied','unknown','executing'].includes(p.state))row.append(click('Conferir publicação',async()=>{
   const x=await api('verify',{body:{proposal_id:p.proposal_id}});await refresh();msg(x.matched?'As fotos e a ordem conferem.':'A conferência encontrou divergências. Consulte a auditoria.');
  }));
  return row;
 }));
 $('events').replaceChildren(...model.events.map(e=>make('li',new Date(e.created_at).toLocaleString('pt-BR')+' · '+e.event_type+' · '+JSON.stringify(e.payload))));
 control();
}
async function refresh(reset=false){
 const next=await api('status');model=next;
 if(reset)selected=[];
 const old=new Set(selected.map(id=>next.images.find(i=>i.id===id)?.slot));
 selected=selected.filter(id=>next.images.some(i=>i.id===id&&i.staged));
 for(const i of next.images)if(i.staged&&!old.has(i.slot)&&selected.length<9){selected.push(i.id);old.add(i.slot)}
 $('item').hidden=$('history').hidden=false;draw();
}
$('login').onsubmit=e=>{e.preventDefault();run(async()=>{
 const {data,error}=await supabase.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
 $('password').value='';if(error||!data.session)throw Error('Confira seu e-mail e senha.');
 session=data.session;const response=await api('shops');
 $('shop').replaceChildren(...response.shops.map(s=>new Option(s.nickname+' · '+s.seller_id,s.id)));
 $('login').hidden=true;
 $('workspace').hidden=$('logout').hidden=false;
 msg(response.shops.length?'Selecione a loja e localize o anúncio.':'Nenhuma loja autorizada para esta conta.');
})};
$('logout').onclick=()=>run(async()=>{await supabase.auth.signOut();location.reload()});
$('shop').onchange=()=>{listing=null;selected=[];model=null;$('item').hidden=$('history').hidden=true;$('matches').replaceChildren()};
async function open(id){listing=id;$('attest').checked=false;await refresh(true);msg('Confira o anúncio e as fotos atuais.')}
$('search').onsubmit=e=>{e.preventDefault();run(async()=>{
 const query=$('query').value.trim();listing=null;$('item').hidden=$('history').hidden=true;$('matches').replaceChildren();
 if(/^MLB[0-9]+$/i.test(query))return open(query.toUpperCase());
 const {items}=await api('search',{params:{sku:query}});
 $('matches').replaceChildren(...items.map(i=>click(i.id+' · '+i.title,()=>open(i.id))));
 msg(items.length?'Selecione um anúncio.':'Nenhum anúncio com esse SKU nesta loja.');
})};
$('stage').onsubmit=e=>{e.preventDefault();run(async()=>{
 const files=[...$('files').files],start=Number($('start').value);
 if(!files.length||start+files.length>10)throw Error('Escolha até nove imagens e confira a posição inicial.');
 let ok=0;const failures=[];
 for(const [index,file] of files.entries()){
  try{const r=await api('stage',{file:true,body:file,params:{slot:start+index}});
   const prior=selected.findIndex(id=>model.images.find(i=>i.id===id)?.slot===start+index);
   if(prior>=0)selected[prior]=r.image.id;else if(!selected.includes(r.image.id))selected.push(r.image.id);ok++;
  }catch(e){failures.push((start+index)+' · '+e.message)}
 }
 $('attest').checked=false;await refresh();msg(ok+' imagens guardadas. '+failures.join(' '));
})};
$('attest').onchange=control;
$('review').onclick=()=>run(async()=>{await api('review',{body:{ids:selected,attested:$('attest').checked}});await refresh();msg('Revisão visual registrada para as nove fotos nesta ordem.')});
function currentReview(){const r=model.reviews.find(r=>r.ids.join()===selected.join());if(!r)throw Error('Registre a revisão visual desta ordem.');return r.id}
$('upload').onclick=()=>run(async()=>{
 const review_id=currentReview();let valid=0;const failures=[];
 for(let index=0;index<selected.length;index++){
  try{const r=await api('upload',{body:{ids:selected,review_id,index}});if(r.passed)valid++;else failures.push('Foto '+(index+1)+' · '+r.codes.join(', '));}
  catch(e){failures.push('Foto '+(index+1)+' · '+e.message);if(/bloqueado|vendas|vinculados|confirmação/.test(e.message))break}
 }
 await refresh();msg(valid+' fotos aprovadas pelo diagnóstico do Mercado Livre. '+failures.join(' '));
});
$('preview').onclick=()=>run(async()=>{const p=await api('preview',{body:{ids:selected,review_id:currentReview()}});await refresh();msg('Proposta '+p.id+' disponível em Publicação e auditoria.')});
$('reload').onclick=()=>run(async()=>{await refresh();msg('Dados atualizados.')});

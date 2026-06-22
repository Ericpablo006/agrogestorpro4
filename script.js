import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  updatePassword,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  serverTimestamp,
  onSnapshot,
  deleteDoc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';

let app=null, auth=null, db=null, storage=null;
let firebaseReady=false;
let currentUser=null;

function isFirebaseConfigured(){
  return firebaseConfig && firebaseConfig.projectId && !String(firebaseConfig.projectId).includes('SEU_PROJECT_ID') && !String(firebaseConfig.apiKey).includes('COLE_');
}

function initFirebase(){
  if(!isFirebaseConfigured()){
    firebaseReady=false;
    return false;
  }
  app=initializeApp(firebaseConfig);
  auth=getAuth(app);
  db=getFirestore(app);
  storage=getStorage(app);
  firebaseReady=true;
  return true;
}

function mostrarLogin(){document.body.classList.add('locked'); if($('loginScreen')) $('loginScreen').classList.remove('hidden');}
function ocultarLogin(){document.body.classList.remove('locked'); if($('loginScreen')) $('loginScreen').classList.add('hidden');}
function setStatus(msg){ if($('firebaseStatus')) $('firebaseStatus').textContent=msg; }

async function entrar(){
  if(!firebaseReady){alert('Configure o arquivo firebase-config.js antes de usar o login pelo Firebase.');return;}
  const email=($('loginEmail')?.value||'').trim();
  const senha=$('loginSenha')?.value||'';
  if(!email || !senha){alert('Digite e-mail e senha.');return;}
  try{
    await signInWithEmailAndPassword(auth,email,senha);
  }catch(e){
    alert('Não foi possível entrar. Confira e-mail e senha.');
    console.error(e);
  }
}

async function entrarGoogle(){
  if(!firebaseReady){alert('Configure o Firebase antes.');return;}
  try{ await signInWithPopup(auth,new GoogleAuthProvider()); }
  catch(e){ console.error(e); alert('Erro ao entrar com Google. Verifique se o provedor Google está ativado no Firebase Authentication.'); }
}
async function entrarApple(){
  if(!firebaseReady){alert('Configure o Firebase antes.');return;}
  try{ await signInWithPopup(auth,new OAuthProvider('apple.com')); }
  catch(e){ console.error(e); alert('Erro ao entrar com iCloud/Apple. Ative Apple em Firebase Authentication > Método de login.'); }
}

async function sair(){
  if(unsubProdutores) { unsubProdutores(); unsubProdutores=null; }
  produtores=[];
  renderLista();
  if(firebaseReady) await signOut(auth);
  mostrarLogin();
}

async function criarUsuario(){
  if(!firebaseReady){alert('Configure o arquivo firebase-config.js antes de cadastrar usuários.');return;}
  const nome=($('novoNome')?.value||'').trim();
  const email=($('novoEmail')?.value||'').trim();
  const cpf=($('novoCpf')?.value||'').trim();
  const telefone=($('novoTelefone')?.value||'').trim();
  const senha=$('novaSenha')?.value||'';
  const confirmar=$('confirmarSenha')?.value||'';
  const perfil=$('novoPerfil')?.value||'Técnico';
  if(nome.length<3){alert('Digite o nome do usuário.');return;}
  if(!email.includes('@')){alert('Digite um e-mail válido.');return;}
  if(senha.length<6){alert('A senha precisa ter pelo menos 6 caracteres.');return;}
  if(confirmar && senha!==confirmar){alert('As senhas não conferem.');return;}
  try{
    const cred=await createUserWithEmailAndPassword(auth,email,senha);
    await updateProfile(cred.user,{displayName:nome});
    await setDoc(doc(db,'usuarios',cred.user.uid),{
      nome,email,cpf,telefone,perfil,
      criadoEm:serverTimestamp(),
      ativo:true
    });
    alert('Usuário cadastrado no Firebase com sucesso!');
    $('loginEmail').value=email;
    $('loginSenha').value='';
    if($('loginCreate')) $('loginCreate').classList.remove('open');
  }catch(e){
    console.error(e);
    if(e.code==='auth/email-already-in-use') alert('Este e-mail já está cadastrado.');
    else alert('Erro ao cadastrar usuário no Firebase.');
  }
}

function userProdutoresCollection(){
  if(!currentUser) throw new Error('Usuário não autenticado.');
  return collection(db, 'produtores');
}

function userProdutorDoc(key){
  if(!currentUser) throw new Error('Usuário não autenticado.');
  return doc(db, 'produtores', key);
}
function storageDocRef(key,fileName){
  if(!currentUser) throw new Error('Usuário não autenticado.');
  const clean=String(fileName||'arquivo').replace(/[\\/:*?"<>|#%]/g,'_');
  return ref(storage,`usuarios/${currentUser.uid}/produtores/${key}/documentos/${Date.now()}_${clean}`);
}

let unsubProdutores=null;
function carregarProdutoresFirebase(){
  if(!firebaseReady || !currentUser) return;
  try{
    if(unsubProdutores) unsubProdutores();
    unsubProdutores = onSnapshot(userProdutoresCollection(), snap=>{
      produtores = snap.docs.map(d=>({id:d.id, ...d.data()}));
      renderLista();
      updateDash();
    }, e=>{
      console.error(e);
      alert('Não foi possível carregar produtores do Firebase. Verifique as regras do Firestore.');
    });
  }catch(e){
    console.error(e);
    alert('Não foi possível conectar ao Firestore.');
  }
}

async function salvarProdutorFirebase(key,dados){
  if(!firebaseReady || !currentUser) return;
  await setDoc(userProdutorDoc(key),{
    ...dados,
    uid:currentUser.uid,
    atualizadoEmFirebase:serverTimestamp()
  },{merge:true});
}

async function uploadDocsFirebase(key){
  if(!firebaseReady || !currentUser) return docs.map(docMeta);
  const out=[];
  for(const d of docs){
    if(d.file instanceof File || d.file instanceof Blob){
      const r=storageDocRef(key,d.name);
      await uploadBytes(r,d.file,{contentType:d.type||'application/octet-stream'});
      const url=await getDownloadURL(r);
      out.push({id:d.id||crypto.randomUUID?.()||String(Date.now()),name:d.name,type:d.type,size:d.size,url,path:r.fullPath,savedAt:new Date().toISOString()});
    }else{
      out.push(docMeta(d));
    }
  }
  docs=out;
  return out;
}

async function iniciarLogin(){
  if($('btnEntrar')) $('btnEntrar').onclick=entrar;
  if($('btnGoogle')) $('btnGoogle').onclick=entrarGoogle;
  if($('btnApple')) $('btnApple').onclick=entrarApple;
  if($('loginSenha')) $('loginSenha').addEventListener('keydown',e=>{if(e.key==='Enter') entrar();});
  if($('btnSair')) $('btnSair').onclick=sair;
  if($('btnMostrarCadastroUsuario')) $('btnMostrarCadastroUsuario').onclick=()=>$('loginCreate').classList.toggle('open');
  if($('btnCriarUsuario')) $('btnCriarUsuario').onclick=criarUsuario;

  if(!initFirebase()){
    mostrarLogin();
    setStatus('Edite firebase-config.js com os dados do seu projeto Firebase.');
    return;
  }
  onAuthStateChanged(auth,async user=>{
    currentUser=user;
    if(user){
      ocultarLogin();
      setStatus(`Logado: ${user.email}`);
      carregarProdutoresFirebase();
      carregarPerfil();
    }else{
      mostrarLogin();
      setStatus('Cadastros serão salvos no Firebase após o login.');
    }
  });
}
const pages=[
 ['dashboard','🏠 Dashboard'],['produtor','👨‍🌾 Produtor'],['propriedade','🌱 Propriedade'],['agricultura','🌾 Agricultura'],['pecuaria','🐄 Pecuária'],['projeto','📄 Projeto'],['garantia','🏠 Garantia'],['documentos','📎 Documentos'],['roteiro','🧭 Roteiro'],['mapa','🗺️ Mapa'],['agenda','📅 Agenda'],['relatorios','📊 Relatórios'],['perfil','👤 Perfil']
];
let current=0;
let produtores=[];
let ativo={};
let editingKey=null;
let docs=[];
const $=id=>document.getElementById(id);
const money=v=>(Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const safeKey=s=>String(s||'').replace(/\D/g,'') || String(s||'produtor').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'_').toLowerCase();
const DB_NAME='agrogestor_docs_db';
const STORE='documentos';

function openDocsDB(){
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{ const db=req.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'}); };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
async function saveDocsForProducer(key){
 const db=await openDocsDB();
 const tx=db.transaction(STORE,'readwrite');
 const store=tx.objectStore(STORE);
 await new Promise((resolve,reject)=>{ const clear=store.openCursor(); clear.onsuccess=e=>{const cursor=e.target.result; if(cursor){ if(cursor.value.produtorKey===key) cursor.delete(); cursor.continue(); } else resolve();}; clear.onerror=()=>reject(clear.error); });
 for(const d of docs){
  if(d.file instanceof File || d.file instanceof Blob){
   store.put({id:d.id, produtorKey:key, name:d.name, type:d.type, size:d.size, file:d.file, savedAt:new Date().toISOString()});
  }
 }
 await new Promise((resolve,reject)=>{tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);});
}
async function loadDocsForProducer(key){
 try{
  const db=await openDocsDB();
  const tx=db.transaction(STORE,'readonly');
  const store=tx.objectStore(STORE);
  const out=[];
  await new Promise((resolve,reject)=>{
   const req=store.openCursor();
   req.onsuccess=e=>{const cursor=e.target.result; if(cursor){ if(cursor.value.produtorKey===key) out.push(cursor.value); cursor.continue(); } else resolve();};
   req.onerror=()=>reject(req.error);
  });
  return out;
 }catch(e){ console.warn('IndexedDB indisponível',e); return []; }
}
async function deleteDocsForProducer(key){
 const db=await openDocsDB();
 const tx=db.transaction(STORE,'readwrite');
 const store=tx.objectStore(STORE);
 await new Promise((resolve,reject)=>{ const req=store.openCursor(); req.onsuccess=e=>{const cursor=e.target.result; if(cursor){ if(cursor.value.produtorKey===key) cursor.delete(); cursor.continue(); } else resolve();}; req.onerror=()=>reject(req.error); });
}
function docMeta(d){return {id:d.id,name:d.name,type:d.type,size:d.size,url:d.url||'',path:d.path||'',savedAt:d.savedAt||new Date().toISOString()};}

function initMenu(){
 $('menu').innerHTML=pages.map((p,i)=>`<button data-i="${i}">${p[1]}</button>`).join('');
 document.querySelectorAll('#menu button').forEach(b=>b.onclick=()=>showPage(+b.dataset.i));
}
function closeMobileMenu(){document.body.classList.remove('menu-open')}
function showPage(i){
 current=i;
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
 document.querySelector(`[data-page="${pages[i][0]}"]`).classList.add('active');
 document.querySelectorAll('#menu button').forEach(b=>b.classList.toggle('active',+b.dataset.i===i));
 $('pageTitle').textContent=pages[i][1].replace(/[🏠👨‍🌾🌱🌾🐄📄📎🧭📊]/g,'').trim();
 $('stepInfo').textContent=`Etapa ${i+1} de ${pages.length}`;
 closeMobileMenu();
 calcProgress();
}
function getData(){return{
 nome:$('nome').value,apelido:$('apelido')?.value||'',cpf:$('cpf').value,rg:$('rg').value,nascimento:$('nascimento').value,estadoCivil:$('estadoCivil').value,telefone:$('telefone').value,email:$('email').value,caf:$('caf').value,conjugeNome:$('conjugeNome')?.value||'',conjugeCpf:$('conjugeCpf')?.value||'',conjugeNascimento:$('conjugeNascimento')?.value||'',conjugeTelefone:$('conjugeTelefone')?.value||'',
 propriedade:$('propriedade').value,comunidade:$('comunidade').value,cep:$('cep')?.value||'',municipio:$('municipio').value,uf:$('uf').value,areaTotal:$('areaTotal').value,areaProdutiva:$('areaProdutiva').value,areaPlantio:$('areaPlantio')?.value||'',car:$('car').value,ccir:$('ccir').value,itr:$('itr').value,gps:$('gps').value,seiaLogin:$('seiaLogin')?.value||'',seiaSenha:$('seiaSenha')?.value||'',
 banco:$('banco').value,agencia:$('agencia')?.value||'',cidadeAgencia:$('cidadeAgencia')?.value||'',conta:$('conta')?.value||'',linha:$('linha').value,finalidade:$('finalidade').value,valorSolicitado:$('valorSolicitado').value,prazo:$('prazo').value,carencia:$('carencia').value,
 dataVisita:$('dataVisita').value,tecnico:$('tecnico').value,objetivoVisita:$('objetivoVisita').value,observacoes:$('observacoes').value,recomendacoes:$('recomendacoes').value,
 culturas:getRows('culturasBody'),pecuaria:getRows('pecuariaBody'),itens:getRows('itensBody'),garantia:getGarantiaRows(),agenda:agendaItens,docs:docs.map(docMeta)
};}
async function setData(d={}){
 ['nome','apelido','cpf','rg','nascimento','estadoCivil','telefone','email','caf','conjugeNome','conjugeCpf','conjugeNascimento','conjugeTelefone','propriedade','comunidade','cep','municipio','uf','areaTotal','areaProdutiva','areaPlantio','car','ccir','itr','gps','seiaLogin','seiaSenha','consultaCar','consultaSeiaLogin','consultaSeiaSenha','situacaoAmbiental','obsAmbiental','roteiroChegada','banco','agencia','cidadeAgencia','conta','linha','finalidade','valorSolicitado','prazo','carencia','dataVisita','tecnico','objetivoVisita','observacoes','recomendacoes'].forEach(id=>{if($(id)) $(id).value=d[id]||''});
 renderRows('culturasBody',d.culturas||[],['cultura','area','producao','unidade','preco']);
 renderRows('pecuariaBody',d.pecuaria||[],['atividade','qtd','producao','unidade','preco']);
 renderRows('itensBody',d.itens||[],['descricao','qtd','valor']);
 renderGarantiaRows(d.garantia||[]);
 const key=safeKey(d.cpf||d.nome);
 const savedDocs=key ? await loadDocsForProducer(key) : [];
 docs=(d.docs&&d.docs.length) ? d.docs : savedDocs;
 agendaItens=Array.isArray(d.agenda)?d.agenda:[];
 renderDocs();
 renderAgenda();
 atualizarMiniMapa();
 calcProgress();
}
function addRow(body,keys,vals={}){
 const tr=document.createElement('tr');
 tr.innerHTML=keys.map(k=>`<td><input data-k="${k}" value="${vals[k]||''}" type="${['area','producao','preco','qtd','valor'].includes(k)?'number':'text'}" step="0.01"></td>`).join('')+`<td class="total"></td><td><button class="secondary remove">x</button></td>`;
 $(body).appendChild(tr);
 tr.querySelector('.remove').onclick=()=>{tr.remove();calcAll()};
 tr.querySelectorAll('input').forEach(i=>i.oninput=calcAll);
 calcAll();
}
function renderRows(body,rows,keys){$(body).innerHTML='';rows.forEach(r=>addRow(body,keys,r));}
function getRows(body){return [...$(body).querySelectorAll('tr')].map(tr=>{let o={};tr.querySelectorAll('input').forEach(i=>o[i.dataset.k]=i.value);return o});}

function addGarantiaRow(vals={}){
 const tr=document.createElement('tr');
 tr.innerHTML=`
  <td><input data-k="item" value="${vals.item||''}" placeholder="Ex: casa sede, secador, depósito"></td>
  <td><input data-k="quantidade" value="${vals.quantidade||''}" type="number" min="0" step="0.01"></td>
  <td><input data-k="unidade" value="${vals.unidade||''}" placeholder="un, m², ha"></td>
  <td><input data-k="idade" value="${vals.idade||''}" placeholder="Ex: 5 anos"></td>
  <td><select data-k="estado"><option value="">Selecione</option><option ${vals.estado==='Ótimo'?'selected':''}>Ótimo</option><option ${vals.estado==='Bom'?'selected':''}>Bom</option><option ${vals.estado==='Regular'?'selected':''}>Regular</option><option ${vals.estado==='Ruim'?'selected':''}>Ruim</option></select></td>
  <td><input data-k="valor" value="${vals.valor||''}" type="number" min="0" step="0.01"></td>
  <td class="total"></td>
  <td><button class="secondary remove" type="button">x</button></td>`;
 $('garantiaBody').appendChild(tr);
 tr.querySelector('.remove').onclick=()=>{tr.remove();calcGarantiaTotal();calcProgress();};
 tr.querySelectorAll('input,select').forEach(i=>i.oninput=()=>{calcGarantiaTotal();calcProgress();});
 calcGarantiaTotal();
}
function renderGarantiaRows(rows=[]){if(!$('garantiaBody')) return; $('garantiaBody').innerHTML=''; rows.forEach(r=>addGarantiaRow(r)); calcGarantiaTotal();}
function getGarantiaRows(){if(!$('garantiaBody')) return []; return [...$('garantiaBody').querySelectorAll('tr')].map(tr=>{let o={};tr.querySelectorAll('input,select').forEach(i=>o[i.dataset.k]=i.value);return o});}
function calcGarantiaTotal(){
 if(!$('garantiaBody')) return;
 let total=0;
 [...$('garantiaBody').querySelectorAll('tr')].forEach(tr=>{
  const qtd=+tr.querySelector('[data-k="quantidade"]')?.value||0;
  const valor=+tr.querySelector('[data-k="valor"]')?.value||0;
  const soma=qtd*valor;
  total+=soma;
  const td=tr.querySelector('.total'); if(td) td.textContent=money(soma);
 });
 if($('totalGarantia')) $('totalGarantia').textContent=money(total);
}

function calcAll(){
 ['culturasBody','pecuariaBody'].forEach(body=>[...$(body).querySelectorAll('tr')].forEach(tr=>{let prod=+tr.querySelector('[data-k="producao"]')?.value||0,preco=+tr.querySelector('[data-k="preco"]')?.value||0;tr.querySelector('.total').textContent=money(prod*preco)}));
 [...$('itensBody').querySelectorAll('tr')].forEach(tr=>{let qtd=+tr.querySelector('[data-k="qtd"]')?.value||0,val=+tr.querySelector('[data-k="valor"]')?.value||0;tr.querySelector('.total').textContent=money(qtd*val)});
 calcGarantiaTotal();
 calcProgress();
}
function calcProgress(){
 const d=getData();
 const required=['nome','cpf','telefone','caf','propriedade','municipio','areaTotal','areaPlantio','car','banco','linha','valorSolicitado'];
 let ok=required.filter(k=>d[k]).length;
 if(d.culturas.length) ok++; if(d.pecuaria.length) ok++; if(d.itens.length) ok++; if((d.garantia||[]).length) ok++; if(d.observacoes) ok++; if(d.docs.length) ok++; if((d.agenda||[]).length) ok++;
 const pct=Math.min(100,Math.round(ok/(required.length+7)*100));
 $('progressText').textContent=pct+'%'; $('progressBar').style.width=pct+'%'; updateDash();
}
async function salvar(){
 const d=getData();
 if(!currentUser){alert('Faça login antes de salvar.');return}
 if(!d.nome){alert('Digite o nome do produtor.');return}

 // Se estiver editando um produtor já existente, mantém a edição no mesmo cadastro.
 // Se for novo cadastro, usa CPF ou nome para criar o documento no Firestore.
 const novoKey=safeKey(d.cpf||d.nome);
 const key=editingKey || novoKey;
 d.docKey=key;
 d.atualizadoEm=new Date().toLocaleString('pt-BR');
 try{
   d.docs=await uploadDocsFirebase(key);
   await salvarProdutorFirebase(key,d);

   // Caso o produtor antigo tenha sido aberto para edição, mas o CPF/nome mudou,
   // o cadastro continua atualizado no mesmo documento para não duplicar.
   editingKey=key;
   ativo=d;
   await setData(d);
   alert('Cadastro do produtor atualizado no Firebase com sucesso!');
 }catch(e){
   console.error(e);
   alert('Erro ao salvar no Firebase. Verifique Firestore, Storage e regras de segurança.');
 }
}
async function novo(){ativo={};editingKey=null;docs=[];setReadOnly(false);await setData({});showPage(1)}
function updateDash(){
 let valor=produtores.reduce((s,p)=>s+(+p.valorSolicitado||0),0);
 let agro=produtores.reduce((s,p)=>s+(p.culturas||[]).reduce((a,c)=>a+(+c.producao||0)*(+c.preco||0),0),0);
 let pec=produtores.reduce((s,p)=>s+(p.pecuaria||[]).reduce((a,c)=>a+(+c.producao||0)*(+c.preco||0),0),0);
 $('totalProdutores').textContent=produtores.length; $('valorTotal').textContent=money(valor); $('receitaAgro').textContent=money(agro); $('receitaPec').textContent=money(pec);
}
function setReadOnly(status){
  document.body.classList.toggle('view-only', !!status);
  document.querySelectorAll('.app input,.app textarea,.app select').forEach(el=>{ if(el.id!=='busca') el.disabled=!!status; });
  ['btnSalvar','addCultura','addPecuaria','addItem','addGarantia','docs','btnLimparDocs'].forEach(id=>{ if($(id)) $(id).disabled=!!status; });
}
function renderLista(){
 const q=($('busca')?.value||'').toLowerCase();
 $('listaProdutores').innerHTML=produtores.filter(p=>JSON.stringify(p).toLowerCase().includes(q)).map((p,i)=>`<div class="row"><div><b>${p.nome||'Sem nome'}</b><br><small>${p.cpf||''} • ${p.municipio||''}/${p.uf||''} • CAF ${p.caf||''} • Docs ${(p.docs||[]).length}</small></div><div class="row-actions"><button data-i="${i}" class="secondary ver-produtor">Abrir</button><button data-i="${i}" class="secondary abrir-produtor">✏️ Editar</button><button data-i="${i}" class="secondary excluir-produtor">Excluir</button></div></div>`).join('')||'<p class="muted">Nenhum produtor cadastrado.</p>';
 document.querySelectorAll('.ver-produtor').forEach(b=>b.onclick=async()=>{
   ativo=produtores[+b.dataset.i];
   editingKey=ativo.docKey || ativo.id || safeKey(ativo.cpf||ativo.nome);
   await setData(ativo);
   setReadOnly(true);
   showPage(1);
 });
 document.querySelectorAll('.abrir-produtor').forEach(b=>b.onclick=async()=>{
   ativo=produtores[+b.dataset.i];
   editingKey=ativo.docKey || ativo.id || safeKey(ativo.cpf||ativo.nome);
   await setData(ativo);
   setReadOnly(false);
   showPage(1);
   alert('Modo edição aberto. Faça as alterações e clique em Salvar para atualizar o cadastro.');
 });
 document.querySelectorAll('.excluir-produtor').forEach(b=>b.onclick=async()=>{await excluirProdutor(+b.dataset.i)});
 updateDash();
}
async function excluirProdutor(i){
 const p=produtores[i];
 if(!p || !currentUser) return;
 if(!confirm('Excluir este produtor do Firebase?')) return;
 try{
   const key=p.docKey || safeKey(p.cpf||p.nome);
   await deleteDoc(userProdutorDoc(key));
   if(key) await deleteDocsForProducer(key);
   if(ativo && (ativo.docKey===key || safeKey(ativo.cpf||ativo.nome)===key)) await novo();
   if(editingKey===key) editingKey=null;
 }catch(e){
   console.error(e);
   alert('Não foi possível excluir do Firebase.');
 }
}
function renderDocs(){
 $('docsLista').innerHTML=(docs||[]).map((d,i)=>`<span class="chip">📎 ${d.name} <small>${((d.size||0)/1024).toFixed(1)} KB</small> <button class="chip-x" onclick="removerDoc(${i})" type="button">×</button></span>`).join('') || '<span class="muted">Nenhum documento anexado.</span>';
 calcProgress();
}
window.removerDoc=i=>{docs.splice(i,1);renderDocs();};
async function limparDocsAtual(){
 const d=getData(); const key=safeKey(d.cpf||d.nome);
 if(!confirm('Limpar documentos anexados deste produtor?')) return;
 docs=[]; if(key) await deleteDocsForProducer(key); renderDocs();
}
async function buscarCep(){
 const input=$('cep'); if(!input) return;
 const cep=input.value.replace(/\D/g,'');
 if(cep.length!==8) return;
 input.value=cep.replace(/(\d{5})(\d{3})/,'$1-$2');
 try{
  const r=await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  const data=await r.json();
  if(data.erro){alert('CEP não encontrado.');return}
  $('municipio').value=data.localidade||'';
  $('uf').value=data.uf||'';
  calcProgress();
 }catch(e){ alert('Não foi possível consultar o CEP agora.'); }
}
function gerarPDF(){
 const d=getData(); const {jsPDF}=window.jspdf; const pdf=new jsPDF(); let y=12;
 function line(t){pdf.text(String(t||''),12,y);y+=8;if(y>280){pdf.addPage();y=12}}
 pdf.setFontSize(16);line('AgroGestor Pro - Ficha do Produtor');pdf.setFontSize(11);
 line(`Nome: ${d.nome}${d.apelido ? ' | Apelido: '+d.apelido : ''}`);line(`CPF: ${d.cpf}   RG: ${d.rg}`);line(`Estado civil: ${d.estadoCivil}`);line(`Telefone: ${d.telefone}   CAF: ${d.caf}`);if(d.conjugeNome || d.conjugeCpf || d.conjugeTelefone){line(`Cônjuge: ${d.conjugeNome||''} | CPF: ${d.conjugeCpf||''} | Nascimento: ${d.conjugeNascimento||''} | Tel: ${d.conjugeTelefone||''}`);}
 line(`Propriedade: ${d.propriedade} - ${d.comunidade} - ${d.municipio}/${d.uf}`);line(`CEP: ${d.cep}`);
 line(`Área total: ${d.areaTotal} ha | Área produtiva: ${d.areaProdutiva} ha | Área para plantio: ${d.areaPlantio} ha`);
 line(`CAR: ${d.car} | CCIR: ${d.ccir} | ITR/NIRF: ${d.itr}`); line(`SEIA login: ${d.seiaLogin||''} | SEIA senha: ${d.seiaSenha ? '********' : ''}`); line('');
 line('AGRICULTURA'); d.culturas.forEach(c=>line(`${c.cultura||'-'} | Área: ${c.area||0} ha | Produção: ${c.producao||0} ${c.unidade||''} | Preço: ${money(c.preco)} | Receita: ${money((+c.producao||0)*(+c.preco||0))}`));
 line(''); line('PECUÁRIA'); d.pecuaria.forEach(c=>line(`${c.atividade||'-'} | Qtd: ${c.qtd||0} | Produção: ${c.producao||0} ${c.unidade||''} | Preço: ${money(c.preco)} | Receita: ${money((+c.producao||0)*(+c.preco||0))}`));
 line(''); line('GARANTIA / AVALIAÇÃO DO IMÓVEL'); (d.garantia||[]).forEach(g=>line(`${g.item||'-'} | Qtd: ${g.quantidade||0} ${g.unidade||''} | Idade: ${g.idade||''} | Estado: ${g.estado||''} | Valor: ${money(g.valor)} | Total: ${money((+g.quantidade||0)*(+g.valor||0))}`)); line('Total garantia: '+money((d.garantia||[]).reduce((s,g)=>s+(+g.quantidade||0)*(+g.valor||0),0)));
 line(''); line('DOCUMENTOS'); d.docs.forEach(x=>line(`- ${x.name}`));
 line(''); line('PROJETO PRONAF'); line(`Banco: ${d.banco} | Agência: ${d.agencia||''} | Cidade agência: ${d.cidadeAgencia||''} | Conta: ${d.conta||''}`); line(`Linha: ${d.linha} | Valor: ${money(d.valorSolicitado)}`); d.itens.forEach(i=>line(`${i.descricao||'-'} | Qtd: ${i.qtd||0} | Unit: ${money(i.valor)} | Total: ${money((+i.qtd||0)*(+i.valor||0))}`));
 line(''); line('ROTEIRO PARA CHEGAR NA PROPRIEDADE'); line(`Data: ${d.dataVisita} | Técnico: ${d.tecnico}`); line(`Objetivo: ${d.objetivoVisita}`); line(`Observações: ${d.observacoes}`); line(`Recomendações: ${d.recomendacoes}`);
 pdf.save(`Ficha_${(d.nome||'produtor').replaceAll(' ','_')}.pdf`);
}
async function criarPasta(){
 const d=getData();
 const zip=new JSZip();
 const nomePasta=(d.nome||'produtor').replace(/[\\/:*?"<>|]/g,'_');
 const folder=zip.folder(nomePasta);
 const docsFolder=folder.folder('documentos');
 const key=safeKey(d.cpf||d.nome);
 const stored=await loadDocsForProducer(key);
 const docsToZip=stored.length?stored:docs;
 if(!docsToZip.length){alert('Nenhum documento anexado para criar a pasta.');return;}
 for(const doc of docsToZip){
   if(doc.file){ docsFolder.file(doc.name, doc.file); }
   else if(doc.url){
     try{ const resp=await fetch(doc.url); const blob=await resp.blob(); docsFolder.file(doc.name, blob); }
     catch(e){ docsFolder.file((doc.name||'documento')+'_link.txt', doc.url); }
   }
 }
 const blob=await zip.generateAsync({type:'blob'});
 const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`Documentos_${nomePasta}.zip`; a.click();
}

async function exportarTudo(){const zip=new JSZip();zip.file('backup_agrogestor.json',JSON.stringify(produtores,null,2));const blob=await zip.generateAsync({type:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='backup_agrogestor_pro.zip';a.click();}

function aplicarMascaraCpf(v){
  return String(v||'').replace(/\D/g,'').slice(0,11)
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d)/,'$1.$2')
    .replace(/(\d{3})(\d{1,2})$/,'$1-$2');
}
function aplicarMascaraTelefone(v){
  const n=String(v||'').replace(/\D/g,'').slice(0,11);
  if(n.length<=10) return n.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d)/,'$1-$2');
  return n.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d)/,'$1-$2');
}
function somenteLetras(v){ return String(v||'').replace(/[^A-Za-zÀ-ÿ\s.'-]/g,''); }
function somenteNumeros(v){ return String(v||'').replace(/\D/g,''); }
function configurarValidacoes(){
  document.querySelectorAll('.numbers-only').forEach(input=>{
    input.addEventListener('input',()=>{
      if(input.classList.contains('cpf-field')) input.value=aplicarMascaraCpf(input.value);
      else if(input.classList.contains('phone-field')) input.value=aplicarMascaraTelefone(input.value);
      else if(input.classList.contains('cep-field')) input.value=somenteNumeros(input.value).slice(0,8).replace(/(\d{5})(\d{1,3})/,'$1-$2');
      else input.value=somenteNumeros(input.value);
    });
  });
  document.querySelectorAll('.letters-only').forEach(input=>{
    input.addEventListener('input',()=>{input.value=somenteLetras(input.value);});
  });
  if($('toggleConsultaSeiaSenha')) $('toggleConsultaSeiaSenha').onclick=()=>{
    const campo=$('consultaSeiaSenha');
    campo.type = campo.type === 'password' ? 'text' : 'password';
    $('toggleConsultaSeiaSenha').textContent = campo.type === 'password' ? '🔍' : '🙈';
  };
  if($('gps')) $('gps').addEventListener('input',atualizarMiniMapa);
  if($('toggleSeiaSenha')) $('toggleSeiaSenha').onclick=()=>{
    const campo=$('seiaSenha');
    campo.type = campo.type === 'password' ? 'text' : 'password';
    $('toggleSeiaSenha').textContent = campo.type === 'password' ? '🔍' : '🙈';
  };
  ['toggleLoginSenha','toggleNovaSenha','toggleConfirmarSenha'].forEach((btnId)=>{
    if($(btnId)) $(btnId).onclick=()=>{
      const map={toggleLoginSenha:'loginSenha',toggleNovaSenha:'novaSenha',toggleConfirmarSenha:'confirmarSenha'};
      const campo=$(map[btnId]);
      if(!campo) return;
      campo.type = campo.type === 'password' ? 'text' : 'password';
      $(btnId).textContent = campo.type === 'password' ? '👁️' : '🙈';
    };
  });

  ['agencia','conta'].forEach(id=>{
    const campo=$(id);
    if(campo){
      campo.removeAttribute('maxlength');
      campo.addEventListener('input',()=>{
        campo.value = String(campo.value||'').toUpperCase().replace(/[^0-9A-Z-]/g,'');
      });
    }
  });

  if($('agencia')) $('agencia').addEventListener('blur',()=>{
    if($('cidadeAgencia') && !$('cidadeAgencia').value.trim()) $('cidadeAgencia').value = $('municipio')?.value || '';
    calcProgress();
  });
}


let agendaItens=[];
function renderAgenda(){
 if(!$('listaAgenda')) return;
 $('listaAgenda').innerHTML=(agendaItens||[]).map((a,i)=>`<div class="agenda-item"><b>${a.tipo||''}</b><span>${a.data||''} ${a.hora||''}</span><small>${a.status||''} - ${a.descricao||''}</small><button class="secondary" onclick="removerAgenda(${i})" type="button">Remover</button></div>`).join('') || '<p class="muted">Nenhum compromisso cadastrado.</p>';
}
window.removerAgenda=i=>{agendaItens.splice(i,1);renderAgenda();calcProgress();};
function addAgenda(){
 const item={tipo:$('agendaTipo')?.value||'',data:$('agendaData')?.value||'',hora:$('agendaHora')?.value||'',status:$('agendaStatus')?.value||'',descricao:$('agendaDescricao')?.value||''};
 if(!item.data && !item.descricao){alert('Informe pelo menos a data ou descrição.');return;}
 agendaItens.push(item); renderAgenda(); calcProgress();
}
function dmsParaDecimal(valor) {
  const texto = String(valor || '').trim().toUpperCase();

  // Aceita: 13°22'13"S | 13 22 13 S | 13° 22' S
  const partes = texto.match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)?\D*(\d+(?:\.\d+)?)?\D*([NSEW])/);
  if (!partes) return null;

  const graus = parseFloat(partes[1]) || 0;
  const minutos = parseFloat(partes[2]) || 0;
  const segundos = parseFloat(partes[3]) || 0;
  const direcao = partes[4];

  let decimal = graus + (minutos / 60) + (segundos / 3600);
  if (direcao === 'S' || direcao === 'W') decimal *= -1;

  return decimal;
}

function obterCoordenadas(gps) {
  const texto = String(gps || '').trim();

  // Formato decimal: -13.3705, -39.0732
  const decimal = texto.match(/-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?/);
  if (decimal) {
    const [lat, lng] = decimal[0].split(',').map(v => v.trim());
    return { lat, lng };
  }

  // Formato grau/minuto/segundo: 13°22'13"S, 39°04'23"W
  const partes = texto.split(',');
  if (partes.length >= 2) {
    const lat = dmsParaDecimal(partes[0]);
    const lng = dmsParaDecimal(partes[1]);

    if (lat !== null && lng !== null) {
      return {
        lat: lat.toFixed(6),
        lng: lng.toFixed(6)
      };
    }
  }

  return null;
}

function atualizarMiniMapa(){
 if(!$('miniMapa')) return;
 const gps=$('gps')?.value||'';
 const coords=obterCoordenadas(gps);

 if($('gpsPreview')) $('gpsPreview').textContent=gps||'não informado';

 if(!coords){
   $('miniMapa').innerHTML='Digite as coordenadas em decimal ou em grau, minuto e segundo. Ex: 13°22\'13"S, 39°04\'23"W';
   return;
 }

 if($('gpsPreview')) $('gpsPreview').textContent=`${coords.lat}, ${coords.lng}`;
 $('miniMapa').innerHTML=`<iframe title="Mini mapa" loading="lazy" src="https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=15&output=embed"></iframe>`;
}

function abrirMaps() {
  const gps = $('gps')?.value || '';
  const coords = obterCoordenadas(gps);

  if (!coords) {
    alert('Informe uma localização válida. Ex: 13°22\'13"S, 39°04\'23"W');
    return;
  }

  window.open(`https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`, '_blank');
}

function abrirEarth(){
  const gps = $('gps')?.value || '';
  const coords = obterCoordenadas(gps);

  if (!coords) {
    alert('Informe uma localização válida. Ex: 13°22\'13"S, 39°04\'23"W');
    return;
  }

  window.open(`https://earth.google.com/web/search/${coords.lat},${coords.lng}`, '_blank');
}
function capturarGps(){ if(!navigator.geolocation){alert('GPS não disponível neste navegador.');return;} navigator.geolocation.getCurrentPosition(p=>{ $('gps').value=p.coords.latitude+', '+p.coords.longitude; atualizarMiniMapa(); calcProgress(); },()=>alert('Não foi possível capturar o GPS.')); }
function abrirCAR(){ window.open('https://www.car.gov.br/#/consultar','_blank'); }
function abrirSEIA(){ window.open('http://sistema.seia.ba.gov.br/','_blank'); }
function gerarPlanilha(){
 const linhas=[['Nome','CPF','Valor financiado']];
 produtores.forEach(p=>linhas.push([p.nome||'',p.cpf||'',p.valorSolicitado||'']));
 const csv='\ufeff'+linhas.map(l=>l.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\n');
 const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='produtores_propostas.csv'; a.click();
}
function analisarIA(){
 const d=getData(); const falt=[];
 ['nome','cpf','caf','car','areaTotal','areaPlantio','banco','linha','valorSolicitado'].forEach(c=>{if(!d[c]) falt.push(c)});
 const receita=[...(d.culturas||[]),...(d.pecuaria||[])].reduce((s,x)=>s+(+x.producao||0)*(+x.preco||0),0);
 const valor=+d.valorSolicitado||0;
 let capacidade = receita ? (valor/Math.max(receita,1)) : 0;
 let sugestao='PRONAF Custeio';
 if((d.finalidade||'').toLowerCase().includes('máquina') || (d.finalidade||'').toLowerCase().includes('equip')) sugestao='PRONAF Mais Alimentos';
 if((d.finalidade||'').toLowerCase().includes('mulher')) sugestao='PRONAF Mulher';
 if((d.finalidade||'').toLowerCase().includes('agroecologia')) sugestao='PRONAF Agroecologia';
 const inconsist=[];
 if(+d.areaPlantio > +d.areaTotal) inconsist.push('Área para plantio maior que área total.');
 if(!d.docs?.length) inconsist.push('Nenhum documento anexado.');
 $('resultadoIA').innerHTML=`<h3>Resultado da análise</h3><p><b>Documentos/campos faltantes:</b> ${falt.length?falt.join(', '):'Nenhum item crítico identificado.'}</p><p><b>Linha sugerida:</b> ${sugestao}</p><p><b>Receita estimada:</b> ${money(receita)}</p><p><b>Capacidade de pagamento:</b> ${receita? (capacidade<1?'Boa/possível':'Atenção: valor solicitado alto em relação à receita informada'):'Não calculada, informe produção e preço.'}</p><p><b>Alertas:</b> ${inconsist.length?inconsist.join(' '):'Sem inconsistências principais.'}</p>`;
}
function gerarRascunhoProjeto(){
 const d=getData();
 const texto=`PROJETO TÉCNICO PRONAF - RASCUNHO\n\nProdutor: ${d.nome||''}\nCPF: ${d.cpf||''}\nPropriedade: ${d.propriedade||''}, ${d.municipio||''}/${d.uf||''}\n\nObjetivo: financiar ${d.finalidade||'atividade produtiva rural'} pela linha ${d.linha||'PRONAF'}.\n\nJustificativa: o produtor desenvolve atividades agropecuárias na propriedade informada, buscando ampliar a capacidade produtiva, melhorar a renda familiar e fortalecer a agricultura familiar.\n\nSituação ambiental: ${d.situacaoAmbiental||'não informada'}. CAR: ${d.car||d.consultaCar||'não informado'}.\n\nValor solicitado: ${money(d.valorSolicitado)}.\n\nParecer preliminar: recomenda-se conferir documentação, orçamentos, capacidade de pagamento e adequação da linha de crédito antes do envio ao banco.`;
 $('resultadoIA').innerHTML='<h3>Rascunho do projeto</h3><textarea class="wide rascunho">'+texto+'</textarea>';
}


async function carregarPerfil(){
  if(!currentUser) return;
  if($('perfilEmail')) $('perfilEmail').value = currentUser.email || '';
  if($('perfilNome')) $('perfilNome').value = currentUser.displayName || '';
  try{
    const snap = await getDoc(doc(db,'usuarios',currentUser.uid));
    if(snap.exists()){
      const u = snap.data();
      if($('perfilNome') && u.nome) $('perfilNome').value = u.nome;
      if($('perfilCpf')) $('perfilCpf').value = u.cpf || '';
      if($('perfilTelefone')) $('perfilTelefone').value = u.telefone || '';
    }
  }catch(e){
    console.warn('Não foi possível carregar perfil do usuário.', e);
  }
}

async function salvarPerfil(){
  if(!currentUser){alert('Faça login antes de alterar o perfil.');return;}
  const nome = ($('perfilNome')?.value || '').trim();
  const cpf = ($('perfilCpf')?.value || '').trim();
  const telefone = ($('perfilTelefone')?.value || '').trim();
  const senha = $('perfilSenha')?.value || '';
  const senha2 = $('perfilSenha2')?.value || '';

  if(nome.length < 3){alert('Digite um nome de usuário válido.');return;}
  if(senha || senha2){
    if(senha.length < 6){alert('A nova senha precisa ter pelo menos 6 caracteres.');return;}
    if(senha !== senha2){alert('As senhas não conferem.');return;}
  }

  try{
    await updateProfile(currentUser,{displayName:nome});
    await setDoc(doc(db,'usuarios',currentUser.uid),{
      nome,
      email: currentUser.email || '',
      cpf,
      telefone,
      atualizadoEm: serverTimestamp()
    },{merge:true});

    if(senha){
      await updatePassword(currentUser, senha);
      if($('perfilSenha')) $('perfilSenha').value='';
      if($('perfilSenha2')) $('perfilSenha2').value='';
    }

    setStatus(`Logado: ${currentUser.email}`);
    alert('Perfil atualizado com sucesso!');
  }catch(e){
    console.error(e);
    if(e.code === 'auth/requires-recent-login'){
      alert('Por segurança, saia e entre novamente para alterar a senha.');
    }else{
      alert('Não foi possível salvar o perfil. Verifique sua conexão e as regras do Firestore.');
    }
  }
}

function configurarPerfil(){
  if($('btnSalvarPerfil')) $('btnSalvarPerfil').onclick = salvarPerfil;
  [['togglePerfilSenha','perfilSenha'],['togglePerfilSenha2','perfilSenha2']].forEach(([btnId,inputId])=>{
    if($(btnId)) $(btnId).onclick=()=>{
      const campo=$(inputId);
      if(!campo) return;
      campo.type = campo.type === 'password' ? 'text' : 'password';
      $(btnId).textContent = campo.type === 'password' ? '👁️' : '🙈';
    };
  });
}

function bind(){
 initMenu();
 $('btnAvancar').onclick=()=>showPage(Math.min(current+1,pages.length-1)); $('btnVoltar').onclick=()=>showPage(Math.max(current-1,0));
 $('btnSalvar').onclick=salvar; $('btnNovo').onclick=novo; $('btnPDF').onclick=gerarPDF; $('btnPDF2').onclick=gerarPDF; $('btnPasta').onclick=criarPasta; $('btnLimpar').onclick=novo;
 $('addCultura').onclick=()=>addRow('culturasBody',['cultura','area','producao','unidade','preco']); $('addPecuaria').onclick=()=>addRow('pecuariaBody',['atividade','qtd','producao','unidade','preco']); $('addItem').onclick=()=>addRow('itensBody',['descricao','qtd','valor']); if($('addGarantia')) $('addGarantia').onclick=()=>addGarantiaRow();
 $('busca').oninput=renderLista;
 if($('btnPlanilha')) $('btnPlanilha').onclick=gerarPlanilha;
 if($('btnAbrirMaps')) $('btnAbrirMaps').onclick=abrirMaps;
 if($('btnAbrirEarth')) $('btnAbrirEarth').onclick=abrirEarth;
 if($('btnCapturarGps')) $('btnCapturarGps').onclick=capturarGps;
 if($('btnAddAgenda')) $('btnAddAgenda').onclick=addAgenda;
 if($('btnGerarRascunho')) $('btnGerarRascunho').onclick=gerarRascunhoProjeto;
 $('docs').onchange=e=>{docs=[...docs,...[...e.target.files].map(f=>({id:crypto.randomUUID ? crypto.randomUUID() : Date.now()+'_'+f.name,name:f.name,type:f.type,size:f.size,file:f}))];renderDocs();};
 if($('btnLimparDocs')) $('btnLimparDocs').onclick=limparDocsAtual;
 if($('cep')) $('cep').addEventListener('blur',buscarCep);
 if($('mobileMenuBtn')) $('mobileMenuBtn').onclick=()=>document.body.classList.toggle('menu-open');
 if($('menuOverlay')) $('menuOverlay').onclick=closeMobileMenu;
 configurarValidacoes();
 configurarPerfil();
 document.querySelectorAll('input,textarea,select').forEach(el=>el.addEventListener('input',calcProgress));
 setData(ativo).then(()=>{renderLista();showPage(0)});
}
bind();
iniciarLogin();

const campoGps = document.getElementById("gps");

if (campoGps) {
  campoGps.addEventListener("input", () => {
    atualizarMiniMapa();
  });

  campoGps.addEventListener("blur", () => {
    atualizarMiniMapa();
  });
}

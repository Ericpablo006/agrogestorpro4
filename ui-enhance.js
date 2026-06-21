/* ui-enhance.js
   Camada puramente visual/interativa do AgroGestor Pro.
   Não toca em Firebase, dados ou regras de negócio do script.js —
   apenas adiciona toasts, efeito de "carimbo" nos botões e pequenas
   animações. Carregar ANTES do script.js (módulo) no index.html. */
(function(){
  "use strict";

  /* ---------- Toasts no lugar do alert() padrão ---------- */
  function ensureStack(){
    let stack = document.querySelector('.toast-stack');
    if(!stack){
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      stack.setAttribute('role','status');
      stack.setAttribute('aria-live','polite');
      document.body.appendChild(stack);
    }
    return stack;
  }

  function classify(msg){
    const m = String(msg||'').toLowerCase();
    if(/erro|não foi possível|nao foi possivel|inválid|invalido|não confere|nao confere|já está cadastrado|ja esta cadastrado/.test(m)) return 'error';
    if(/sucesso|atualizado|cadastrado com sucesso|salvo/.test(m)) return 'success';
    return '';
  }

  function showToast(msg){
    const stack = ensureStack();
    const el = document.createElement('div');
    el.className = 'toast ' + classify(msg);
    el.textContent = String(msg);
    stack.appendChild(el);
    const ttl = Math.min(7000, Math.max(3200, String(msg).length * 60));
    setTimeout(()=>{
      el.classList.add('leaving');
      el.addEventListener('animationend', ()=>el.remove(), {once:true});
    }, ttl);
  }

  const nativeAlert = window.alert.bind(window);
  window.alert = function(msg){
    try{ showToast(msg); }
    catch(e){ nativeAlert(msg); }
  };

  /* ---------- Efeito "carimbo" (ripple) nos botões ---------- */
  document.addEventListener('click', function(e){
    const btn = e.target.closest('button');
    if(!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.3;
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.width = span.style.height = size + 'px';
    span.style.left = (e.clientX - rect.left - size/2) + 'px';
    span.style.top = (e.clientY - rect.top - size/2) + 'px';
    btn.appendChild(span);
    span.addEventListener('animationend', ()=>span.remove(), {once:true});
  }, true);

  /* ---------- Pequeno "pulso" quando os números do dashboard mudam ---------- */
  ['totalProdutores','valorTotal','receitaAgro','receitaPec'].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    const card = el.closest('.card');
    if(!card) return;
    let last = el.textContent;
    new MutationObserver(()=>{
      if(el.textContent === last) return;
      last = el.textContent;
      card.classList.remove('pulse');
      requestAnimationFrame(()=>card.classList.add('pulse'));
    }).observe(el, {childList:true, characterData:true, subtree:true});
  });

})();

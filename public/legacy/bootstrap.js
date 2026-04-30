(function(){
  var KEY='titan_landing_seen_v1';
  var el=document.getElementById('titan-landing');
  if(!el) return;
  var forceHome=/[?&]home=1\b/.test(location.search);
  var forcePricing=/[?&]pricing=1\b/.test(location.search);
  var seen=false;
  try{seen=localStorage.getItem(KEY)==='1'}catch(_){}
  if(seen && !forceHome && !forcePricing){el.parentNode.removeChild(el);return}
  document.body.classList.add('tl-locked');

  function dismiss(goLearn){
    if(isOverlayOpen()){closeOverlays();return;}
    try{localStorage.setItem(KEY,'1')}catch(_){}
    el.classList.add('tl-out');
    document.body.classList.remove('tl-locked');
    setTimeout(function(){
      if(el.parentNode) el.parentNode.removeChild(el);
      if(goLearn){
        var t=document.querySelector('.tab-btn[data-tab="learn"], .tab-btn[data-tab="academy"]');
        if(t) t.click();
      }
    },360);
  }

  /* ── PRICING / CART / CHECKOUT ─────────────────────────────────── */
  var PLANS={
    desktop:{id:'desktop',name:'TITAN Desktop',sub:'Windows · macOS · Linux',price:250,unit:'/yr'},
    browser:{id:'browser',name:'TITAN Browser',sub:'Web · No install',price:20,unit:'/mo'}
  };
  var CART_KEY='titan_cart_v1';
  var TAX_RATE=0; // demo store, no tax applied (display-only field)
  var cart=loadCart();

  function loadCart(){try{return JSON.parse(localStorage.getItem(CART_KEY))||[]}catch(_){return[]}}
  function saveCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(cart))}catch(_){}}
  function fmt(n){return '$'+n.toFixed(2)}
  function subtotal(){return cart.reduce(function(s,it){return s+(PLANS[it.id]?PLANS[it.id].price:0)},0)}

  var pill=document.getElementById('tlCartPill');
  var pillCount=document.getElementById('tlCartCount');
  var cartEl=document.getElementById('tlCart');
  var cartBody=document.getElementById('tlCartBody');
  var cartEmpty=document.getElementById('tlCartEmpty');
  var cartCheckoutBtn=document.getElementById('tlCartCheckout');
  var backdrop=document.getElementById('tlBackdrop');
  var checkoutEl=document.getElementById('tlCheckout');
  var coList=document.getElementById('tlCoList');
  var coForm=document.getElementById('tlCheckoutForm');
  var coSuccess=document.getElementById('tlCoSuccess');
  var coError=document.getElementById('tlCoError');
  var payBtn=document.getElementById('tlCoPay');
  var payAmt=document.getElementById('tlCoPayAmt');
  var payCardFields=document.getElementById('tlPayCardFields');

  function isOverlayOpen(){return cartEl.classList.contains('tl-open')||checkoutEl.classList.contains('tl-open')}
  function openCart(){
    cartEl.classList.add('tl-open');backdrop.classList.add('tl-open');
    cartEl.setAttribute('aria-hidden','false');
  }
  function closeCart(){
    cartEl.classList.remove('tl-open');
    cartEl.setAttribute('aria-hidden','true');
    if(!checkoutEl.classList.contains('tl-open')) backdrop.classList.remove('tl-open');
  }
  function openCheckout(){
    if(!cart.length) return;
    closeCart();
    renderCheckoutSummary();
    resetCheckoutState();
    checkoutEl.classList.add('tl-open');backdrop.classList.add('tl-open');
    checkoutEl.setAttribute('aria-hidden','false');
    setTimeout(function(){var f=document.getElementById('tlCoName');if(f)f.focus()},50);
  }
  function closeCheckout(){
    checkoutEl.classList.remove('tl-open');
    checkoutEl.setAttribute('aria-hidden','true');
    backdrop.classList.remove('tl-open');
  }
  function closeOverlays(){closeCart();closeCheckout();}

  function renderCart(){
    var sub=subtotal();
    var tax=sub*TAX_RATE;
    var tot=sub+tax;

    pill.setAttribute('data-empty',cart.length?'0':'1');
    pillCount.textContent=String(cart.length);

    document.getElementById('tlCartSubtotal').textContent=fmt(sub);
    document.getElementById('tlCartTax').textContent=fmt(tax);
    document.getElementById('tlCartTotal').textContent=fmt(tot);
    cartCheckoutBtn.disabled=!cart.length;

    // CTA buttons reflect "in cart" state
    document.querySelectorAll('[data-add-plan]').forEach(function(btn){
      var id=btn.getAttribute('data-add-plan');
      var inCart=cart.some(function(it){return it.id===id});
      var p=PLANS[id];
      if(inCart){
        btn.classList.add('tl-in-cart');
        btn.textContent='✓ Added · View Cart';
      }else{
        btn.classList.remove('tl-in-cart');
        btn.textContent='Add to Cart · '+fmt(p.price).replace('.00','')+(p.unit==='/mo'?'/mo':'');
      }
    });

    if(!cart.length){cartEmpty.style.display='';
      // remove any rendered items
      Array.prototype.slice.call(cartBody.querySelectorAll('.tl-cart-item')).forEach(function(n){n.remove()});
      return;
    }
    cartEmpty.style.display='none';
    Array.prototype.slice.call(cartBody.querySelectorAll('.tl-cart-item')).forEach(function(n){n.remove()});
    cart.forEach(function(it){
      var p=PLANS[it.id];if(!p) return;
      var row=document.createElement('div');
      row.className='tl-cart-item';
      row.innerHTML=
        '<div class="tl-cart-item-ico">'+(it.id==='desktop'?'💻':'🌐')+'</div>'+
        '<div class="tl-cart-item-info"><b>'+p.name+'</b><span>'+p.sub+'</span></div>'+
        '<div class="tl-cart-item-price">'+fmt(p.price)+'<small>'+(p.unit==='/mo'?'per month':'one-time / yr')+'</small></div>'+
        '<div class="tl-cart-item-row"><button type="button" class="tl-cart-item-rm" data-rm-plan="'+p.id+'">Remove</button></div>';
      cartBody.appendChild(row);
    });
  }

  function renderCheckoutSummary(){
    coList.innerHTML='';
    cart.forEach(function(it){
      var p=PLANS[it.id];if(!p) return;
      var row=document.createElement('div');
      row.className='tl-co-item';
      row.innerHTML='<div><b>'+p.name+'</b><span>'+p.sub+(p.unit==='/mo'?' · monthly':' · 1-year licence')+'</span></div>'+
        '<strong>'+fmt(p.price)+'</strong>';
      coList.appendChild(row);
    });
    var sub=subtotal(),tax=sub*TAX_RATE,tot=sub+tax;
    document.getElementById('tlCoSubtotal').textContent=fmt(sub);
    document.getElementById('tlCoTax').textContent=fmt(tax);
    document.getElementById('tlCoTotal').textContent=fmt(tot);
    payAmt.textContent=fmt(tot);
  }

  function resetCheckoutState(){
    coError.classList.remove('tl-show');coError.textContent='';
    coSuccess.classList.remove('tl-show');
    coForm.querySelectorAll('input,select,button.tl-checkout-pay,.tl-pay-method').forEach(function(n){n.style.display=''});
    payBtn.disabled=false;payBtn.textContent='Pay ';
    payBtn.appendChild(payAmt);
    document.querySelector('.tl-checkout-secure').style.display='';
  }

  function addToCart(id){
    if(!PLANS[id]) return;
    if(cart.some(function(it){return it.id===id})){openCart();return}
    cart.push({id:id});saveCart();renderCart();openCart();
  }
  function removeFromCart(id){
    cart=cart.filter(function(it){return it.id!==id});saveCart();renderCart();
  }

  // Event wiring
  document.querySelectorAll('[data-add-plan]').forEach(function(btn){
    btn.addEventListener('click',function(){addToCart(btn.getAttribute('data-add-plan'))});
  });
  cartBody.addEventListener('click',function(e){
    var t=e.target.closest('[data-rm-plan]');if(!t) return;
    removeFromCart(t.getAttribute('data-rm-plan'));
  });
  if(pill) pill.addEventListener('click',openCart);
  document.getElementById('tlCartClose').addEventListener('click',closeCart);
  cartCheckoutBtn.addEventListener('click',openCheckout);
  document.getElementById('tlCheckoutClose').addEventListener('click',closeCheckout);
  backdrop.addEventListener('click',closeOverlays);

  // Payment method toggle
  Array.prototype.slice.call(document.querySelectorAll('input[name="paymethod"]')).forEach(function(r){
    r.addEventListener('change',function(){
      payCardFields.style.display=(r.value==='card'&&r.checked)?'':'none';
    });
  });

  // Card formatting niceties
  var cardEl=document.getElementById('tlCoCard');
  cardEl.addEventListener('input',function(){
    var v=cardEl.value.replace(/\D/g,'').slice(0,19);
    cardEl.value=v.replace(/(\d{4})(?=\d)/g,'$1 ').trim();
  });
  var expEl=document.getElementById('tlCoExp');
  expEl.addEventListener('input',function(){
    var v=expEl.value.replace(/\D/g,'').slice(0,4);
    expEl.value=v.length>2?v.slice(0,2)+'/'+v.slice(2):v;
  });

  function showErr(msg){coError.textContent=msg;coError.classList.add('tl-show')}

  coForm.addEventListener('submit',function(e){
    e.preventDefault();
    coError.classList.remove('tl-show');coError.textContent='';
    var name=document.getElementById('tlCoName').value.trim();
    var email=document.getElementById('tlCoEmail').value.trim();
    var country=document.getElementById('tlCoCountry').value.trim();
    var zip=document.getElementById('tlCoZip').value.trim();
    var method=document.querySelector('input[name="paymethod"]:checked').value;
    if(!name) return showErr('Please enter your full name.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showErr('Please enter a valid email address.');
    if(!country) return showErr('Please select your country.');
    if(!zip) return showErr('Please enter your postal code.');
    if(method==='card'){
      var card=document.getElementById('tlCoCard').value.replace(/\s/g,'');
      var exp=document.getElementById('tlCoExp').value.trim();
      var cvc=document.getElementById('tlCoCvc').value.trim();
      var cardName=document.getElementById('tlCoCardName').value.trim();
      if(!cardName) return showErr('Please enter the cardholder name.');
      if(!/^\d{13,19}$/.test(card)) return showErr('Card number looks incomplete.');
      if(!/^\d{2}\/\d{2}$/.test(exp)) return showErr('Expiry must be in MM/YY format.');
      if(!/^\d{3,4}$/.test(cvc)) return showErr('CVC must be 3 or 4 digits.');
    }
    payBtn.disabled=true;payBtn.textContent='Processing…';
    setTimeout(function(){
      var orderId='TITAN-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
      try{localStorage.setItem('titan_last_order_v1',JSON.stringify({id:orderId,email:email,items:cart,total:subtotal(),at:Date.now()}))}catch(_){}
      // hide form, show success
      coForm.querySelectorAll('.tl-form-row,.tl-pay-method,#tlPayCardFields,.tl-checkout-pay,.tl-checkout-secure,.tl-checkout-error').forEach(function(n){n.style.display='none'});
      document.getElementById('tlSuccessEmail').textContent=email;
      document.getElementById('tlSuccessOrder').textContent='ORDER #'+orderId;
      coSuccess.classList.add('tl-show');
      cart=[];saveCart();renderCart();
    },900);
  });

  document.getElementById('tlSuccessClose').addEventListener('click',function(){
    closeCheckout();dismiss(false);
  });

  // Initial render
  renderCart();

  // Landing nav / hero buttons
  var enter=document.getElementById('tlEnter');
  var learn=document.getElementById('tlLearn');
  var nf=document.getElementById('tlNavFeat');
  var np=document.getElementById('tlNavPricing');
  var nl=document.getElementById('tlNavLearn');
  if(enter) enter.addEventListener('click',function(){dismiss(false)});
  if(learn) learn.addEventListener('click',function(){dismiss(true)});
  if(nf) nf.addEventListener('click',function(){var f=el.querySelector('.tl-features');if(f) f.scrollIntoView({behavior:'smooth'})});
  if(np) np.addEventListener('click',function(){var f=el.querySelector('#tlPricing');if(f) f.scrollIntoView({behavior:'smooth'})});
  if(nl) nl.addEventListener('click',function(){dismiss(true)});

  document.addEventListener('keydown',function(e){
    if(e.key!=='Escape') return;
    if(!document.getElementById('titan-landing')) return;
    if(checkoutEl.classList.contains('tl-open')){closeCheckout();return}
    if(cartEl.classList.contains('tl-open')){closeCart();return}
    dismiss(false);
  });

  // Auto-scroll to pricing when forced via URL
  if(forcePricing){
    setTimeout(function(){
      var f=el.querySelector('#tlPricing');
      if(f) f.scrollIntoView({behavior:'smooth',block:'start'});
    },200);
  }
})();

/* ===== TITAN LINEUP — toggle, Esc ===== */
(function(){
  var openBtn=document.getElementById('t3dOpenBtn');
  var closeBtn=document.getElementById('t3dCloseBtn');
  var overlay=document.getElementById('t3dOverlay');
  if(!openBtn||!overlay) return;
  function open(){
    overlay.classList.add('open');
    openBtn.classList.add('active');
    document.body.style.overflow='hidden';
  }
  function close(){
    overlay.classList.remove('open');
    openBtn.classList.remove('active');
    document.body.style.overflow='';
  }
  openBtn.addEventListener('click',function(){
    overlay.classList.contains('open')?close():open();
  });
  if(closeBtn) closeBtn.addEventListener('click',close);
  overlay.addEventListener('click',function(e){if(e.target===overlay)close();});
  window.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&overlay.classList.contains('open')){e.preventDefault();close();}
  });
})();

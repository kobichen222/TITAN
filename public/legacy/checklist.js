/**
 * TITAN — first-run interactive checklist.
 *
 * Each item self-detects completion from app state (localStorage, DOM,
 * Web MIDI, Supabase). Auto-detected items can't be hand-toggled.
 * Optional items the user can tick manually; their state persists in
 * localStorage under `titan_first_run_checklist_v1`.
 *
 * The checklist re-evaluates on every settings-tab click and every
 * 4 seconds while visible so completion lights up promptly without
 * requiring a reload.
 */
(function(){
  var STORE_KEY='titan_first_run_checklist_v1';

  function read(){try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{};}catch(e){return {};}}
  function write(o){try{localStorage.setItem(STORE_KEY,JSON.stringify(o));}catch(e){}}

  function has(key){
    try{var v=localStorage.getItem(key);return v!==null && v!=='' && v!=='null' && v!=='[]' && v!=='{}';}
    catch(e){return false;}
  }

  // Auto-detected items return true when the app already has the state in place.
  // Returning null means "no auto-detection — manual only".
  var ITEMS={
    theme:function(){
      // Theme persisted by app; fall back to data attribute on body / html.
      if(has('djtitan_theme')||has('titan_theme'))return true;
      try{
        var t=document.body&&document.body.getAttribute('data-theme');
        if(t&&t!=='dark'&&t!=='')return true;
        var cls=(document.body&&document.body.className)||'';
        if(/theme-(neon|pioneer|gold|light|onyx|pulse|blade|euphonia)/.test(cls))return true;
      }catch(e){}
      return false;
    },
    library:function(){
      // Library is in IndexedDB but the app keeps a small mirror in localStorage.
      // Fall back to DOM probe for any rendered library row.
      if(has('djpro_library')||has('titan_library_v1'))return true;
      try{
        var rows=document.querySelectorAll('[data-track-id], .lib-row, .library-row');
        if(rows && rows.length>0)return true;
      }catch(e){}
      return false;
    },
    services:function(){
      // Music services creds live under djpro_music_creds_v1.
      try{
        var raw=localStorage.getItem('djpro_music_creds_v1');
        if(!raw)return false;
        var c=JSON.parse(raw);
        if(!c||typeof c!=='object')return false;
        var keys=['spotify','youtube','jamendo','spotifyClientId','youtubeApiKey','jamendoClientId','spotify_client_id','youtube_api_key','jamendo_client_id'];
        for(var i=0;i<keys.length;i++){
          var v=c[keys[i]];
          if(v && typeof v==='string' && v.trim().length>0)return true;
        }
      }catch(e){}
      return false;
    },
    auth:function(){
      // Supabase session lives under sb-*-auth-token; entitlement under titan_entitlement_v1.
      if(has('titan_entitlement_v1'))return true;
      try{
        for(var i=0;i<localStorage.length;i++){
          var k=localStorage.key(i)||'';
          if(/^sb-.*-auth-token$/.test(k))return true;
        }
      }catch(e){}
      return false;
    },
    midi:function(){
      // MIDI map written when the user binds at least one control.
      if(has('djpro_midi_map'))return true;
      // Or if Web MIDI access has been granted and at least one input is connected.
      try{
        if(window.__titanMidiInputCount && window.__titanMidiInputCount>0)return true;
      }catch(e){}
      return null; // also user-toggleable
    },
    session:function(){
      // Sessions saved by the user.
      try{
        var raw=localStorage.getItem('djpro_sessions');
        if(!raw)return false;
        var arr=JSON.parse(raw);
        return Array.isArray(arr) && arr.length>0;
      }catch(e){return false;}
    },
    tour:function(){
      return has('titan_tour_done_v1')||has('titan_landing_seen_v1');
    },
    desktop:function(){
      // Optional — purely user-toggled.
      return null;
    }
  };

  function evaluate(){
    var manual=read();
    var root=document.getElementById('firstRunChecklist');
    if(!root)return;
    var items=root.querySelectorAll('.frc-item');
    var total=items.length;
    var done=0;
    Array.prototype.forEach.call(items,function(el){
      var id=el.getAttribute('data-frc-id');
      var detector=ITEMS[id];
      var auto=detector?detector():null;
      var box=el.querySelector('input[type="checkbox"]');
      if(!box)return;
      if(auto===true){
        box.checked=true;
        box.disabled=true;
        el.classList.add('frc-done','frc-auto');
        done++;
      }else if(auto===false){
        box.checked=false;
        box.disabled=true;
        el.classList.remove('frc-done');
        el.classList.add('frc-auto');
      }else{
        // Manual or hybrid (null) — defer to the persisted user state.
        box.disabled=false;
        el.classList.remove('frc-auto');
        var checked=!!manual[id];
        box.checked=checked;
        if(checked){el.classList.add('frc-done');done++;}
        else el.classList.remove('frc-done');
      }
    });
    var label=document.getElementById('frcProgressLabel');
    var bar=document.getElementById('frcProgressBar');
    var doneMsg=document.getElementById('frcDoneMsg');
    if(label)label.textContent=done+' / '+total;
    if(bar)bar.style.width=(total?Math.round(100*done/total):0)+'%';
    if(doneMsg)doneMsg.style.display=(total>0 && done===total)?'inline-block':'none';
  }

  function onChange(e){
    var el=e.target;
    if(!el || el.tagName!=='INPUT' || el.type!=='checkbox')return;
    var item=el.closest('.frc-item');
    if(!item)return;
    if(el.disabled)return;
    var id=item.getAttribute('data-frc-id');
    var manual=read();
    if(el.checked)manual[id]=true; else delete manual[id];
    write(manual);
    evaluate();
  }

  function init(){
    var root=document.getElementById('firstRunChecklist');
    if(!root)return;
    root.addEventListener('change',onChange);
    var resetBtn=document.getElementById('frcReset');
    if(resetBtn){
      resetBtn.addEventListener('click',function(){
        if(!confirm('Reset the first-run checklist? Your manual ticks will be cleared. Auto-detected items stay as they are.'))return;
        write({});
        evaluate();
      });
    }
    // Re-evaluate when the user navigates to the SUPPORT/SETTINGS tab.
    var supBtn=document.querySelector('.tab-btn[data-tab="support"]');
    if(supBtn)supBtn.addEventListener('click',function(){setTimeout(evaluate,50);});
    // Periodic re-eval while the section is on screen (cheap; ~25 µs).
    setInterval(function(){
      var section=document.getElementById('firstRunChecklistSection');
      if(!section)return;
      var rect=section.getBoundingClientRect();
      var visible=rect.bottom>0 && rect.top<innerHeight;
      if(visible)evaluate();
    },4000);
    evaluate();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);
  else init();
})();

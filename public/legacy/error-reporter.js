/* TITAN — lightweight error reporter
   Captures uncaught errors and unhandled promise rejections into a ring
   buffer (window._titanErrors + localStorage) so issues don't get silently
   swallowed by the 248 try/catch blocks across the app. Exposes
   `window.titanGetErrors()` for support diagnostics. */
(function(){
  'use strict';
  var KEY='titan_err_log_v1';
  var MAX=50;
  var buf=[];
  try{
    var raw=localStorage.getItem(KEY);
    if(raw){var j=JSON.parse(raw);if(Array.isArray(j))buf=j.slice(-MAX);}
  }catch(_){}
  window._titanErrors=buf;

  function persist(){
    try{localStorage.setItem(KEY,JSON.stringify(buf.slice(-MAX)));}catch(_){}
  }

  function record(kind,msg,detail){
    var entry={
      t:Date.now(),
      kind:kind,
      msg:String(msg||'').slice(0,500),
      url:String((detail&&detail.url)||location.pathname).slice(0,200),
      line:(detail&&detail.line)||0,
      col:(detail&&detail.col)||0,
      stack:String((detail&&detail.stack)||'').split('\n').slice(0,8).join('\n')
    };
    buf.push(entry);
    if(buf.length>MAX)buf.splice(0,buf.length-MAX);
    persist();
  }

  window.addEventListener('error',function(ev){
    if(!ev)return;
    record('error',ev.message,{
      url:ev.filename,
      line:ev.lineno,
      col:ev.colno,
      stack:ev.error&&ev.error.stack
    });
  });

  window.addEventListener('unhandledrejection',function(ev){
    var r=ev&&ev.reason;
    record('promise',(r&&(r.message||r))||'unhandled rejection',{
      stack:r&&r.stack
    });
  });

  window.titanGetErrors=function(){return buf.slice();};
  window.titanClearErrors=function(){buf.length=0;persist();};

  /* ------------- YouTube IFrame API — lazy loader ---------------
     The legacy app polls window.YT in a 200ms retry loop when a
     YouTube track is loaded, so we only inject the API when actually
     needed instead of pulling 100KB+ on every page load. */
  window.titanLoadYouTube=function(){
    if(window.titanLoadYouTube._done)return;
    window.titanLoadYouTube._done=true;
    var s=document.createElement('script');
    s.src='https://www.youtube.com/iframe_api';
    s.async=true;
    document.head.appendChild(s);
  };

  /* ---------------- Web Vitals (LCP, CLS, INP, TTFB) -----------------
     Lightweight in-place implementation — no external dep. Stored on
     window._titanVitals and exposed via window.titanGetVitals(). */
  var vitals={lcp:null,cls:0,inp:null,ttfb:null,fcp:null};
  window._titanVitals=vitals;
  window.titanGetVitals=function(){return Object.assign({},vitals);};

  try{
    var navEntry=performance.getEntriesByType&&performance.getEntriesByType('navigation')[0];
    if(navEntry)vitals.ttfb=Math.round(navEntry.responseStart-navEntry.requestStart);
  }catch(_){}

  try{
    new PerformanceObserver(function(list){
      var entries=list.getEntries();
      var last=entries[entries.length-1];
      if(last)vitals.lcp=Math.round(last.startTime);
    }).observe({type:'largest-contentful-paint',buffered:true});
  }catch(_){}

  try{
    new PerformanceObserver(function(list){
      list.getEntries().forEach(function(e){
        if(!e.hadRecentInput)vitals.cls=+(vitals.cls+e.value).toFixed(4);
      });
    }).observe({type:'layout-shift',buffered:true});
  }catch(_){}

  try{
    new PerformanceObserver(function(list){
      list.getEntries().forEach(function(e){
        var d=e.processingEnd-e.startTime;
        if(vitals.inp===null||d>vitals.inp)vitals.inp=Math.round(d);
      });
    }).observe({type:'event',buffered:true,durationThreshold:40});
  }catch(_){}

  try{
    new PerformanceObserver(function(list){
      var fcp=list.getEntries().find(function(e){return e.name==='first-contentful-paint';});
      if(fcp)vitals.fcp=Math.round(fcp.startTime);
    }).observe({type:'paint',buffered:true});
  }catch(_){}

  /* ------------- Vitals + errors beacon (opt-in) -----------------
     Call window.titanReportVitals('https://example.com/beacon') to
     ship the captured metrics + last 10 errors via sendBeacon on
     pagehide. Uses navigator.sendBeacon when available so it survives
     unload reliably. */
  window.titanReportVitals=function(url){
    if(!url||typeof url!=='string')return;
    function send(){
      var payload={
        ts:Date.now(),
        ua:navigator.userAgent,
        url:location.href,
        vitals:vitals,
        errors:buf.slice(-10)
      };
      try{
        var data=JSON.stringify(payload);
        if(navigator.sendBeacon){
          navigator.sendBeacon(url,new Blob([data],{type:'application/json'}));
        }else{
          fetch(url,{method:'POST',body:data,keepalive:true,headers:{'Content-Type':'application/json'}}).catch(function(){});
        }
      }catch(_){}
    }
    addEventListener('pagehide',send,{once:true});
    addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')send();},{once:true});
  };
})();

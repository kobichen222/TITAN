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
})();

/* DJ TITAN — Radio stations panel logic.
   Extracted from inline <script> in index.html so it can be deferred,
   cached, and parsed off the critical path. */
(function(){
  var STATIONS_KEY='djtitan_radio_stations_v1';
  var FREQ_KEY='djtitan_radio_next_freq_v1';
  var SUB_PREFIX='djtitan_radio_subs_v1_';
  var REG_KEY='djtitan_radio_reg_v1';
  var REG_PEND_KEY='djtitan_radio_reg_pending_v1';
  var FORWARD_KEY='djtitan_radio_forward_v1';
  var ADMIN_EMAIL='kobi@media-deal.co.il';
  var BASE_FREQ=200.0;
  var FREQ_STEP=0.5;
  var currentStationId=null;

  function read(key,fallback){try{var v=localStorage.getItem(key);return v?JSON.parse(v):fallback;}catch(e){return fallback;}}
  function write(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}
  function uid(){return 'st_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]);});}
  function fmtFreq(f){return (Math.round(f*10)/10).toFixed(1);}
  function fmtTime(ts){var d=new Date(ts);var pad=function(n){return n<10?'0'+n:n;};return pad(d.getHours())+':'+pad(d.getMinutes())+' · '+pad(d.getDate())+'/'+pad(d.getMonth()+1);}

  function nextFreq(){
    var stations=read(STATIONS_KEY,[]);
    var used={};
    stations.forEach(function(s){used[fmtFreq(s.frequency)]=true;});
    var f=read(FREQ_KEY,BASE_FREQ);
    if(typeof f!=='number'||f<BASE_FREQ)f=BASE_FREQ;
    while(used[fmtFreq(f)]){f+=FREQ_STEP;}
    return f;
  }

  function loadSubs(stationId){return read(SUB_PREFIX+stationId,[]);}
  function saveSubs(stationId,arr){write(SUB_PREFIX+stationId,arr);}

  function renderList(){
    var grid=document.getElementById('rdGrid');
    var empty=document.getElementById('rdEmpty');
    if(!grid)return;
    var stations=read(STATIONS_KEY,[]);
    if(!stations.length){grid.innerHTML='';empty.style.display='block';return;}
    empty.style.display='none';
    stations.sort(function(a,b){return a.frequency-b.frequency;});
    grid.innerHTML=stations.map(function(s){
      var subs=loadSubs(s.id);
      return '<div class="rd-card live" data-id="'+esc(s.id)+'">'+
        '<div class="rd-freq">'+fmtFreq(s.frequency)+' <small>WEB</small></div>'+
        '<div class="rd-name">'+esc(s.name)+'</div>'+
        '<div class="rd-meta">'+
          (s.owner?'<span>🎧 '+esc(s.owner)+'</span>':'')+
          (s.genre?'<span>♬ '+esc(s.genre)+'</span>':'')+
          '<span>📨 '+subs.length+'</span>'+
        '</div>'+
        (s.tagline?'<div class="rd-tagline">"'+esc(s.tagline)+'"</div>':'')+
        '<div class="rd-card-actions">'+
          '<button class="rd-btn primary" data-act="enter">▶ ENTER CHANNEL</button>'+
          '<button class="rd-btn danger" data-act="del" title="Delete">🗑</button>'+
        '</div>'+
      '</div>';
    }).join('');
    Array.prototype.forEach.call(grid.querySelectorAll('.rd-card'),function(card){
      var id=card.getAttribute('data-id');
      card.querySelector('[data-act="enter"]').addEventListener('click',function(){enterChannel(id);});
      card.querySelector('[data-act="del"]').addEventListener('click',function(ev){
        ev.stopPropagation();
        if(confirm('Delete this station and all its submissions?'))deleteStation(id);
      });
    });
  }

  function renderSubs(){
    if(!currentStationId)return;
    var list=document.getElementById('rdSubList');
    var count=document.getElementById('rdChCount');
    var subs=loadSubs(currentStationId).slice().sort(function(a,b){return b.createdAt-a.createdAt;});
    count.textContent='('+subs.length+')';
    if(!subs.length){list.innerHTML='<div class="rd-empty-sub">NO TRANSMISSIONS YET — BE THE FIRST TO TUNE IN.</div>';return;}
    list.innerHTML=subs.map(function(s){
      return '<div class="rd-sub-item" data-id="'+esc(s.id)+'">'+
        '<div class="sub-head">'+
          '<span><span class="sub-tag '+esc(s.type)+'">'+esc(s.type.toUpperCase())+'</span> <span class="sub-from">'+esc(s.name||'Anonymous')+'</span></span>'+
          '<span>'+fmtTime(s.createdAt)+'</span>'+
        '</div>'+
        '<div class="sub-body">'+esc(s.body)+'</div>'+
        '<div class="sub-foot"><button class="rd-btn ghost" data-act="rmsub">✕ REMOVE</button></div>'+
      '</div>';
    }).join('');
    Array.prototype.forEach.call(list.querySelectorAll('[data-act="rmsub"]'),function(b){
      b.addEventListener('click',function(){
        var id=b.closest('.rd-sub-item').getAttribute('data-id');
        var arr=loadSubs(currentStationId).filter(function(x){return x.id!==id;});
        saveSubs(currentStationId,arr);renderSubs();
      });
    });
  }

  function enterChannel(id){
    var stations=read(STATIONS_KEY,[]);
    var s=stations.filter(function(x){return x.id===id;})[0];
    if(!s)return;
    currentStationId=id;
    document.getElementById('rdListView').style.display='none';
    document.getElementById('rdChannel').classList.add('active');
    document.getElementById('rdNewBtn').style.display='none';
    document.getElementById('rdBackBtn').style.display='inline-block';
    document.getElementById('rdChFreq').innerHTML=fmtFreq(s.frequency)+'<small> WEB</small>';
    document.getElementById('rdChName').textContent=s.name;
    document.getElementById('rdChMeta').textContent=(s.owner?'🎧 '+s.owner:'')+(s.owner&&s.genre?' · ':'')+(s.genre?'♬ '+s.genre:'');
    document.getElementById('rdChTagline').textContent=s.tagline?'"'+s.tagline+'"':'';
    renderSubs();
  }

  function exitChannel(){
    currentStationId=null;
    document.getElementById('rdListView').style.display='block';
    document.getElementById('rdChannel').classList.remove('active');
    document.getElementById('rdNewBtn').style.display='inline-block';
    document.getElementById('rdBackBtn').style.display='none';
    renderList();
  }

  function deleteStation(id){
    var stations=read(STATIONS_KEY,[]).filter(function(x){return x.id!==id;});
    write(STATIONS_KEY,stations);
    try{localStorage.removeItem(SUB_PREFIX+id);}catch(e){}
    if(currentStationId===id)exitChannel();else renderList();
  }

  function createStation(){
    var name=document.getElementById('rdInName').value.trim();
    var err=document.getElementById('rdNewErr');
    if(!name){err.textContent='Station name is required.';return;}
    var stations=read(STATIONS_KEY,[]);
    if(stations.some(function(s){return s.name.toLowerCase()===name.toLowerCase();})){err.textContent='A station with this name already exists.';return;}
    var freq=nextFreq();
    var s={
      id:uid(),
      name:name,
      owner:document.getElementById('rdInOwner').value.trim(),
      genre:document.getElementById('rdInGenre').value.trim(),
      tagline:document.getElementById('rdInTagline').value.trim(),
      frequency:freq,
      createdAt:Date.now()
    };
    stations.push(s);write(STATIONS_KEY,stations);
    write(FREQ_KEY,freq+FREQ_STEP);
    err.textContent='';
    document.getElementById('rdNewForm').style.display='none';
    ['rdInName','rdInOwner','rdInGenre','rdInTagline'].forEach(function(id){document.getElementById(id).value='';});
    renderList();
    enterChannel(s.id);
  }

  function submitToStation(){
    if(!currentStationId)return;
    var body=document.getElementById('rdSubBody').value.trim();
    var err=document.getElementById('rdSubErr');
    if(!body){err.textContent='Message cannot be empty.';return;}
    var sub={
      id:'sb_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),
      name:document.getElementById('rdSubName').value.trim()||'Anonymous',
      type:document.getElementById('rdSubType').value,
      body:body,
      createdAt:Date.now()
    };
    var arr=loadSubs(currentStationId);arr.push(sub);saveSubs(currentStationId,arr);
    document.getElementById('rdSubBody').value='';err.textContent='';
    renderSubs();
    if(read(FORWARD_KEY,false)&&read(REG_KEY,null)){
      var stations=read(STATIONS_KEY,[]);
      var s=stations.filter(function(x){return x.id===currentStationId;})[0];
      forwardSubmissionEmail(s,sub);
    }
  }

  /* ===== Manual registration (OTP via kobi@media-deal.co.il) ===== */
  function genOtp(){var s='';for(var i=0;i<6;i++)s+=Math.floor(Math.random()*10);return s;}
  function isEmail(s){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);}

  function openMail(to,subject,body){
    var url='mailto:'+encodeURIComponent(to)+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
    try{var w=window.open(url,'_blank');if(!w)window.location.href=url;}catch(e){window.location.href=url;}
  }

  function refreshRegUi(){
    var reg=read(REG_KEY,null);
    var pend=read(REG_PEND_KEY,null);
    var form=document.getElementById('rdRegForm');
    var profile=document.getElementById('rdRegProfile');
    var badge=document.getElementById('rdRegBadge');
    var otpRow=document.getElementById('rdRegOtpRow');
    if(reg){
      form.style.display='none';
      profile.style.display='flex';
      badge.style.display='inline-block';
      document.getElementById('rdRegProfileName').textContent=reg.name;
      document.getElementById('rdRegProfileEmail').textContent=reg.email;
      document.getElementById('rdRegForward').checked=!!read(FORWARD_KEY,false);
    }else{
      form.style.display='block';
      profile.style.display='none';
      badge.style.display='none';
      otpRow.style.display=pend?'block':'none';
    }
  }

  function sendOtp(resend){
    var name=document.getElementById('rdRegName').value.trim();
    var email=document.getElementById('rdRegEmail').value.trim();
    var phone=document.getElementById('rdRegPhone').value.trim();
    var err=document.getElementById('rdRegErr');
    err.textContent='';
    if(!name){err.textContent='Full name is required.';return;}
    if(!isEmail(email)){err.textContent='Enter a valid email address.';return;}
    var otp=genOtp();
    var pending={name:name,email:email,phone:phone,otp:otp,createdAt:Date.now()};
    write(REG_PEND_KEY,pending);
    document.getElementById('rdRegOtpRow').style.display='block';
    document.getElementById('rdRegOtpInput').value='';
    var subject='TITAN RADIO — OTP Verification Request';
    var body=
      'A new TITAN RADIO user is requesting verification.\n\n'+
      '─── USER DETAILS ───\n'+
      'Name : '+name+'\n'+
      'Email: '+email+'\n'+
      (phone?'Phone: '+phone+'\n':'')+
      'Time : '+new Date().toLocaleString()+'\n\n'+
      '─── ONE-TIME PASSWORD ───\n'+
      '       OTP: '+otp+'\n\n'+
      'Please share this code with the user to complete their registration.\n'+
      '(Generated by TITAN RADIO — kobi@media-deal.co.il is the verifying admin.)';
    openMail(ADMIN_EMAIL,subject,body);
    document.getElementById('rdRegOtpInput').focus();
  }

  function verifyOtp(){
    var pend=read(REG_PEND_KEY,null);
    var err=document.getElementById('rdRegErr');
    err.textContent='';
    if(!pend){err.textContent='No pending registration. Send a new OTP first.';return;}
    var input=document.getElementById('rdRegOtpInput').value.trim();
    if(!/^\d{6}$/.test(input)){err.textContent='OTP must be 6 digits.';return;}
    if(input!==pend.otp){err.textContent='Incorrect OTP. Please try again.';return;}
    var reg={name:pend.name,email:pend.email,phone:pend.phone,verifiedAt:Date.now()};
    write(REG_KEY,reg);
    write(FORWARD_KEY,true);
    try{localStorage.removeItem(REG_PEND_KEY);}catch(e){}
    refreshRegUi();
  }

  function signOutReg(){
    if(!confirm('Sign out and remove your verified registration from this device?'))return;
    try{localStorage.removeItem(REG_KEY);localStorage.removeItem(REG_PEND_KEY);localStorage.removeItem(FORWARD_KEY);}catch(e){}
    refreshRegUi();
  }

  function forwardSubmissionEmail(station,sub){
    if(!station)return;
    var subject='TITAN RADIO — '+sub.type.toUpperCase()+' on '+station.name+' ('+fmtFreq(station.frequency)+' WEB)';
    var body=
      'A new transmission was received on your station.\n\n'+
      '─── STATION ───\n'+
      'Name     : '+station.name+'\n'+
      'Frequency: '+fmtFreq(station.frequency)+' WEB\n'+
      (station.owner?'DJ       : '+station.owner+'\n':'')+
      (station.genre?'Genre    : '+station.genre+'\n':'')+
      '\n─── '+sub.type.toUpperCase()+' ───\n'+
      'From : '+sub.name+'\n'+
      'Time : '+new Date(sub.createdAt).toLocaleString()+'\n\n'+
      sub.body+'\n\n'+
      '— Forwarded automatically by TITAN RADIO.';
    openMail(ADMIN_EMAIL,subject,body);
  }

  function init(){
    var newBtn=document.getElementById('rdNewBtn');
    if(!newBtn)return;
    newBtn.addEventListener('click',function(){
      var f=document.getElementById('rdNewForm');
      f.style.display=f.style.display==='block'?'none':'block';
      if(f.style.display==='block')document.getElementById('rdInName').focus();
    });
    document.getElementById('rdNewCancel').addEventListener('click',function(){
      document.getElementById('rdNewForm').style.display='none';
      document.getElementById('rdNewErr').textContent='';
    });
    document.getElementById('rdNewSave').addEventListener('click',createStation);
    document.getElementById('rdBackBtn').addEventListener('click',exitChannel);
    document.getElementById('rdSubSend').addEventListener('click',submitToStation);
    document.getElementById('rdChDelete').addEventListener('click',function(){
      if(currentStationId&&confirm('Delete this station and all its submissions?'))deleteStation(currentStationId);
    });
    document.getElementById('rdInName').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();createStation();}});
    document.getElementById('rdSubBody').addEventListener('keydown',function(e){if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();submitToStation();}});
    var radioTabBtn=document.querySelector('.tab-btn[data-tab="radio"]');
    if(radioTabBtn)radioTabBtn.addEventListener('click',function(){if(currentStationId)renderSubs();else renderList();});
    document.getElementById('rdRegSendOtp').addEventListener('click',function(){sendOtp(false);});
    document.getElementById('rdRegResend').addEventListener('click',function(){sendOtp(true);});
    document.getElementById('rdRegVerify').addEventListener('click',verifyOtp);
    document.getElementById('rdRegSignOut').addEventListener('click',signOutReg);
    document.getElementById('rdRegForward').addEventListener('change',function(e){write(FORWARD_KEY,!!e.target.checked);});
    document.getElementById('rdRegOtpInput').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();verifyOtp();}});
    document.getElementById('rdRegEmail').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();sendOtp(false);}});
    refreshRegUi();
    renderList();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

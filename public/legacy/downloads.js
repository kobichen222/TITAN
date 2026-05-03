function setupOfflineDownload(){
  const btn=document.getElementById('offlineDownloadBtn');
  const loginPrompt=document.getElementById('offlineLoginPrompt');
  const loginErr=document.getElementById('offlineLoginErr');
  const status=document.getElementById('offlineStatus');
  const panel=document.getElementById('offlineUnlocked');
  const userChip=document.getElementById('offlineUserChip');
  const userName=document.getElementById('offlineUserName');
  const signOutBtn=document.getElementById('offlineSignOutBtn');
  const googleBtn=document.getElementById('offlineGoogleBtn');
  const emailBtn=document.getElementById('offlineEmailBtn');
  if(!btn||!loginPrompt)return;

  const isCustomer=()=>!!_supaUser&&_supaProfile&&!_supaProfile.banned;
  const isAdmin=()=>isCustomer()&&_supaProfile.role==='admin';

  // Public hook — auth code calls this when the session changes
  window.refreshOfflineDownloadGate=refresh;

  function refresh(){
    if(isCustomer()){
      if(loginPrompt)loginPrompt.style.display='none';
      if(panel)panel.style.display='block';
      const nm=_supaProfile?.name||_supaUser?.email||_supaUser?.phone||'Customer';
      if(userChip)userChip.style.display='inline-flex';
      if(userName)userName.textContent=nm+(isAdmin()?' · ADMIN':'');
      if(btn){btn.textContent=isAdmin()?'✓ ADMIN · DOWNLOADS OPEN':'✓ DOWNLOADS OPEN';btn.style.opacity='.85';}
      if(status)status.textContent='';
    }else{
      if(panel)panel.style.display='none';
      if(userChip)userChip.style.display='none';
      if(btn){btn.textContent='🔐 SIGN IN TO DOWNLOAD';btn.style.opacity='1';}
      if(_supaUser&&_supaProfile&&_supaProfile.banned){
        if(status)status.textContent='Account suspended';
      }
    }
  }
  refresh();

  btn.addEventListener('click',()=>{
    if(isCustomer()){panel?.scrollIntoView({behavior:'smooth',block:'nearest'});return;}
    if(loginPrompt){loginPrompt.style.display='flex';loginPrompt.scrollIntoView({behavior:'smooth',block:'nearest'});}
    if(loginErr)loginErr.textContent='';
  });

  googleBtn?.addEventListener('click',async()=>{
    if(loginErr)loginErr.textContent='';
    if(!_supa){loginErr.textContent='Sign-in not configured yet. Owner must add Supabase URL + Anon Key in SETTINGS → SUPABASE.';return;}
    loginErr.textContent='Redirecting to Google…';
    try{
      const{error}=await _supa.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href}});
      if(error)loginErr.textContent='Error: '+error.message;
    }catch(e){loginErr.textContent='Error: '+(e.message||e);}
  });

  emailBtn?.addEventListener('click',()=>{
    if(!_supa){loginErr.textContent='Sign-in not configured yet. Owner must add Supabase URL + Anon Key in SETTINGS → SUPABASE.';return;}
    document.getElementById('authModal')?.classList.add('open');
  });

  signOutBtn?.addEventListener('click',async()=>{
    if(_supa){await _supa.auth.signOut();toast&&toast('Signed out','success');}
    refresh();
  });
}

/* ====================================================================
   DESKTOP DOWNLOADS — resolve per-platform asset URL from the latest
   GitHub Release so each button jumps straight to the .exe/.dmg/.AppImage.
   Falls back to the releases page if the API fails or the asset is
   missing, and disables a button when its platform has no build yet.
   ==================================================================== */
function setupDesktopDownloads(){
  const REPO='kobichen222/titan';
  const dlWin=document.getElementById('dlWin');
  const dlMac=document.getElementById('dlMac');
  const dlLinux=document.getElementById('dlLinux');
  const info=document.getElementById('dlReleaseInfo');
  if(!dlWin||!dlMac||!dlLinux)return;
  const fallback=`https://github.com/${REPO}/releases/latest`;

  // Highlight the user's own OS
  const ua=(navigator.userAgent||'').toLowerCase();
  const plat=(navigator.platform||'').toLowerCase();
  let mine=null;
  if(/win/.test(plat)||/windows/.test(ua))mine=dlWin;
  else if(/mac/.test(plat)||/iphone|ipad/.test(ua))mine=dlMac;
  else if(/linux/.test(plat))mine=dlLinux;
  if(mine)mine.style.boxShadow='0 0 16px rgba(127,247,255,.45)';

  function bytesToMB(n){return (n/1048576).toFixed(1)+' MB'}
  function disable(btn,reason){
    btn.removeAttribute('href');
    btn.title=reason;
    btn.style.opacity='.5';
    btn.style.cursor='not-allowed';
    btn.addEventListener('click',e=>{e.preventDefault();if(typeof toast==='function')toast(reason,'warn');});
  }
  function wire(btn,asset,label){
    if(!asset){
      disable(btn,`No ${label} build in the latest release yet`);
      return;
    }
    btn.href=asset.browser_download_url;
    btn.title=`${asset.name} · ${bytesToMB(asset.size)}`;
    btn.setAttribute('download',asset.name);
    btn.style.opacity='1';
    btn.style.cursor='pointer';
  }

  fetch(`https://api.github.com/repos/${REPO}/releases/latest`,{cache:'no-store'})
    .then(r=>{
      if(r.status===404)throw new Error('no-release');
      if(!r.ok)throw new Error('api-'+r.status);
      return r.json();
    })
    .then(rel=>{
      const a=rel.assets||[];
      const pickBy=re=>a.find(x=>re.test(x.name));
      const win=pickBy(/\.exe$/i);
      const mac=pickBy(/\.dmg$/i);
      const lin=pickBy(/\.AppImage$/i);
      wire(dlWin,win,'Windows');
      wire(dlMac,mac,'macOS');
      wire(dlLinux,lin,'Linux');
      if(info){
        const when=rel.published_at?new Date(rel.published_at).toLocaleDateString():'';
        info.textContent=`Latest release: ${rel.tag_name||rel.name||''}${when?' · '+when:''}`;
      }
    })
    .catch(err=>{
      // Keep fallback links working; annotate the info line.
      [dlWin,dlMac,dlLinux].forEach(b=>{b.href=fallback;b.removeAttribute('download');});
      if(info){
        info.textContent=err.message==='no-release'
          ?'No release published yet — admin must run the Build Desktop App workflow.'
          :'Could not contact GitHub API — opens the releases page directly.';
      }
    });
}

/* ====================================================================
   ADMIN DOWNLOAD — owner-only shortcut: type the admin code to unlock
   direct installer links without going through Supabase sign-in. The
   installers are public on GitHub Releases anyway, so this is purely
   a UX bypass for the owner — not a security boundary.
   ==================================================================== */
function setupAdminDownload(){
  const ADMIN_CODE='KOBI2100';
  const REPO='kobichen222/titan';
  const fallback=`https://github.com/${REPO}/releases/latest`;
  const input=document.getElementById('adminDownloadCode');
  const unlockBtn=document.getElementById('adminDownloadUnlockBtn');
  const errEl=document.getElementById('adminDownloadErr');
  const linksEl=document.getElementById('adminDownloadLinks');
  const dlWin=document.getElementById('adminDlWin');
  const dlMac=document.getElementById('adminDlMac');
  const dlLinux=document.getElementById('adminDlLinux');
  const info=document.getElementById('adminDlReleaseInfo');
  if(!input||!unlockBtn||!linksEl)return;

  let resolved=false;
  function resolveAssets(){
    if(resolved)return;
    resolved=true;
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`,{cache:'no-store'})
      .then(r=>{if(!r.ok)throw new Error('api-'+r.status);return r.json();})
      .then(rel=>{
        const a=rel.assets||[];
        const pick=re=>a.find(x=>re.test(x.name));
        const wire=(btn,asset)=>{
          if(!btn||!asset)return;
          btn.href=asset.browser_download_url;
          btn.setAttribute('download',asset.name);
          btn.title=asset.name;
        };
        wire(dlWin,pick(/\.exe$/i));
        wire(dlMac,pick(/\.dmg$/i));
        wire(dlLinux,pick(/\.AppImage$/i));
        if(info){
          const when=rel.published_at?new Date(rel.published_at).toLocaleDateString():'';
          info.textContent=`Latest release: ${rel.tag_name||rel.name||''}${when?' · '+when:''}`;
        }
      })
      .catch(()=>{
        [dlWin,dlMac,dlLinux].forEach(b=>{if(b){b.href=fallback;b.removeAttribute('download');}});
        if(info)info.textContent='Could not contact GitHub API — opens the releases page directly.';
      });
  }

  function unlock(){
    const v=(input.value||'').trim();
    if(v===ADMIN_CODE){
      errEl.textContent='';
      linksEl.style.display='block';
      input.disabled=true;
      unlockBtn.disabled=true;
      unlockBtn.textContent='✓ UNLOCKED';
      unlockBtn.style.opacity='.7';
      resolveAssets();
      try{sessionStorage.setItem('djtitan-admin-dl','1');}catch(e){}
      if(typeof toast==='function')toast('Admin downloads unlocked','success');
    }else{
      errEl.textContent='Wrong admin code';
      linksEl.style.display='none';
    }
  }

  unlockBtn.addEventListener('click',unlock);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();unlock();}});

  // Stay unlocked for the rest of the session once the code was entered.
  try{
    if(sessionStorage.getItem('djtitan-admin-dl')==='1'){
      input.value=ADMIN_CODE;
      unlock();
    }
  }catch(e){}
}

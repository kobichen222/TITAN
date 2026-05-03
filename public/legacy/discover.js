/* ====================================================================
   DISCOVER — world music catalog search (iTunes + Deezer)
   ==================================================================== */
function setupDiscover(){
  const GENRE_QUERY={
    'house':'house music',
    'trance':'trance',
    'techno':'techno',
    'edm':'edm anthems',
    'deep-house':'deep house',
    'progressive':'progressive house',
    'tech-house':'tech house',
    'drum-bass':'drum and bass',
    'hardstyle':'hardstyle',
    'psytrance':'psytrance',
    'dubstep':'dubstep',
    'festival':'festival anthem',
    'future-house':'future house',
    'bigroom':'big room house',
    'melodic-techno':'melodic techno',
    'afro-house':'afro house',
  };
  let currentSource='itunes';

  const toggleBtn=document.getElementById('discoverBtnToggle');
  const panel=document.getElementById('discoverWrap');
  const srcBtns=document.querySelectorAll('.disc-src-btn');
  const genreBtns=document.querySelectorAll('.disc-genre-btn');
  const input=document.getElementById('discoverInput');
  const go=document.getElementById('discoverSearch');
  const out=document.getElementById('discoverResults');
  const status=document.getElementById('discoverStatus');
  if(!panel||!out)return;

  toggleBtn?.addEventListener('click',()=>{
    const open=panel.classList.toggle('open');
    toggleBtn.classList.toggle('open',open);
    if(open&&!out.dataset.loaded){
      // Seed with a popular genre on first open
      doSearch(GENRE_QUERY['house']);
      out.dataset.loaded='1';
    }
  });

  srcBtns.forEach(b=>{
    b.addEventListener('click',()=>{
      srcBtns.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      currentSource=b.dataset.discSrc;
      const q=(input?.value||'').trim();
      if(q)doSearch(q);
    });
  });

  genreBtns.forEach(b=>{
    b.addEventListener('click',()=>{
      genreBtns.forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      const q=GENRE_QUERY[b.dataset.discGenre]||b.dataset.discGenre;
      if(input)input.value=q;
      doSearch(q);
    });
  });

  go?.addEventListener('click',()=>{
    const q=(input?.value||'').trim();
    if(q)doSearch(q);
  });
  input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go.click()}});

  function setStatus(msg,cls){
    if(!status)return;
    status.textContent=msg||'';
    status.style.color=cls==='err'?'var(--red)':cls==='ok'?'var(--play-green)':'var(--orange)';
  }

  async function doSearch(q){
    out.innerHTML='<div class="disc-loading">Searching '+currentSource+' for "'+escapeHtml(q)+'"…</div>';
    setStatus('Searching…','');
    try{
      let results=[];
      if(currentSource==='itunes'){
        const url=`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=50`;
        const r=await fetch(url);
        if(!r.ok)throw new Error('iTunes '+r.status);
        const j=await r.json();
        results=(j.results||[]).filter(x=>x.previewUrl).map(x=>({
          title:x.trackName,
          artist:x.artistName,
          album:x.collectionName,
          duration:x.trackTimeMillis?x.trackTimeMillis/1000:30,
          artwork:(x.artworkUrl100||'').replace('100x100','200x200'),
          previewUrl:x.previewUrl,
          source:'itunes',
          fullLength:false,
        }));
      }else if(currentSource==='deezer'){
        results=await deezerSearchJsonp(q);
      }else if(currentSource==='jamendo'){
        const cid=(typeof musicCreds!=='undefined'&&musicCreds.jamendoId)||'';
        if(!cid){
          out.innerHTML=
            '<div class="disc-note" style="grid-column:1/-1">'+
            '🎶 <b>Jamendo needs a free Client ID.</b> Go to <b>Settings → 🎵 MUSIC SERVICES</b> and paste a Client ID from '+
            '<a href="https://developer.jamendo.com" target="_blank" rel="noopener" style="color:#2ee0ff">developer.jamendo.com</a> '+
            '(free 2-minute signup). Jamendo gives you <b>full-length Creative-Commons tracks</b> — house, trance, techno, and more.'+
            '</div>';
          setStatus('Configure Jamendo in Settings','err');
          return;
        }
        // Map genre queries to Jamendo tags where possible; fall back to free search
        const TAG_MAP={'trance':'trance','house music':'house','deep house':'deephouse','progressive house':'progressive','tech house':'techhouse','techno':'techno','edm anthems':'edm','hardstyle':'hardstyle','psytrance':'psytrance','dubstep':'dubstep','drum and bass':'drumnbass','future house':'house','big room house':'edm','melodic techno':'techno','afro house':'afrohouse','festival anthem':'edm'};
        const tag=TAG_MAP[q.toLowerCase()]||null;
        const base='https://api.jamendo.com/v3.0/tracks/';
        const params=new URLSearchParams({
          client_id:cid,
          format:'json',
          limit:'50',
          audioformat:'mp32',
          order:'popularity_total',
          include:'musicinfo',
        });
        if(tag){params.set('tags',tag);}
        else{params.set('search',q);}
        const url=base+'?'+params.toString();
        const r=await fetch(url);
        if(!r.ok)throw new Error('Jamendo '+r.status);
        const j=await r.json();
        if(j.headers&&j.headers.status&&j.headers.status!=='success'){
          throw new Error('Jamendo: '+(j.headers.error_message||j.headers.code));
        }
        results=(j.results||[]).filter(x=>x.audio).map(x=>({
          title:x.name,
          artist:x.artist_name,
          album:x.album_name||'',
          duration:x.duration||0,
          artwork:x.album_image||x.image||'',
          previewUrl:x.audio,             // full-length MP3 URL
          source:'jamendo',
          fullLength:true,
        }));
      }
      renderResults(results,q);
      setStatus(`${results.length} results from ${currentSource}`,'ok');
    }catch(e){
      out.innerHTML=`<div class="disc-error">Search failed: ${escapeHtml(e.message||String(e))}</div>`;
      setStatus('Failed','err');
    }
  }

  function deezerSearchJsonp(q){
    return new Promise((resolve,reject)=>{
      const cbName='djmaxDeezerCb_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
      window[cbName]=data=>{
        delete window[cbName];
        try{s.remove()}catch(_){}
        const items=(data&&data.data)||[];
        resolve(items.filter(x=>x.preview).map(x=>({
          title:x.title,
          artist:x.artist&&x.artist.name,
          album:x.album&&x.album.title,
          duration:x.duration||30,
          artwork:(x.album&&(x.album.cover_medium||x.album.cover))||'',
          previewUrl:x.preview,
          source:'deezer',
          fullLength:false,
        })));
      };
      const s=document.createElement('script');
      s.src=`https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=50&output=jsonp&callback=${cbName}`;
      s.onerror=()=>{try{delete window[cbName]}catch(_){}try{s.remove()}catch(_){}reject(new Error('Deezer request blocked'))};
      document.body.appendChild(s);
      setTimeout(()=>{if(window[cbName]){try{delete window[cbName]}catch(_){}try{s.remove()}catch(_){}reject(new Error('Deezer timeout'))}},10000);
    });
  }

  let previewAudio=null;
  let currentPlayBtn=null;
  function renderResults(list,q){
    if(!list.length){
      out.innerHTML='<div class="disc-empty">No results for "'+escapeHtml(q)+'"</div>';
      return;
    }
    const note = currentSource==='jamendo'
      ? '<div class="disc-note" style="color:#9aff9a;border-color:rgba(28,255,143,.3);background:rgba(28,255,143,.05)">✓ These are <b>FULL-LENGTH</b> Creative-Commons tracks from Jamendo — free to play, remix and DJ with. Each track includes its CC license info on the artist\'s Jamendo page.</div>'
      : '<div class="disc-note">ℹ️ These are 30-second previews from '+(currentSource==='itunes'?'Apple iTunes':'Deezer')+'. Adding to library saves the preview locally — great for practice, demos, and sampling. For <b>full tracks</b>: switch to 🎶 Jamendo, or use + FILES / + URL / + YOUTUBE.</div>';
    out.innerHTML=note+list.map((t,i)=>`
      <div class="disc-row" data-i="${i}">
        <img class="disc-art" src="${escapeHtml(t.artwork||'')}" loading="lazy" onerror="this.style.visibility='hidden'"/>
        <div class="disc-info">
          <div class="disc-title-txt">${escapeHtml(t.title||'—')}</div>
          <div class="disc-artist-txt">${escapeHtml(t.artist||'—')}${t.duration?' · '+Math.round(t.duration)+'s':''}${t.album?' · '+escapeHtml(t.album):''}</div>
        </div>
        <button class="disc-preview" data-i="${i}" title="Preview">▶</button>
        <button class="disc-add" data-i="${i}">+ ADD</button>
      </div>
    `).join('');

    out.querySelectorAll('.disc-preview').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const t=list[+btn.dataset.i];
        if(!t||!t.previewUrl)return;
        if(!previewAudio){previewAudio=new Audio();previewAudio.crossOrigin='anonymous'}
        if(currentPlayBtn===btn&&!previewAudio.paused){
          previewAudio.pause();btn.classList.remove('playing');btn.textContent='▶';currentPlayBtn=null;return;
        }
        if(currentPlayBtn){currentPlayBtn.classList.remove('playing');currentPlayBtn.textContent='▶'}
        previewAudio.src=t.previewUrl;
        previewAudio.play().catch(()=>toast&&toast('Preview blocked — tap once on the page first','warn'));
        btn.classList.add('playing');btn.textContent='■';currentPlayBtn=btn;
        previewAudio.onended=()=>{btn.classList.remove('playing');btn.textContent='▶';currentPlayBtn=null};
      });
    });

    out.querySelectorAll('.disc-add').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const idx=+btn.dataset.i;
        const t=list[idx];
        if(!t||!t.previewUrl)return;
        btn.disabled=true;btn.textContent='…';
        try{
          ensureAudio();
          const resp=await fetch(t.previewUrl);
          if(!resp.ok)throw new Error('HTTP '+resp.status);
          const ab=await resp.arrayBuffer();
          const abCopy=ab.slice(0);
          const buf=await audioCtx.decodeAudioData(ab);
          let bpm=0;try{bpm=await detectBPM(buf);}catch(_){}
          const track={
            id:(t.source||'disc')+'_'+Date.now().toString(36)+'_'+idx,
            title:t.title||'Untitled',
            artist:t.artist||'—',
            album:t.album||'',
            bpm:bpm||0,
            key:'--',
            duration:buf.duration,
            buffer:buf,
            url:t.previewUrl,
            artwork:t.artwork||'',
            source:'url',          // treat as URL for filtering
            origin:t.source,       // 'itunes' / 'deezer' — for future filtering
            preview:true,
            rating:0,
            addedAt:Date.now(),
          };
          library.push(track);
          if(typeof renderLibrary==='function')renderLibrary();
          if(typeof saveToDB==='function')saveToDB();
          if(typeof idbPutAudio==='function')idbPutAudio(track.id,abCopy);
          if(typeof enrichTrackAsync==='function')enrichTrackAsync(track,buf);
          btn.textContent='✓ ADDED';btn.style.background='rgba(28,255,143,.2)';btn.style.color='#9aff9a';
          toast&&toast(`Added "${track.title}" to library`,'success');
        }catch(err){
          btn.textContent='✗ ERR';btn.style.background='rgba(255,46,46,.2)';btn.style.color='#ff6666';
          console.warn('discover add failed',err);
          toast&&toast('Add failed: '+(err.message||err),'error');
        }finally{
          setTimeout(()=>{btn.textContent='+ ADD';btn.disabled=false;btn.style.background='';btn.style.color=''},3200);
        }
      });
    });
  }
}

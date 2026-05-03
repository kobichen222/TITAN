/* SUPPORT — contact / purchase form, routes everything to kobi@media-deal.co.il */
function setupSupport(){
  const SUPPORT_EMAIL='kobi@media-deal.co.il';
  const FORM_ENDPOINT='https://formsubmit.co/ajax/'+encodeURIComponent(SUPPORT_EMAIL);
  const modes={
    support:{label:'SUPPORT / BUG',emoji:'🛟',subject:'DJ TITAN — Support request'},
    feature:{label:'FEATURE REQUEST',emoji:'💡',subject:'DJ TITAN — Feature request'},
    purchase:{label:'PURCHASE REQUEST',emoji:'💳',subject:'DJ TITAN — Purchase / Lead'},
    general:{label:'GENERAL',emoji:'✉',subject:'DJ TITAN — General inquiry'},
  };
  let mode='support';
  const $=(id)=>document.getElementById(id);
  const subjEl=$('supSubject'),honey=$('supHoney'),purchaseBox=$('supPurchaseFields');
  const statusEl=$('supStatus'),sendBtn=$('supSend'),copyBtn=$('supCopy'),mailBtn=$('supMailto');
  if(!subjEl||!sendBtn)return;

  document.querySelectorAll('.sup-mode-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.sup-mode-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      mode=btn.dataset.supMode;
      if(purchaseBox)purchaseBox.style.display=(mode==='purchase')?'grid':'none';
      if(!subjEl.dataset.userTyped)subjEl.value=modes[mode].subject;
      sendBtn.textContent=mode==='purchase'?'💳 SEND PURCHASE REQUEST':'📧 SEND MESSAGE';
    });
  });
  subjEl.addEventListener('input',()=>{subjEl.dataset.userTyped='1'});
  subjEl.value=modes[mode].subject;

  function values(){
    return {
      name:($('supName').value||'').trim(),
      email:($('supEmail').value||'').trim(),
      phone:($('supPhone').value||'').trim(),
      subject:(subjEl.value||'').trim()||modes[mode].subject,
      message:($('supMessage').value||'').trim(),
      tier:document.querySelector('input[name="supTier"]:checked')?.value||'',
      category:modes[mode].label,
      emoji:modes[mode].emoji,
      honey:(honey?.value||'').trim(),
    };
  }
  function textBody(v){
    const lines=[];
    lines.push(`Category: ${v.emoji} ${v.category}`);
    if(v.name)lines.push(`Name: ${v.name}`);
    if(v.email)lines.push(`Email: ${v.email}`);
    if(v.phone)lines.push(`Phone: ${v.phone}`);
    if(mode==='purchase'&&v.tier)lines.push(`License tier requested: ${v.tier}`);
    lines.push('');
    lines.push(v.message||'(no message)');
    lines.push('');
    lines.push('— Sent from DJ TITAN Professional DJ Studio');
    lines.push(`App URL: ${location.href}`);
    lines.push(`User-Agent: ${navigator.userAgent}`);
    lines.push(`Sent at: ${new Date().toISOString()}`);
    return lines.join('\n');
  }
  function setStatus(t,cls){statusEl.textContent=t||'';statusEl.className='sup-status'+(cls?' '+cls:'')}
  function validEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)}

  async function send(){
    const v=values();
    if(v.honey){setStatus('✓ Message received','ok');return;} // spam honeypot
    if(!v.message){setStatus('Please write a message first','err');return;}
    if(!validEmail(v.email)){setStatus('Please enter a valid email so we can reply','err');return;}

    sendBtn.disabled=true;sendBtn.textContent='⏳ SENDING…';setStatus('Sending…','');
    const payload={
      _subject:`[${v.category}] ${v.subject}`,
      _template:'table',
      _captcha:'false',
      _replyto:v.email,
      Category:`${v.emoji} ${v.category}`,
      Name:v.name||'(not provided)',
      Email:v.email,
      Phone:v.phone||'(not provided)',
      Subject:v.subject,
      Message:v.message,
      LicenseTier:mode==='purchase'?(v.tier||'(not selected)'):'—',
      AppURL:location.href,
      UserAgent:navigator.userAgent,
      SentAt:new Date().toISOString(),
    };
    try{
      const r=await fetch(FORM_ENDPOINT,{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(payload),
      });
      let data=null;try{data=await r.json()}catch(_){}
      if(!r.ok||(data&&String(data.success)==='false')){
        throw new Error((data&&(data.message||data.error))||('HTTP '+r.status));
      }
      setStatus('✓ Message sent — reply within 24h','ok');
      if(typeof toast==='function')toast('Message sent to DJ TITAN support','success');
      $('supMessage').value='';
      sendBtn.textContent='✓ SENT';
      setTimeout(()=>{sendBtn.disabled=false;sendBtn.textContent=mode==='purchase'?'💳 SEND PURCHASE REQUEST':'📧 SEND MESSAGE';setStatus('')},3800);
    }catch(err){
      console.warn('formsubmit failed',err);
      setStatus('Direct send blocked — opening your email app instead','err');
      const href=`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(v.subject)}&body=${encodeURIComponent(textBody(v))}`;
      setTimeout(()=>{window.location.href=href;sendBtn.disabled=false;sendBtn.textContent=mode==='purchase'?'💳 SEND PURCHASE REQUEST':'📧 SEND MESSAGE';},700);
    }
  }

  sendBtn.addEventListener('click',send);

  mailBtn?.addEventListener('click',()=>{
    const v=values();
    if(!v.message){setStatus('Please write a message first','err');return;}
    const href=`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(v.subject)}&body=${encodeURIComponent(textBody(v))}`;
    window.location.href=href;
    setStatus('Email app opening…','ok');setTimeout(()=>setStatus(''),5000);
  });

  copyBtn.addEventListener('click',async()=>{
    const v=values();
    const text=`To: ${SUPPORT_EMAIL}\nSubject: ${v.subject}\n\n${textBody(v)}`;
    try{
      await navigator.clipboard.writeText(text);
      setStatus('Copied — paste into WhatsApp / email / chat','ok');
      if(typeof toast==='function')toast('Message copied','success');
    }catch(e){
      const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');setStatus('Copied','ok');}
      catch(_){setStatus('Copy failed — select the text manually','err');}
      ta.remove();
    }
    setTimeout(()=>setStatus(''),5000);
  });
}

/* TITAN CLOCK — header digital clock (time only, fixed width) */
function setupTitanClock(){
  const timeEl=document.getElementById('tcTime');
  const box=document.getElementById('titanClock');
  if(!timeEl)return;
  let is24=localStorage.getItem('djtitan_clock_24h')!=='0';
  function tick(){
    const d=new Date();
    let h=d.getHours(),m=d.getMinutes(),s=d.getSeconds();
    if(!is24){h=h%12;if(h===0)h=12;}
    const hh=String(h).padStart(2,'0'),mm=String(m).padStart(2,'0'),ss=String(s).padStart(2,'0');
    timeEl.textContent=`${hh}:${mm}:${ss}`;
  }
  tick();setInterval(tick,1000);
  box?.addEventListener('click',()=>{
    is24=!is24;
    localStorage.setItem('djtitan_clock_24h',is24?'1':'0');
    tick();
  });
}

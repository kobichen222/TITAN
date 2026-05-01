/* PIONEER DJ PRO MAX — Ultimate DJ Console */
const STORAGE_KEY = 'djMaxAi_v1';

let audioCtx=null, masterGain=null, masterLimiter=null, recordDestination=null;
let mediaRecorder=null, recordedChunks=[];
let masterAnalyserL, masterAnalyserR;
let library=[], playlists=[], samples=new Array(16).fill(null);
let ytPlayers={A:null,B:null}, midiAccess=null, midiDevices=[];
let stats={totalTime:0,tracksPlayed:0,fxCount:0,cueCount:0,mixHistory:[],sessionStart:Date.now()};
let settings={theme:'dark',rgbAmbient:true,phraseMarkers:true,limiter:true,autoGain:false,autoSave:true};
let aiDJ={active:false,style:'smooth',transLen:16,bpmTol:6,order:'energy-flow',transitionTimer:null};

function createDeck(id){return{id,track:null,playing:false,startTime:0,offset:0,tempo:0,playbackRate:1,rpmScale:1,tempoRange:8,cuePoint:0,hotCues:{},savedLoops:{},loop:{active:false,start:null,end:null,loopInSet:false},keylock:false,quantize:false,slip:false,slipReturn:null,reverse:false,sync:false,source:null,volumeGain:null,trimGain:null,channelGain:null,eqLow:null,eqLoMid:null,eqHiMid:null,eqHigh:null,killLow:false,killMid:false,killHi:false,compressor:null,saturation:null,colorFilter:null,buffer:null,volume:1,eq:{low:0,loMid:0,hiMid:0,high:0},trim:1,analyser:null,padMode:'cue',waveZoom:1,energy:0,beatgrid:null,phraseOffset:0};}
const decks={A:createDeck('A'),B:createDeck('B'),C:createDeck('C'),D:createDeck('D')};
const mixerState={crossfader:0.5,xfaderCurve:'smooth',master:0.9,booth:0.7,balance:0,hpMix:0.5,hpVol:0.7,hpCue:{A:false,B:false,C:false,D:false},micOn:false,micVol:0,micHi:0,micLow:0,fx:{type:'delay',channel:'master',beat:1,level:0.5,on:false},colorFx:{type:'filter',A:0,B:0,C:0,D:0},xfaderAssign:{A:'A',B:'B',C:'THRU',D:'THRU'},isRecording:false,sceneFx:{type:null,depth:0.5,xpadX:0.5,xpadY:0.5,xpadActive:false},isolator:{low:0,mid:0,hi:0}};

const DEMO_TRACKS=[
{title:"Midnight Drive",artist:"Synthwave Collective",bpm:124,key:"8A",duration:180},
{title:"Neon Pulse",artist:"Future Funk",bpm:128,key:"5B",duration:180},
{title:"Deep Space",artist:"Cosmic Nights",bpm:122,key:"11A",duration:180},
{title:"Tokyo Drift",artist:"Urban Echo",bpm:130,key:"7A",duration:180},
{title:"Ocean Waves",artist:"Chill Sessions",bpm:118,key:"9B",duration:180},
{title:"Electric Dreams",artist:"Pulse Factory",bpm:126,key:"4A",duration:180}];

/* ============ DECK HTML BUILDER ============ */
function buildDeckHTML(d){
  return `<div class="deck-header"><div class="deck-label"><span class="model">TITAN-3K</span><span class="suffix">DECK</span></div><button class="deck-upload-btn" data-deck-upload="${d}" title="Upload audio files and load to deck ${d}"><span class="btn-icon">⬆</span><span class="btn-text">⬆ UPLOAD</span></button><button class="deck-lib-btn" data-deck-lib="${d}" title="Browse library and load to deck ${d}"><span class="btn-icon" aria-hidden="true"><svg class="lib-svg" viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><ellipse cx="11" cy="4.5" rx="7" ry="2.2"/><path d="M4 4.5v4c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2v-4"/><path d="M4 10.5v4c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2v-4"/><path d="M4 15.5v2.5c0 1.2 3.1 2.2 7 2.2s7-1 7-2.2v-2.5"/></svg></span><span class="btn-text">LIBRARY</span></button><div class="deck-number">${d}</div></div>
  <div class="screen"><div class="screen-top"><div><div class="track-title" id="title-${d}">— NO TRACK LOADED —</div><div class="track-artist" id="artist-${d}">LOAD A TRACK</div></div><div class="screen-right"><div class="screen-bpm" id="bpm-${d}">---.--</div><div class="screen-bpm-label">BPM</div><div class="screen-key" id="key-${d}">--</div></div></div>
  <div class="waveform"><canvas class="waveform-canvas" id="wave-${d}" width="600" height="48"></canvas><div class="phrase-markers" id="phrase-${d}"></div><div class="playhead"></div></div>
  <div class="time-row"><div><div class="time-label">ELAPSED</div><div class="time-value" id="elapsed-${d}">00:00.0</div></div><div style="text-align:right;"><div class="time-label">REMAIN</div><div class="time-value remain" id="remain-${d}">-00:00.0</div></div></div></div>
  <div class="loop-section">
    <button class="loop-btn" data-action="loopIn" data-deck="${d}">LOOP IN</button>
    <button class="loop-btn" data-action="loopOut" data-deck="${d}">LOOP OUT</button>
    <button class="loop-btn" data-action="reloop" data-deck="${d}">RELOOP</button>
    <select class="fx-selector" data-autoloop="${d}" style="font-size:9px;padding:4px 2px;min-width:0;">
      <option value="">AUTO</option><option value="0.25">1/4</option><option value="0.5">1/2</option>
      <option value="1">1</option><option value="2">2</option><option value="4">4</option>
      <option value="8">8</option><option value="16">16</option>
    </select></div>
  <div class="beat-jump">
    <button class="jump-btn" data-jump="-4" data-deck="${d}">← 4</button>
    <button class="jump-btn" data-jump="-1" data-deck="${d}">← 1</button>
    <button class="jump-btn" data-jump="1" data-deck="${d}">1 →</button>
    <button class="jump-btn" data-jump="4" data-deck="${d}">4 →</button>
  </div>
  <div class="deck-utils">
    <button class="util-btn sync" data-util="sync" data-deck="${d}">SYNC</button>
    <button class="util-btn keylock" data-util="keylock" data-deck="${d}">KEY</button>
    <button class="util-btn quantize" data-util="quantize" data-deck="${d}">QUANT</button>
    <button class="util-btn slip" data-util="slip" data-deck="${d}">SLIP</button>
    <button class="util-btn reverse" data-util="reverse" data-deck="${d}">REV</button>
  </div>
  <div class="pad-mode-row" data-deck="${d}">
    <button class="pad-mode-btn active" data-pad-mode="cue" data-deck="${d}">HOT CUE</button>
    <button class="pad-mode-btn" data-pad-mode="roll" data-deck="${d}">ROLL</button>
    <button class="pad-mode-btn" data-pad-mode="slicer" data-deck="${d}">SLICER</button>
    <button class="pad-mode-btn" data-pad-mode="sampler" data-deck="${d}">SAMPLER</button>
    <button class="pad-mode-btn" data-pad-mode="loop" data-deck="${d}">LOOP</button>
    <button class="pad-mode-btn" data-pad-mode="pitch" data-deck="${d}">PITCH</button>
  </div>
  <div class="hot-cues" data-deck="${d}">${[1,2,3,4,5,6,7,8].map(n=>`<button class="cue-btn" data-color="${n}" data-cue="${n}">${n}</button>`).join('')}</div>
  <div class="jog-wrapper"><div class="jog-wheel" id="jog-${d}"><div class="jog-outer"></div><div class="jog-ring"><div class="jog-ring-light"></div></div><div class="jog-markers"></div><div class="jog-platter" id="platter-${d}"><div class="jog-platter-disc"></div></div><div class="jog-indicator"></div><div class="jog-center-screen"><svg class="jog-bpm-dial" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" fill="none" stroke="#2a2a30" stroke-width="0.8"/><circle cx="50" cy="50" r="44" fill="none" stroke="#0f0f14" stroke-width="0.6"/><g class="jdial-ticks" stroke="#4a4a52" stroke-width="0.8" stroke-linecap="round"><line x1="50" y1="6" x2="50" y2="10" stroke="#ff8a1a" stroke-width="1.1"/><line x1="74" y1="12.5" x2="72.5" y2="15.5"/><line x1="88" y1="26" x2="85" y2="27.5"/><line x1="94" y1="50" x2="90" y2="50"/><line x1="88" y1="74" x2="85" y2="72.5"/><line x1="74" y1="87.5" x2="72.5" y2="84.5"/><line x1="50" y1="94" x2="50" y2="90"/><line x1="26" y1="87.5" x2="27.5" y2="84.5"/><line x1="12" y1="74" x2="15" y2="72.5"/><line x1="6" y1="50" x2="10" y2="50"/><line x1="12" y1="26" x2="15" y2="27.5"/><line x1="26" y1="12.5" x2="27.5" y2="15.5"/></g><g class="jdial-needle" id="bpmNeedle-${d}" transform="rotate(0 50 50)" opacity="0.95"><line x1="50" y1="20" x2="50" y2="9" stroke="#ff8a1a" stroke-width="1.6" stroke-linecap="round"/><circle cx="50" cy="9" r="1.6" fill="#ff8a1a"/></g></svg><div class="jdial-text"><div class="bpm-display" id="centerBpm-${d}">---</div><div class="bpm-sub">BPM</div></div></div></div></div>
  <div class="transport">
    <button class="big-btn cue" data-deck="${d}" data-action="cue"><span class="icon">◄◄</span><span class="lbl">CUE</span></button>
    <button class="big-btn play" data-deck="${d}" data-action="play"><span class="icon" id="playIcon-${d}">▶</span><span class="lbl" id="playLabel-${d}">PLAY</span></button>
  </div>
  <div class="tempo-section"><div class="tempo-header"><span>TEMPO</span><select class="tempo-range" data-range="${d}"><option value="6">±6%</option><option value="8" selected>±8%</option><option value="10">±10%</option><option value="16">±16%</option><option value="50">±50%</option></select><span class="tempo-value" id="tempoVal-${d}">+0.00%</span></div>
  <div class="tempo-btn-row">
    <div class="tempo-display-big" id="tempoBig-${d}">+0.00%</div>
    <button class="tempo-btn" data-tempo-action="minus-big" data-deck="${d}">−−</button>
    <button class="tempo-btn reset" data-tempo-action="reset" data-deck="${d}">0.00</button>
    <button class="tempo-btn" data-tempo-action="plus-big" data-deck="${d}">++</button>
    <button class="tempo-btn" data-tempo-action="minus" data-deck="${d}">−</button>
    <button class="tempo-btn reset" data-tempo-action="nudge-down" data-deck="${d}">NUDGE</button>
    <button class="tempo-btn" data-tempo-action="plus" data-deck="${d}">+</button>
    <div class="tempo-step-row">
      <button class="step-btn" data-tempo-step="0.02" data-deck="${d}">0.02</button>
      <button class="step-btn active" data-tempo-step="0.1" data-deck="${d}">0.1</button>
      <button class="step-btn" data-tempo-step="0.5" data-deck="${d}">0.5</button>
      <button class="step-btn" data-tempo-step="1" data-deck="${d}">1.0</button>
    </div>
  </div></div>
  <div class="dj-focus-vol" data-deck="${d}">
    <div class="djfv-head">
      <span class="djfv-label">CH ${d} · VOLUME</span>
      <button class="djfv-mute" data-djfv-mute="${d}" title="Mute channel ${d}">MUTE</button>
    </div>
    <div class="djfv-body">
      <button class="djfv-btn" data-djfv-step="${d}" data-djfv-dir="-1" title="Volume down">−</button>
      <input type="range" class="djfv-slider" min="0" max="100" value="0" step="1" data-djfv-slider="${d}" aria-label="Volume deck ${d}"/>
      <button class="djfv-btn" data-djfv-step="${d}" data-djfv-dir="1" title="Volume up">+</button>
      <div class="djfv-value" data-djfv-value="${d}">0</div>
    </div>
  </div>`;
}

function buildMixerToolbarTopHTML(){
  return `<div class="mtb-section mtb-automix">
    <div class="mtb-head">
      <span class="mtb-label"><span class="mtb-led" aria-hidden="true"></span>AUTO&nbsp;MIX</span>
      <span class="mtb-dir" id="automixDir">A→B</span>
    </div>
    <div class="mtb-body">
      <div class="automix-grid">
        <button class="automix-btn" data-mix="smooth" title="Long bass-swap blend"><span class="amx-led" aria-hidden="true"></span><span class="amx-txt">SMOOTH</span></button>
        <button class="automix-btn" data-mix="energy" title="High-pass sweep + expo fade"><span class="amx-led" aria-hidden="true"></span><span class="amx-txt">ENERGY</span></button>
        <button class="automix-btn" data-mix="harmonic" title="Key-matched blend"><span class="amx-led" aria-hidden="true"></span><span class="amx-txt">HARMONIC</span></button>
        <button class="automix-btn danger" data-mix="cut" title="Hard cut on next downbeat"><span class="amx-led" aria-hidden="true"></span><span class="amx-txt">CUT</span></button>
        <button class="automix-btn echo" data-mix="echo" title="Echo tail on outgoing"><span class="amx-led" aria-hidden="true"></span><span class="amx-txt">ECHO</span></button>
        <button class="automix-btn pick" id="automixPickBtn" title="Load smart next track"><span class="amx-led" aria-hidden="true"></span><span class="amx-txt">PICK</span></button>
      </div>
      <div class="automix-decks" id="automixDecks" title="Decks eligible for Auto-Mix">
        <span class="automix-decks-label">DECKS</span>
        <button class="automix-deck-btn active" data-amx-deck="A" title="Use deck A in Auto-Mix">A</button>
        <button class="automix-deck-btn active" data-amx-deck="B" title="Use deck B in Auto-Mix">B</button>
        <button class="automix-deck-btn active" data-amx-deck="C" title="Use deck C in Auto-Mix">C</button>
        <button class="automix-deck-btn active" data-amx-deck="D" title="Use deck D in Auto-Mix">D</button>
      </div>
      <div class="automix-sub">
        <span class="automix-sub-label">BARS</span>
        <select class="fx-selector automix-bars" id="automixBars">
          <option value="4">4</option><option value="8">8</option><option value="16" selected>16</option>
          <option value="32">32</option><option value="64">64</option>
        </select>
        <span class="automix-sep" aria-hidden="true"></span>
        <button class="automix-sync" id="automixSync" title="Sync incoming deck"><span class="asy-txt">SYNC</span><span class="asy-arrow" aria-hidden="true"></span></button>
        <button class="automix-sync automix-cont" id="automixContBtn" title="Auto-chain transitions forever">CONT</button>
      </div>
    </div>
  </div>`;
}

function buildMixerToolbarBottomHTML(){
  return `<div class="mtb-section mtb-hpmic">
    <div class="mtb-head"><span class="mtb-label">HEADPHONES &amp; MIC</span></div>
    <div class="mtb-body">
      <div class="mtb-hpmic-grid">
        <div class="mtb-hp">
          <div class="mtb-sublabel">HEADPHONES</div>
          <div class="mtb-knobrow">
            <div class="knob-wrap"><div class="knob small" data-knob="hpMix"><div class="knob-indicator"></div></div><span class="knob-label">CUE MIX</span></div>
            <div class="knob-wrap"><div class="knob small" data-knob="hpVol"><div class="knob-indicator"></div></div><span class="knob-label">HP VOL</span></div>
          </div>
          <div class="cue-hp-buttons" title="Pick decks to monitor in your headphones"><button class="cue-hp-btn" id="hpCue-A" title="Monitor Deck A">DECK A</button><button class="cue-hp-btn" id="hpCue-B" title="Monitor Deck B">DECK B</button><button class="cue-hp-btn" id="hpCue-C" title="Monitor Deck C">DECK C</button><button class="cue-hp-btn" id="hpCue-D" title="Monitor Deck D">DECK D</button></div>
        </div>
        <div class="mtb-hpmic-divider" aria-hidden="true"></div>
        <div class="mtb-mic">
          <div class="mtb-sublabel">MIC</div>
          <div class="mtb-knobrow">
            <div class="knob-wrap"><div class="knob small" data-knob="micVol"><div class="knob-indicator"></div></div><span class="knob-label">VOL</span></div>
            <div class="knob-wrap"><div class="knob small" data-knob="micHi"><div class="knob-indicator"></div></div><span class="knob-label">HI</span></div>
            <div class="knob-wrap"><div class="knob small" data-knob="micLow"><div class="knob-indicator"></div></div><span class="knob-label">LOW</span></div>
            <button class="mic-btn" id="micOnBtn">ON</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="mtb-section mtb-iso">
    <div class="mtb-head"><span class="mtb-label">ISOLATOR</span></div>
    <div class="mtb-body">
      <div class="mtb-knobrow">
        <div class="knob-wrap"><div class="knob small" data-knob="isoLow"><div class="knob-indicator"></div></div><span class="knob-label">LOW</span></div>
        <div class="knob-wrap"><div class="knob small" data-knob="isoMid"><div class="knob-indicator"></div></div><span class="knob-label">MID</span></div>
        <div class="knob-wrap"><div class="knob small" data-knob="isoHi"><div class="knob-indicator"></div></div><span class="knob-label">HI</span></div>
      </div>
    </div>
  </div>`;
}

function buildMixerHTML(){
  return `<div class="mixer-header"><div class="mixer-brand"><span class="model">TITAN</span>CORE</div></div>
  <div class="master-vu-modern" id="masterVuBox">
    <div class="master-vu-halo" id="masterVuHalo"></div>
    <div class="mvm-scale">
      <span>+6</span><span>0</span><span>-6</span><span>-12</span><span>-24</span><span>-48</span>
    </div>
    <div class="mvm-cols">
      <div class="mvm-col">
        <div class="mvm-chlabel" id="mvmLabelL">L</div>
        <div class="mvm-clip" id="clipLedL"></div>
        <div class="vu-meter vu-master" id="masterHVuL"></div>
      </div>
      <div class="mvm-col">
        <div class="mvm-chlabel mvm-chlabel-r" id="mvmLabelR">R</div>
        <div class="mvm-clip" id="clipLedR"></div>
        <div class="vu-meter vu-master vu-master-r" id="masterHVuR"></div>
      </div>
    </div>
  </div>
  <div class="master-section">
    <div class="master-knob-wrap"><div class="knob" data-knob="master"><div class="knob-indicator"></div></div><span class="knob-label">MASTER</span></div>
    <div class="master-knob-wrap"><div class="knob" data-knob="booth"><div class="knob-indicator"></div></div><span class="knob-label">BOOTH</span></div>
    <div class="master-knob-wrap"><div class="knob" data-knob="balance"><div class="knob-indicator"></div></div><span class="knob-label">BAL</span></div>
  </div>
  <div class="color-fx-row">
    <div class="color-fx-channel"><div class="knob small" data-knob="colorFx-A"><div class="knob-indicator"></div></div><span class="knob-label">COLOR A</span></div>
    <div class="color-fx-channel"><div class="knob small" data-knob="colorFx-B"><div class="knob-indicator"></div></div><span class="knob-label">COLOR B</span></div>
  </div>
  <div class="color-fx-grid">
    <button class="curve-btn color-fx-select active" data-colorfx="filter">FILTER</button>
    <button class="curve-btn color-fx-select" data-colorfx="dub">DUB ECHO</button>
    <button class="curve-btn color-fx-select" data-colorfx="noise">NOISE</button>
    <button class="curve-btn color-fx-select" data-colorfx="pitch">PITCH</button>
    <button class="curve-btn color-fx-select" data-colorfx="space">SPACE</button>
    <button class="curve-btn color-fx-select" data-colorfx="crush">CRUSH</button>
  </div>
  <div class="channels">${['A','B','C','D'].map((d,i)=>`
    <div class="channel">
      <div class="channel-label">CH ${d}</div>
      <div class="knob-wrap"><div class="knob small" data-knob="trim-${d}"><div class="knob-indicator"></div></div><span class="knob-label">TRIM</span></div>
      <div class="knob-wrap"><div class="knob small" data-knob="hi-${d}"><div class="knob-indicator"></div></div><span class="knob-label">HI</span></div>
      <div class="knob-wrap"><div class="knob small" data-knob="mid-${d}"><div class="knob-indicator"></div></div><span class="knob-label">MID</span></div>
      <div class="knob-wrap"><div class="knob small" data-knob="low-${d}"><div class="knob-indicator"></div></div><span class="knob-label">LOW</span></div>
      <div class="channel-body"><div class="vu-meter" id="vu-${d}"></div><div class="fader-wrap" data-fader="${d}"><div class="fader-handle" id="fader-${d}"></div></div></div>
      <div class="xfader-assign" data-deck="${d}">
        <button class="assign-btn ${d==='A'||d==='C'?'active':''}" data-assign="A">A</button>
        <button class="assign-btn" data-assign="THRU">∥</button>
        <button class="assign-btn ${d==='B'||d==='D'?'active':''}" data-assign="B">B</button>
      </div>
    </div>`).join('')}
  </div>
  <div class="crossfader-section">
    <div class="crossfader-ab"><span>A</span><span>B</span></div>
    <div class="crossfader-track" id="xfader"><div class="crossfader-handle" id="xfaderHandle"></div></div>
    <div class="crossfader-label">CROSSFADER</div>
    <div class="curve-switch" id="xfaderCurve">
      <button class="curve-btn active" data-curve="smooth">SMOOTH</button>
      <button class="curve-btn" data-curve="sharp">SHARP</button>
      <button class="curve-btn" data-curve="cut">CUT</button>
    </div>
  </div>
  <div class="compact-decks" id="mixerCompactDecks"></div>`;
}

/* ============ AUDIO ENGINE ============ */
function ensureAudio(){
  if(audioCtx){
    // Resume if suspended (autoplay policy)
    if(audioCtx.state==='suspended'){audioCtx.resume().catch(()=>{});}
    return;
  }
  audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  masterGain=audioCtx.createGain();masterGain.gain.value=mixerState.master;

  // Master Isolator (3-band EQ on master)
  window.isoLow=audioCtx.createBiquadFilter();isoLow.type='lowshelf';isoLow.frequency.value=200;
  window.isoMid=audioCtx.createBiquadFilter();isoMid.type='peaking';isoMid.frequency.value=1000;isoMid.Q.value=0.7;
  window.isoHi=audioCtx.createBiquadFilter();isoHi.type='highshelf';isoHi.frequency.value=5000;
  masterGain.connect(isoLow);isoLow.connect(isoMid);isoMid.connect(isoHi);

  // Scene FX on master
  window.sceneFxDry=audioCtx.createGain();sceneFxDry.gain.value=1;
  window.sceneFxWet=audioCtx.createGain();sceneFxWet.gain.value=0;
  window.sceneFxDelay=audioCtx.createDelay(4);sceneFxDelay.delayTime.value=0.25;
  window.sceneFxFeedback=audioCtx.createGain();sceneFxFeedback.gain.value=0.5;
  window.sceneFxFilter=audioCtx.createBiquadFilter();sceneFxFilter.type='lowpass';sceneFxFilter.frequency.value=5000;
  window.sceneFxOut=audioCtx.createGain();
  isoHi.connect(sceneFxDry);
  isoHi.connect(sceneFxDelay);
  sceneFxDelay.connect(sceneFxFeedback);
  sceneFxFeedback.connect(sceneFxDelay);
  sceneFxDelay.connect(sceneFxFilter);
  sceneFxFilter.connect(sceneFxWet);
  sceneFxDry.connect(sceneFxOut);
  sceneFxWet.connect(sceneFxOut);

  masterLimiter=audioCtx.createDynamicsCompressor();
  masterLimiter.threshold.value=-0.5;masterLimiter.knee.value=0;
  masterLimiter.ratio.value=20;masterLimiter.attack.value=0.001;masterLimiter.release.value=0.05;
  recordDestination=audioCtx.createMediaStreamDestination();
  masterAnalyserL=audioCtx.createAnalyser();masterAnalyserR=audioCtx.createAnalyser();
  masterAnalyserL.fftSize=1024;masterAnalyserR.fftSize=1024;
  masterAnalyserL.smoothingTimeConstant=0.25;masterAnalyserR.smoothingTimeConstant=0.25;
  const splitter=audioCtx.createChannelSplitter(2);
  sceneFxOut.connect(splitter);
  splitter.connect(masterAnalyserL,0);splitter.connect(masterAnalyserR,1);
  if(settings.limiter){sceneFxOut.connect(masterLimiter);masterLimiter.connect(audioCtx.destination);masterLimiter.connect(recordDestination);}
  else{sceneFxOut.connect(audioCtx.destination);sceneFxOut.connect(recordDestination);}
  ['A','B','C','D'].forEach(d=>setupDeck(d));
  setupMic();
}

function setupDeck(id){
  const d=decks[id];
  d.trimGain=audioCtx.createGain();d.trimGain.gain.value=1;
  // 4-band EQ (Low / Lo-Mid / Hi-Mid / High)
  d.eqLow=audioCtx.createBiquadFilter();d.eqLow.type='lowshelf';d.eqLow.frequency.value=120;
  d.eqLoMid=audioCtx.createBiquadFilter();d.eqLoMid.type='peaking';d.eqLoMid.frequency.value=500;d.eqLoMid.Q.value=1;
  d.eqHiMid=audioCtx.createBiquadFilter();d.eqHiMid.type='peaking';d.eqHiMid.frequency.value=2500;d.eqHiMid.Q.value=1;
  d.eqHigh=audioCtx.createBiquadFilter();d.eqHigh.type='highshelf';d.eqHigh.frequency.value=8000;
  // Compressor per channel
  d.compressor=audioCtx.createDynamicsCompressor();
  d.compressor.threshold.value=-18;d.compressor.knee.value=12;
  d.compressor.ratio.value=2;d.compressor.attack.value=0.003;d.compressor.release.value=0.25;
  // Saturation (waveshaper) for tape warmth
  d.saturation=audioCtx.createWaveShaper();
  const curve=new Float32Array(4096);
  for(let i=0;i<4096;i++){const x=(i*2/4096)-1;curve[i]=Math.tanh(x*1.2);}
  d.saturation.curve=curve;d.saturation.oversample='2x';
  // Color FX
  d.colorFilter=audioCtx.createBiquadFilter();d.colorFilter.type='allpass';d.colorFilter.frequency.value=1000;
  // Volume + channel + analyser — decks start at unity gain so they
  // play independently of the mixer's channel fader (the deck has its
  // own internal output level). The channel fader still works; it
  // just starts at the top instead of the bottom.
  d.volumeGain=audioCtx.createGain();d.volumeGain.gain.value=1;
  d.channelGain=audioCtx.createGain();d.channelGain.gain.value=1;
  d.analyser=audioCtx.createAnalyser();d.analyser.fftSize=512;
  // Chain: trim → low → loMid → hiMid → high → compressor → saturation → color → volume → channel → master
  d.trimGain.connect(d.eqLow);d.eqLow.connect(d.eqLoMid);d.eqLoMid.connect(d.eqHiMid);d.eqHiMid.connect(d.eqHigh);
  d.eqHigh.connect(d.compressor);d.compressor.connect(d.saturation);d.saturation.connect(d.colorFilter);
  d.colorFilter.connect(d.volumeGain);d.volumeGain.connect(d.channelGain);d.channelGain.connect(d.analyser);
  d.channelGain.connect(masterGain);
}

let micStream,micSource,micGain,micEqHi,micEqLow;
function setupMic(){
  micGain=audioCtx.createGain();micGain.gain.value=0;
  micEqHi=audioCtx.createBiquadFilter();micEqHi.type='highshelf';micEqHi.frequency.value=4000;
  micEqLow=audioCtx.createBiquadFilter();micEqLow.type='lowshelf';micEqLow.frequency.value=250;
  micEqLow.connect(micEqHi);micEqHi.connect(micGain);micGain.connect(masterGain);
}
function setMicUi(on){
  const b=document.getElementById('micOnBtn');if(b)b.classList.toggle('active',on);
}

async function toggleMic(){
  ensureAudio();
  if(mixerState.micOn){
    mixerState.micOn=false;
    if(micSource){micSource.disconnect();micSource=null;}
    if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null;}
    setMicUi(false);
    return;
  }
  try{
    micStream=await navigator.mediaDevices.getUserMedia({audio:true});
    micSource=audioCtx.createMediaStreamSource(micStream);
    micSource.connect(micEqLow);
    mixerState.micOn=true;
    setMicUi(true);
    toast('Mic connected','success');
  }catch(e){toast('Mic denied','error');}
}

function generateBuffer(track){
  ensureAudio();
  const sr=audioCtx.sampleRate,buf=audioCtx.createBuffer(2,sr*track.duration,sr);
  const bpm=track.bpm,beatDur=60/bpm,seed=track.title.length+track.bpm,lead=220+(seed%200);
  for(let ch=0;ch<2;ch++){
    const data=buf.getChannelData(ch);
    for(let i=0;i<data.length;i++){
      const t=i/sr,beatT=t%beatDur,beatIdx=Math.floor(t/beatDur);
      let kick=0;
      if(beatT<0.12)kick=Math.sin(2*Math.PI*55*beatT*(1-beatT*3))*Math.exp(-beatT*18)*0.7;
      let hat=0;const hatT=(t+beatDur/2)%beatDur;
      if(hatT<0.05&&beatIdx%2===1)hat=(Math.random()*2-1)*Math.exp(-hatT*60)*0.15;
      const bass=Math.sin(2*Math.PI*(lead/4)*t)*0.15*(1-beatT/beatDur*0.3);
      const barT=t%(beatDur*4),leadOn=barT<beatDur*2?1:0.4;
      const leadFreq=lead*(1+0.5*Math.sin(2*Math.PI*0.25*t));
      const leadSig=Math.sin(2*Math.PI*leadFreq*t)*0.1*leadOn;
      data[i]=kick+hat+bass+leadSig;
    }
  }
  return buf;
}

async function loadAudioFile(file){
  if(!file){throw new Error('No file');}
  ensureAudio();
  if(!audioCtx)throw new Error('Audio context unavailable');
  if(audioCtx.state==='suspended'){try{await audioCtx.resume();}catch(e){}}
  if(audioCtx.state!=='running')throw new Error('Audio locked — click anywhere first');
  let ab;
  try{ab=await file.arrayBuffer();}
  catch(e){throw new Error('Could not read file');}
  const abCopy=ab.slice(0);
  let buf;
  try{buf=await audioCtx.decodeAudioData(ab);}
  catch(e){throw new Error('Unsupported audio format ('+(file.type||file.name.split('.').pop())+')');}
  let bpm=120;try{bpm=await detectBPM(buf);}catch(e){}
  const track={id:'u_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),title:file.name.replace(/\.[^/.]+$/,''),artist:'Unknown',bpm,key:'--',duration:buf.duration,buffer:buf,source:'file',rating:0,addedAt:Date.now()};
  library.push(track);try{renderLibrary();}catch(e){}
  try{saveToDB();}catch(e){}
  try{await idbPutAudio(track.id,abCopy);}catch(e){console.warn('IDB store failed',e);}
  try{enrichTrackAsync(track,buf);}catch(e){}
  toast(`Loaded: ${track.title} — ${bpm} BPM`,'success');
  return track;
}

function isSpotifyTrackUrl(url){return /open\.spotify\.com\/(intl-[\w-]+\/)?track\/[a-zA-Z0-9]+/.test(url);}
function extractSpotifyTrackId(url){const m=url.match(/track\/([a-zA-Z0-9]+)/);return m?m[1]:null;}

async function loadSpotifyUrl(url){
  ensureAudio();
  const status=document.getElementById('urlStatus'),btn=document.getElementById('urlLoad');
  status.className='url-status';status.textContent='SPOTIFY — RESOLVING...';btn.disabled=true;
  try{
    let title='Spotify Track',artist='',artwork='',preview=null;
    try{
      const om=await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
      if(om.ok){
        const j=await om.json();
        if(j.title)title=j.title;
        if(j.thumbnail_url)artwork=j.thumbnail_url;
      }
    }catch(e){}
    if(musicCreds&&musicCreds.spotifyId&&musicCreds.spotifySecret){
      try{
        const id=extractSpotifyTrackId(url);
        if(id){
          status.textContent='SPOTIFY API LOOKUP...';
          const tok=await getSpotifyToken();
          const r=await fetch(`https://api.spotify.com/v1/tracks/${id}`,{headers:{Authorization:'Bearer '+tok}});
          if(r.ok){
            const d=await r.json();
            if(d.name)title=d.name;
            if(d.artists&&d.artists.length)artist=d.artists.map(a=>a.name).join(', ');
            if(d.album&&d.album.images&&d.album.images[0])artwork=d.album.images[0].url;
            if(d.preview_url)preview=d.preview_url;
          }
        }
      }catch(e){console.warn('Spotify API:',e.message);}
    }
    if(!preview){
      status.textContent='SEARCHING ITUNES FALLBACK...';
      const q=encodeURIComponent(`${title} ${artist}`.trim());
      const r=await fetch(`https://itunes.apple.com/search?term=${q}&media=music&limit=5`);
      if(r.ok){
        const j=await r.json();
        const match=(j.results||[]).find(x=>x.previewUrl&&
            (!artist||(x.artistName||'').toLowerCase().includes(artist.toLowerCase().split(',')[0].trim())))
          || (j.results||[]).find(x=>x.previewUrl);
        if(match){
          preview=match.previewUrl;
          title=match.trackName||title;
          artist=match.artistName||artist;
          artwork=(match.artworkUrl100||'').replace('100x100','600x600')||artwork;
        }
      }
    }
    if(!preview)throw new Error('No playable preview — add Spotify credentials in Settings or the track is not on iTunes');
    status.textContent='FETCHING PREVIEW...';
    const r=await fetch(preview);
    if(!r.ok)throw new Error('Preview fetch '+r.status);
    const ab=await r.arrayBuffer();
    const abCopy=ab.slice(0);
    status.textContent='DECODING...';
    const buf=await audioCtx.decodeAudioData(ab);
    status.textContent='ANALYZING...';
    const bpm=await detectBPM(buf);
    const id='sp_'+Date.now();
    const track={id,title,artist:artist||'Unknown',bpm,key:'--',duration:buf.duration,buffer:buf,url:preview,source:'spotify',sourceKind:'spotify',artwork,link:url,rating:0,addedAt:Date.now()};
    if(!library.find(x=>x.id===track.id))library.push(track);
    renderLibrary();saveToDB();
    idbPutAudio(id,abCopy);
    enrichTrackAsync&&enrichTrackAsync(track,buf);
    status.className='url-status success';status.textContent='LOADED ✓';
    document.getElementById('urlInput').value='';
    toast(`Spotify → ${title}${artist?' — '+artist:''}`,'success');
  }catch(err){
    status.className='url-status error';status.textContent='SPOTIFY ERROR';
    toast('Spotify failed: '+err.message,'error');
  }finally{
    btn.disabled=false;
    setTimeout(()=>{status.className='url-status';status.textContent='READY';},5000);
  }
}

async function loadFromURL(url){
  if(isSpotifyTrackUrl(url))return loadSpotifyUrl(url);
  if(typeof extractYouTubeId==='function'&&extractYouTubeId(url)){
    const t=addYouTubeTrack(url);
    if(t){toast('Added YouTube track','success');document.getElementById('urlInput').value='';}
    return;
  }
  ensureAudio();
  const status=document.getElementById('urlStatus'),btn=document.getElementById('urlLoad');
  status.className='url-status';status.textContent='FETCHING...';btn.disabled=true;
  try{
    const resp=await fetch(url);
    if(!resp.ok)throw new Error('Fetch '+resp.status);
    const ab=await resp.arrayBuffer();
    const abCopy=ab.slice(0);
    status.textContent='DECODING...';
    const buf=await audioCtx.decodeAudioData(ab);
    status.textContent='ANALYZING...';
    const bpm=await detectBPM(buf);
    const parts=url.split('/'),fname=decodeURIComponent(parts[parts.length-1].split('?')[0]);
    const title=fname.replace(/\.[^/.]+$/,'')||'Remote Track';
    const track={id:'r_'+Date.now(),title,artist:new URL(url).hostname,bpm,key:'--',duration:buf.duration,buffer:buf,url,source:'url',rating:0,addedAt:Date.now()};
    library.push(track);renderLibrary();saveToDB();
    idbPutAudio(track.id,abCopy);
    enrichTrackAsync(track,buf);
    status.className='url-status success';status.textContent='LOADED ✓';
    document.getElementById('urlInput').value='';
    toast(`Loaded: ${title}`,'success');
  }catch(err){
    status.className='url-status error';
    if(err.message.includes('Fetch')||err.name==='TypeError'){status.textContent='CORS BLOCKED';toast('CORS blocked — try direct audio link or Spotify / YouTube URL','error');}
    else{status.textContent='ERROR';toast('Failed: '+err.message,'error');}
  }finally{btn.disabled=false;setTimeout(()=>{status.className='url-status';status.textContent='READY';},4000);}
}

function extractYouTubeId(url){
  if(/^[\w-]{11}$/.test(url))return url;
  const pats=[/youtube\.com\/watch\?v=([\w-]{11})/,/youtu\.be\/([\w-]{11})/,/youtube\.com\/embed\/([\w-]{11})/,/youtube\.com\/shorts\/([\w-]{11})/];
  for(const p of pats){const m=url.match(p);if(m)return m[1];}
  return null;
}

function addYouTubeTrack(url){
  const id=extractYouTubeId(url);
  if(!id){toast('Invalid YT URL','error');return null;}
  const status=document.getElementById('ytStatus');
  if(status){status.className='url-status';status.textContent='FETCHING...';}
  const track={id:'yt_'+id,ytId:id,title:'YouTube Video',artist:'YouTube',bpm:120,key:'--',duration:0,source:'yt',rating:0,addedAt:Date.now()};
  library.push(track);renderLibrary();saveToDB();
  fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
    .then(r=>r.json())
    .then(data=>{
      track.title=data.title||'YouTube Video';
      track.artist=data.author_name||'YouTube';
      track.thumbnail=data.thumbnail_url;
      renderLibrary();saveToDB();
      if(status){status.className='url-status success';status.textContent='ADDED ✓';}
      document.getElementById('ytInput').value='';
      toast(`YouTube: ${track.title}`,'success');
    })
    .catch(()=>{
      if(status){status.className='url-status success';status.textContent='ADDED';}
      document.getElementById('ytInput').value='';
    });
  setTimeout(()=>{if(status){status.className='url-status';status.textContent='READY';}},4000);
  return track;
}

async function detectBPM(buf){
  if(window._analyzer&&buf){
    try{
      const ch=buf.getChannelData(0);
      const result=await analyzeInWorker(ch.buffer.slice(0),buf.sampleRate,'bpm_'+Date.now()+Math.random());
      return result.bpm||120;
    }catch(e){console.warn('worker bpm failed',e);}
  }
  try{
    const off=new OfflineAudioContext(1,buf.length,buf.sampleRate);
    const src=off.createBufferSource();src.buffer=buf;
    const lp=off.createBiquadFilter();lp.type='lowpass';lp.frequency.value=150;
    src.connect(lp);lp.connect(off.destination);src.start(0);
    const rend=await off.startRendering();
    const data=rend.getChannelData(0),sr=rend.sampleRate;
    let peaks=[],lastPeak=-Infinity;
    const minGap=sr*0.25,thr=0.6;
    for(let i=0;i<data.length;i++){
      if(Math.abs(data[i])>thr&&i-lastPeak>minGap){peaks.push(i);lastPeak=i;}
    }
    if(peaks.length<4)return 120;
    const ints={};
    for(let i=1;i<peaks.length;i++){
      const sec=(peaks[i]-peaks[i-1])/sr;let bpm=Math.round(60/sec);
      while(bpm<70)bpm*=2;while(bpm>180)bpm/=2;bpm=Math.round(bpm);
      ints[bpm]=(ints[bpm]||0)+1;
    }
    let best=120,bc=0;
    for(const[k,v]of Object.entries(ints)){if(v>bc){bc=v;best=Number(k);}}
    return best;
  }catch(e){return 120;}
}

/* LIBRARY */
// ─── Crates (library organisation, mirrors src/core/crate-state.ts) ──
const CRATES_KEY='titan_crates_v1';
let crateState={crates:{},smartCrates:{},tags:{}};
let activeCrateId='__all__';
try{const raw=localStorage.getItem(CRATES_KEY);if(raw){const p=JSON.parse(raw);if(p&&typeof p==='object')crateState={crates:p.crates||{},smartCrates:p.smartCrates||{},tags:p.tags||{}};}}catch(_){}
function _saveCrates(){try{localStorage.setItem(CRATES_KEY,JSON.stringify(crateState));}catch(_){}}
function _newId(){return 'c_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6);}
function _cratesFilterTracks(tracks){
  if(activeCrateId==='__all__')return tracks;
  if(activeCrateId.startsWith('smart:')){
    const sc=crateState.smartCrates[activeCrateId.slice(6)];
    if(!sc)return tracks;
    const now=Date.now();
    return tracks.filter(t=>sc.rules.every(r=>{
      if(r.kind==='bpm-range')return t.bpm>=r.min&&t.bpm<=r.max;
      if(r.kind==='rating-gte')return (t.rating||0)>=r.min;
      if(r.kind==='added-days')return now-t.addedAt<=r.within*86400000;
      if(r.kind==='title-contains')return t.title.toLowerCase().includes(r.query.toLowerCase());
      if(r.kind==='key-is')return r.keys.includes(t.key);
      if(r.kind==='tag'){const tags=crateState.tags[t.id]||t.tags||[];return tags.includes(r.tag);}
      return true;
    })).slice(0,sc.limit||1e9);
  }
  const crate=crateState.crates[activeCrateId];
  if(!crate)return tracks;
  return tracks.filter(t=>crate.trackIds.includes(t.id));
}
function renderCratesBar(){
  const host=document.getElementById('cratesChips');if(!host)return;
  const chips=[];
  for(const id of Object.keys(crateState.crates)){
    const c=crateState.crates[id];
    chips.push(`<button class="crate-chip${activeCrateId===id?' active':''}" data-crate-id="${id}" title="${c.trackIds.length} tracks — right-click to delete" style="padding:4px 10px;background:${activeCrateId===id?'linear-gradient(180deg,var(--orange),#c85a00)':'#1a1a1c'};color:${activeCrateId===id?'#000':'#cfcfd2'};border:1px solid ${activeCrateId===id?'transparent':'#2a2a2e'};border-radius:3px;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;font-weight:700;cursor:pointer">📁 ${escapeHtml(c.name)} <span style="opacity:.6">(${c.trackIds.length})</span></button>`);
  }
  for(const id of Object.keys(crateState.smartCrates)){
    const sc=crateState.smartCrates[id];const key='smart:'+id;
    chips.push(`<button class="crate-chip${activeCrateId===key?' active':''}" data-crate-id="${key}" style="padding:4px 10px;background:${activeCrateId===key?'linear-gradient(180deg,var(--screen-glow),#0088aa)':'#1a1a1c'};color:${activeCrateId===key?'#000':'#7ff0ff'};border:1px solid ${activeCrateId===key?'transparent':'rgba(46,224,255,.3)'};border-radius:3px;font-family:'Orbitron',sans-serif;font-size:10px;letter-spacing:1px;font-weight:700;cursor:pointer">⚡ ${escapeHtml(sc.name)}</button>`);
  }
  host.innerHTML=chips.join('');
  document.querySelectorAll('.crate-chip').forEach(b=>{
    b.addEventListener('click',()=>{activeCrateId=b.dataset.crateId||'__all__';document.querySelectorAll('.crate-chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderLibrary();renderCratesBar();});
    b.addEventListener('contextmenu',e=>{
      e.preventDefault();
      const id=b.dataset.crateId;
      if(!id||id==='__all__')return;
      if(id.startsWith('smart:')){
        if(!confirm('Delete smart crate?'))return;
        delete crateState.smartCrates[id.slice(6)];
      }else{
        if(!confirm('Delete crate "'+(crateState.crates[id]?.name||'')+'"? (Tracks stay in the library.)'))return;
        delete crateState.crates[id];
      }
      if(activeCrateId===id)activeCrateId='__all__';
      _saveCrates();renderCratesBar();renderLibrary();
    });
  });
}
function wireCratesBar(){
  document.getElementById('newCrateBtn')?.addEventListener('click',()=>{
    const name=prompt('Crate name?');if(!name||!name.trim())return;
    const id=_newId();crateState.crates[id]={id,name:name.trim(),trackIds:[],createdAt:Date.now()};
    _saveCrates();renderCratesBar();toast&&toast('Crate created: '+name,'success');
  });
  document.getElementById('smartCrateBtn')?.addEventListener('click',()=>{
    const name=prompt('Smart crate name?','High-energy peak time');if(!name)return;
    const bpmLo=parseFloat(prompt('BPM min?','124')||'0');
    const bpmHi=parseFloat(prompt('BPM max?','132')||'999');
    const ratMin=parseInt(prompt('Minimum rating (0-5)?','4')||'0',10);
    const id=_newId();
    crateState.smartCrates[id]={id,name,rules:[{kind:'bpm-range',min:bpmLo,max:bpmHi},{kind:'rating-gte',min:ratMin}]};
    _saveCrates();renderCratesBar();toast&&toast('Smart crate: '+name,'success');
  });
  document.querySelector('[data-crate-id="__all__"]')?.addEventListener('click',()=>{
    activeCrateId='__all__';
    document.querySelectorAll('.crate-chip').forEach(x=>x.classList.remove('active'));
    document.querySelector('[data-crate-id="__all__"]')?.classList.add('active');
    renderLibrary();
  });
  renderCratesBar();
}
document.addEventListener('DOMContentLoaded',()=>setTimeout(wireCratesBar,500));

// ─── Library state + virtualization ─────────────────────────────────
// At large sizes (5000+ tracks) rendering every row was a multi-hundred-ms
// reflow that locked the main thread on every keystroke in the search box.
// We now keep a filtered "view" array and only mount the rows that fit in
// the visible scroll window, plus a small buffer above/below.
const _libView={tracks:[],rowH:38,overscan:6};
function _libRowHTML(tr,idx){
  const stars=Array.from({length:5},(_,i)=>`<span class="star ${i<(tr.rating||0)?'filled':''}" data-rating="${i+1}">★</span>`).join('');
  const isYt=tr.source==='yt';
  return `<div class="track-row${isYt?' yt-track':''}" draggable="true" data-track-id="${tr.id}" data-idx="${idx}">
    <span class="t-num">${String(idx+1).padStart(2,'0')}</span>
    <span class="t-title">${escapeHtml(tr.title)}${isYt?' 📺':''}</span>
    <span class="t-artist">${escapeHtml(tr.artist)}</span>
    <span class="t-bpm">${(tr.bpm||0).toFixed(1)}</span>
    <span class="t-key">${tr.key}</span>
    <span class="rating" data-track="${tr.id}">${stars}</span>
    <div class="actions" style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap;">
      ${!isYt?`<button class="preview tl-btn" data-preview="${tr.id}" style="padding:5px 8px;background:linear-gradient(180deg,#2a2a2e,#151518);border:1px solid rgba(255,212,0,.35);color:var(--yellow);font-family:Orbitron,sans-serif;font-size:10px;font-weight:800;letter-spacing:1.5px;border-radius:3px;cursor:pointer;">▶ PREV</button>`:''}
      <button class="tl-btn tl-a" data-load="A" data-track="${tr.id}" style="padding:5px 10px;background:linear-gradient(180deg,#2a2a2e,#151518);border:1px solid rgba(46,224,255,.45);color:#2ee0ff;font-family:Orbitron,sans-serif;font-size:10px;font-weight:900;letter-spacing:1.5px;border-radius:3px;cursor:pointer;min-width:42px;">→ A</button>
      <button class="tl-btn tl-b" data-load="B" data-track="${tr.id}" style="padding:5px 10px;background:linear-gradient(180deg,#2a2a2e,#151518);border:1px solid rgba(255,60,120,.45);color:#ff3c78;font-family:Orbitron,sans-serif;font-size:10px;font-weight:900;letter-spacing:1.5px;border-radius:3px;cursor:pointer;min-width:42px;">→ B</button>
      ${!isYt?`<button class="tl-btn tl-c" data-load="C" data-track="${tr.id}" style="padding:5px 10px;background:linear-gradient(180deg,#2a2a2e,#151518);border:1px solid rgba(255,212,0,.45);color:#ffd400;font-family:Orbitron,sans-serif;font-size:10px;font-weight:900;letter-spacing:1.5px;border-radius:3px;cursor:pointer;min-width:42px;">→ C</button>`:''}
      ${!isYt?`<button class="tl-btn tl-d" data-load="D" data-track="${tr.id}" style="padding:5px 10px;background:linear-gradient(180deg,#2a2a2e,#151518);border:1px solid rgba(200,0,255,.45);color:#c800ff;font-family:Orbitron,sans-serif;font-size:10px;font-weight:900;letter-spacing:1.5px;border-radius:3px;cursor:pointer;min-width:42px;">→ D</button>`:''}
      <button class="remove tl-btn" data-remove="${tr.id}" style="padding:5px 8px;background:linear-gradient(180deg,#2a2a2e,#151518);border:1px solid rgba(255,46,46,.35);color:var(--red);font-family:Orbitron,sans-serif;font-size:12px;font-weight:900;border-radius:3px;cursor:pointer;">✕</button>
    </div>
  </div>`;
}

function _libRenderWindow(){
  const list=document.getElementById('trackList');
  if(!list||!list._virt)return;
  const {tracks,rowH,overscan}=_libView;
  const viewport=list.clientHeight||280;
  const total=tracks.length*rowH;
  const scroll=list.scrollTop;
  const first=Math.max(0,Math.floor(scroll/rowH)-overscan);
  const last=Math.min(tracks.length,Math.ceil((scroll+viewport)/rowH)+overscan);
  const before=first*rowH;
  const after=Math.max(0,total-last*rowH);
  let html='';
  for(let i=first;i<last;i++)html+=_libRowHTML(tracks[i],i);
  list._virt.innerHTML=
    `<div style="height:${before}px" aria-hidden="true"></div>`+
    html+
    `<div style="height:${after}px" aria-hidden="true"></div>`;
}

function renderLibrary(){
  const list=document.getElementById('trackList');
  if(!list)return;
  const search=document.getElementById('searchInput').value.toLowerCase();
  const sort=document.getElementById('sortSelect').value;
  const filter=document.getElementById('filterSource').value;
  let tracks=library.filter(t=>{
    const ms=t.title.toLowerCase().includes(search)||t.artist.toLowerCase().includes(search);
    const mf=filter==='all'||t.source===filter;
    return ms&&mf;
  });
  tracks.sort((a,b)=>{
    if(sort==='title')return a.title.localeCompare(b.title);
    if(sort==='artist')return a.artist.localeCompare(b.artist);
    if(sort==='bpm')return b.bpm-a.bpm;
    if(sort==='rating')return(b.rating||0)-(a.rating||0);
    return b.addedAt-a.addedAt;
  });
  // Apply the active crate filter (defined alongside wireCratesBar above)
  if(typeof _cratesFilterTracks==='function')tracks=_cratesFilterTracks(tracks);
  _libView.tracks=tracks;
  // First call: set up the inner wrapper + bind scroll/click/drag delegation
  if(!list._virt){
    list.innerHTML='';
    const inner=document.createElement('div');
    inner.style.minHeight='100%';
    list.appendChild(inner);
    list._virt=inner;
    list.addEventListener('scroll',()=>{
      if(list._raf)return;
      list._raf=requestAnimationFrame(()=>{list._raf=0;_libRenderWindow();});
    },{passive:true});
    // Delegated click — works for virtualized rows since listener is on parent
    list.addEventListener('click',(e)=>{
      const loadBtn=e.target.closest('[data-load]');
      if(loadBtn){
        const t=library.find(x=>x.id===loadBtn.dataset.track);
        if(t)loadTrackToDeck(loadBtn.dataset.load,t);
        return;
      }
      const prevBtn=e.target.closest('[data-preview]');
      if(prevBtn){previewTrack(prevBtn.dataset.preview);return;}
      const remBtn=e.target.closest('[data-remove]');
      if(remBtn){
        const tid=remBtn.dataset.remove;
        idbDelAudio(tid);library=library.filter(t=>t.id!==tid);
        renderLibrary();saveToDB();
        return;
      }
      const star=e.target.closest('.star');
      if(star){
        const r=parseInt(star.dataset.rating);
        const rating=star.closest('.rating');
        const tid=rating?.dataset.track;
        const t=library.find(x=>x.id===tid);
        if(t){t.rating=r;renderLibrary();saveToDB();}
      }
    });
    list.addEventListener('dragstart',e=>{
      const row=e.target.closest('.track-row');
      if(!row)return;
      e.dataTransfer.setData('text/plain',row.dataset.trackId);
      row.classList.add('dragging');
    });
    list.addEventListener('dragend',e=>{
      const row=e.target.closest('.track-row');
      if(row)row.classList.remove('dragging');
    });
  }
  _libRenderWindow();
  const c=document.getElementById('trackCount');if(c)c.textContent=`${library.length} TRACKS`;
  const s=document.getElementById('statLibSize');if(s)s.textContent=library.length;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

let previewSrc=null;
function previewTrack(id){
  ensureAudio();
  const t=library.find(x=>x.id===id);
  if(!t||!t.buffer)return;
  if(previewSrc){try{previewSrc.stop();}catch(e){}previewSrc=null;}
  previewSrc=audioCtx.createBufferSource();previewSrc.buffer=t.buffer;
  const g=audioCtx.createGain();g.gain.value=0.5;
  previewSrc.connect(g);g.connect(audioCtx.destination);
  previewSrc.start(0,Math.min(30,t.duration*0.3));
  setTimeout(()=>{if(previewSrc){try{previewSrc.stop();}catch(e){}previewSrc=null;}},10000);
  toast(`Preview: ${t.title} (10s)`);
}

async function loadTrackToDeck(deckId,track){
  ensureAudio();
  if(track.source==='yt'&&(deckId==='A'||deckId==='B')){
    const d=decks[deckId];d.track=track;d.offset=0;d.cuePoint=0;d.hotCues={};
    const setText=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    setText(`title-${deckId}`,(track.title||'YouTube').toUpperCase());
    setText(`artist-${deckId}`,(track.artist||'YouTube').toUpperCase());
    setText(`centerBpm-${deckId}`,'YT');
    loadYouTubeToDeck(deckId,track);
    toast(`YouTube → Deck ${deckId}: open 🔎 MUSIC tab to view & play`,'success');
    logMix(`Loaded YT "${track.title}" → Deck ${deckId}`);
    return;
  }
  const d=decks[deckId];stopDeck(deckId);
  d.track=track;d.offset=0;d.cuePoint=0;d.hotCues={};
  d.loop={active:false,start:null,end:null,loopInSet:false};
  _libTouch(track);
  if(!track.buffer&&track.source!=='yt'){
    const cached=await idbGetAudio(track.id);
    if(cached){
      try{track.buffer=await audioCtx.decodeAudioData(cached);toast(`Restored from cache: ${track.title}`,'success');}
      catch(e){console.warn('cache decode failed',e);}
    }
  }
  d.buffer=track.buffer||generateBuffer(track);
  const setText=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  setText(`title-${deckId}`,track.title.toUpperCase());
  setText(`artist-${deckId}`,track.artist.toUpperCase());
  setText(`bpm-${deckId}`,track.bpm.toFixed(2));
  setText(`key-${deckId}`,track.key);
  setText(`centerBpm-${deckId}`,track.bpm.toFixed(1));
  {const ndl=document.getElementById(`bpmNeedle-${deckId}`);if(ndl){const clamp=Math.max(60,Math.min(200,track.bpm||0));const ang=-135+((clamp-60)/140)*270;ndl.setAttribute('transform',`rotate(${ang.toFixed(1)} 50 50)`);}}
  setText(`cdTitle-${deckId}`,track.title.toUpperCase());
  setText(`cdBpm-${deckId}`,track.bpm.toFixed(1)+' BPM');
  document.querySelectorAll(`.hot-cues[data-deck="${deckId}"] .cue-btn`).forEach(b=>b.classList.remove('active'));
  try{drawWaveform(deckId,track);drawPhraseMarkers(deckId,track);}catch(e){}
  updateDsbMonitor&&updateDsbMonitor();
  updateMasterBpm();logMix(`Loaded "${track.title}" → Deck ${deckId}`);
  stats.tracksPlayed++;updateStats();
}

function loadYouTubeToDeck(deckId,track){
  const titleEl=document.getElementById(`ytTitle${deckId}`);
  if(titleEl)titleEl.textContent=`${track.title||'YouTube'}`;
  const slot=document.getElementById(`ytPlayer${deckId}`);
  if(!slot){
    console.warn(`ytPlayer${deckId} element missing`);
    toast('YouTube player area missing — open the MUSIC tab once','error');
    return;
  }
  // If API hasn't loaded yet, retry up to ~5s
  if(!window.YT||!window.YT.Player){
    if(!track._ytRetry)track._ytRetry=0;
    if(track._ytRetry<25){
      track._ytRetry++;
      setTimeout(()=>loadYouTubeToDeck(deckId,track),200);
      return;
    }
    toast('YouTube API failed to load','error');return;
  }
  if(ytPlayers[deckId]&&typeof ytPlayers[deckId].loadVideoById==='function'){
    try{ytPlayers[deckId].loadVideoById(track.ytId);}catch(e){console.warn(e);}
    return;
  }
  try{
    ytPlayers[deckId]=new YT.Player(`ytPlayer${deckId}`,{
      videoId:track.ytId,
      width:'100%',height:'100%',
      playerVars:{autoplay:0,controls:1,playsinline:1,modestbranding:1,rel:0},
      events:{
        onReady:e=>{
          try{e.target.setVolume(parseInt(document.getElementById(`ytVol${deckId}`)?.value||'70',10));}catch(_){}
        },
        onStateChange:e=>{
          // 1=playing, 2=paused, 0=ended
          const d=decks[deckId];if(!d)return;
          const playing=e.data===1;
          d.playing=playing;
          document.getElementById(`jog-${deckId}`)?.classList.toggle('playing',playing);
          const pb=document.querySelector(`.big-btn.play[data-deck="${deckId}"]`);
          if(pb)pb.classList.toggle('active',playing);
          const icon=document.getElementById(`playIcon-${deckId}`);
          const lbl=document.getElementById(`playLabel-${deckId}`);
          if(icon)icon.textContent=playing?'⏸':'▶';
          if(lbl)lbl.textContent=playing?'PAUSE':'PLAY';
        },
        onError:err=>{
          console.warn('YT player error',err);
          toast('YouTube playback error (restricted video or network)','error');
        },
      }
    });
  }catch(e){console.warn('YT.Player ctor failed',e);toast('Failed to create YouTube player','error');}
}

/* Deck PLAY/PAUSE should control YouTube player when a YT track is loaded.
   Wrap the existing functions so the normal audio path is skipped for yt. */
(function wrapYouTubeDeckControl(){
  if(window.__ytDeckWrapped)return;window.__ytDeckWrapped=true;
  const origPlay=window.playDeck;
  const origPause=window.pauseDeck;
  const origStop=window.stopDeck;
  const origSeek=window.seekDeck;
  function updateYtBtnState(deckId,playing){
    const btn=document.querySelector(`.big-btn.play[data-deck="${deckId}"]`);
    if(btn)btn.classList.toggle('active',!!playing);
    const icon=document.getElementById(`playIcon-${deckId}`);
    const lbl=document.getElementById(`playLabel-${deckId}`);
    if(icon)icon.textContent=playing?'⏸':'▶';
    if(lbl)lbl.textContent=playing?'PAUSE':'PLAY';
    document.getElementById(`jog-${deckId}`)?.classList.toggle('playing',!!playing);
  }
  if(typeof origPlay==='function'){
    window.playDeck=function(deckId){
      const d=decks[deckId];
      if(d&&d.track&&d.track.source==='yt'){
        const p=ytPlayers[deckId];
        if(p&&typeof p.playVideo==='function'){try{p.playVideo();}catch(_){}}
        else{loadYouTubeToDeck(deckId,d.track);setTimeout(()=>{try{ytPlayers[deckId]&&ytPlayers[deckId].playVideo()}catch(_){}},600)}
        d.playing=true;updateYtBtnState(deckId,true);
        return;
      }
      return origPlay.apply(this,arguments);
    };
  }
  if(typeof origPause==='function'){
    window.pauseDeck=function(deckId){
      const d=decks[deckId];
      if(d&&d.track&&d.track.source==='yt'){
        const p=ytPlayers[deckId];
        if(p&&typeof p.pauseVideo==='function'){try{p.pauseVideo();}catch(_){}}
        d.playing=false;updateYtBtnState(deckId,false);
        return;
      }
      return origPause.apply(this,arguments);
    };
  }
  if(typeof origStop==='function'){
    window.stopDeck=function(deckId){
      const d=decks[deckId];
      if(d&&d.track&&d.track.source==='yt'){
        const p=ytPlayers[deckId];
        if(p){try{p.pauseVideo();p.seekTo(0,true);}catch(_){}}
        d.playing=false;
        document.getElementById(`jog-${deckId}`)?.classList.remove('playing');
        return;
      }
      return origStop.apply(this,arguments);
    };
  }
  if(typeof origSeek==='function'){
    window.seekDeck=function(deckId,sec){
      const d=decks[deckId];
      if(d&&d.track&&d.track.source==='yt'){
        const p=ytPlayers[deckId];
        if(p&&typeof p.seekTo==='function'){try{p.seekTo(sec,true);}catch(_){}}
        return;
      }
      return origSeek.apply(this,arguments);
    };
  }
})();

function drawWaveform(deckId,track){
  const c=document.getElementById(`wave-${deckId}`);if(!c)return;
  const ctx=c.getContext('2d');
  c.width=c.offsetWidth*2;c.height=c.offsetHeight*2;
  const w=c.width,h=c.height;ctx.clearRect(0,0,w,h);
  if(!track.buffer)return;
  const dL=track.buffer.getChannelData(0);
  const dR=track.buffer.numberOfChannels>1?track.buffer.getChannelData(1):dL;
  const bars=Math.floor(w/2),spb=Math.floor(dL.length/bars),bw=w/bars;
  const cy=h/2;
  // Compute peaks + energy for color
  for(let i=0;i<bars;i++){
    let sumL=0,sumR=0,peakL=0,peakR=0,lowEnergy=0,highEnergy=0;
    for(let j=0;j<spb;j++){
      const idx=i*spb+j;
      const vL=Math.abs(dL[idx]||0),vR=Math.abs(dR[idx]||0);
      sumL+=vL;sumR+=vR;
      if(vL>peakL)peakL=vL;if(vR>peakR)peakR=vR;
      // Rough energy bands (lower half of indices = lows approx)
      if(j<spb/3)lowEnergy+=vL;else highEnergy+=vL;
    }
    const ampL=(peakL*0.7+(sumL/spb)*0.6)*2,ampR=(peakR*0.7+(sumR/spb)*0.6)*2;
    const bhL=Math.min(cy*0.95,ampL*cy),bhR=Math.min(cy*0.95,ampR*cy);
    // Color based on frequency content: red=bass, yellow=mid, cyan=high
    const bassRatio=lowEnergy/(lowEnergy+highEnergy+0.001);
    let color;
    if(bassRatio>0.6&&ampL>0.3){color=['#ffd400','#ff7a00','#ff2e2e'];}
    else if(bassRatio>0.4){color=['#ffed00','#ffa500','#ff6600'];}
    else if(ampL>0.2){color=['#00ffff','#00d4ff','#0088ff'];}
    else{color=['#88eeff','#44a8dd','#0066aa'];}
    // Top (L)
    const gradT=ctx.createLinearGradient(0,cy-bhL,0,cy);
    gradT.addColorStop(0,color[0]);gradT.addColorStop(0.5,color[1]);gradT.addColorStop(1,color[2]);
    ctx.fillStyle=gradT;ctx.fillRect(i*bw,cy-bhL,Math.max(1,bw-0.5),bhL);
    // Bottom (R)
    const gradB=ctx.createLinearGradient(0,cy,0,cy+bhR);
    gradB.addColorStop(0,color[2]);gradB.addColorStop(0.5,color[1]);gradB.addColorStop(1,color[0]);
    ctx.fillStyle=gradB;ctx.fillRect(i*bw,cy,Math.max(1,bw-0.5),bhR);
  }
  // Center line
  ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,cy);ctx.lineTo(w,cy);ctx.stroke();
}

function setupWaveformInteraction(){
  ['A','B','C','D'].forEach(deckId=>{
    const wave=document.querySelector(`.waveform:has(#wave-${deckId})`)||document.getElementById(`wave-${deckId}`).parentElement;
    if(!wave)return;
    let wDown=false;
    wave.addEventListener('pointerdown',e=>{
      wDown=true;
      const dk=decks[deckId];if(!dk.track||!dk.buffer)return;
      const r=wave.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width;
      const zoom=dk.waveZoom||1;
      const cur=getCurrentTime(deckId);
      // x=0.5 is the playhead. calculate offset from center
      const centerOffset=(x-0.5)/zoom*dk.buffer.duration;
      const target=Math.max(0,Math.min(dk.buffer.duration-0.5,cur+centerOffset));
      seekDeck(deckId,target);
    });
    wave.addEventListener('wheel',e=>{
      e.preventDefault();
      const dk=decks[deckId];
      const zooms=[1,2,4,8];
      let idx=zooms.indexOf(dk.waveZoom||1);
      if(e.deltaY>0)idx=Math.max(0,idx-1);
      else idx=Math.min(zooms.length-1,idx+1);
      dk.waveZoom=zooms[idx];
      toast(`Wave zoom: ${dk.waveZoom}x`);
    });
  });
}

function drawPhraseMarkers(deckId,track){
  const c=document.getElementById(`phrase-${deckId}`);
  if(!c)return;c.innerHTML='';
  if(!settings.phraseMarkers||!track.duration)return;
  const beatDur=60/track.bpm,phraseDur=beatDur*16;
  const total=Math.floor(track.duration/phraseDur);
  for(let i=1;i<=total;i++){
    const m=document.createElement('div');m.className='phrase-mark';
    m.style.left=`${(i*phraseDur/track.duration)*100}%`;
    c.appendChild(m);
  }
}

/* TRANSPORT */
// ─── Keylock AudioWorklet (granular pitch shifter) ──────────────────────
// Loaded lazily on first use so the import doesn't block boot.
let _titanKeylockReady=null;
async function ensureKeylockWorklet(){
  if(!audioCtx)return false;
  if(_titanKeylockReady)return _titanKeylockReady;
  _titanKeylockReady=audioCtx.audioWorklet.addModule('./titan-keylock-worklet.js').then(()=>true).catch(err=>{
    console.warn('[keylock] worklet failed to load',err);
    _titanKeylockReady=null;
    return false;
  });
  return _titanKeylockReady;
}
function _makeKeylockNode(deck){
  try{
    const n=new AudioWorkletNode(audioCtx,'titan-keylock',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[2]});
    n.parameters.get('pitch').value=1/Math.max(0.5,Math.min(2,deck.playbackRate));
    n.parameters.get('wet').value=deck.keylock?1:0;
    return n;
  }catch(e){console.warn('[keylock] node build failed',e);return null;}
}

function playDeck(deckId){
  const d=decks[deckId];if(!d.buffer||d.playing)return;
  ensureAudio();
  d.source=audioCtx.createBufferSource();
  d.source.buffer=d.buffer;d.source.playbackRate.value=d.playbackRate;
  // When keylock is enabled, route source → keylockNode → trimGain so the
  // granular pitch-shifter can cancel out the speed-induced pitch change.
  // Otherwise we fall back to the original direct connection (still works).
  if(d.keylock){
    ensureKeylockWorklet().then(ok=>{
      if(!ok||!d.source)return;
      try{
        const kn=_makeKeylockNode(d);
        if(!kn)return;
        d.source.disconnect();
        d.source.connect(kn);
        kn.connect(d.trimGain);
        d.keylockNode=kn;
      }catch(e){console.warn('[keylock] re-routing failed, falling back',e);
        try{d.source.connect(d.trimGain);}catch(_){}}
    });
    // Until the worklet loads, keep the dry path live so audio isn't silent.
    d.source.connect(d.trimGain);
  }else{
    d.source.connect(d.trimGain);
  }
  // CRITICAL: zero the gain BEFORE starting the source. WebAudio
  // processes audio in 128-sample chunks; if the source starts even a
  // single chunk before the gain reset takes effect, that chunk plays
  // at whatever gain stopDeck restored on the previous stop — this is
  // exactly the "burst on PLAY" the user heard at fader=0.
  if(d.volumeGain){
    const now0=audioCtx.currentTime;
    d.volumeGain.gain.cancelScheduledValues(now0);
    try{d.volumeGain.gain.value=0;}catch(_){}
    d.volumeGain.gain.setValueAtTime(0,now0);
  }
  d.source.start(0,d.offset);d.startTime=audioCtx.currentTime;d.playing=true;
  if(d.volumeGain){
    // Apply the perceptual taper so play-in matches the fader's current
    // audible position. Up-ramp over 25 ms — long enough to avoid any
    // click/transient when audio comes in, short enough to feel instant.
    const rawV=(d.volume!==undefined)?d.volume:0;
    const target=(typeof _djFaderTaper==='function')?_djFaderTaper(rawV):rawV;
    const now=audioCtx.currentTime;
    if(target<=0){
      d.volumeGain.gain.setValueAtTime(0,now+0.025);
    }else{
      d.volumeGain.gain.setValueAtTime(0,now);
      d.volumeGain.gain.linearRampToValueAtTime(target,now+0.025);
    }
  }
  if(deckId==='A'||deckId==='B'){
    document.getElementById(`jog-${deckId}`)?.classList.add('playing');
    document.getElementById(`platter-${deckId}`)?.classList.add('spinning');
    const btn=document.querySelector(`.big-btn.play[data-deck="${deckId}"]`);
    if(btn)btn.classList.add('active');
    const icon=document.getElementById(`playIcon-${deckId}`);
    if(icon)icon.textContent='❚❚';
    const lbl=document.getElementById(`playLabel-${deckId}`);
    if(lbl)lbl.textContent='PAUSE';
  }else{
    const btn=document.querySelector(`.compact-btn.play[data-deck="${deckId}"]`);
    if(btn){btn.classList.add('active');btn.textContent='❚❚ PAUSE';}
  }
  d.source.onended=()=>{
    if(d.playing){
      d.playing=false;
      if(deckId==='A'||deckId==='B'){
        document.getElementById(`jog-${deckId}`)?.classList.remove('playing');
        document.getElementById(`platter-${deckId}`)?.classList.remove('spinning');
        const btn=document.querySelector(`.big-btn.play[data-deck="${deckId}"]`);
        if(btn)btn.classList.remove('active');
        const icon=document.getElementById(`playIcon-${deckId}`);if(icon)icon.textContent='▶';
        const lbl=document.getElementById(`playLabel-${deckId}`);if(lbl)lbl.textContent='PLAY';
      }else{
        const btn=document.querySelector(`.compact-btn.play[data-deck="${deckId}"]`);
        if(btn){btn.classList.remove('active');btn.textContent='▶ PLAY';}
      }
    }
  };
}

function pauseDeck(deckId){
  const d=decks[deckId];if(!d.playing||!d.source)return;
  d.offset=getCurrentTime(deckId);
  const src=d.source;
  if(d.volumeGain&&audioCtx){
    const now=audioCtx.currentTime;
    const cur=d.volumeGain.gain.value;
    d.volumeGain.gain.cancelScheduledValues(now);
    d.volumeGain.gain.setValueAtTime(cur,now);
    d.volumeGain.gain.linearRampToValueAtTime(0,now+0.006);
    setTimeout(()=>{try{src.stop();src.disconnect();}catch(e){}if(d.source===src)d.source=null;const raw=(d.volume!==undefined)?d.volume:0;const restore=(typeof _djFaderTaper==='function')?_djFaderTaper(raw):raw;d.volumeGain.gain.setValueAtTime(restore,audioCtx.currentTime);},12);
  }else{
    try{d.source.stop();}catch(e){}
    d.source.disconnect();
  }
  d.source=null;d.playing=false;
  if(deckId==='A'||deckId==='B'){
    document.getElementById(`jog-${deckId}`)?.classList.remove('playing');
    document.getElementById(`platter-${deckId}`)?.classList.remove('spinning');
    const btn=document.querySelector(`.big-btn.play[data-deck="${deckId}"]`);
    if(btn)btn.classList.remove('active');
    const icon=document.getElementById(`playIcon-${deckId}`);if(icon)icon.textContent='▶';
    const lbl=document.getElementById(`playLabel-${deckId}`);if(lbl)lbl.textContent='PLAY';
  }else{
    const btn=document.querySelector(`.compact-btn.play[data-deck="${deckId}"]`);
    if(btn){btn.classList.remove('active');btn.textContent='▶ PLAY';}
  }
}

function stopDeck(deckId){pauseDeck(deckId);decks[deckId].offset=0;}
function togglePlay(deckId){
  const d=decks[deckId];if(!d.track)return;
  if(d.playing)pauseDeck(deckId);
  else{playDeck(deckId);logMix(`Play Deck ${deckId}`);}
}
function cueDeck(deckId){
  const d=decks[deckId];if(!d.track)return;
  if(d.playing){
    seekDeck(deckId,d.cuePoint);
    pauseDeck(deckId);
  }else{
    const cur=getCurrentTime(deckId);
    if(Math.abs(cur-d.cuePoint)>0.05){d.cuePoint=cur;toast(`Cue set: ${fmtTime(d.cuePoint)}`);}
    else{seekDeck(deckId,d.cuePoint);}
  }
}
function cuePressDown(deckId){
  const d=decks[deckId];if(!d.track||d.playing)return;
  const cur=getCurrentTime(deckId);
  if(Math.abs(cur-d.cuePoint)<=0.05){d._cuePreview=true;playDeck(deckId);}
}
function cuePressUp(deckId){
  const d=decks[deckId];if(!d._cuePreview)return;
  d._cuePreview=false;
  pauseDeck(deckId);
  seekDeck(deckId,d.cuePoint);
}
function getCurrentTime(deckId){
  const d=decks[deckId];
  if(d.playing)return d.offset+(audioCtx.currentTime-d.startTime)*d.playbackRate;
  return d.offset;
}
function seekDeck(deckId,sec){
  const d=decks[deckId],was=d.playing;
  if(was)pauseDeck(deckId);
  d.offset=Math.max(0,Math.min(sec,d.buffer?d.buffer.duration:0));
  if(was)playDeck(deckId);
}

function setTempo(deckId,pct){
  const d=decks[deckId];d.tempo=pct;
  const was=d.playing,pos=getCurrentTime(deckId);
  if(was)pauseDeck(deckId);
  d.playbackRate=(1+pct/100)*(d.rpmScale||1);d.offset=pos;
  if(was)playDeck(deckId);
  // If the deck has a live keylock worklet, update its pitch inversion
  // so the harmonic content stays at the original pitch. 1/r cancels the
  // speed-induced shift.
  if(d.keylockNode&&d.keylockNode.parameters){
    try{d.keylockNode.parameters.get('pitch').setTargetAtTime(1/Math.max(0.5,Math.min(2,d.playbackRate)),audioCtx.currentTime,0.02);}catch(_){}
  }
  const valStr=`${pct>=0?'+':''}${pct.toFixed(2)}%`;
  const tv=document.getElementById(`tempoVal-${deckId}`);if(tv)tv.textContent=valStr;
  const bigEl=document.getElementById(`tempoBig-${deckId}`);
  if(bigEl)bigEl.textContent=valStr;
  if(d.track){
    const nb=d.track.bpm*(1+pct/100);
    const bpmEl=document.getElementById(`bpm-${deckId}`);if(bpmEl)bpmEl.textContent=nb.toFixed(2);
    const cbEl=document.getElementById(`centerBpm-${deckId}`);if(cbEl)cbEl.textContent=nb.toFixed(1);
    const ndl=document.getElementById(`bpmNeedle-${deckId}`);
    if(ndl){const clamp=Math.max(60,Math.min(200,nb));const ang=-135+((clamp-60)/140)*270;ndl.setAttribute('transform',`rotate(${ang.toFixed(1)} 50 50)`);}
    const cdBpm=document.getElementById(`cdBpm-${deckId}`);if(cdBpm)cdBpm.textContent=nb.toFixed(1)+' BPM';
  }
  updateMasterBpm();
}

// Live-toggle the keylock wet/dry mix when the user clicks the KEY button
// on an already-playing deck. Called from the util-btn click handler.
function updateKeylockWet(deckId){
  const d=decks[deckId];
  if(!d||!d.keylockNode)return;
  try{
    const wet=d.keylock?1:0;
    d.keylockNode.parameters.get('wet').setTargetAtTime(wet,audioCtx.currentTime,0.02);
  }catch(_){}
}

/* Tempo step state per deck */
const tempoStep={A:0.1,B:0.1,C:0.1,D:0.1};
function adjustTempo(deckId,direction,big){
  const d=decks[deckId];
  const step=big?1.0:tempoStep[deckId];
  let pct=(d.tempo||0)+direction*step;
  const r=d.tempoRange||8;
  pct=Math.max(-r,Math.min(r,pct));
  setTempo(deckId,Math.round(pct*100)/100);
}
function nudgeTempo(deckId){
  const d=decks[deckId];
  if(!d.playing)return;
  d.offset=getCurrentTime(deckId)+0.05;
}

function updateMasterBpm(){
  let bpm=0;
  for(const d of ['A','B','C','D']){
    if(decks[d].track&&decks[d].playing){bpm=decks[d].track.bpm*(1+decks[d].tempo/100);break;}
  }
  if(!bpm){
    for(const d of ['A','B','C','D']){
      if(decks[d].track){bpm=decks[d].track.bpm*(1+decks[d].tempo/100);break;}
    }
  }
  document.getElementById('masterBpm').textContent=bpm?bpm.toFixed(2):'---.--';
  applySceneFx();
}

function syncDeck(deckId){
  const d=decks[deckId];
  if(!d.track){toast('No track loaded','error');return false;}
  // Find best source: any playing deck other than this one, or first loaded
  let o=null,oId=null;
  for(const id of ['A','B','C','D']){
    if(id===deckId)continue;
    if(decks[id].track&&decks[id].playing){o=decks[id];oId=id;break;}
  }
  if(!o){
    for(const id of ['A','B','C','D']){
      if(id===deckId)continue;
      if(decks[id].track){o=decks[id];oId=id;break;}
    }
  }
  if(!o){toast('No other deck with track','error');return false;}
  const tb=o.track.bpm*(1+o.tempo/100);
  const pct=((tb/d.track.bpm)-1)*100;
  if(Math.abs(pct)>(d.tempoRange||8)){toast(`Out of range (${pct.toFixed(1)}%)`,'error');return false;}
  setTempo(deckId,pct);
  // ─── Phase-aware alignment ───
  // Port of beat-math.ts phaseOffsetSeconds — snap self's downbeat to other's.
  // Only applied if the source deck is actually playing AND we have an anchor
  // (cuePoint is used as the grid-1 anchor; if beatgrid is present, prefer it).
  let phaseAligned=false;
  if(o.playing&&d.buffer){
    const anchor=(x)=>(x.beatgrid&&x.beatgrid.origin!=null)?x.beatgrid.origin:(x.cuePoint||0);
    const bpm=d.track.bpm*(1+pct/100);
    const oBpm=o.track.bpm*(1+o.tempo/100);
    const beatsPerBar=4;
    const selfBar=60/bpm*beatsPerBar;
    const othBar=60/oBpm*beatsPerBar;
    const selfPhase=(((getCurrentTime(deckId)-anchor(d))%selfBar)+selfBar)%selfBar/selfBar;
    const othPhase=(((getCurrentTime(oId)-anchor(o))%othBar)+othBar)%othBar/othBar;
    let diff=selfPhase-othPhase;
    if(diff>0.5)diff-=1;
    if(diff<-0.5)diff+=1;
    const offsetSec=diff*selfBar;
    // Only nudge when the drift is audible (>10ms) but not huge (<1 bar)
    if(Math.abs(offsetSec)>0.010&&Math.abs(offsetSec)<selfBar*0.75){
      seekDeck(deckId,Math.max(0,getCurrentTime(deckId)-offsetSec));
      phaseAligned=true;
    }
  }
  toast(`Synced ${deckId} → ${tb.toFixed(2)} BPM${phaseAligned?' · phase-locked':''}`,'success');
  return true;
}

/* LOOP */
function _setReloopBtn(d,active){
  const b=document.querySelector(`.loop-btn[data-action="reloop"][data-deck="${d}"]`);
  if(b)b.classList.toggle('active',!!active);
}
function setLoopIn(d){const dk=decks[d];if(!dk.track)return;dk.loop.start=getCurrentTime(d);dk.loop.loopInSet=true;dk.loop.active=false;_setReloopBtn(d,false);toast(`Loop IN: ${fmtTime(dk.loop.start)}`);}
function setLoopOut(d){const dk=decks[d];if(!dk.loop.loopInSet)return;dk.loop.end=getCurrentTime(d);if(dk.loop.end<=dk.loop.start)return;dk.loop.active=true;_setReloopBtn(d,true);toast(`Loop: ${fmtTime(dk.loop.start)}→${fmtTime(dk.loop.end)}`);}
function toggleReloop(d){const dk=decks[d];if(!dk.loop.start||!dk.loop.end)return;dk.loop.active=!dk.loop.active;_setReloopBtn(d,dk.loop.active);if(dk.loop.active)seekDeck(d,dk.loop.start);}
function setAutoLoop(d,beats){const dk=decks[d];if(!dk.track)return;const bd=60/(dk.track.bpm*(1+dk.tempo/100)),pos=getCurrentTime(d);dk.loop.start=pos;dk.loop.end=pos+beats*bd;dk.loop.active=true;dk.loop.loopInSet=true;_setReloopBtn(d,true);toast(`Auto loop: ${beats} beats`);}
function beatJump(d,beats){const dk=decks[d];if(!dk.track)return;const bd=60/(dk.track.bpm*(1+dk.tempo/100));seekDeck(d,getCurrentTime(d)+beats*bd);}

/* ============ PAD MODES ============ */
const PAD_LOOP_SIZES=[0.0625,0.125,0.25,0.5,1,2,4,8]; // 1/16 to 8 beats
const PAD_ROLL_SIZES=[0.0625,0.125,0.25,0.5,1,2,4,8];
const PAD_PITCH_SEMITONES=[-12,-7,-5,-3,0,3,5,7]; // -12st to +7st

function triggerPad(deckId,padNum){
  const dk=decks[deckId];if(!dk.track)return;
  const mode=dk.padMode||'cue';
  if(mode==='cue')triggerHotCue(deckId,padNum);
  else if(mode==='roll')triggerBeatRoll(deckId,padNum);
  else if(mode==='slicer')triggerSlicer(deckId,padNum);
  else if(mode==='sampler'){triggerSample(padNum-1);}
  else if(mode==='loop')triggerLoopPad(deckId,padNum);
  else if(mode==='pitch')triggerPitchPad(deckId,padNum);
}

function triggerHotCue(deckId,n){
  const dk=decks[deckId];
  const btn=document.querySelector(`.hot-cues[data-deck="${deckId}"] .cue-btn[data-cue="${n}"]`);
  if(dk.hotCues[n]!==undefined){
    // Shift-click = remove the cue (clear). Same-spot click (already at
    // the cue, not playing) also clears — matches the user mental model
    // of 'click CUE again to cancel'.
    const cur=getCurrentTime(deckId);
    const atCue=Math.abs(cur-dk.hotCues[n])<0.12;
    const forceClear=(window.event&&window.event.shiftKey)||(atCue&&!dk.playing);
    if(forceClear){
      delete dk.hotCues[n];
      if(btn){btn.classList.remove('active');btn.classList.remove('armed')}
      if(typeof toast==='function')toast(`Cleared hot cue ${n} · Deck ${deckId}`,'warn');
      return;
    }
    seekDeck(deckId,dk.hotCues[n]);
  }else{
    dk.hotCues[n]=getCurrentTime(deckId);
    if(btn)btn.classList.add('active');
  }
  stats.cueCount++;const el=document.getElementById('statCueCount');if(el)el.textContent=stats.cueCount;
}

let beatRollState={};
function triggerBeatRoll(deckId,n){
  const dk=decks[deckId];if(!dk.track)return;
  const beats=PAD_ROLL_SIZES[n-1];
  const bd=60/(dk.track.bpm*(1+dk.tempo/100));
  const startPos=getCurrentTime(deckId);
  // Save return point if first press
  if(!beatRollState[deckId]){
    beatRollState[deckId]={returnPos:startPos,startTime:audioCtx.currentTime};
  }
  dk.loop.start=startPos;dk.loop.end=startPos+beats*bd;dk.loop.active=true;dk.loop.loopInSet=true;
  const btn=document.querySelector(`.hot-cues[data-deck="${deckId}"] .cue-btn[data-cue="${n}"]`);
  if(btn)btn.classList.add('active');
  toast(`Roll ${beats < 1 ? '1/'+Math.round(1/beats) : beats} beats`);
}
function releaseBeatRoll(deckId){
  const dk=decks[deckId];
  if(!beatRollState[deckId])return;
  dk.loop.active=false;
  // Calculate proper slip-return position
  const elapsed=audioCtx.currentTime-beatRollState[deckId].startTime;
  const properPos=beatRollState[deckId].returnPos+elapsed*dk.playbackRate;
  if(dk.slip)seekDeck(deckId,Math.min(properPos,dk.buffer.duration-0.5));
  delete beatRollState[deckId];
  // Always clear the roll highlight, then re-add .active only for pads that
  // still have a saved hot-cue. Previously a saved cue at a rolled pad would
  // keep it lit across mode switches.
  document.querySelectorAll(`.hot-cues[data-deck="${deckId}"] .cue-btn`).forEach(b=>{
    b.classList.remove('active');
    const n=parseInt(b.dataset.cue);
    if(dk.hotCues[n]!==undefined&&dk.padMode==='hotcue')b.classList.add('active');
  });
}

function triggerSlicer(deckId,n){
  const dk=decks[deckId];if(!dk.track)return;
  // Slicer: divide current 8-beat phrase into 8 slices
  const bd=60/(dk.track.bpm*(1+dk.tempo/100));
  const pos=getCurrentTime(deckId);
  const phraseStart=Math.floor(pos/(bd*8))*bd*8;
  const targetPos=phraseStart+(n-1)*bd;
  seekDeck(deckId,targetPos);
  const btn=document.querySelector(`.hot-cues[data-deck="${deckId}"] .cue-btn[data-cue="${n}"]`);
  if(btn){
    clearTimeout(btn._slicerTimer);
    btn.classList.add('active');
    btn._slicerTimer=setTimeout(()=>btn.classList.remove('active'),200);
  }
}

function triggerLoopPad(deckId,n){
  const dk=decks[deckId];if(!dk.track)return;
  const beats=PAD_LOOP_SIZES[n-1];
  const bd=60/(dk.track.bpm*(1+dk.tempo/100)),pos=getCurrentTime(deckId);
  dk.loop.start=pos;dk.loop.end=pos+beats*bd;dk.loop.active=true;dk.loop.loopInSet=true;
  const btn=document.querySelector(`.hot-cues[data-deck="${deckId}"] .cue-btn[data-cue="${n}"]`);
  if(btn){
    document.querySelectorAll(`.hot-cues[data-deck="${deckId}"] .cue-btn`).forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
  toast(`Loop ${beats<1?'1/'+Math.round(1/beats):beats} beats`);
}

function triggerPitchPad(deckId,n){
  const dk=decks[deckId];if(!dk.track)return;
  const semi=PAD_PITCH_SEMITONES[n-1];
  const rate=Math.pow(2,semi/12);
  dk.playbackRate=rate;
  if(dk.source)dk.source.playbackRate.value=rate;
  const btn=document.querySelector(`.hot-cues[data-deck="${deckId}"] .cue-btn[data-cue="${n}"]`);
  if(btn){
    document.querySelectorAll(`.hot-cues[data-deck="${deckId}"] .cue-btn`).forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  }
  toast(`Pitch: ${semi>=0?'+':''}${semi} semitones`);
}

function setPadMode(deckId,mode){
  decks[deckId].padMode=mode;
  document.querySelectorAll(`.pad-mode-btn[data-deck="${deckId}"]`).forEach(b=>{
    b.classList.toggle('active',b.dataset.padMode===mode);
  });
  // Clear visual state of pads
  document.querySelectorAll(`.hot-cues[data-deck="${deckId}"] .cue-btn`).forEach(b=>{
    const n=parseInt(b.dataset.cue);
    if(mode==='cue'){
      b.classList.toggle('active',decks[deckId].hotCues[n]!==undefined);
      b.textContent=n;
    }else if(mode==='roll'){
      b.classList.remove('active');
      const beats=PAD_ROLL_SIZES[n-1];
      b.textContent=beats<1?'1/'+Math.round(1/beats):beats;
    }else if(mode==='slicer'){
      b.classList.remove('active');
      b.textContent=n;
    }else if(mode==='sampler'){
      b.classList.remove('active');
      b.textContent=(samples[n-1]?samples[n-1].name.substr(0,3):'—');
    }else if(mode==='loop'){
      b.classList.remove('active');
      const beats=PAD_LOOP_SIZES[n-1];
      b.textContent=beats<1?'1/'+Math.round(1/beats):beats;
    }else if(mode==='pitch'){
      b.classList.remove('active');
      const semi=PAD_PITCH_SEMITONES[n-1];
      b.textContent=(semi>=0?'+':'')+semi;
    }
  });
  toast(`Deck ${deckId} → ${mode.toUpperCase()} mode`);
}

/* SAMPLER */
/* PRO SAMPLER ENGINE — banks, per-pad params, FX chain, choke, step seq */
let samplerBank=0;let samplerSelected=null;
const samplerBanks=[new Array(16).fill(null),new Array(16).fill(null),new Array(16).fill(null),new Array(16).fill(null)];
const samplerSeq=[new Array(16).fill(null),new Array(16).fill(null),new Array(16).fill(null),new Array(16).fill(null)]; // each pad has steps[16]
const samplerActive=new Map(); // map padIdx → active source for choke
const SE_DEFAULTS={gain:0.8,pitch:0,pan:0,fadeIn:0,fadeOut:50,filterType:'off',filterFreq:5000,delay:0,feedback:0.35,choke:0,loop:false,reverse:false,sync:false};
function getCurBank(){return samplerBanks[samplerBank];}
function getCurSeq(){return samplerSeq[samplerBank];}
function _ensurePadDefaults(p){if(!p.params)p.params={...SE_DEFAULTS};return p;}

function renderSampler(){
  const g=document.getElementById('samplerGrid');if(!g)return;g.innerHTML='';
  if(typeof samples!=='undefined'&&samples&&samples.some(Boolean)&&!samplerBanks[0].some(Boolean)){
    samples.forEach((s,i)=>{if(s)samplerBanks[0][i]=_ensurePadDefaults({...s});});
  }
  const bank=getCurBank();
  for(let i=0;i<16;i++){
    const p=document.createElement('div');
    p.className='sample-pad'+(bank[i]?' loaded':'')+(samplerSelected===i?' selected':'');
    p.dataset.color=i;p.dataset.pad=i;
    const params=bank[i]?.params||{};
    p.innerHTML=`<div class="pad-num">${i+1}</div><div class="pad-name">${bank[i]?escapeHtml(bank[i].name):'EMPTY'}</div>
      ${params.choke?`<span class="pad-fx">CH${params.choke}</span>`:''}
      ${params.loop?'<span class="pad-loop">⟳</span>':''}
      ${params.reverse?'<span class="pad-rev">◄◄</span>':''}`;
    p.addEventListener('click',(e)=>{if(e.shiftKey){selectSamplerPad(i);return;}triggerSample(i);selectSamplerPad(i);});
    p.addEventListener('contextmenu',e=>{e.preventDefault();clearSample(i);});
    p.addEventListener('dragover',e=>{e.preventDefault();p.style.borderColor='var(--orange)';});
    p.addEventListener('dragleave',()=>{p.style.borderColor='';});
    p.addEventListener('drop',async e=>{
      e.preventDefault();p.style.borderColor='';
      const tid=e.dataTransfer.getData('text/plain');
      if(tid){const t=library.find(x=>x.id===tid);if(t&&t.buffer){bank[i]=_ensurePadDefaults({buffer:t.buffer,name:t.title});renderSampler();saveToDB();}}
      else if(e.dataTransfer.files.length){
        for(const f of e.dataTransfer.files){
          if(!f.type.startsWith('audio/')&&!/\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(f.name))continue;
          ensureAudio();
          const ab=await f.arrayBuffer(),buf=await audioCtx.decodeAudioData(ab);
          bank[i]=_ensurePadDefaults({buffer:buf,name:f.name.replace(/\.[^/.]+$/,'')});
          renderSampler();saveToDB();break;
        }
      }
    });
    g.appendChild(p);
  }
  if(samplerSelected!=null)renderSampleEditor();
  renderSampleSeq();
}

function selectSamplerPad(i){
  samplerSelected=i;renderSampler();renderSampleEditor();renderSampleSeq();
}
function renderSampleEditor(){
  const i=samplerSelected;const bank=getCurBank();
  const lbl=document.getElementById('seEditingPad');
  if(i==null||!bank[i]){if(lbl)lbl.textContent='— select a pad —';return;}
  const s=bank[i];const p=s.params||(s.params={...SE_DEFAULTS});
  lbl.textContent=`#${i+1} · ${s.name}`;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
  set('seGain',Math.round(p.gain*100));set('sePitch',p.pitch);set('sePan',Math.round(p.pan*100));
  set('seFadeIn',p.fadeIn);set('seFadeOut',p.fadeOut);set('seFilterType',p.filterType);set('seFilterFreq',p.filterFreq);
  set('seDelay',p.delay);set('seFeedback',Math.round(p.feedback*100));set('seChoke',p.choke);
  document.getElementById('seLoop').checked=p.loop;
  document.getElementById('seReverse').checked=p.reverse;
  document.getElementById('seSync').checked=p.sync;
  document.getElementById('seGainVal').textContent=Math.round(p.gain*100)+'%';
  document.getElementById('sePitchVal').textContent=(p.pitch>=0?'+':'')+p.pitch+' st';
  document.getElementById('sePanVal').textContent=p.pan===0?'CTR':p.pan<0?'L'+Math.abs(p.pan*100).toFixed(0):'R'+(p.pan*100).toFixed(0);
  document.getElementById('seFadeInVal').textContent=p.fadeIn+'ms';
  document.getElementById('seFadeOutVal').textContent=p.fadeOut+'ms';
  document.getElementById('seFilterFreqVal').textContent=p.filterFreq>=1000?(p.filterFreq/1000).toFixed(1)+'kHz':p.filterFreq+'Hz';
  document.getElementById('seDelayVal').textContent=p.delay===0?'OFF':p.delay+'ms';
  document.getElementById('seFeedbackVal').textContent=Math.round(p.feedback*100)+'%';
}
function renderSampleSeq(){
  const row=document.getElementById('seqRow');if(!row)return;
  const seq=getCurSeq();const i=samplerSelected;
  document.getElementById('seqEditingPad').textContent=i!=null?`pad #${i+1}`:'select a pad';
  if(i==null){row.innerHTML='';return;}
  const steps=seq[i]||(seq[i]=new Array(16).fill(false));
  row.innerHTML=Array.from({length:16},(_,k)=>`<div class="seq-step ${steps[k]?'on':''} ${k%4===0?'beat':''}" data-step="${k}">${k+1}</div>`).join('');
  row.querySelectorAll('[data-step]').forEach(el=>{
    el.addEventListener('click',()=>{const k=parseInt(el.dataset.step);steps[k]=!steps[k];el.classList.toggle('on',steps[k]);saveToDB();});
  });
  const bpm=parseFloat(document.getElementById('masterBpm')?.textContent)||128;
  const bpmEl=document.getElementById('seqBpm');if(bpmEl)bpmEl.textContent=isFinite(bpm)?bpm.toFixed(0):'128';
}

function triggerSample(idx,velocity=1){
  const bank=getCurBank();const s=bank[idx];if(!s||!s.buffer)return;
  ensureAudio();if(!audioCtx)return;
  const p=s.params||(s.params={...SE_DEFAULTS});
  // Choke handling
  if(p.choke){
    samplerActive.forEach((arr,k)=>{
      const o=bank[k]?.params;if(o&&o.choke===p.choke&&k!==idx){
        try{arr.src.stop();arr.src.disconnect();}catch(e){}
        samplerActive.delete(k);
      }
    });
  }
  // Reverse
  let buf=s.buffer;
  if(p.reverse&&!s._reversedBuf){
    const rev=audioCtx.createBuffer(buf.numberOfChannels,buf.length,buf.sampleRate);
    for(let c=0;c<buf.numberOfChannels;c++){const src=buf.getChannelData(c);const dst=rev.getChannelData(c);for(let j=0;j<src.length;j++)dst[j]=src[src.length-1-j];}
    s._reversedBuf=rev;
  }
  if(p.reverse)buf=s._reversedBuf;
  const src=audioCtx.createBufferSource();src.buffer=buf;
  src.playbackRate.value=Math.pow(2,p.pitch/12);
  src.loop=p.loop;
  const gNode=audioCtx.createGain();
  const targetGain=p.gain*velocity;
  const t0=audioCtx.currentTime;
  if(p.fadeIn>0){gNode.gain.setValueAtTime(0,t0);gNode.gain.linearRampToValueAtTime(targetGain,t0+p.fadeIn/1000);}
  else{gNode.gain.setValueAtTime(targetGain,t0);}
  const panner=audioCtx.createStereoPanner();panner.pan.value=p.pan;
  let chain=src;chain.connect(gNode);
  let last=gNode;
  if(p.filterType&&p.filterType!=='off'){
    const f=audioCtx.createBiquadFilter();f.type=p.filterType;f.frequency.value=p.filterFreq;f.Q.value=1;
    last.connect(f);last=f;
  }
  last.connect(panner);
  if(p.delay>0){
    const dly=audioCtx.createDelay(2);dly.delayTime.value=Math.max(0,Math.min(2,(p.delay||0)/1000));
    const fb=audioCtx.createGain();fb.gain.value=Math.max(0,Math.min(0.95,Number(p.feedback)||0));
    const wet=audioCtx.createGain();wet.gain.value=.6;
    panner.connect(dly);dly.connect(fb);fb.connect(dly);dly.connect(wet);wet.connect(masterGain);
  }
  panner.connect(masterGain);
  src.start();
  samplerActive.set(idx,{src});
  src.onended=()=>{samplerActive.delete(idx);};
  // Auto fade out near end (non-loop)
  if(!p.loop&&p.fadeOut>0){
    const dur=buf.duration/(src.playbackRate.value||1);
    const stop=t0+dur;
    gNode.gain.setValueAtTime(targetGain,Math.max(t0,stop-p.fadeOut/1000));
    gNode.gain.linearRampToValueAtTime(0,stop);
  }
  const padEl=document.querySelector(`.sample-pad[data-pad="${idx}"]`);
  if(padEl){
    padEl.classList.add('playing');
    // Clear on real end of playback (including ramp-out), with a safety ceiling.
    const clear=()=>padEl.classList.remove('playing');
    try{src.addEventListener('ended',clear,{once:true});}catch(_){}
    setTimeout(clear,Math.max(200,Math.min(buf.duration*1000+p.fadeOut,15000)));
  }
}
function clearSample(idx){
  const bank=getCurBank();bank[idx]=null;
  const seq=getCurSeq();seq[idx]=null;
  const a=samplerActive.get(idx);if(a){try{a.src.stop();}catch(e){}samplerActive.delete(idx);}
  renderSampler();saveToDB();
}
function clearBank(){
  const bank=getCurBank();const seq=getCurSeq();
  for(let i=0;i<16;i++){bank[i]=null;seq[i]=null;}
  samplerActive.forEach(a=>{try{a.src.stop();}catch(e){}});samplerActive.clear();
  samplerSelected=null;renderSampler();saveToDB();toast('Bank cleared','success');
}

/* ===== FACTORY SAMPLES — 4 banks × 16 pads = 64 built-in sounds =====
   Bank A: DRUMS  ·  Bank B: BASS  ·  Bank C: SYNTH & FX  ·  Bank D: LOOPS & VOX
   All synthesized into AudioBuffers at runtime so the app ships no audio files.
   ==================================================================== */
function _spBufRender(seconds,render){
  const sr=audioCtx.sampleRate;
  const len=Math.max(1,Math.floor(sr*seconds));
  const b=audioCtx.createBuffer(1,len,sr);
  const d=b.getChannelData(0);
  render(d,sr,len);
  const fade=Math.min(len,Math.floor(sr*0.006));
  for(let i=0;i<fade;i++)d[len-1-i]*=(i/fade);
  return b;
}
const _spVoices={
  // ---- DRUMS ----
  kick808:()=>_spBufRender(0.55,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=55*Math.exp(-t*8)+32;d[i]=Math.sin(2*Math.PI*f*t)*Math.exp(-t*3.2)*0.95}}),
  kickHouse:()=>_spBufRender(0.28,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=150*Math.exp(-t*30)+55;d[i]=Math.sin(2*Math.PI*f*t)*Math.exp(-t*13)*0.92;if(t<0.003)d[i]+=(Math.random()*2-1)*0.6}}),
  snare:()=>_spBufRender(0.25,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const tone=Math.sin(2*Math.PI*190*t)+0.3*Math.sin(2*Math.PI*265*t);const nz=Math.random()*2-1;d[i]=tone*Math.exp(-t*16)*0.4+nz*Math.exp(-t*9)*0.52}}),
  clap:()=>_spBufRender(0.32,(d,sr,n)=>{const bursts=[0,0.012,0.025,0.040];for(let i=0;i<n;i++){const t=i/sr;const nz=Math.random()*2-1;let env=0;bursts.forEach(b=>{const dt=t-b;if(dt>=0)env+=Math.exp(-dt*38)});env=Math.min(env,1.1);d[i]=nz*env*0.55}}),
  hatClosed:()=>_spBufRender(0.06,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.random()*2-1)*Math.exp(-t*85)*0.42}}),
  hatOpen:()=>_spBufRender(0.38,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.random()*2-1)*Math.exp(-t*6.5)*0.38}}),
  ride:()=>_spBufRender(0.85,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const tone=Math.sin(2*Math.PI*3500*t)+Math.sin(2*Math.PI*5200*t)*0.5;d[i]=(Math.random()*2-1)*0.55+tone*0.12;d[i]*=Math.exp(-t*2.8)*0.35}}),
  crash:()=>_spBufRender(1.7,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.random()*2-1)*Math.exp(-t*2.1)*0.42}}),
  tomHi:()=>_spBufRender(0.32,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=230*Math.exp(-t*6.5)+160;d[i]=Math.sin(2*Math.PI*f*t)*Math.exp(-t*7)*0.75}}),
  tomLow:()=>_spBufRender(0.38,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=110*Math.exp(-t*6)+75;d[i]=Math.sin(2*Math.PI*f*t)*Math.exp(-t*6.5)*0.8}}),
  rim:()=>_spBufRender(0.08,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const tone=Math.sin(2*Math.PI*1700*t);const click=Math.random()*2-1;d[i]=(tone*0.7+click*0.5)*Math.exp(-t*48)*0.55}}),
  cowbell:()=>_spBufRender(0.42,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const tone=Math.sin(2*Math.PI*540*t)+Math.sin(2*Math.PI*800*t)*0.8;d[i]=tone*Math.exp(-t*4.6)*0.26}}),
  conga:()=>_spBufRender(0.3,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=260*Math.exp(-t*10)+180;d[i]=Math.sin(2*Math.PI*f*t)*Math.exp(-t*9)*0.56}}),
  shaker:()=>_spBufRender(0.1,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const env=Math.exp(-t*42)*Math.min(1,t*60);d[i]=(Math.random()*2-1)*env*0.32}}),
  percHi:()=>_spBufRender(0.18,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=Math.sin(2*Math.PI*1100*t)*Math.exp(-t*22)*0.5}}),
  percLow:()=>_spBufRender(0.22,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=Math.sin(2*Math.PI*420*t)*Math.exp(-t*18)*0.55}}),
  // ---- BASS (chromatic C1..D#2) ----
  bass:midi=>{const f=440*Math.pow(2,(midi-69)/12);return _spBufRender(0.7,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const saw=2*(t*f-Math.floor(t*f+0.5));const sub=Math.sin(2*Math.PI*f*0.5*t);const env=Math.min(1,t*80)*Math.exp(-t*3.2);d[i]=(saw*0.55+sub*0.5)*env*0.7}})},
  // ---- SYNTH & FX ----
  stab:()=>_spBufRender(0.4,(d,sr,n)=>{const r=220,chord=[r,r*Math.pow(2,3/12),r*Math.pow(2,7/12),r*Math.pow(2,10/12)];for(let i=0;i<n;i++){const t=i/sr;let v=0;chord.forEach(f=>{v+=2*(t*f-Math.floor(t*f+0.5))});v/=chord.length;d[i]=v*Math.exp(-t*6)*Math.min(1,t*80)*0.55}}),
  lead:f=>_spBufRender(0.55,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=2*(t*f-Math.floor(t*f+0.5))*Math.exp(-t*3)*Math.min(1,t*80)*0.55}}),
  pluck:f=>_spBufRender(0.4,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const v=Math.sin(2*Math.PI*f*t)+Math.sin(2*Math.PI*f*2*t)*0.3;d[i]=v*Math.exp(-t*12)*0.48}}),
  chord:()=>_spBufRender(1.4,(d,sr,n)=>{const base=220,freqs=[base,base*Math.pow(2,3/12),base*Math.pow(2,7/12)];for(let i=0;i<n;i++){const t=i/sr;let v=0;freqs.forEach(f=>{v+=Math.sin(2*Math.PI*f*t)+2*(t*f*2-Math.floor(t*f*2+0.5))*0.15});v/=freqs.length;d[i]=v*Math.exp(-t*1.5)*Math.min(1,t*4)*0.5}}),
  sub:()=>_spBufRender(0.9,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=50;d[i]=Math.sin(2*Math.PI*f*t)*Math.exp(-t*1.5)*Math.min(1,t*20)*0.95}}),
  laser:()=>_spBufRender(0.35,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=2000*Math.exp(-t*6)+200;d[i]=Math.sin(2*Math.PI*f*t)*Math.exp(-t*4)*0.5}}),
  zap:()=>_spBufRender(0.22,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=800*Math.exp(-t*10)+100;d[i]=2*(t*f-Math.floor(t*f+0.5))*Math.exp(-t*10)*0.55}}),
  sweepUp:()=>_spBufRender(1.2,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=100*Math.pow(16,t/1.2);const nz=Math.random()*2-1;d[i]=(nz*0.45+Math.sin(2*Math.PI*f*t)*0.32)*(t/1.2)*0.5}}),
  sweepDn:()=>_spBufRender(1.2,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=1600*Math.exp(-t*2.2);const nz=Math.random()*2-1;d[i]=(nz*0.4+Math.sin(2*Math.PI*f*t)*0.3)*(1-t/1.2)*0.5}}),
  noiseUp:()=>_spBufRender(1.5,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.random()*2-1)*(t/1.5)*0.5}}),
  pad:()=>_spBufRender(2.0,(d,sr,n)=>{const freqs=[220,261.63,329.63,440];for(let i=0;i<n;i++){const t=i/sr;let v=0;freqs.forEach((f,j)=>{v+=Math.sin(2*Math.PI*f*t)*(1-j*0.12)});v/=freqs.length;d[i]=v*Math.min(1,t*1.6)*Math.exp(-t*0.9)*0.48}}),
  bell:()=>_spBufRender(1.3,(d,sr,n)=>{const f=880;for(let i=0;i<n;i++){const t=i/sr;const v=Math.sin(2*Math.PI*f*t)+Math.sin(2*Math.PI*f*2*t)*0.5+Math.sin(2*Math.PI*f*3*t)*0.25;d[i]=v*Math.exp(-t*1.9)*0.32}}),
  sqrLead:f=>_spBufRender(0.4,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const v=Math.sin(2*Math.PI*f*t)>0?1:-1;d[i]=v*Math.exp(-t*5)*0.45}}),
  sawLead:f=>_spBufRender(0.4,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=2*(t*f-Math.floor(t*f+0.5))*Math.exp(-t*4)*0.5}}),
  blip:()=>_spBufRender(0.08,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=Math.sin(2*Math.PI*1200*t)*Math.exp(-t*40)*0.5}}),
  whoosh:()=>_spBufRender(0.9,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;d[i]=(Math.random()*2-1)*Math.exp(-Math.pow((t-0.45)*3.6,2))*0.55}}),
  // ---- LOOPS & VOX ----
  horn:base=>_spBufRender(0.45,(d,sr,n)=>{const freqs=[base,base*Math.pow(2,4/12),base*Math.pow(2,7/12)];for(let i=0;i<n;i++){const t=i/sr;let v=0;freqs.forEach(f=>{v+=2*(t*f-Math.floor(t*f+0.5))+Math.sin(2*Math.PI*f*t)*0.3});v/=freqs.length;d[i]=v*Math.min(1,t*120)*Math.exp(-t*3.5)*0.58}}),
  hit:()=>_spBufRender(0.7,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=60*Math.exp(-t*4)+30;d[i]=(Math.sin(2*Math.PI*f*t)*0.65+(Math.random()*2-1)*0.28)*Math.exp(-t*3)}}),
  rumble:()=>_spBufRender(1.4,(d,sr,n)=>{let p=0;for(let i=0;i<n;i++){const t=i/sr;p=p*0.985+(Math.random()*2-1)*0.015;d[i]=p*Math.exp(-t*1.1)*4.5}}),
  kickLoop:()=>{const bpm=128,step=60/bpm,dur=step*4;return _spBufRender(dur,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const local=t%step;const f=150*Math.exp(-local*28)+55;d[i]=Math.sin(2*Math.PI*f*local)*Math.exp(-local*13)*0.85}})},
  percLoop:()=>{const bpm=128,step=60/bpm/4,dur=step*16;return _spBufRender(dur,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const idx=Math.floor(t/step);const local=t-idx*step;const hit=[0,3,5,9,11,13].includes(idx%16);const f=200+((idx*7)%11)*30;d[i]=hit?Math.sin(2*Math.PI*f*local)*Math.exp(-local*25)*0.42:0}})},
  hatLoop:()=>{const bpm=128,beat=60/bpm,half=beat/2,dur=beat*4;return _spBufRender(dur,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const halfIdx=Math.floor(t/half);const local=t-halfIdx*half;d[i]=(halfIdx%2===1)?(Math.random()*2-1)*Math.exp(-local*65)*0.5:0}})},
  vox1:()=>_spBufRender(0.35,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=440+Math.sin(2*Math.PI*6*t)*40;d[i]=(2*(t*f-Math.floor(t*f+0.5))*0.5+(Math.random()*2-1)*0.15)*Math.exp(-t*3.5)*Math.min(1,t*25)*0.55}}),
  vox2:()=>_spBufRender(0.4,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=660+Math.sin(2*Math.PI*8*t)*50;d[i]=(Math.sin(2*Math.PI*f*t)*0.5+2*(t*f-Math.floor(t*f+0.5))*0.35)*Math.exp(-t*3)*Math.min(1,t*30)*0.55}}),
  airhorn:()=>_spBufRender(0.6,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=330+Math.sin(2*Math.PI*12*t)*8;const v=2*(t*f-Math.floor(t*f+0.5))+2*(t*f*1.5-Math.floor(t*f*1.5+0.5))*0.6;d[i]=v*Math.min(1,t*20)*Math.exp(-t*1.5)*0.45}}),
  siren:()=>_spBufRender(1.2,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=500+Math.sin(2*Math.PI*1.6*t)*200;d[i]=Math.sin(2*Math.PI*f*t)*0.45*Math.min(1,t*6)}}),
  scratch:()=>_spBufRender(0.35,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const ph=t<0.15?t/0.15:1-(t-0.15)/0.2;const f=300+ph*1400;d[i]=(Math.sin(2*Math.PI*f*t)*0.5+(Math.random()*2-1)*0.2)*Math.min(1,t*20)*Math.exp(-Math.max(0,t-0.25)*20)*0.55}}),
  vinylCrackle:()=>_spBufRender(1.5,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const crackle=Math.random()<0.003?(Math.random()*2-1):0;d[i]=crackle*Math.exp(-t*0.5)*0.7}}),
  fxDrop:()=>_spBufRender(0.8,(d,sr,n)=>{for(let i=0;i<n;i++){const t=i/sr;const f=800*Math.exp(-t*5);d[i]=(Math.sin(2*Math.PI*f*t)*0.6+(Math.random()*2-1)*Math.exp(-t*2)*0.3)*0.55}}),
};

/* Fill ALL four banks with the factory set */
function loadDefaultSamples(){
  ensureAudio();if(!audioCtx)return;
  const DRUMS=[
    ['KICK 808',_spVoices.kick808],['KICK',_spVoices.kickHouse],['SNARE',_spVoices.snare],['CLAP',_spVoices.clap],
    ['HAT',_spVoices.hatClosed],['OPEN HAT',_spVoices.hatOpen],['RIDE',_spVoices.ride],['CRASH',_spVoices.crash],
    ['TOM HI',_spVoices.tomHi],['TOM LO',_spVoices.tomLow],['RIM',_spVoices.rim],['COWBELL',_spVoices.cowbell],
    ['CONGA',_spVoices.conga],['SHAKER',_spVoices.shaker],['PERC HI',_spVoices.percHi],['PERC LO',_spVoices.percLow],
  ];
  const BASS_MIDI=[24,26,28,29,31,33,35,36,38,40,41,43,45,47,48,50]; // C1..D3
  const NOTE=m=>{const N=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];return N[m%12]+Math.floor(m/12-1)};
  const BASS=BASS_MIDI.map(m=>[`BASS ${NOTE(m)}`,()=>_spVoices.bass(m)]);
  const FX=[
    ['STAB',_spVoices.stab],['LEAD A',()=>_spVoices.lead(440)],['PLUCK',()=>_spVoices.pluck(587)],['CHORD',_spVoices.chord],
    ['SUB',_spVoices.sub],['LASER',_spVoices.laser],['ZAP',_spVoices.zap],['SWEEP UP',_spVoices.sweepUp],
    ['SWEEP DN',_spVoices.sweepDn],['NOISE UP',_spVoices.noiseUp],['PAD',_spVoices.pad],['BELL',_spVoices.bell],
    ['SQR LEAD',()=>_spVoices.sqrLead(440)],['SAW LEAD',()=>_spVoices.sawLead(660)],['BLIP',_spVoices.blip],['WHOOSH',_spVoices.whoosh],
  ];
  const LOOPS=[
    ['HORN LO',()=>_spVoices.horn(220)],['HORN MID',()=>_spVoices.horn(277)],['HORN HI',()=>_spVoices.horn(330)],['HIT',_spVoices.hit],
    ['KICK LOOP',_spVoices.kickLoop],['PERC LOOP',_spVoices.percLoop],['HAT LOOP',_spVoices.hatLoop],['RUMBLE',_spVoices.rumble],
    ['VOX 1',_spVoices.vox1],['VOX 2',_spVoices.vox2],['AIRHORN',_spVoices.airhorn],['SIREN',_spVoices.siren],
    ['SCRATCH',_spVoices.scratch],['CRACKLE',_spVoices.vinylCrackle],['DROP',_spVoices.fxDrop],['LASER 2',_spVoices.laser],
  ];
  const banks=[DRUMS,BASS,FX,LOOPS];
  banks.forEach((set,bi)=>{
    set.forEach(([name,gen],i)=>{
      try{samplerBanks[bi][i]=_ensurePadDefaults({buffer:gen(),name})}
      catch(e){console.warn('sample gen failed',name,e)}
    });
  });
  renderSampler();saveToDB();toast('64 factory sounds loaded: DRUMS · BASS · FX · LOOPS','success');
}

/* Step Sequencer scheduler */
let _seqRunning=false;let _seqTimer=null;let _seqStep=0;
function seqStart(){
  if(_seqRunning)return;_seqRunning=true;_seqStep=0;
  document.getElementById('seqPlayBtn').textContent='⏸ STOP';
  schedSeq();
}
function seqStop(){
  _seqRunning=false;if(_seqTimer)clearTimeout(_seqTimer);_seqTimer=null;
  document.getElementById('seqPlayBtn').textContent='▶ PLAY';
  document.querySelectorAll('.seq-step.cur').forEach(el=>el.classList.remove('cur'));
}
function schedSeq(){
  if(!_seqRunning)return;
  ensureAudio();
  const bpm=parseFloat(document.getElementById('masterBpm')?.textContent)||128;
  const div=parseFloat(document.getElementById('seqDiv')?.value||0.5);
  const stepMs=(60000/bpm)*div;
  const seq=getCurSeq();
  for(let i=0;i<16;i++){
    if(seq[i]&&seq[i][_seqStep])triggerSample(i);
  }
  document.querySelectorAll('.seq-step').forEach(el=>el.classList.remove('cur'));
  document.querySelector(`.seq-step[data-step="${_seqStep}"]`)?.classList.add('cur');
  _seqStep=(_seqStep+1)%16;
  _seqTimer=setTimeout(schedSeq,stepMs);
}

/* Record from master to selected pad */
let _padRec=null;
async function recordToPad(){
  if(samplerSelected==null){toast('Shift+click a pad to select first','error');return;}
  if(!window.recordDestination){toast('Audio not initialised','error');return;}
  if(_padRec){_padRec.stop();return;}
  toast('Recording 4s to pad…','success');
  const chunks=[];
  const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
  _padRec=new MediaRecorder(recordDestination.stream,{mimeType:mime});
  _padRec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
  _padRec.onstop=async()=>{
    _padRec=null;
    const blob=new Blob(chunks,{type:mime});
    const ab=await blob.arrayBuffer();
    try{
      const buf=await audioCtx.decodeAudioData(ab);
      const bank=getCurBank();
      bank[samplerSelected]=_ensurePadDefaults({buffer:buf,name:`REC ${samplerSelected+1}`});
      renderSampler();saveToDB();toast('Recorded to pad','success');
    }catch(e){toast('Decode failed: '+e.message,'error');}
  };
  _padRec.start();
  setTimeout(()=>{if(_padRec)_padRec.stop();},4000);
}

/* Sampler edit panel wiring */
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    const bind=(id,key,xform=v=>v)=>{
      const el=document.getElementById(id);if(!el)return;
      el.addEventListener('input',()=>{
        const i=samplerSelected;if(i==null)return;
        const bank=getCurBank();if(!bank[i])return;
        const p=bank[i].params||(bank[i].params={...SE_DEFAULTS});
        let v=el.type==='checkbox'?el.checked:(isNaN(parseFloat(el.value))?el.value:parseFloat(el.value));
        p[key]=xform(v);
        if(key==='reverse')bank[i]._reversedBuf=null;
        renderSampleEditor();renderSampler();saveToDB();
      });
    };
    bind('seGain','gain',v=>v/100);
    bind('sePitch','pitch');
    bind('sePan','pan',v=>v/100);
    bind('seFadeIn','fadeIn');
    bind('seFadeOut','fadeOut');
    bind('seFilterType','filterType');
    bind('seFilterFreq','filterFreq');
    bind('seDelay','delay');
    bind('seFeedback','feedback',v=>v/100);
    bind('seChoke','choke',v=>parseInt(v));
    bind('seLoop','loop');
    bind('seReverse','reverse');
    bind('seSync','sync');
    document.querySelectorAll('.bank-btn').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.bank-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');samplerBank=parseInt(b.dataset.bank);samplerSelected=null;renderSampler();
    }));
    document.getElementById('seqPlayBtn')?.addEventListener('click',()=>{if(_seqRunning)seqStop();else seqStart();});
    document.getElementById('seqClearBtn')?.addEventListener('click',()=>{
      const seq=getCurSeq();const i=samplerSelected;if(i==null)return;
      seq[i]=new Array(16).fill(false);renderSampleSeq();saveToDB();
    });
    document.getElementById('sampleClearAll')?.addEventListener('click',clearBank);
    document.getElementById('sampleRecordBtn')?.addEventListener('click',recordToPad);
  },400);
});

/* legacy loadDefaultSamples removed — the 4-bank factory above supersedes it */

/* PLAYLISTS */
function renderPlaylists(){
  const g=document.getElementById('playlistGrid');g.innerHTML='';
  if(!playlists.length)g.innerHTML='<div style="color:var(--text-dim);font-family:Share Tech Mono,monospace;font-size:12px;padding:20px;">No playlists yet. Click NEW PLAYLIST.</div>';
  playlists.forEach((pl,idx)=>{
    const tracks=pl.trackIds.map(id=>library.find(t=>t.id===id)).filter(Boolean);
    const totalSec=tracks.reduce((s,t)=>s+(t.duration||0),0);
    const totalMin=Math.floor(totalSec/60),totalRest=Math.round(totalSec%60);
    const dur=`${totalMin}:${String(totalRest).padStart(2,'0')}`;
    const avgBpm=tracks.length?Math.round(tracks.reduce((s,t)=>s+(t.bpm||0),0)/tracks.length):0;
    const c=document.createElement('div');c.className='playlist-card';
    c.innerHTML=`<h4>${escapeHtml(pl.name)}</h4>
      <div class="pl-meta"><strong>${pl.trackIds.length}</strong> tracks · <strong>${dur}</strong> · avg <strong>${avgBpm||'--'}</strong> BPM</div>
      <div class="pl-actions">
        <button class="pl-ai" data-pl-aiplay="${idx}" title="Play full playlist with AI auto-mix">🤖 PLAY AI</button>
        <button data-pl-queue="${idx}">QUEUE A</button>
        <button data-pl-queueb="${idx}">QUEUE B</button>
        <button data-pl-rename="${idx}">RENAME</button>
        <button data-pl-delete="${idx}">DEL</button>
      </div>`;
    g.appendChild(c);
  });
  g.querySelectorAll('[data-pl-aiplay]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    const idx=parseInt(b.dataset.plAiplay);
    if(typeof startAIPlaylistAutoMix==='function')startAIPlaylistAutoMix(idx);
  }));
  if(typeof refreshAIPlaylistSelect==='function')refreshAIPlaylistSelect();
  document.getElementById('playlistCount').textContent=playlists.length;
  g.querySelectorAll('[data-pl-queue]').forEach(b=>b.addEventListener('click',()=>{
    const pl=playlists[parseInt(b.dataset.plQueue)];
    const first=pl.trackIds.map(id=>library.find(t=>t.id===id)).find(t=>t&&t.source!=='yt');
    if(first){loadTrackToDeck('A',first);toast(`Loaded "${first.title}" → Deck A`,'success');}
    else toast('No playable tracks in playlist','error');
  }));
  g.querySelectorAll('[data-pl-queueb]').forEach(b=>b.addEventListener('click',()=>{
    const pl=playlists[parseInt(b.dataset.plQueueb)];
    const first=pl.trackIds.map(id=>library.find(t=>t.id===id)).find(t=>t&&t.source!=='yt');
    if(first){loadTrackToDeck('B',first);toast(`Loaded "${first.title}" → Deck B`,'success');}
    else toast('No playable tracks in playlist','error');
  }));
  g.querySelectorAll('[data-pl-delete]').forEach(b=>b.addEventListener('click',()=>{
    playlists.splice(parseInt(b.dataset.plDelete),1);renderPlaylists();saveToDB();
  }));
  g.querySelectorAll('[data-pl-rename]').forEach(b=>b.addEventListener('click',()=>{
    const idx=parseInt(b.dataset.plRename);
    showModal('Rename Playlist',`<input type="text" id="plRenameInput" value="${escapeHtml(playlists[idx].name)}" />`,()=>{
      const nm=document.getElementById('plRenameInput').value.trim();
      if(nm){playlists[idx].name=nm;renderPlaylists();saveToDB();}
    });
  }));
}

function createPlaylist(name){
  playlists.push({name,createdAt:Date.now(),trackIds:[]});
  renderPlaylists();saveToDB();
  toast(`Created "${name}" — drag tracks from library to add`,'success');
}

/* AI DJ */
function aiLog(msg){
  const log=document.getElementById('aiLog');
  const e=document.createElement('div');e.className='ai-log-entry recent';
  e.textContent=`[${new Date().toLocaleTimeString()}] ${msg}`;
  log.appendChild(e);log.scrollTop=log.scrollHeight;
  setTimeout(()=>e.classList.remove('recent'),2000);
  while(log.children.length>100)log.removeChild(log.firstChild);
}

function startAIDJ(){
  if(aiDJ.active){stopAIDJ();return;}
  if(!library.filter(t=>t.source!=='yt').length){toast('Load tracks first','error');return;}
  aiDJ.active=true;
  document.getElementById('aiStatus')?.classList.add('active');
  if(document.getElementById('aiStatusText'))document.getElementById('aiStatusText').textContent='ACTIVE — AUTO-MIXING';
  document.getElementById('aiStartBtn')?.classList.add('active');
  if(document.getElementById('aiStartBtn'))document.getElementById('aiStartBtn').textContent='⏹ STOP AUTO-MIX';
  aiLog('AI Auto-Mix started');
  if(!decks.A.playing&&!decks.B.playing){
    const t=pickNextTrack();
    if(t){loadTrackToDeck('A',t);setTimeout(()=>{playDeck('A');aiLog(`Started: ${t.title}`);},800);}
  }
  scheduleAITransition();
}

function stopAIDJ(){
  aiDJ.active=false;
  document.getElementById('aiStatus')?.classList.remove('active');
  if(document.getElementById('aiStatusText'))document.getElementById('aiStatusText').textContent='INACTIVE';
  document.getElementById('aiStartBtn')?.classList.remove('active');
  if(document.getElementById('aiStartBtn'))document.getElementById('aiStartBtn').textContent='▶ START AUTO-MIX';
  if(aiDJ.transitionTimer){clearTimeout(aiDJ.transitionTimer);aiDJ.transitionTimer=null;}
  aiLog('AI stopped');
}

function pickNextTrack(){
  const cands=library.filter(t=>t.source!=='yt'&&t.buffer);
  if(!cands.length)return null;
  aiDJ.style=document.getElementById('aiStyle').value;
  aiDJ.transLen=parseInt(document.getElementById('aiTransLen').value);
  aiDJ.bpmTol=parseFloat(document.getElementById('aiBpmTol').value);
  aiDJ.order=document.getElementById('aiOrder').value;
  if(aiDJ.order==='random')return cands[Math.floor(Math.random()*cands.length)];
  const cur=decks.A.playing?decks.A:decks.B.playing?decks.B:null;
  if(!cur||!cur.track)return cands[0];
  const cbpm=cur.track.bpm,tol=aiDJ.bpmTol/100;
  let filtered=cands.filter(t=>{if(t.id===cur.track.id)return false;const d=Math.abs(t.bpm-cbpm)/cbpm;return d<=tol;});
  if(!filtered.length)filtered=cands.filter(t=>t.id!==cur.track.id);
  if(!filtered.length)return null;
  if(aiDJ.order==='bpm-progressive'){filtered.sort((a,b)=>a.bpm-b.bpm);return filtered.find(t=>t.bpm>=cbpm)||filtered[0];}
  return filtered[Math.floor(Math.random()*filtered.length)];
}

function scheduleAITransition(){
  if(!aiDJ.active)return;
  const cur=decks.A.playing?'A':decks.B.playing?'B':null;
  if(!cur){aiDJ.transitionTimer=setTimeout(scheduleAITransition,3000);return;}
  const d=decks[cur];if(!d.track)return;
  const rem=d.track.duration-getCurrentTime(cur);
  const bd=60/(d.track.bpm*(1+d.tempo/100));
  const transDur=bd*aiDJ.transLen;
  const ms=Math.max(100,(rem-transDur)*1000);
  aiLog(`Next transition in ${Math.round(ms/1000)}s`);
  aiDJ.transitionTimer=setTimeout(()=>performAITransition(cur),ms);
}

function performAITransition(from){
  if(!aiDJ.active)return;
  const to=from==='A'?'B':'A';
  const nt=pickNextTrack();
  if(!nt){aiLog('No next track');stopAIDJ();return;}
  aiLog(`Transitioning ${from}→${to}: ${nt.title}`);
  loadTrackToDeck(to,nt);
  setTimeout(()=>{
    syncDeck(to);playDeck(to);
    const d=aiDJ.transLen*(60/(decks[from].track.bpm*(1+decks[from].tempo/100)));
    fadeCrossfader(from==='A'?1:0,d*1000);
    setTimeout(()=>{pauseDeck(from);aiLog(`Now on Deck ${to}`);scheduleAITransition();},d*1000+500);
  },800);
}

function fadeCrossfader(target,dur){
  const start=mixerState.crossfader,t0=performance.now();
  function step(){
    const el=performance.now()-t0,t=Math.min(1,el/dur);
    mixerState.crossfader=start+(target-start)*t;
    document.getElementById('xfaderHandle').style.left=`${mixerState.crossfader*100}%`;
    applyCrossfader();
    if(t<1)requestAnimationFrame(step);
  }
  step();
}

/* YOUTUBE */
function setupYouTubeControls(){
  document.querySelectorAll('[data-yt-deck]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const d=btn.dataset.ytDeck,a=btn.dataset.ytAction,p=ytPlayers[d];
      if(!p)return;
      if(a==='play')p.playVideo();if(a==='pause')p.pauseVideo();
    });
  });
  ['A','B'].forEach(d=>{
    document.getElementById(`ytVol${d}`).addEventListener('input',e=>{
      if(ytPlayers[d])ytPlayers[d].setVolume(parseInt(e.target.value));
    });
  });
  document.getElementById('ytBigLoad').addEventListener('click',()=>{
    const url=document.getElementById('ytBigInput').value.trim();
    if(!url)return;
    const id=extractYouTubeId(url);
    if(!id){toast('Invalid URL','error');return;}
    let t=library.find(x=>x.ytId===id);
    if(!t)t=addYouTubeTrack(url);
    if(t)loadTrackToDeck('A',t);
    document.getElementById('ytBigInput').value='';
  });
}
window.onYouTubeIframeAPIReady=function(){setupYouTubeControls();};

/* MIDI */
async function connectMIDI(){
  if(!navigator.requestMIDIAccess){toast('MIDI not supported','error');return;}
  try{
    midiAccess=await navigator.requestMIDIAccess();
    rescanMIDIDevices();
    // Hot-plug: browser fires 'statechange' when a device connects or disconnects
    midiAccess.onstatechange=e=>{
      rescanMIDIDevices();
      if(e&&e.port){
        const name=e.port.name||'Device';
        if(e.port.state==='connected')toast(`MIDI plugged: ${name}`,'success');
        else toast(`MIDI unplugged: ${name}`);
      }
    };
    toast(`MIDI: ${midiDevices.length} device(s)`,'success');
  }catch(e){toast('MIDI denied','error');}
}

function rescanMIDIDevices(){
  if(!midiAccess)return;
  midiDevices=[];
  midiAccess.inputs.forEach(inp=>{
    if(inp.state!=='connected')return;
    midiDevices.push(inp);
    inp.onmidimessage=handleMIDI;
  });
  renderMIDIDevices();
  updateMidiStatusChip();
}

function renderMIDIDevices(){
  const el=document.getElementById('midiDevices');
  if(!el)return;
  if(!midiDevices.length){
    el.innerHTML='<div style="color:var(--text-dim);text-align:center;padding:20px;font-family:\'Share Tech Mono\',monospace;font-size:11px">No devices connected</div>';
    return;
  }
  el.innerHTML=midiDevices.map(d=>{
    const mfg=d.manufacturer?`<span style="color:var(--text-dim);font-size:9px;margin-left:8px">${d.manufacturer}</span>`:'';
    return `<div class="midi-device"><span>${d.name||'Unknown'}${mfg}</span><span class="status">● CONNECTED</span></div>`;
  }).join('');
}

function updateMidiStatusChip(){
  const chip=document.getElementById('midiStatusChip');if(!chip)return;
  const n=midiDevices.length;
  if(n){chip.textContent=`● ${n} connected`;chip.style.color='var(--play-green)';chip.style.borderColor='var(--play-green)';}
  else{chip.textContent='● disconnected';chip.style.color='var(--text-dim)';chip.style.borderColor='#333';}
}

/* Controller presets — pre-built mapping tables.
   Keys are `${type}_${channel}_${cc_or_note}` in hex, matching handleMIDI. */
const MIDI_PRESETS={
  // Minimal generic 2-deck layout: CC 1-8 = deck A/B EQs + vol; notes 36-43 = hot cues A.
  generic:{
    'b0_0_1':{target:'knob:low-A',label:'Deck A Low'},
    'b0_0_2':{target:'knob:mid-A',label:'Deck A Mid'},
    'b0_0_3':{target:'knob:hi-A',label:'Deck A Hi'},
    'b0_0_4':{target:'fader:A',label:'Deck A Volume'},
    'b0_0_5':{target:'knob:low-B',label:'Deck B Low'},
    'b0_0_6':{target:'knob:mid-B',label:'Deck B Mid'},
    'b0_0_7':{target:'knob:hi-B',label:'Deck B Hi'},
    'b0_0_8':{target:'fader:B',label:'Deck B Volume'},
    'b0_0_9':{target:'crossfader',label:'Crossfader'},
    '90_0_24':{target:'btn:.big-btn.play[data-deck="A"]',label:'Deck A PLAY'},
    '90_0_25':{target:'btn:.big-btn.cue[data-deck="A"]',label:'Deck A CUE'},
    '90_1_24':{target:'btn:.big-btn.play[data-deck="B"]',label:'Deck B PLAY'},
    '90_1_25':{target:'btn:.big-btn.cue[data-deck="B"]',label:'Deck B CUE'},
  },
  // Pioneer DDJ-400 standard HID/MIDI map (simplified — covers main bindings)
  ddj400:{
    'b0_0_11':{target:'fader:A',label:'Deck A Volume'},
    'b0_1_11':{target:'fader:B',label:'Deck B Volume'},
    'b0_6_31':{target:'crossfader',label:'Crossfader'},
    'b0_0_7':{target:'knob:low-A',label:'Deck A EQ Low'},
    'b0_0_11':{target:'knob:mid-A',label:'Deck A EQ Mid'},
    'b0_0_15':{target:'knob:hi-A',label:'Deck A EQ Hi'},
    'b0_1_7':{target:'knob:low-B',label:'Deck B EQ Low'},
    'b0_1_11':{target:'knob:mid-B',label:'Deck B EQ Mid'},
    'b0_1_15':{target:'knob:hi-B',label:'Deck B EQ Hi'},
    '90_0_11':{target:'btn:.big-btn.play[data-deck="A"]',label:'Deck A PLAY'},
    '90_0_12':{target:'btn:.big-btn.cue[data-deck="A"]',label:'Deck A CUE'},
    '90_1_11':{target:'btn:.big-btn.play[data-deck="B"]',label:'Deck B PLAY'},
    '90_1_12':{target:'btn:.big-btn.cue[data-deck="B"]',label:'Deck B CUE'},
    // Hot cues A (pads 1-8 on performance)
    '97_0_0':{target:'btn:.hot-cues[data-deck="A"] .cue-btn[data-cue="1"]',label:'Deck A Cue 1'},
    '97_0_1':{target:'btn:.hot-cues[data-deck="A"] .cue-btn[data-cue="2"]',label:'Deck A Cue 2'},
    '97_0_2':{target:'btn:.hot-cues[data-deck="A"] .cue-btn[data-cue="3"]',label:'Deck A Cue 3'},
    '97_0_3':{target:'btn:.hot-cues[data-deck="A"] .cue-btn[data-cue="4"]',label:'Deck A Cue 4'},
  },
  // Numark Mixtrack Pro — MIDI channel 1 = deck A, channel 2 = deck B (approx)
  mixtrack:{
    'b0_0_1':{target:'fader:A',label:'Deck A Volume'},
    'b0_1_1':{target:'fader:B',label:'Deck B Volume'},
    'b0_0_8':{target:'crossfader',label:'Crossfader'},
    'b0_0_5':{target:'knob:low-A',label:'Deck A EQ Low'},
    'b0_0_6':{target:'knob:mid-A',label:'Deck A EQ Mid'},
    'b0_0_7':{target:'knob:hi-A',label:'Deck A EQ Hi'},
    'b0_1_5':{target:'knob:low-B',label:'Deck B EQ Low'},
    'b0_1_6':{target:'knob:mid-B',label:'Deck B EQ Mid'},
    'b0_1_7':{target:'knob:hi-B',label:'Deck B EQ Hi'},
    '90_0_23':{target:'btn:.big-btn.play[data-deck="A"]',label:'Deck A PLAY'},
    '90_0_22':{target:'btn:.big-btn.cue[data-deck="A"]',label:'Deck A CUE'},
    '90_1_23':{target:'btn:.big-btn.play[data-deck="B"]',label:'Deck B PLAY'},
    '90_1_22':{target:'btn:.big-btn.cue[data-deck="B"]',label:'Deck B CUE'},
  }
};

function applyMidiPreset(name){
  if(name==='none'){
    midiMappings={};
    localStorage.setItem('djpro_midi_map','{}');
    renderMidiMapList();
    toast('MIDI mappings cleared','success');
    return;
  }
  const p=MIDI_PRESETS[name];
  if(!p){toast('Unknown preset: '+name,'error');return;}
  midiMappings={...midiMappings,...p};
  localStorage.setItem('djpro_midi_map',JSON.stringify(midiMappings));
  renderMidiMapList();
  toast(`Loaded ${Object.keys(p).length} mappings: ${name}`,'success');
}

function renderMidiMapList(){
  const el=document.getElementById('midiMapList');
  if(!el)return;
  const keys=Object.keys(midiMappings);
  const cnt=document.getElementById('midiMapCount');
  if(cnt)cnt.textContent=`(${keys.length})`;
  if(!keys.length){
    el.innerHTML='<div style="color:var(--text-dim);text-align:center;padding:14px;font-family:\'Share Tech Mono\',monospace;font-size:11px">No mappings yet. Pick a preset above or right-click any control → MIDI Learn.</div>';
    return;
  }
  el.innerHTML=keys.map(k=>{
    const m=midiMappings[k];
    const [type,ch,d1]=k.split('_');
    const typeName=type==='b0'?'CC':type==='90'?'Note':type==='97'?'Pad':type;
    return `<div class="midi-device" style="gap:8px">
      <span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-dim);min-width:120px">${typeName} ch${parseInt(ch,16)+1} #${parseInt(d1,10)}</span>
      <span style="flex:1;color:var(--screen-glow)">${m.label||m.target}</span>
      <button class="tool-btn" data-midi-unmap="${k}" style="padding:3px 8px;font-size:9px;color:var(--red);border-color:var(--red)">✕</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-midi-unmap]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      delete midiMappings[btn.dataset.midiUnmap];
      localStorage.setItem('djpro_midi_map',JSON.stringify(midiMappings));
      renderMidiMapList();
    });
  });
}

function wireMidiPanelControls(){
  document.getElementById('midiPresetSelect')?.addEventListener('change',e=>{
    const v=e.target.value;if(!v)return;
    applyMidiPreset(v);e.target.value='';
  });
  document.getElementById('midiExportBtn')?.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(midiMappings,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`titan-midi-map-${Date.now()}.json`;a.click();
    setTimeout(()=>{try{URL.revokeObjectURL(url);}catch(e){}},8000);
    toast('MIDI map exported','success');
  });
  document.getElementById('midiImportBtn')?.addEventListener('click',()=>document.getElementById('midiImportFile')?.click());
  document.getElementById('midiImportFile')?.addEventListener('change',e=>{
    const f=e.target.files?.[0];if(!f)return;
    const r=new FileReader();
    r.onload=ev=>{
      try{
        const parsed=JSON.parse(ev.target.result);
        if(typeof parsed!=='object'||!parsed)throw new Error('Invalid file');
        midiMappings={...midiMappings,...parsed};
        localStorage.setItem('djpro_midi_map',JSON.stringify(midiMappings));
        renderMidiMapList();
        toast(`Imported ${Object.keys(parsed).length} mappings`,'success');
      }catch(err){toast('Import failed: '+err.message,'error');}
    };
    r.readAsText(f);
    e.target.value='';
  });
  document.getElementById('midiClearBtn')?.addEventListener('click',()=>{
    if(!Object.keys(midiMappings).length){toast('Already empty');return;}
    if(!confirm('Remove all '+Object.keys(midiMappings).length+' MIDI mappings?'))return;
    applyMidiPreset('none');
  });
  renderMidiMapList();
}
// Refresh the mapping panel whenever the MIDI tab opens
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(wireMidiPanelControls,400);
});

function handleMIDI(msg){
  const[s,d1,d2]=msg.data,type=s&0xF0,ch=s&0x0F;
  // Pad messages sometimes come as 0x97 (note-on on channel 7); match both forms
  const midiKey=`${type.toString(16)}_${ch}_${d1}`;
  const log=document.getElementById('midiLog');
  if(log){
    // Bound the log so the DOM text node doesn't grow indefinitely over long sets
    if(log.textContent.length>8000)log.textContent=log.textContent.slice(-4000);
    log.textContent+=`\n[${new Date().toLocaleTimeString()}] Ch${ch+1} ${type.toString(16)} ${d1} ${d2}`;
    log.scrollTop=log.scrollHeight;
  }

  // MIDI Learn mode — capture this control
  if(midiLearnMode&&(type===0xB0||(type===0x90&&d2>0))){
    completeMidiLearn(midiKey);
    return;
  }

  // User / preset mappings
  if(midiMappings[midiKey]){
    const m=midiMappings[midiKey];
    const v=d2/127;
    if(m.target.startsWith('knob:')){
      const knobId=m.target.slice(5);
      applyKnob(knobId,v*2-1);
      // Visually rotate the knob element too
      const knob=document.querySelector(`.knob[data-knob="${knobId}"]`);
      if(knob){const ind=knob.querySelector('.knob-indicator');knob._rot=(v*2-1)*135;if(ind)ind.style.transform=`rotate(${knob._rot}deg)`;}
    }else if(m.target.startsWith('btn:')){
      if(type===0x90&&d2>0){
        const el=document.querySelector(m.target.slice(4));
        if(el)el.click();
      }
    }else if(m.target.startsWith('fader:')){
      const deck=m.target.slice(6);
      if(decks[deck]){
        decks[deck].volume=v;
        if(decks[deck].volumeGain)_rampGain(decks[deck].volumeGain.gain,_djFaderTaper(v),audioCtx,0.012);
        // Update the per-channel DJ focus slider if visible
        const ds=document.querySelector(`[data-djfv-slider="${deck}"]`);
        if(ds){ds.value=Math.round(v*100);const dv=document.querySelector(`[data-djfv-value="${deck}"]`);if(dv)dv.textContent=Math.round(v*100);}
        applyCrossfader();
      }
    }else if(m.target==='crossfader'){
      mixerState.crossfader=v;
      const xh=document.getElementById('xfaderHandle');if(xh)xh.style.left=`${v*100}%`;
      applyCrossfader();
    }else if(m.target.startsWith('tempo:')){
      const deck=m.target.slice(6);
      if(decks[deck]){
        const range=decks[deck].tempoRange||8;
        setTempo(deck,(v*2-1)*range);
      }
    }
    return;
  }

  // Default mappings fallback — sensible out-of-the-box behaviour for a
  // freshly-plugged controller with no preset loaded. Covers both decks.
  if(type===0xB0){
    const v=d2/127;
    // CC 1-4 on ch 1 → deck A low/mid/hi/trim
    if(ch===0&&d1>=1&&d1<=4){
      const names=['low','mid','hi','trim'];
      applyKnob(`${names[d1-1]}-A`,v*2-1);
    }
    // CC 1-4 on ch 2 → deck B low/mid/hi/trim
    else if(ch===1&&d1>=1&&d1<=4){
      const names=['low','mid','hi','trim'];
      applyKnob(`${names[d1-1]}-B`,v*2-1);
    }
    // CC 7 = channel volume (standard MIDI spec) per channel
    else if(d1===7&&(ch===0||ch===1)){
      const deck=ch===0?'A':'B';
      if(decks[deck]){decks[deck].volume=v;if(decks[deck].volumeGain)_rampGain(decks[deck].volumeGain.gain,_djFaderTaper(v),audioCtx,0.012);applyCrossfader();}
    }
  }
  if(type===0x90&&d2>0){
    // Notes 36-43 on ch 1 → deck A hot cues; ch 2 → deck B
    if(d1>=36&&d1<=43){
      const deck=ch===0?'A':ch===1?'B':null;
      if(deck){const btn=document.querySelector(`.hot-cues[data-deck="${deck}"] .cue-btn[data-cue="${d1-35}"]`);if(btn)btn.click();}
    }
  }
}

/* KNOBS */
function attachKnobs(){
  document.querySelectorAll('.knob').forEach(knob=>{
    if(knob.dataset.attached)return;
    knob.dataset.attached='1';
    knob._rot=knob._rot||0;
    let startY=0,startRot=0,drag=false;
    const ind=knob.querySelector('.knob-indicator');
    knob.addEventListener('pointerdown',e=>{knob.setPointerCapture(e.pointerId);startY=e.clientY;startRot=knob._rot;drag=true;knob.style.cursor='grabbing';});
    knob.addEventListener('pointermove',e=>{if(!drag)return;const dy=startY-e.clientY;knob._rot=Math.max(-135,Math.min(135,startRot+dy));if(ind)ind.style.transform=`rotate(${knob._rot}deg)`;applyKnob(knob.dataset.knob,knob._rot/135);if(knob._onStepperUpdate)knob._onStepperUpdate();});
    knob.addEventListener('pointerup',e=>{knob.releasePointerCapture(e.pointerId);drag=false;knob.style.cursor='grab';});
    knob.addEventListener('dblclick',()=>{knob._rot=0;if(ind)ind.style.transform='rotate(0deg)';applyKnob(knob.dataset.knob,0);if(knob._onStepperUpdate)knob._onStepperUpdate();});

    // Inject +/- stepper UI.  Hidden by default via CSS; surfaces only in
    // SIMPLE 4 mode (body.show-all) so touch users can nudge values precisely
    // without fighting a tiny rotary knob.
    const host=knob.parentElement;
    if(host&&!host.querySelector('.knob-steppers')){
      const st=document.createElement('div');
      st.className='knob-steppers';
      st.innerHTML='<button type="button" class="knob-step minus" aria-label="decrease">−</button><span class="knob-step-val">0</span><button type="button" class="knob-step plus" aria-label="increase">+</button>';
      host.insertBefore(st,knob.nextSibling);
      const valEl=st.querySelector('.knob-step-val');
      const update=()=>{
        const pct=Math.round((knob._rot/135)*100);
        valEl.textContent=pct>0?`+${pct}`:`${pct}`;
      };
      knob._onStepperUpdate=update;
      update();
      const nudge=(sign,step)=>{
        knob._rot=Math.max(-135,Math.min(135,(knob._rot||0)+sign*step));
        if(ind)ind.style.transform=`rotate(${knob._rot}deg)`;
        applyKnob(knob.dataset.knob,knob._rot/135);
        update();
      };
      st.querySelectorAll('.knob-step').forEach(btn=>{
        const sign=btn.classList.contains('plus')?1:-1;
        let holdTimer=null,repeatTimer=null;
        const startHold=()=>{
          holdTimer=setTimeout(()=>{
            repeatTimer=setInterval(()=>nudge(sign,5),70);
          },320);
        };
        const stopHold=()=>{
          clearTimeout(holdTimer);holdTimer=null;
          clearInterval(repeatTimer);repeatTimer=null;
        };
        btn.addEventListener('pointerdown',e=>{e.stopPropagation();startHold();});
        btn.addEventListener('pointerup',e=>{e.stopPropagation();stopHold();});
        btn.addEventListener('pointerleave',stopHold);
        btn.addEventListener('pointercancel',stopHold);
        btn.addEventListener('click',e=>{e.stopPropagation();nudge(sign,15);});
        btn.addEventListener('dblclick',e=>{e.stopPropagation();});
      });
      // Double-click the value readout to reset that knob to 0.
      valEl.addEventListener('dblclick',e=>{e.stopPropagation();knob._rot=0;if(ind)ind.style.transform='rotate(0deg)';applyKnob(knob.dataset.knob,0);update();});
    }
  });
}

/* Programmatic knob nudge — used by keyboard shortcuts */
function adjustKnob(id,delta){
  const knob=document.querySelector(`.knob[data-knob="${id}"]`);
  if(!knob)return;
  knob._rot=Math.max(-135,Math.min(135,(knob._rot||0)+delta));
  const ind=knob.querySelector('.knob-indicator');
  if(ind)ind.style.transform=`rotate(${knob._rot}deg)`;
  applyKnob(id,knob._rot/135);
}
function resetKnob(id){
  const knob=document.querySelector(`.knob[data-knob="${id}"]`);
  if(!knob)return;
  knob._rot=0;
  const ind=knob.querySelector('.knob-indicator');
  if(ind)ind.style.transform='rotate(0deg)';
  applyKnob(id,0);
}

function applyKnob(id,val){
  ensureAudio();if(!id)return;
  const[type,deck]=id.split('-');
  if(['A','B','C','D'].includes(deck)){
    const d=decks[deck];if(!d)return;
    if(type==='trim'){d.trim=1+val*0.5;if(d.trimGain)d.trimGain.gain.value=d.trim;}
    else if(type==='low'){d.eq.low=val;if(d.eqLow&&!d.killLow)d.eqLow.gain.value=val<=-0.95?-80:val<0?val*40:val*12;}
    else if(type==='loMid'){d.eq.loMid=val;if(d.eqLoMid&&!d.killMid)d.eqLoMid.gain.value=val<=-0.95?-80:val<0?val*40:val*12;}
    else if(type==='hiMid'){d.eq.hiMid=val;if(d.eqHiMid&&!d.killMid)d.eqHiMid.gain.value=val<=-0.95?-80:val<0?val*40:val*12;}
    else if(type==='mid'){d.eq.loMid=val;d.eq.hiMid=val;if(d.eqLoMid&&!d.killMid){const g=val<=-0.95?-80:val<0?val*40:val*12;d.eqLoMid.gain.value=g;d.eqHiMid.gain.value=g;}}
    else if(type==='hi'){d.eq.high=val;if(d.eqHigh&&!d.killHi)d.eqHigh.gain.value=val<=-0.95?-80:val<0?val*40:val*12;}
    else if(type==='colorFx'){mixerState.colorFx[deck]=val;applyColorFx(deck);}
  }else if(id==='master'){mixerState.master=0.5+val*0.5;if(masterGain)masterGain.gain.value=mixerState.master;}
  else if(id==='booth'){mixerState.booth=0.5+val*0.5;}
  else if(id==='balance'){mixerState.balance=val;}
  else if(id==='hpMix'){mixerState.hpMix=0.5+val*0.5;}
  else if(id==='hpVol'){mixerState.hpVol=0.5+val*0.5;}
  else if(id==='micVol'){mixerState.micVol=0.5+val*0.5;if(micGain&&mixerState.micOn)micGain.gain.value=mixerState.micVol;}
  else if(id==='micHi'){if(micEqHi)micEqHi.gain.value=val*12;}
  else if(id==='micLow'){if(micEqLow)micEqLow.gain.value=val*12;}
  else if(id==='fxLevel'){mixerState.fx.level=(val+1)/2;if(mixerState.fx.on&&typeof applyBeatFx==='function')applyBeatFx();}
  else if(id==='isoLow'){mixerState.isolator.low=val;if(window.isoLow){const v=val<=-0.95?-80:val<0?val*30:val*12;isoLow.gain.value=v;}}
  else if(id==='isoMid'){mixerState.isolator.mid=val;if(window.isoMid){const v=val<-0.9?-40:val<0?val*30:val*12;isoMid.gain.value=v;}}
  else if(id==='isoHi'){mixerState.isolator.hi=val;if(window.isoHi){const v=val<-0.9?-40:val<0?val*30:val*12;isoHi.gain.value=v;}}
  else if(id==='sceneDepth'){mixerState.sceneFx.depth=0.5+val*0.5;applySceneFx();}
}

function applyColorFx(deck){
  const d=decks[deck];if(!d.colorFilter)return;
  const val=mixerState.colorFx[deck],type=mixerState.colorFx.type;
  if(type==='filter'){
    if(val<0){d.colorFilter.type='lowpass';d.colorFilter.frequency.value=200+(1+val)*19800;}
    else if(val>0){d.colorFilter.type='highpass';d.colorFilter.frequency.value=80+val*5000;}
    else{d.colorFilter.type='allpass';d.colorFilter.frequency.value=1000;}
  }else if(type==='noise'){d.colorFilter.type='bandpass';d.colorFilter.frequency.value=2000+val*2000;d.colorFilter.Q.value=0.5+Math.abs(val)*5;}
  else if(type==='space'){d.colorFilter.type='notch';d.colorFilter.frequency.value=1000+val*3000;d.colorFilter.Q.value=1+Math.abs(val)*10;}
  else if(type==='crush'){d.colorFilter.type='lowpass';d.colorFilter.frequency.value=20000-Math.abs(val)*18000;d.colorFilter.Q.value=5;}
  else{d.colorFilter.type='allpass';d.colorFilter.frequency.value=1000;}
}

/* SCENE FX */
function applySceneFx(){
  if(!audioCtx||!window.sceneFxWet)return;
  const sf=mixerState.sceneFx;
  if(!sf.type){
    sceneFxWet.gain.value=0;sceneFxDry.gain.value=1;return;
  }
  const wet=sf.depth;
  const bpmRaw=parseFloat(document.getElementById('masterBpm').textContent);
  const bpm=Number.isFinite(bpmRaw)&&bpmRaw>0?bpmRaw:128;
  const beatSec=60/bpm;
  if(sf.type==='dubspiral'){
    sceneFxDelay.delayTime.value=Math.min(2,beatSec*(0.25+sf.xpadX*1.75));
    sceneFxFeedback.gain.value=0.4+sf.xpadY*0.55;
    sceneFxFilter.frequency.value=500+sf.xpadY*6000;
    sceneFxWet.gain.value=wet;sceneFxDry.gain.value=1-wet*0.3;
  }else if(sf.type==='sweep'){
    sceneFxDelay.delayTime.value=beatSec*0.125;
    sceneFxFeedback.gain.value=0.2;
    sceneFxFilter.type='bandpass';
    sceneFxFilter.frequency.value=200+sf.xpadX*8000;
    sceneFxFilter.Q.value=1+sf.xpadY*20;
    sceneFxWet.gain.value=wet;sceneFxDry.gain.value=1-wet*0.5;
  }else if(sf.type==='helix'){
    sceneFxDelay.delayTime.value=beatSec*(0.125+sf.xpadY*0.875);
    sceneFxFeedback.gain.value=0.6+sf.xpadX*0.35;
    sceneFxFilter.type='highpass';
    sceneFxFilter.frequency.value=200+sf.xpadY*3000;
    sceneFxWet.gain.value=wet;sceneFxDry.gain.value=1;
  }else if(sf.type==='mod'){
    sceneFxDelay.delayTime.value=0.003+Math.sin(performance.now()/200)*0.002;
    sceneFxFeedback.gain.value=0.5+sf.xpadX*0.4;
    sceneFxFilter.type='allpass';
    sceneFxWet.gain.value=wet*0.7;sceneFxDry.gain.value=1;
  }else if(sf.type==='shimmer'){
    sceneFxDelay.delayTime.value=beatSec*0.5;
    sceneFxFeedback.gain.value=0.7;
    sceneFxFilter.type='highshelf';
    sceneFxFilter.frequency.value=3000+sf.xpadY*5000;
    sceneFxFilter.gain.value=sf.xpadX*12;
    sceneFxWet.gain.value=wet*0.8;sceneFxDry.gain.value=1;
  }else if(sf.type==='plaza'){
    sceneFxDelay.delayTime.value=beatSec*1;
    sceneFxFeedback.gain.value=0.3+sf.xpadX*0.4;
    sceneFxFilter.type='lowpass';
    sceneFxFilter.frequency.value=1500+sf.xpadY*4000;
    sceneFxWet.gain.value=wet;sceneFxDry.gain.value=1-wet*0.3;
  }
}

function setupSceneFx(){
  document.querySelectorAll('#sceneFxButtons .scene-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const type=btn.dataset.scene;
      if(mixerState.sceneFx.type===type){
        mixerState.sceneFx.type=null;
        btn.classList.remove('active');
      }else{
        document.querySelectorAll('#sceneFxButtons .scene-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        mixerState.sceneFx.type=type;
      }
      applySceneFx();
      toast(`Scene FX: ${mixerState.sceneFx.type||'OFF'}`);
    });
  });
  const pad=document.getElementById('xPad'),dot=document.getElementById('xPadDot');
  let active=false;
  function setFromEvent(e){
    const r=pad.getBoundingClientRect();
    const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
    const y=Math.max(0,Math.min(1,1-(e.clientY-r.top)/r.height));
    mixerState.sceneFx.xpadX=x;mixerState.sceneFx.xpadY=y;
    dot.style.left=`${x*100}%`;dot.style.top=`${(1-y)*100}%`;
    applySceneFx();
  }
  pad.addEventListener('pointerdown',e=>{
    pad.setPointerCapture(e.pointerId);active=true;
    mixerState.sceneFx.xpadActive=true;pad.classList.add('active');setFromEvent(e);
  });
  pad.addEventListener('pointermove',e=>{if(active)setFromEvent(e);});
  const endXpad=e=>{
    try{pad.releasePointerCapture(e.pointerId);}catch(_){}
    active=false;mixerState.sceneFx.xpadActive=false;pad.classList.remove('active');
  };
  pad.addEventListener('pointerup',endXpad);
  pad.addEventListener('pointercancel',endXpad);
  pad.addEventListener('pointerleave',e=>{if(active)endXpad(e);});
}

/* CROSSFADER */
/* Perceptual audio-taper for DJ channel faders — Pioneer DJM-style.
   Linear fader movement feels wrong on ears — the human loudness response
   is logarithmic. Pioneer DJM faders use a gentle power curve (~v^1.8)
   that gives a long quiet tail near zero, predictable mid-travel, and
   fine control approaching unity:
     v=0   → 0    (mute — hard zero, no residue)
     v=0.3 → 0.12 (~ -18 dB)
     v=0.5 → 0.29 (~ -10.8 dB)
     v=0.7 → 0.53 (~ -5.4 dB)
     v=0.9 → 0.82 (~ -1.7 dB)
     v=1.0 → 1    (0 dB / unity) */
function _djFaderTaper(v){
  if(v<=0)return 0;
  if(v>=1)return 1;
  return Math.pow(v,1.8);
}
/* Short smoothing time constant for all fader / xfader writes. 12 ms
   is slow enough to kill zipper noise, fast enough to still feel
   instant under the finger.  The pre-existing `.gain.value = …` made
   every fader movement a discontinuity and that's what the user heard
   as "not smooth".

   setTargetAtTime exponentially approaches the target — perfect for
   moving between non-zero values, but it asymptotes and never exactly
   reaches 0. That left a barely-audible residue at "fader at 0", so
   target<=0 takes a guaranteed-zero linear ramp instead. Coming UP
   from a current value of 0 also needs an explicit setValueAtTime
   anchor before the ramp, otherwise the curve restarts from whatever
   was scheduled before. */
function _rampGain(param,target,ctx,tau){
  if(!param||!ctx)return;
  const t=tau||0.012;
  try{
    const now=ctx.currentTime;
    const cur=param.value;
    param.cancelScheduledValues(now);
    if(target<=0){
      param.setValueAtTime(cur,now);
      param.linearRampToValueAtTime(0,now+t);
    }else if(cur<=0.0001){
      param.setValueAtTime(cur,now);
      param.linearRampToValueAtTime(target,now+t);
    }else{
      param.setTargetAtTime(target,now,t);
    }
  }catch(_){param.value=target;}
}

function applyCrossfader(){
  const x=mixerState.crossfader,curve=mixerState.xfaderCurve;
  ensureAudio();
  const ctx=audioCtx;
  ['A','B','C','D'].forEach(deckId=>{
    const d=decks[deckId],a=mixerState.xfaderAssign[deckId];let xgain=1;
    if(a==='THRU'){xgain=1;}
    else{
      const isA=a==='A';let pos=isA?(1-x):x;
      if(curve==='sharp')pos=Math.pow(pos,2.5);
      else if(curve==='cut')pos=pos>0.5?1:0;
      else pos=Math.cos((1-pos)*Math.PI/2);
      xgain=pos;
    }
    // volumeGain already carries the tapered fader position (see setY /
    // playDeck). channelGain is dedicated to the crossfader contribution
    // alone — double-applying would cube the curve and the fader would
    // feel dead until it's almost at the top.
    if(d.channelGain)_rampGain(d.channelGain.gain,xgain,ctx,0.012);
  });
}

/* EVENTS */
function attachEvents(){
  document.querySelectorAll('.big-btn').forEach(btn=>{
    const d=btn.dataset.deck,a=btn.dataset.action;
    if(a==='cue'){
      let touchActive=false;
      btn.addEventListener('mousedown',(e)=>{e.preventDefault();cuePressDown(d);});
      btn.addEventListener('mouseup',()=>cuePressUp(d));
      btn.addEventListener('mouseleave',()=>cuePressUp(d));
      btn.addEventListener('touchstart',(e)=>{
        e.preventDefault();
        touchActive=true;
        cuePressDown(d);
      },{passive:false});
      btn.addEventListener('touchend',(e)=>{
        e.preventDefault();
        const wasPreview=!!decks[d]._cuePreview;
        cuePressUp(d);
        // Touch suppresses click on most browsers — deliver tap behavior here
        if(!wasPreview)cueDeck(d);
        // Reset shortly after, so any synthetic click is ignored
        setTimeout(()=>{touchActive=false;},400);
      });
      btn.addEventListener('touchcancel',()=>{cuePressUp(d);touchActive=false;});
      btn.addEventListener('click',()=>{
        if(touchActive)return; // already handled by touchend
        cueDeck(d);
      });
    }else{
      btn.addEventListener('click',()=>{if(a==='play')togglePlay(d);});
    }
  });
  document.querySelectorAll('.loop-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const d=btn.dataset.deck,a=btn.dataset.action;
      if(a==='loopIn')setLoopIn(d);else if(a==='loopOut')setLoopOut(d);else if(a==='reloop')toggleReloop(d);
    });
  });
  document.querySelectorAll('[data-autoloop]').forEach(sel=>{
    sel.addEventListener('change',()=>{const b=parseFloat(sel.value);if(b>0)setAutoLoop(sel.dataset.autoloop,b);sel.value='';});
  });
  document.querySelectorAll('[data-range]').forEach(sel=>{
    sel.addEventListener('change',()=>{decks[sel.dataset.range].tempoRange=parseFloat(sel.value);});
  });
  document.querySelectorAll('.jump-btn').forEach(btn=>{
    btn.addEventListener('click',()=>beatJump(btn.dataset.deck,parseInt(btn.dataset.jump)));
  });
  document.querySelectorAll('.util-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const d=btn.dataset.deck,u=btn.dataset.util,dk=decks[d];
      if(!dk)return;
      if(u==='sync'){
        // Keep deck.sync boolean and visual class in lockstep
        if(dk.sync){dk.sync=false;btn.classList.remove('active');}
        else if(syncDeck(d)!==false){dk.sync=true;btn.classList.add('active');}
        // syncDeck() already toasted the error on failure — no visual change
      }else{
        dk[u]=!dk[u];btn.classList.toggle('active',!!dk[u]);
        // Live-update keylock wet/dry if the user toggled KEY mid-play
        if(u==='keylock'&&typeof updateKeylockWet==='function')updateKeylockWet(d);
      }
    });
  });
  document.querySelectorAll('.cue-btn').forEach(btn=>{
    const _deckOf=()=>btn.closest('.hot-cues')?.dataset.deck;
    btn.addEventListener('pointerdown',e=>{
      const d=_deckOf();if(!d||!decks[d])return;
      const n=parseInt(btn.dataset.cue);
      triggerPad(d,n);
    });
    btn.addEventListener('pointerup',e=>{
      const d=_deckOf();if(!d||!decks[d])return;
      if(decks[d].padMode==='roll')releaseBeatRoll(d);
    });
    btn.addEventListener('pointerleave',e=>{
      const d=_deckOf();if(!d||!decks[d])return;
      if(decks[d].padMode==='roll'&&beatRollState[d])releaseBeatRoll(d);
    });
    btn.addEventListener('contextmenu',e=>{
      e.preventDefault();
      const d=_deckOf();if(!d||!decks[d])return;
      const n=btn.dataset.cue;
      if(decks[d].padMode==='cue'){delete decks[d].hotCues[n];btn.classList.remove('active');}
      else if(decks[d].padMode==='pitch'){decks[d].playbackRate=1+decks[d].tempo/100;if(decks[d].source)decks[d].source.playbackRate.value=decks[d].playbackRate;toast('Pitch reset');}
    });
  });
  // Pad mode buttons
  document.querySelectorAll('.pad-mode-btn').forEach(btn=>{
    btn.addEventListener('click',()=>setPadMode(btn.dataset.deck,btn.dataset.padMode));
  });
  ['A','B','C','D'].forEach(d=>{
    // Tempo buttons replace the slider
    const deckEl=document.getElementById(`deck${d}-container`);
    if(!deckEl)return;
    deckEl.querySelectorAll(`[data-tempo-action][data-deck="${d}"]`).forEach(btn=>{
      const act=btn.dataset.tempoAction;
      if(act==='minus')btn.addEventListener('click',()=>adjustTempo(d,-1,false));
      else if(act==='plus')btn.addEventListener('click',()=>adjustTempo(d,1,false));
      else if(act==='minus-big')btn.addEventListener('click',()=>adjustTempo(d,-1,true));
      else if(act==='plus-big')btn.addEventListener('click',()=>adjustTempo(d,1,true));
      else if(act==='reset')btn.addEventListener('click',()=>setTempo(d,0));
      else if(act==='nudge-down')btn.addEventListener('click',()=>nudgeTempo(d));
    });
    deckEl.querySelectorAll(`[data-tempo-step][data-deck="${d}"]`).forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(btn.classList.contains('active'))return;
        deckEl.querySelectorAll(`[data-tempo-step][data-deck="${d}"]`).forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        tempoStep[d]=parseFloat(btn.dataset.tempoStep);
      });
    });
  });
  const xf=document.getElementById('xfader'),xh=document.getElementById('xfaderHandle');let xd=false;
  function setX(cx){const r=xf.getBoundingClientRect();let x=(cx-r.left)/r.width;x=Math.max(0,Math.min(1,x));mixerState.crossfader=x;xh.style.left=`${x*100}%`;applyCrossfader();}
  const endXf=e=>{try{xf.releasePointerCapture(e.pointerId);}catch(_){}xd=false;};
  xf.addEventListener('pointerdown',e=>{xf.setPointerCapture(e.pointerId);xd=true;setX(e.clientX);});
  xf.addEventListener('pointermove',e=>{if(xd)setX(e.clientX);});
  xf.addEventListener('pointerup',endXf);
  xf.addEventListener('pointercancel',endXf);
  window.addEventListener('blur',()=>{xd=false;});
  document.querySelectorAll('#xfaderCurve .curve-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(btn.classList.contains('active'))return;
      document.querySelectorAll('#xfaderCurve .curve-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      mixerState.xfaderCurve=btn.dataset.curve;applyCrossfader();
    });
  });
  document.querySelectorAll('.xfader-assign').forEach(grp=>{
    const d=grp.dataset.deck;
    grp.querySelectorAll('.assign-btn').forEach(btn=>{
      btn.addEventListener('click',()=>{
        grp.querySelectorAll('.assign-btn').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        mixerState.xfaderAssign[d]=btn.dataset.assign;applyCrossfader();
      });
    });
  });
  ['A','B','C','D'].forEach(d=>{
    const w=document.querySelector(`.fader-wrap[data-fader="${d}"]`);
    if(!w)return;
    const h=document.getElementById(`fader-${d}`);let drag=false;let pendingCy=null,rafId=null;
    // Initial handle position — top of travel — to match the new
    // unity-gain default. The deck plays at full level out of the box;
    // dragging this fader DOWN now attenuates instead of enables.
    if(h){
      const _placeAtTop=()=>{
        const r=w.getBoundingClientRect();
        const handleH=h.offsetHeight||24;
        const travel=Math.max(1,r.height-handleH);
        h.style.bottom=`${travel}px`;
      };
      // Defer one frame so the wrap has its final layout height
      requestAnimationFrame(_placeAtTop);
    }
    /* Click → volume mapping. Full range, no dead zones:
         click at top of wrap        → v=1 (max)
         click at bottom of wrap     → v=0 (silent)
       Visual handle position is computed against the available travel
       (wrap height − handle height) so the handle's edges align with
       the wrap's edges at the extremes — no overflow at the top, no
       gap at the bottom. */
    function setY(cy){
      const r=w.getBoundingClientRect();
      const handleH=h.offsetHeight||24;
      const travel=Math.max(1,r.height-handleH);
      // Center-of-handle is what the user expects under the cursor.
      const raw=(cy-r.top-handleH/2)/travel;
      const y=Math.max(0,Math.min(1,raw));
      h.style.bottom=`${(1-y)*travel}px`;
      const v=1-y;
      decks[d].volume=v;
      // Smooth 12 ms ramp. _rampGain force-zeros at v<=0 so "fader at 0"
      // is genuinely silent (setTargetAtTime alone never quite hits 0).
      if(decks[d].volumeGain)_rampGain(decks[d].volumeGain.gain,_djFaderTaper(v),audioCtx,0.012);
      applyCrossfader();
    }
    function scheduleSetY(cy){pendingCy=cy;if(rafId!=null)return;rafId=requestAnimationFrame(()=>{rafId=null;if(pendingCy!=null)setY(pendingCy);pendingCy=null;});}
    const endFader=e=>{try{w.releasePointerCapture(e.pointerId);}catch(_){}drag=false;if(rafId!=null){cancelAnimationFrame(rafId);rafId=null;}};
    w.addEventListener('pointerdown',e=>{w.setPointerCapture(e.pointerId);drag=true;setY(e.clientY);});
    w.addEventListener('pointermove',e=>{if(drag)scheduleSetY(e.clientY);});
    w.addEventListener('pointerup',endFader);
    w.addEventListener('pointercancel',endFader);
  });
  document.querySelectorAll('.color-fx-select').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.color-fx-select').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      mixerState.colorFx.type=btn.dataset.colorfx;
      applyColorFx('A');applyColorFx('B');applyColorFx('C');applyColorFx('D');
    });
  });
  ['A','B','C','D'].forEach(d=>{
    const hpBtn=document.getElementById(`hpCue-${d}`);
    if(hpBtn)hpBtn.addEventListener('click',e=>{
      mixerState.hpCue[d]=!mixerState.hpCue[d];
      e.target.classList.toggle('active',mixerState.hpCue[d]);
    });
  });
  document.getElementById('micOnBtn').addEventListener('click',toggleMic);
  document.querySelectorAll('.cdj').forEach(deck=>{
    deck.addEventListener('dragover',e=>{e.preventDefault();deck.classList.add('drop-target');});
    deck.addEventListener('dragleave',()=>deck.classList.remove('drop-target'));
    deck.addEventListener('drop',e=>{
      e.preventDefault();deck.classList.remove('drop-target');
      const tid=e.dataTransfer.getData('text/plain');
      const t=library.find(x=>x.id===tid);
      if(t)loadTrackToDeck(deck.dataset.deck,t);
    });
  });

  // Compact deck (C/D) handlers
  document.querySelectorAll('.compact-deck').forEach(deck=>{
    deck.addEventListener('dragover',e=>{e.preventDefault();deck.classList.add('drop-target');});
    deck.addEventListener('dragleave',()=>deck.classList.remove('drop-target'));
    deck.addEventListener('drop',e=>{
      e.preventDefault();deck.classList.remove('drop-target');
      const tid=e.dataTransfer.getData('text/plain');
      const t=library.find(x=>x.id===tid);
      if(t&&t.source!=='yt')loadTrackToDeck(deck.dataset.deck,t);
      else if(t)toast('YouTube tracks only for A/B','error');
    });
  });
  document.querySelectorAll('[data-compact]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const d=btn.dataset.deck,act=btn.dataset.compact;
      if(act==='play')togglePlay(d);
      else if(act==='cue')cueDeck(d);
      else if(act==='tempo-minus')adjustTempo(d,-1,false);
      else if(act==='tempo-plus')adjustTempo(d,1,false);
      else if(act==='tempo-reset')setTempo(d,0);
    });
  });
  document.querySelectorAll('[data-compact-vol]').forEach(sl=>{
    sl.addEventListener('input',e=>{
      const d=sl.dataset.compactVol;const v=parseInt(e.target.value)/100;
      decks[d].volume=v;
      if(decks[d].volumeGain)_rampGain(decks[d].volumeGain.gain,_djFaderTaper(v),audioCtx,0.012);
      applyCrossfader();
    });
  });
}

/* BEAT FX UI */
function applyBeatFx(){
  if(!audioCtx||!window.sceneFxWet)return;
  const f=mixerState.fx;const t0=audioCtx.currentTime;
  if(!f.on){
    sceneFxWet.gain.cancelScheduledValues(t0);
    sceneFxWet.gain.setTargetAtTime(0,t0,0.08);
    return;
  }
  const bpmRaw=parseFloat(document.getElementById('masterBpm').textContent);const bpm=Number.isFinite(bpmRaw)&&bpmRaw>0?bpmRaw:128;
  const beatSec=60/bpm;
  const time=Math.max(0.005,beatSec*(f.beat||1));
  const level=Math.max(0,Math.min(1,f.level!=null?f.level:0.6));
  const ramp=0.05;
  sceneFxDelay.delayTime.cancelScheduledValues(t0);
  sceneFxFeedback.gain.cancelScheduledValues(t0);
  sceneFxWet.gain.cancelScheduledValues(t0);
  sceneFxDry.gain.cancelScheduledValues(t0);
  if(sceneFxFilter.frequency)sceneFxFilter.frequency.cancelScheduledValues(t0);
  if(f.type==='delay'){
    sceneFxDelay.delayTime.setTargetAtTime(time,t0,ramp);
    sceneFxFeedback.gain.setTargetAtTime(0.35,t0,ramp);
    sceneFxFilter.type='allpass';
  }else if(f.type==='echo'){
    sceneFxDelay.delayTime.setTargetAtTime(time,t0,ramp);
    sceneFxFeedback.gain.setTargetAtTime(0.75,t0,ramp);
    sceneFxFilter.type='lowpass';sceneFxFilter.frequency.value=3500;
  }else if(f.type==='pingpong'){
    sceneFxDelay.delayTime.setTargetAtTime(time,t0,ramp);
    sceneFxFeedback.gain.setTargetAtTime(0.6,t0,ramp);
    sceneFxFilter.type='allpass';
  }else if(f.type==='reverb'){
    sceneFxDelay.delayTime.setTargetAtTime(0.05,t0,ramp);
    sceneFxFeedback.gain.setTargetAtTime(0.9,t0,ramp);
    sceneFxFilter.type='lowpass';sceneFxFilter.frequency.value=4500;
  }else if(f.type==='filter'){
    sceneFxDelay.delayTime.setTargetAtTime(0,t0,ramp);
    sceneFxFeedback.gain.setTargetAtTime(0,t0,ramp);
    sceneFxFilter.type='bandpass';
    sceneFxFilter.frequency.setTargetAtTime(200+level*6000,t0,ramp);
    if(sceneFxFilter.Q)sceneFxFilter.Q.value=4;
  }else if(f.type==='flanger'){
    sceneFxDelay.delayTime.setTargetAtTime(0.004,t0,ramp);
    sceneFxFeedback.gain.setTargetAtTime(0.75,t0,ramp);
    sceneFxFilter.type='allpass';
  }else if(f.type==='phaser'){
    sceneFxDelay.delayTime.setTargetAtTime(0.008,t0,ramp);
    sceneFxFeedback.gain.setTargetAtTime(0.6,t0,ramp);
    sceneFxFilter.type='allpass';
  }else if(f.type==='roll'){
    sceneFxDelay.delayTime.setTargetAtTime(time*0.5,t0,ramp);
    sceneFxFeedback.gain.setTargetAtTime(0.88,t0,ramp);
    sceneFxFilter.type='allpass';
  }
  sceneFxDry.gain.setTargetAtTime(1,t0,ramp);
  sceneFxWet.gain.setTargetAtTime(level,t0,ramp);
}

function setupBeatFxUI(){
  document.getElementById('fxType').addEventListener('change',e=>{mixerState.fx.type=e.target.value;if(mixerState.fx.on)applyBeatFx();});
  document.getElementById('fxChannel').addEventListener('change',e=>{mixerState.fx.channel=e.target.value;});
  document.querySelectorAll('#beatButtons .beat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(btn.classList.contains('active'))return;
      document.querySelectorAll('#beatButtons .beat-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      mixerState.fx.beat=parseFloat(btn.dataset.beat);
      document.getElementById('beatDisplay').textContent=btn.textContent;
      if(mixerState.fx.on)applyBeatFx();
    });
  });
  document.getElementById('fxOnOff')?.addEventListener('click',()=>{
    ensureAudio();
    mixerState.fx.on=!mixerState.fx.on;
    document.getElementById('fxOnOff')?.classList.toggle('active',mixerState.fx.on);
    if(mixerState.fx.on){stats.fxCount++;document.getElementById('statFxCount').textContent=stats.fxCount;}
    applyBeatFx();
    toast(`Beat FX ${mixerState.fx.on?'ON':'OFF'} — ${mixerState.fx.type}`);
  });
  let tapTimes=[];
  document.getElementById('tapBtn').addEventListener('click',()=>{
    const now=performance.now();
    // Reset the series if the user paused for more than 2 seconds between taps
    if(tapTimes.length&&now-tapTimes[tapTimes.length-1]>2000)tapTimes=[];
    tapTimes.push(now);
    if(tapTimes.length>8)tapTimes.shift();
    if(tapTimes.length>=2){
      const avg=(tapTimes[tapTimes.length-1]-tapTimes[0])/(tapTimes.length-1);
      const bpm=60000/avg;
      document.getElementById('masterBpm').textContent=bpm.toFixed(2);
      mixerState.tapBpm=bpm;
      // Re-time any live FX so echo/delay lock to the new BPM immediately
      if(mixerState.fx&&mixerState.fx.on&&typeof applyBeatFx==='function')applyBeatFx();
      if(typeof applySceneFx==='function')applySceneFx();
      toast(`Tap: ${bpm.toFixed(1)} BPM`);
    }
  });
}

/* VU METERS */
function setupVU(id,segs){
  const vu=document.getElementById(id);if(!vu)return;vu.innerHTML='';
  for(let i=0;i<segs;i++){
    const l=document.createElement('div');l.className='vu-led';
    if(i>=segs-3)l.dataset.color='red';
    else if(i>=segs-7)l.dataset.color='yellow';
    else l.dataset.color='green';
    vu.appendChild(l);
  }
}

function animateVU(){
  ['A','B','C','D'].forEach(d=>{
    const dk=decks[d],vu=document.getElementById(`vu-${d}`);
    if(!vu)return;
    const leds=vu.querySelectorAll('.vu-led');
    let level=0;
    if(dk.playing&&dk.analyser){
      const fftN=dk.analyser.frequencyBinCount;
      const tArr=new Uint8Array(fftN);
      dk.analyser.getByteTimeDomainData(tArr);
      let peak=0,rms=0;
      for(let i=0;i<tArr.length;i++){const v=Math.abs(tArr[i]-128);if(v>peak)peak=v;rms+=v*v;}
      rms=Math.sqrt(rms/tArr.length);
      const combined=peak*0.7+rms*1.6;
      level=Math.min(20,(combined/128)*32);
      if(dk.playing&&level<1.5)level=1.5;
      if(dk._vuHold==null)dk._vuHold=0;
      if(level>dk._vuHold)dk._vuHold=level;else dk._vuHold=Math.max(level,dk._vuHold-0.6);
      level=dk._vuHold;
    }else if(dk._vuHold){dk._vuHold=0;}
    leds.forEach((l,i)=>{l.classList.remove('on','green','yellow','red');if(i<level){l.classList.add('on');l.classList.add(l.dataset.color);}});
  });
  // MASTER VU — drive from per-deck analysers (same signal the working channel
  // meters use) so L/R LEDs animate identically with whatever plays.
  (function paintMaster(){
    const now=performance.now();
    const anyPlaying=['A','B','C','D'].some(k=>decks[k]&&decks[k].playing);
    const SEGS=20;
    // Compute the master level by reading each playing deck's analyser
    // (same path as animateVU) and taking the loudest. Crossfader + channel
    // fader aren't factored in; this meter reflects "source playing" which
    // is what the user expects the lights to follow.
    let masterLevel=0;
    if(anyPlaying){
      ['A','B','C','D'].forEach(d=>{
        const dk=decks[d];
        if(!dk||!dk.playing||!dk.analyser)return;
        try{
          const tArr=new Uint8Array(dk.analyser.frequencyBinCount);
          dk.analyser.getByteTimeDomainData(tArr);
          let peak=0,rms=0;
          for(let i=0;i<tArr.length;i++){const v=Math.abs(tArr[i]-128);if(v>peak)peak=v;rms+=v*v;}
          rms=Math.sqrt(rms/tArr.length);
          const combined=peak*0.7+rms*1.6;
          const level=Math.min(SEGS,(combined/128)*32);
          if(level>masterLevel)masterLevel=level;
        }catch(e){}
      });
    }
    let maxLevel=0;
    ['L','R'].forEach((suffix,chan)=>{
      const vu=document.getElementById('masterHVu'+suffix);
      const clip=document.getElementById('clipLed'+suffix);
      if(!vu)return;
      const leds=vu.querySelectorAll('.vu-led');
      // Slight L/R variation so it looks stereo (±3% of peak)
      const jitter=chan===0?1:0.97;
      const level=masterLevel*jitter;
      vu._hold=vu._hold||0;
      if(level>vu._hold)vu._hold=level;
      else vu._hold=Math.max(level,vu._hold-0.6);
      maxLevel=Math.max(maxLevel,vu._hold);
      // Light up LEDs one by one — identical to animateVU loop above
      leds.forEach((l,i)=>{
        l.classList.remove('on','green','yellow','red');
        if(i<vu._hold){l.classList.add('on');l.classList.add(l.dataset.color);}
      });
      if(clip){
        const nowClip=anyPlaying&&vu._hold>=SEGS-0.5;
        if(nowClip)vu._clipUntil=now+240;
        clip.classList.toggle('hot',(vu._clipUntil||0)>now);
      }
    });
    const halo=document.getElementById('masterVuHalo');
    if(halo){
      const n=Math.min(1,maxLevel/SEGS);
      const color=anyPlaying&&n>0.75?`rgba(255,60,60,${.22+n*.5})`:anyPlaying&&n>0.5?`rgba(255,212,0,${.18+n*.4})`:`rgba(255,138,26,${.08+n*.35})`;
      halo.style.background=`radial-gradient(ellipse at center,${color} 0%,transparent 70%)`;
    }
  })();
}

/* RECORDING */
function toggleRecording(){
  ensureAudio();
  const btn=document.getElementById('recBtn');
  if(mixerState.isRecording){
    try{mediaRecorder&&mediaRecorder.stop();}catch(e){console.warn('rec stop failed',e);recordedChunks=[];}
    mixerState.isRecording=false;
    btn.classList.remove('recording');btn.textContent='REC';
  }else{
    // Drop any prior instance so it can be GC'd (each MediaRecorder pins the stream)
    if(mediaRecorder){try{mediaRecorder.ondataavailable=null;mediaRecorder.onstop=null;}catch(e){}mediaRecorder=null;}
    recordedChunks=[];
    const mime=MediaRecorder.isTypeSupported('audio/webm')?'audio/webm':'';
    mediaRecorder=new MediaRecorder(recordDestination.stream,mime?{mimeType:mime}:{});
    mediaRecorder.ondataavailable=e=>{if(e.data.size>0)recordedChunks.push(e.data);};
    mediaRecorder.onstop=()=>{
      const blob=new Blob(recordedChunks,{type:mime||'audio/webm'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download=`dj-mix-${Date.now()}.webm`;a.click();
      // Release the blob URL once the browser has started the download
      setTimeout(()=>{try{URL.revokeObjectURL(url);}catch(e){}},10000);
      recordedChunks=[]; // free chunk buffers after save
      toast('Mix saved','success');
    };
    mediaRecorder.start();mixerState.isRecording=true;
    btn.classList.add('recording');btn.textContent='STOP';
    toast('Recording...','success');
  }
}

/* STATS */
function updateStats(){
  const sessionMin=Math.floor((Date.now()-stats.sessionStart)/60000);
  const sessionSec=Math.floor(((Date.now()-stats.sessionStart)/1000)%60);
  document.getElementById('statTotalTime').textContent=`${String(sessionMin).padStart(2,'0')}:${String(sessionSec).padStart(2,'0')}`;
  document.getElementById('statTracksPlayed').textContent=stats.tracksPlayed;
  const bpms=library.filter(t=>t.bpm>0).map(t=>t.bpm);
  document.getElementById('statAvgBpm').textContent=bpms.length?Math.round(bpms.reduce((a,b)=>a+b,0)/bpms.length):'---';
  document.getElementById('statFxCount').textContent=stats.fxCount;
  document.getElementById('statCueCount').textContent=stats.cueCount;
}

/* ============ LONG-UPTIME HYGIENE ============
   Two mechanisms for sessions that run for days/weeks (festival booth,
   24/7 streaming): (a) cap the number of decoded AudioBuffers held in the
   library, evicting cold ones; (b) watchdog the AudioContext and recycle
   the audio graph during an idle moment after a long-uptime threshold. */
const _LIB_MAX_DECODED=200;
function _libTouch(track){if(track)track.lastUsedAt=Date.now();}
function _libProtectedIds(){
  const s=new Set();
  ['A','B','C','D'].forEach(k=>{const t=decks[k]&&decks[k].track;if(t&&t.id)s.add(t.id);});
  return s;
}
function _libReleaseColdBuffers(){
  let loaded=0;for(const t of library)if(t&&t.buffer)loaded++;
  if(loaded<=_LIB_MAX_DECODED)return 0;
  const protect=_libProtectedIds();
  const candidates=library.filter(t=>t&&t.buffer&&!protect.has(t.id));
  candidates.sort((a,b)=>(a.lastUsedAt||a.addedAt||0)-(b.lastUsedAt||b.addedAt||0));
  const toFree=loaded-_LIB_MAX_DECODED;let freed=0;
  for(const t of candidates){if(freed>=toFree)break;t.buffer=null;freed++;}
  if(freed)console.info(`[library] released ${freed} cold buffer(s)`);
  return freed;
}

const _AUDIO_RECYCLE_MS=7*24*60*60*1000;
const _audioWatchdog={lastTime:0,sessionStart:Date.now(),lastRecycle:0};
function _decksAreIdle(){
  if(mixerState&&mixerState.isRecording)return false;
  return!['A','B','C','D'].some(k=>decks[k]&&decks[k].playing);
}
function _recycleAudioGraph(){
  if(!audioCtx||!_decksAreIdle())return false;
  ['A','B','C','D'].forEach(k=>{
    const d=decks[k];if(!d)return;
    try{if(d.source){d.source.stop();d.source.disconnect();}}catch(_){}
    d.source=null;d.trimGain=null;d.eqLow=null;d.eqLoMid=null;d.eqHiMid=null;
    d.eqHigh=null;d.compressor=null;d.saturation=null;d.colorFilter=null;
    d.volumeGain=null;d.channelGain=null;d.analyser=null;d.keylockNode=null;
    d.playing=false;
  });
  try{audioCtx.close();}catch(_){}
  audioCtx=null;masterGain=null;masterLimiter=null;recordDestination=null;
  masterAnalyserL=null;masterAnalyserR=null;
  ensureAudio();
  _audioWatchdog.sessionStart=Date.now();
  _audioWatchdog.lastRecycle=Date.now();
  console.info('[watchdog] audio graph recycled');
  try{toast('Audio graph refreshed','success');}catch(_){}
  return true;
}
function _audioWatchdogTick(){
  if(!audioCtx)return;
  if(audioCtx.state==='suspended'){audioCtx.resume().catch(()=>{});}
  const now=audioCtx.currentTime;
  if(_audioWatchdog.lastTime&&now+0.001<_audioWatchdog.lastTime){
    console.warn('[watchdog] non-monotonic audioCtx.currentTime',_audioWatchdog.lastTime,'→',now);
  }
  _audioWatchdog.lastTime=now;
  const uptime=Date.now()-(_audioWatchdog.sessionStart||Date.now());
  if(uptime>_AUDIO_RECYCLE_MS&&_decksAreIdle())_recycleAudioGraph();
}

function logMix(action){
  const entry={time:new Date().toLocaleTimeString(),action};
  stats.mixHistory.unshift(entry);
  if(stats.mixHistory.length>50)stats.mixHistory.pop();
  const list=document.getElementById('mixHistoryList');
  list.innerHTML=stats.mixHistory.map(e=>`<div class="mix-entry"><span>${escapeHtml(e.action)}</span><span class="time">${e.time}</span></div>`).join('');
}

/* PERSISTENCE */
function saveToDB(){
  if(!settings.autoSave)return;
  const data={
    library:library.map(t=>({...t,buffer:undefined,source:t.source})),
    playlists,
    samples:samples.map(s=>s?{name:s.name}:null),
    stats,settings
  };
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(e){console.warn(e);}
}

function loadFromDB(){
  try{
    const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return;
    const data=JSON.parse(raw);
    if(data.library)library=data.library.filter(t=>t.source==='yt').concat(
      data.library.filter(t=>t.source!=='yt').map(t=>({...t,buffer:null}))
    );
    if(data.playlists)playlists=data.playlists;
    if(data.stats)stats={...stats,...data.stats,sessionStart:Date.now()};
    if(data.settings)settings={...settings,...data.settings};
  }catch(e){console.warn(e);}
}

/* SETTINGS */
function applyTheme(name){
  document.body.classList.remove('theme-light','theme-neon','theme-gold','theme-pioneer','theme-xdjxz','theme-euphonia','theme-blade');
  if(name!=='dark')document.body.classList.add(`theme-${name}`);
  settings.theme=name;saveToDB();
}

const DECK_LAYOUTS={
  rx3:{name:'TITAN XDJ-RX3',model:'ALL-IN-ONE'},
  cdj:{name:'TITAN-3K PRO',model:'CDJ + DJM'},
  xz:{name:'TITAN XDJ-XZ',model:'4-CH PRO'},
  compact:{name:'TITAN COMPACT',model:'2-DECK MINI'}
};
function applyDeckLayout(layout){
  if(!DECK_LAYOUTS[layout])layout='rx3';
  document.body.classList.remove('layout-rx3','layout-cdj','layout-xz','layout-compact');
  document.body.classList.add(`layout-${layout}`);
  document.querySelectorAll('#layoutPicker .layout-card').forEach(c=>{
    c.classList.toggle('selected',c.dataset.layout===layout);
    c.setAttribute('aria-pressed',c.dataset.layout===layout?'true':'false');
  });
  const cur=document.getElementById('layoutPickerCurrent');
  if(cur)cur.textContent=`▸ ${DECK_LAYOUTS[layout].name}`;
  settings.deckLayout=layout;saveToDB();
}

function setupSettings(){
  // Set initial state from loaded settings
  const themeSel=document.getElementById('settingTheme');
  if(themeSel)themeSel.value=settings.theme||'dark';
  applyDeckLayout(settings.deckLayout||'rx3');
  document.querySelectorAll('#layoutPicker .layout-card').forEach(c=>{
    c.addEventListener('click',()=>applyDeckLayout(c.dataset.layout));
    c.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();applyDeckLayout(c.dataset.layout);}});
  });
  [['Rgb','rgbAmbient'],['Phrase','phraseMarkers'],['Limiter','limiter'],['AutoGain','autoGain'],['AutoSave','autoSave']].forEach(([s,key])=>{
    const t=document.getElementById(`toggle${s}`);
    if(t)t.classList.toggle('on',!!settings[key]);
  });
  const rgb=document.getElementById('rgbStrip');
  if(rgb)rgb.style.display=settings.rgbAmbient?'':'none';

  document.getElementById('settingTheme').addEventListener('change',e=>applyTheme(e.target.value));
  [['Rgb','rgbAmbient'],['Phrase','phraseMarkers'],['Limiter','limiter'],['AutoGain','autoGain'],['AutoSave','autoSave']].forEach(([s,key])=>{
    const t=document.getElementById(`toggle${s}`);
    if(!t)return;
    t.addEventListener('click',()=>{
      t.classList.toggle('on');
      settings[key]=t.classList.contains('on');
      if(s==='Rgb')document.getElementById('rgbStrip').style.display=settings.rgbAmbient?'':'none';
      if(s==='Phrase'){['A','B','C','D'].forEach(d=>{const tr=decks[d].track;if(tr)drawPhraseMarkers(d,tr);});}
      saveToDB();
    });
  });
  document.getElementById('exportAllBtn').addEventListener('click',()=>{
    const data={library:library.map(t=>({...t,buffer:undefined})),playlists,stats,settings};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`dj-pro-export-${Date.now()}.json`;a.click();
    toast('Exported','success');
  });
  document.getElementById('clearDataBtn').addEventListener('click',()=>{
    showModal('Clear All Data','This removes library, playlists, samples, stats. Continue?',()=>{
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  });
  document.getElementById('resetStatsBtn').addEventListener('click',()=>{
    stats={totalTime:0,tracksPlayed:0,fxCount:0,cueCount:0,mixHistory:[],sessionStart:Date.now()};
    updateStats();renderLibrary();saveToDB();
    document.getElementById('mixHistoryList').innerHTML='<div class="mix-entry" style="color:var(--text-dim);">No activity</div>';
    toast('Stats reset','success');
  });
}

/* MODAL */
let modalCallback=null;
function showModal(title,body,onConfirm){
  // Close any other overlay so two modals never stack with colliding z-index.
  document.getElementById('quickLibOverlay')?.classList.remove('open');
  document.getElementById('authModal')?.classList.remove('open');
  document.getElementById('modalTitle').textContent=title;
  document.getElementById('modalBody').innerHTML=body;
  document.getElementById('modal').classList.add('open');
  modalCallback=onConfirm;
}
function closeModal(){document.getElementById('modal').classList.remove('open');modalCallback=null;}
// Global ESC — close whichever overlay is on top.
document.addEventListener('keydown',function(e){
  if(e.key!=='Escape')return;
  const m=document.getElementById('modal');
  if(m&&m.classList.contains('open')){e.preventDefault();closeModal();return;}
  const am=document.getElementById('authModal');
  if(am&&am.classList.contains('open')){e.preventDefault();am.classList.remove('open');return;}
});

/* TOAST */
function toast(msg,type){
  const t=document.createElement('div');
  t.className='toast'+(type==='error'?' error':type==='success'?' success':'');
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

/* AUTO-UPDATE INDICATOR (Electron desktop only; no-op in browser).
   Shows a single toast on update-available, suppresses per-percent spam while
   downloading, and toasts once more when the build is staged for restart.
   The native "Restart now / Later" dialog in main.js handles the actual
   install action, so the renderer only has to keep the user informed. */
(function(){
  if (!window.djtitan || typeof window.djtitan.onUpdateStatus !== 'function') return;
  let announced = {};
  window.djtitan.onUpdateStatus((s) => {
    if (!s || !s.state) return;
    if (s.state === 'available' && !announced.available) {
      announced.available = true;
      toast('Update available: v' + (s.version||'?') + ' — downloading…', 'success');
    } else if (s.state === 'downloaded' && !announced.downloaded) {
      announced.downloaded = true;
      toast('Update v' + (s.version||'?') + ' ready — will install on quit', 'success');
    }
    // state==='none' and state==='downloading' are deliberately silent.
  });
})();

function fmtTime(sec){
  sec=Math.max(0,sec);const m=Math.floor(sec/60),s=Math.floor(sec%60),ds=Math.floor((sec-Math.floor(sec))*10);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${ds}`;
}

/* MAIN TICK — rAF-driven deck / waveform / VU / spectrum refresh.
   Perf guards:
     • Skip the frame entirely when the tab is hidden. The browser
       already throttles rAF to ~1 Hz on hidden tabs, but we still
       have layout work + innerText churn running that isn't free.
     • When the DECKS tab isn't active, only the loop-punch engine
       and track-end safety still need to run. UI text updates
       (elapsed / remain / waveform transform) are skipped.
     • VU + spectrum canvases are only redrawn when *their* tab is
       visible (DECKS for VU, SOUND for spectrum). */
function tick(){
  if(document.hidden){requestAnimationFrame(tick);return;}
  const decksTabActive=document.getElementById('tab-deck')?.classList.contains('active');
  ['A','B','C','D'].forEach(d=>{
    const dk=decks[d];if(!dk.track)return;
    const t=dk.playing?getCurrentTime(d):dk.offset;
    const dur=dk.track.duration;
    // Loop punch runs unconditionally — audio correctness, not visual
    if(dk.loop.active&&dk.loop.end&&t>=dk.loop.end)seekDeck(d,dk.loop.start);
    // Text + waveform transform only when user can actually see it
    if(decksTabActive&&(d==='A'||d==='B')){
      const el=document.getElementById(`elapsed-${d}`),rm=document.getElementById(`remain-${d}`);
      if(el)el.textContent=fmtTime(t);
      if(rm)rm.textContent='-'+fmtTime(dur-t);
      const c=document.getElementById(`wave-${d}`);
      if(c){const pct=t/dur;const zoom=dk.waveZoom||1;c.style.transform=`translateX(${(0.5-pct)*100*zoom}%) scaleX(${zoom})`;c.style.transformOrigin=`${pct*100}% 50%`;}
    }
  });
  if(decksTabActive)animateVU();
  drawSpectrum();  // cheap — checks its own canvas visibility inside
  requestAnimationFrame(tick);
}

/* KEYBOARD */
function setupKeyboard(){
  document.addEventListener('keydown',e=>{
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    // Ignore OS-level key repeat (holding a key) — sampler pads and hot cues
    // must not retrigger as fast as the keyboard repeat rate.
    if(e.repeat)return;
    const k=e.key.toLowerCase();
    // ── Ctrl / Cmd combos ──
    if(e.ctrlKey||e.metaKey){
      if(k==='a'){e.preventDefault();startAIDJ();}
      else if(k==='r'){e.preventDefault();toggleRecording();}
      else if(/^[1-9]$/.test(k)){e.preventDefault();const idx=parseInt(k)-1;const tabs=document.querySelectorAll('.tab-btn');if(tabs[idx])tabs[idx].click();}
      return;
    }
    // ── Alt combos → mixer knobs & auto-mix ──
    if(e.altKey){
      const STEP=18;
      switch(k){
        case '-':case '_':e.preventDefault();adjustKnob('master',-STEP);return;
        case '=':case '+':e.preventDefault();adjustKnob('master',STEP);return;
        case '[':e.preventDefault();adjustKnob('hpVol',-STEP);return;
        case ']':e.preventDefault();adjustKnob('hpVol',STEP);return;
        case ';':e.preventDefault();adjustKnob('booth',-STEP);return;
        case "'":e.preventDefault();adjustKnob('booth',STEP);return;
        case 'm':e.preventDefault();document.getElementById('micOnBtn')?.click();return;
        case 'r':e.preventDefault();['isoLow','isoMid','isoHi'].forEach(resetKnob);return;
        case '1':e.preventDefault();document.querySelector('[data-mix="smooth"]')?.click();return;
        case '2':e.preventDefault();document.querySelector('[data-mix="energy"]')?.click();return;
        case '3':e.preventDefault();document.querySelector('[data-mix="harmonic"]')?.click();return;
        case '4':e.preventDefault();document.querySelector('[data-mix="cut"]')?.click();return;
        case '5':e.preventDefault();document.querySelector('[data-mix="echo"]')?.click();return;
        case '6':e.preventDefault();document.getElementById('automixPickBtn')?.click();return;
        case 's':e.preventDefault();document.getElementById('automixSync')?.click();return;
      }
    }
    // ── Arrow keys → deck tempo fine-nudge ──
    if(e.key==='ArrowUp'){e.preventDefault();nudgeTempo('A',0.05);return;}
    if(e.key==='ArrowDown'){e.preventDefault();nudgeTempo('A',-0.05);return;}
    if(e.key==='ArrowRight'){e.preventDefault();nudgeTempo('B',0.05);return;}
    if(e.key==='ArrowLeft'){e.preventDefault();nudgeTempo('B',-0.05);return;}
    // ── Plain keys ──
    switch(k){
      case 'q':cueDeck('A');break;
      case 'w':togglePlay('A');break;
      case 'o':cueDeck('B');break;
      case 'p':togglePlay('B');break;
      case 'a':beatJump('A',-1);break;
      case 's':beatJump('A',1);break;
      case 'k':beatJump('B',-1);break;
      case 'l':beatJump('B',1);break;
      case ',':{mixerState.crossfader=Math.max(0,mixerState.crossfader-0.1);document.getElementById('xfaderHandle').style.left=`${mixerState.crossfader*100}%`;applyCrossfader();break;}
      case '.':{mixerState.crossfader=Math.min(1,mixerState.crossfader+0.1);document.getElementById('xfaderHandle').style.left=`${mixerState.crossfader*100}%`;applyCrossfader();break;}
      case '/':{mixerState.crossfader=0.5;document.getElementById('xfaderHandle').style.left='50%';applyCrossfader();break;}
      case ' ':e.preventDefault();togglePlay('A');togglePlay('B');break;
      case 'f':document.getElementById('fxOnOff')?.click();break;
      case 't':document.getElementById('tapBtn').click();break;
      case 'g':{const hpA=document.getElementById('hpCue-A');if(hpA)hpA.click();break;}
      case 'h':{const hpB=document.getElementById('hpCue-B');if(hpB)hpB.click();break;}
    }
    const padKeys=['z','x','c','v','b','n','m',','];
    const idx=padKeys.indexOf(k);
    if(idx>=0)triggerSample(idx+8);
    if(/^[1-8]$/.test(k)){
      const deckId=e.shiftKey?'B':'A';
      const btn=document.querySelector(`.hot-cues[data-deck="${deckId}"] .cue-btn[data-cue="${k}"]`);
      if(btn)btn.click();
    }
  });
}
/* Shortcut helper — nudge the tempo of a deck by ±percent */
function nudgeTempo(d,pct){
  const dk=decks[d];if(!dk)return;
  dk.tempo=Math.max(-50,Math.min(50,(dk.tempo||0)+pct));
  const newRate=(1+dk.tempo/100)*(dk.rpmScale||1);
  dk.playbackRate=newRate;
  if(dk.source&&dk.source.playbackRate)dk.source.playbackRate.value=newRate;
  const vEl=document.getElementById(`tempoVal-${d}`);if(vEl)vEl.textContent=(dk.tempo>=0?'+':'')+dk.tempo.toFixed(2)+'%';
  const bigEl=document.getElementById(`tempoBig-${d}`);if(bigEl)bigEl.textContent=(dk.tempo>=0?'+':'')+dk.tempo.toFixed(2)+'%';
}

/* ====================================================================
   OFFLINE DOWNLOAD — gated by Supabase customer login.
   Registered customers (any role, not banned) get the installer;
   admin users are identified server-side by profiles.role='admin'.
   No hardcoded admin code — that was a security liability in client code.
   ==================================================================== */
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

/* ====================================================================
   SECRET OFFICE — settings shortcut: type the secret code to open the
   /office admin panel. Validates locally, persists the unlock flag in
   localStorage so the new tab skips the gate, and opens /office.
   ==================================================================== */
function setupSecretOffice(){
  const SECRET='kobi!@#£';
  const UNLOCK_KEY='titan_office_unlocked_v1';
  const input=document.getElementById('secretOfficeCode');
  const btn=document.getElementById('secretOfficeBtn');
  const errEl=document.getElementById('secretOfficeErr');
  if(!input||!btn)return;
  function go(){
    const v=input.value||'';
    if(v===SECRET){
      errEl.textContent='';
      try{localStorage.setItem(UNLOCK_KEY,'1');}catch(e){}
      try{sessionStorage.setItem(UNLOCK_KEY,'1');}catch(e){}
      input.value='';
      if(typeof toast==='function')toast('Office unlocked','success');
      window.open('/office','_blank','noopener');
    }else{
      errEl.textContent='Wrong secret code';
    }
  }
  btn.addEventListener('click',go);
  input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});
}

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

/* ====================================================================
   STUDIO PRO — House · Techno · Trance production suite
   Synth + TB-303 acid bass + Hammond organ + 16-step drum machine
   + tempo-sync delay + reverb + drive + REC-to-library
   ==================================================================== */
const SP={
  ready:false,nodes:{},
  transport:{playing:false,bpm:128,swing:0,step:0,timerId:null,nextTime:0,_pending:[]},
  synth:{osc1Wave:'sawtooth',osc2Wave:'square',filterType:'lowpass',lfoTarget:'none',knobs:{},voices:new Map()},
  drum:{voices:['KICK','SNARE','CHH','OHH','CLAP','CRASH','LOWTOM','HITOM','RIM','RIDE','SHAKER','PERC','COWBELL'],pattern:null,stepEls:[]},
  bass:{knobs:{},pattern:null,voice:null,currentMidi:null,stepEls:[]},
  organ:{drawbars:[8,0,8,0,0,0,0,0,8],knobs:{},voices:new Map()},
  master:{knobs:{}},
  octave:4,activeInst:'synth',
  rec:{recorder:null,chunks:[],streamDest:null,startedAt:0},
  mix:{strips:{},drumVoiceIns:{},soloActive:false,open:false}
};
const SP_P={
  osc2Detune:[-50,50,0.5,'lin',v=>Math.round(v)+'c'],
  osc2Octave:[-2,2,0.5,'int',v=>(Math.round(v)>=0?'+':'')+Math.round(v)],
  oscMix:[0,100,0.5,'lin',v=>Math.round(v)+'%'],
  subLevel:[0,100,0,'lin',v=>Math.round(v)+'%'],
  unison:[1,7,0,'int',v=>String(Math.round(v))],
  unisonDetune:[0,50,0.2,'lin',v=>Math.round(v)+'c'],
  filterCutoff:[50,20000,0.75,'log',v=>v>=1000?(v/1000).toFixed(1)+'k':Math.round(v)+'Hz'],
  filterRes:[0.1,20,0.05,'log',v=>v.toFixed(1)],
  filterEnv:[0,100,0,'lin',v=>Math.round(v)+'%'],
  filterDecay:[10,2000,0.2,'log',v=>Math.round(v)+'ms'],
  drive:[0,100,0,'lin',v=>Math.round(v)+'%'],
  ampA:[1,2000,0.05,'log',v=>Math.round(v)+'ms'],
  ampD:[1,2000,0.2,'log',v=>Math.round(v)+'ms'],
  ampS:[0,100,0.7,'lin',v=>Math.round(v)+'%'],
  ampR:[1,5000,0.3,'log',v=>Math.round(v)+'ms'],
  glide:[0,500,0,'lin',v=>Math.round(v)+'ms'],
  lfoRate:[0.1,20,0.5,'log',v=>v.toFixed(1)+'Hz'],
  lfoDepth:[0,100,0.3,'lin',v=>Math.round(v)+'%'],
  chorusMix:[0,100,0,'lin',v=>Math.round(v)+'%'],
  delaySend:[0,100,0,'lin',v=>Math.round(v)+'%'],
  reverbSend:[0,100,0.2,'lin',v=>Math.round(v)+'%'],
  organPerc:[0,100,0,'lin',v=>Math.round(v)+'%'],
  organPercTone:[0,1,0,'int',v=>v<.5?'2nd':'3rd'],
  organPercDec:[50,2000,0.2,'log',v=>Math.round(v)+'ms'],
  organLeslie:[0,100,0,'lin',v=>Math.round(v)+'%'],
  organLeslieRate:[0.5,12,0.5,'lin',v=>v.toFixed(1)+'Hz'],
  organDrive:[0,100,0,'lin',v=>Math.round(v)+'%'],
  organVol:[0,100,0.7,'lin',v=>Math.round(v)+'%'],
  bassCutoff:[100,5000,0.3,'log',v=>Math.round(v)+'Hz'],
  bassRes:[1,30,0.5,'lin',v=>v.toFixed(1)],
  bassEnv:[0,100,0.7,'lin',v=>Math.round(v)+'%'],
  bassDecay:[50,2000,0.25,'log',v=>Math.round(v)+'ms'],
  bassAccent:[0,100,0.6,'lin',v=>Math.round(v)+'%'],
  bassDrive:[0,100,0.3,'lin',v=>Math.round(v)+'%'],
  bassWave:[0,1,0,'int',v=>v<.5?'SAW':'SQR'],
  bassVol:[0,100,0.8,'lin',v=>Math.round(v)+'%'],
  delayTime:[0,6,0.3,'int',v=>['1/32','1/16','1/8','3/16','1/4','3/8','1/2'][Math.max(0,Math.min(6,Math.round(v)))]],
  delayFb:[0,90,0.39,'lin',v=>Math.round(v)+'%'],
  delayMix:[0,100,0.3,'lin',v=>Math.round(v)+'%'],
  reverbSize:[0,100,0.6,'lin',v=>Math.round(v)+'%'],
  reverbDamp:[0,100,0.5,'lin',v=>Math.round(v)+'%'],
  reverbMix:[0,100,0.3,'lin',v=>Math.round(v)+'%'],
  masterDrive:[0,100,0,'lin',v=>Math.round(v)+'%'],
  drumVol:[0,100,0.85,'lin',v=>Math.round(v)+'%'],
  synthVol:[0,100,0.75,'lin',v=>Math.round(v)+'%'],
  masterVol:[0,100,0.85,'lin',v=>Math.round(v)+'%'],
};
function spVal(k,n){const d=SP_P[k];if(!d)return n;const[lo,hi,,curve]=d;if(curve==='log')return lo*Math.pow(hi/lo,n);if(curve==='int')return Math.round(lo+(hi-lo)*n);return lo+(hi-lo)*n}
function spFmt(k,n){const d=SP_P[k];if(!d)return String(n);return d[4](spVal(k,n))}
function spParamInit(target){for(const k in SP_P)target[k]=SP_P[k][2]}

/* --- Audio graph --- */
function spInitAudio(){
  if(SP.ready)return;
  ensureAudio();
  const ctx=audioCtx,out=ctx.destination;
  const synthBus=ctx.createGain();synthBus.gain.value=spVal('synthVol',SP.master.knobs.synthVol??.75);
  const drumBus=ctx.createGain();drumBus.gain.value=spVal('drumVol',SP.master.knobs.drumVol??.85);
  const bassBus=ctx.createGain();bassBus.gain.value=1;
  const organBus=ctx.createGain();organBus.gain.value=1;
  const mixBus=ctx.createGain();mixBus.gain.value=1;
  // Strip chain factory: source -> gain -> pan -> analyser -> dest
  SP.mix.strips={};
  const mkStrip=(id,source,dest)=>{
    const g=ctx.createGain();g.gain.value=1;
    let pan=null;try{pan=ctx.createStereoPanner();pan.pan.value=0;}catch(_){pan=null;}
    const an=ctx.createAnalyser();an.fftSize=256;
    source.connect(g);
    if(pan){g.connect(pan);pan.connect(an);}else{g.connect(an);}
    an.connect(dest);
    SP.mix.strips[id]={gain:g,pan,meter:an,muted:false,solo:false,vol:1,panV:0};
    return an;
  };
  // Per-voice drum strips — each voice has its own input gain, summed into drumBus
  // Pro mix defaults: hats/rides/shakers/perc panned for stereo width, KICK/SNARE/CLAP/BASS stay centred.
  const DRUM_PAN_DEFAULTS={KICK:0,SNARE:0,CLAP:0,RIM:0.15,CRASH:0,LOWTOM:-0.1,HITOM:0.1,CHH:-0.25,OHH:0.25,RIDE:-0.15,SHAKER:0.35,PERC:-0.35,COWBELL:0.2};
  SP.mix.drumVoiceIns={};
  (SP.drum.voices||[]).forEach(name=>{
    const inG=ctx.createGain();inG.gain.value=1;
    SP.mix.drumVoiceIns[name]=inG;
    mkStrip('DR_'+name,inG,drumBus);
    // apply pro pan default
    const strip=SP.mix.strips['DR_'+name];
    const p=DRUM_PAN_DEFAULTS[name];
    if(strip && p!=null){strip.panV=p;if(strip.pan){try{strip.pan.pan.value=p;}catch(_){}}}
  });
  // Instrument strips — re-insert in path before mixBus
  // Synth first goes through an automation lowpass (used by VIBE 2.0 for filter sweeps)
  const synthAutoFilter=ctx.createBiquadFilter();
  synthAutoFilter.type='lowpass';synthAutoFilter.frequency.value=22000;synthAutoFilter.Q.value=0.7;
  synthBus.connect(synthAutoFilter);
  mkStrip('SYNTH',synthAutoFilter,mixBus);
  // Sidechain duck inserts on bass and organ — kick hits pulse these down
  const bassSidechain=ctx.createGain();bassSidechain.gain.value=1;
  bassBus.connect(bassSidechain);
  mkStrip('BASS',bassSidechain,mixBus);
  const organSidechain=ctx.createGain();organSidechain.gain.value=1;
  organBus.connect(organSidechain);
  mkStrip('ORGAN',organSidechain,mixBus);
  mkStrip('DRUMS',drumBus,mixBus);
  // drive (waveshaper, oversampled)
  const drive=ctx.createWaveShaper();drive.curve=spMakeDriveCurve(0);drive.oversample='4x';
  mixBus.connect(drive);
  // Pro master EQ — low shelf warmth, slight mid scoop, air shelf
  const masterEqLow=ctx.createBiquadFilter();masterEqLow.type='lowshelf';
  masterEqLow.frequency.value=110;masterEqLow.gain.value=2;
  const masterEqMid=ctx.createBiquadFilter();masterEqMid.type='peaking';
  masterEqMid.frequency.value=700;masterEqMid.Q.value=0.65;masterEqMid.gain.value=-1;
  const masterEqHi=ctx.createBiquadFilter();masterEqHi.type='highshelf';
  masterEqHi.frequency.value=9500;masterEqHi.gain.value=2;
  drive.connect(masterEqLow);masterEqLow.connect(masterEqMid);masterEqMid.connect(masterEqHi);
  // Glue bus compressor — medium ratio, soft knee, slow attack to preserve transients
  const masterComp=ctx.createDynamicsCompressor();
  masterComp.threshold.value=-14;masterComp.knee.value=10;masterComp.ratio.value=3;
  masterComp.attack.value=0.015;masterComp.release.value=0.18;
  masterEqHi.connect(masterComp);
  // master gain
  const master=ctx.createGain();master.gain.value=spVal('masterVol',SP.master.knobs.masterVol??.85);
  masterComp.connect(master);
  // chorus (stereo: two modulated delays panned hard L/R)
  const chorusIn=ctx.createGain();chorusIn.gain.value=1;
  const chorusLDelay=ctx.createDelay(0.05);chorusLDelay.delayTime.value=0.018;
  const chorusRDelay=ctx.createDelay(0.05);chorusRDelay.delayTime.value=0.024;
  const chorusLFOL=ctx.createOscillator();chorusLFOL.frequency.value=0.8;
  const chorusLFOR=ctx.createOscillator();chorusLFOR.frequency.value=1.1;
  const chorusLFOLGain=ctx.createGain();chorusLFOLGain.gain.value=0.004;
  const chorusLFORGain=ctx.createGain();chorusLFORGain.gain.value=0.004;
  chorusLFOL.connect(chorusLFOLGain);chorusLFOLGain.connect(chorusLDelay.delayTime);
  chorusLFOR.connect(chorusLFORGain);chorusLFORGain.connect(chorusRDelay.delayTime);
  const chorusMerge=ctx.createChannelMerger(2);
  const chorusLGain=ctx.createGain();chorusLGain.gain.value=0.8;
  const chorusRGain=ctx.createGain();chorusRGain.gain.value=0.8;
  chorusIn.connect(chorusLDelay);chorusLDelay.connect(chorusLGain);chorusLGain.connect(chorusMerge,0,0);
  chorusIn.connect(chorusRDelay);chorusRDelay.connect(chorusRGain);chorusRGain.connect(chorusMerge,0,1);
  const chorusWet=ctx.createGain();chorusWet.gain.value=0;
  chorusMerge.connect(chorusWet);
  mkStrip('CHORUS',chorusWet,master);
  mixBus.connect(chorusIn);
  chorusLFOL.start();chorusLFOR.start();
  // delay (feedback + damp filter)
  const delay=ctx.createDelay(2.0);
  const delayFb=ctx.createGain();delayFb.gain.value=0;
  const delayFilter=ctx.createBiquadFilter();delayFilter.type='lowpass';delayFilter.frequency.value=6000;
  const delayWet=ctx.createGain();delayWet.gain.value=0;
  mixBus.connect(delay);delay.connect(delayFilter);delayFilter.connect(delayFb);delayFb.connect(delay);
  delay.connect(delayWet);
  mkStrip('DELAY',delayWet,master);
  // reverb (convolver with generated IR — size × damp shape)
  const reverb=ctx.createConvolver();reverb.buffer=spMakeIR(ctx,2.0,3);
  const reverbWet=ctx.createGain();reverbWet.gain.value=0;
  mixBus.connect(reverb);reverb.connect(reverbWet);
  mkStrip('REVERB',reverbWet,master);
  // master strip — separate gain so the MASTER fader is independent of the masterVol knob
  const masterStripGain=ctx.createGain();masterStripGain.gain.value=1;
  const masterAn=ctx.createAnalyser();masterAn.fftSize=512;
  // Brickwall limiter — tight ratio for dance-music loudness
  const lim=ctx.createDynamicsCompressor();
  lim.threshold.value=-2;lim.knee.value=1;lim.ratio.value=20;lim.attack.value=0.001;lim.release.value=0.08;
  master.connect(masterStripGain);masterStripGain.connect(masterAn);masterAn.connect(lim);lim.connect(out);
  SP.mix.strips['MASTER']={gain:masterStripGain,pan:null,meter:masterAn,muted:false,solo:false,vol:1,panV:0,isMaster:true};
  // record destination
  let streamDest=null;
  try{streamDest=ctx.createMediaStreamDestination();master.connect(streamDest);}catch(_){}
  // Pre-generated noise buffer for build-up risers
  const _riserNoise=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);
  {const d=_riserNoise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  SP._riserBuffer=_riserNoise;
  SP.nodes={synthBus,drumBus,bassBus,organBus,bassSidechain,organSidechain,mixBus,drive,masterEqLow,masterEqMid,masterEqHi,masterComp,master,delay,delayFb,delayFilter,delayWet,reverb,reverbWet,chorusIn,chorusWet,chorusLDelay,chorusRDelay,synthAutoFilter,masterStripGain,limiter:lim,streamDest};
  SP.rec.streamDest=streamDest;
  SP.ready=true;
}
function spMakeDriveCurve(amount){
  // amount 0..1 → soft saturation via tanh
  const n=1024,curve=new Float32Array(n);const k=1+amount*8;
  for(let i=0;i<n;i++){const x=(i/(n-1))*2-1;curve[i]=Math.tanh(x*k)/Math.tanh(k);}
  return curve;
}
function spMakeIR(ctx,dur,decay,damp){
  // damp 0..1 — 0 = bright, 1 = very dark (smooths HF content)
  const rate=ctx.sampleRate,len=Math.floor(rate*Math.max(0.05,dur));
  const ir=ctx.createBuffer(2,len,rate);
  const d01=Math.max(0,Math.min(1,damp||0));
  const smooth=0.05+d01*0.9; // one-pole coefficient
  for(let ch=0;ch<2;ch++){
    const d=ir.getChannelData(ch);
    let prev=0;
    for(let i=0;i<len;i++){
      const t=i/len;
      const raw=(Math.random()*2-1)*Math.pow(1-t,decay);
      prev=prev+(raw-prev)*(1-smooth);
      d[i]=prev;
    }
  }
  return ir;
}
let _spRevIrTimer=null;
function spRebuildReverbIR(){
  if(!SP.ready||!SP.nodes.reverb||!audioCtx)return;
  if(_spRevIrTimer)clearTimeout(_spRevIrTimer);
  _spRevIrTimer=setTimeout(()=>{
    _spRevIrTimer=null;
    try{
      const size=spVal('reverbSize',SP.master.knobs.reverbSize??.6)/100;
      const damp=spVal('reverbDamp',SP.master.knobs.reverbDamp??.5)/100;
      SP.nodes.reverb.buffer=spMakeIR(audioCtx,0.3+size*3.5,2.2+damp*2.5,damp);
    }catch(e){console.warn('IR rebuild failed',e);}
  },60);
}

/* --- Knob UI --- */
function spWireKnobs(targetStore,scopeSel){
  const root=scopeSel?document.querySelector(scopeSel):document;
  if(!root)return;
  root.querySelectorAll('.sp-knob[data-sp-knob]').forEach(knob=>{
    const name=knob.dataset.spKnob;const def=SP_P[name];if(!def)return;
    const store=targetStore;
    let v=store[name]!=null?store[name]:def[2];
    store[name]=v;
    const ind=knob.querySelector('.sp-knob-indicator');
    const disp=document.querySelector(`.sp-knob-val[data-sp-val="${name}"]`);
    function render(){const deg=-135+v*270;if(ind)ind.style.transform=`rotate(${deg}deg)`;if(disp)disp.textContent=spFmt(name,v);spApplyKnob(name,v);}
    render();
    knob._spSet=(nv)=>{v=Math.max(0,Math.min(1,nv));store[name]=v;render();};
    let dragging=false,startY=0,startV=0;
    knob.addEventListener('pointerdown',e=>{dragging=true;startY=e.clientY;startV=v;try{knob.setPointerCapture(e.pointerId)}catch(_){}});
    knob.addEventListener('pointermove',e=>{if(!dragging)return;v=Math.max(0,Math.min(1,startV+(startY-e.clientY)/200));store[name]=v;render();});
    const stop=e=>{if(dragging){dragging=false;try{knob.releasePointerCapture(e.pointerId)}catch(_){}};};
    knob.addEventListener('pointerup',stop);knob.addEventListener('pointercancel',stop);
    knob.addEventListener('dblclick',()=>{v=def[2];store[name]=v;render();});
    knob.addEventListener('wheel',e=>{e.preventDefault();v=Math.max(0,Math.min(1,v+(e.deltaY<0?.02:-.02)));store[name]=v;render();},{passive:false});
  });
}
function spApplyKnob(name,v){
  if(!SP.ready)return;
  const n=SP.nodes;
  if(name==='delayTime'){
    const idx=Math.round(spVal('delayTime',v));
    const divs=[1/32,1/16,1/8,3/16,1/4,3/8,1/2];
    const sec=60/SP.transport.bpm*4*divs[idx];
    if(n.delay)n.delay.delayTime.setTargetAtTime(sec,audioCtx.currentTime,0.02);
  }else if(name==='delayFb'){
    if(n.delayFb)n.delayFb.gain.setTargetAtTime(spVal('delayFb',v)/100,audioCtx.currentTime,0.02);
  }else if(name==='delayMix'){
    if(n.delayWet)n.delayWet.gain.setTargetAtTime(spVal('delayMix',v)/100,audioCtx.currentTime,0.02);
  }else if(name==='reverbSize'){
    spRebuildReverbIR();
  }else if(name==='reverbDamp'){
    spRebuildReverbIR();
  }else if(name==='reverbMix'){
    if(n.reverbWet)n.reverbWet.gain.setTargetAtTime(spVal('reverbMix',v)/100,audioCtx.currentTime,0.02);
  }else if(name==='masterDrive'){
    if(n.drive)n.drive.curve=spMakeDriveCurve(v);
  }else if(name==='drumVol'){
    if(n.drumBus)n.drumBus.gain.setTargetAtTime(spVal('drumVol',v)/100,audioCtx.currentTime,0.02);
  }else if(name==='synthVol'){
    if(n.synthBus)n.synthBus.gain.setTargetAtTime(spVal('synthVol',v)/100,audioCtx.currentTime,0.02);
  }else if(name==='masterVol'){
    if(n.master)n.master.gain.setTargetAtTime(spVal('masterVol',v)/100,audioCtx.currentTime,0.02);
  }else if(name==='chorusMix'){
    if(n.chorusWet)n.chorusWet.gain.setTargetAtTime(spVal('chorusMix',v)/100*0.7,audioCtx.currentTime,0.02);
  }
}

/* ---------- Synth voice ---------- */
function spMidiToHz(m){return 440*Math.pow(2,(m-69)/12)}
function spSynthNoteOn(midi){
  spInitAudio();const ctx=audioCtx,t=ctx.currentTime;
  // Stuck-note protection: if a voice is already assigned to this midi (e.g. a
  // chord retrigger that shares a note), tear the old one down immediately
  // instead of relying on its pending release setTimeout.
  if(SP.synth.voices.has(midi)){
    const old=SP.synth.voices.get(midi);
    try{old.gain.gain.cancelScheduledValues(t);old.gain.gain.setValueAtTime(old.gain.gain.value||0.001,t);
      old.gain.gain.linearRampToValueAtTime(0,t+0.015);}catch(_){}
    try{old.oscs.forEach(o=>{try{o.stop(t+0.02)}catch(_){}});
      if(old.subOsc){try{old.subOsc.stop(t+0.02)}catch(_){}}
      if(old.lfo){try{old.lfo.stop(t+0.02)}catch(_){}}}catch(_){}
    SP.synth.voices.delete(midi);
  }
  const k=SP.synth.knobs;
  const voice={oscs:[],gain:ctx.createGain(),filter:ctx.createBiquadFilter(),
    subOsc:null,delayTap:null,reverbTap:null,_releaseScheduled:false};
  voice.gain.gain.value=0;
  voice.filter.type=SP.synth.filterType;
  const cutoff=spVal('filterCutoff',k.filterCutoff??.75);
  voice.filter.frequency.value=cutoff;voice.filter.Q.value=spVal('filterRes',k.filterRes??.05);
  // unison
  const n=Math.max(1,Math.round(spVal('unison',k.unison??0)));
  const detuneCents=spVal('unisonDetune',k.unisonDetune??.2);
  const mix=spVal('oscMix',k.oscMix??.5)/100;
  const baseHz=spMidiToHz(midi);
  const oscGain=ctx.createGain();oscGain.gain.value=(1-mix)/Math.sqrt(n);
  const osc2Gain=ctx.createGain();osc2Gain.gain.value=mix/Math.sqrt(n);
  for(let i=0;i<n;i++){
    const o=ctx.createOscillator();o.type=SP.synth.osc1Wave;
    const d=n>1?((i/(n-1))*2-1)*detuneCents:0;
    o.detune.value=d;o.frequency.value=baseHz;
    o.connect(oscGain);o.start(t);voice.oscs.push(o);
  }
  // osc2 (one voice with octave + detune)
  if(mix>0.01){
    const o2=ctx.createOscillator();o2.type=SP.synth.osc2Wave;
    const oct=Math.round(spVal('osc2Octave',k.osc2Octave??.5));
    o2.frequency.value=baseHz*Math.pow(2,oct);
    o2.detune.value=spVal('osc2Detune',k.osc2Detune??.5);
    o2.connect(osc2Gain);o2.start(t);voice.oscs.push(o2);
  }
  // sub osc
  const subAmt=spVal('subLevel',k.subLevel??0)/100;
  if(subAmt>0.01){
    const s=ctx.createOscillator();s.type='sine';s.frequency.value=baseHz*0.5;
    const sg=ctx.createGain();sg.gain.value=subAmt;
    s.connect(sg);sg.connect(voice.filter);s.start(t);voice.subOsc=s;
  }
  oscGain.connect(voice.filter);osc2Gain.connect(voice.filter);
  voice.filter.connect(voice.gain);
  voice.gain.connect(SP.nodes.synthBus);
  // sends
  const dSend=spVal('delaySend',k.delaySend??0)/100;
  const rSend=spVal('reverbSend',k.reverbSend??.2)/100;
  if(dSend>0.01){const g=ctx.createGain();g.gain.value=dSend;voice.gain.connect(g);g.connect(SP.nodes.delay);voice.delayTap=g;}
  if(rSend>0.01){const g=ctx.createGain();g.gain.value=rSend;voice.gain.connect(g);g.connect(SP.nodes.reverb);voice.reverbTap=g;}
  // envelopes (amp ADSR)
  const A=spVal('ampA',k.ampA??.05)/1000;
  const D=spVal('ampD',k.ampD??.2)/1000;
  const S=spVal('ampS',k.ampS??.7)/100;
  const env=voice.gain.gain;
  env.cancelScheduledValues(t);env.setValueAtTime(0,t);
  env.linearRampToValueAtTime(0.75,t+A);
  env.linearRampToValueAtTime(0.75*S,t+A+D);
  // filter env
  const fEnv=spVal('filterEnv',k.filterEnv??0)/100;
  const fDec=spVal('filterDecay',k.filterDecay??.2)/1000;
  if(fEnv>0.01){
    const peak=Math.min(18000,cutoff*(1+fEnv*6));
    voice.filter.frequency.cancelScheduledValues(t);
    voice.filter.frequency.setValueAtTime(cutoff,t);
    voice.filter.frequency.linearRampToValueAtTime(peak,t+0.003);
    voice.filter.frequency.setTargetAtTime(cutoff,t+0.003,Math.max(0.05,fDec/3));
  }
  // LFO — target = filter / pitch / amp (none = bypass)
  const lfoTarget=SP.synth.lfoTarget||'none';
  const lfoDepth=spVal('lfoDepth',k.lfoDepth??.3)/100;
  if(lfoTarget!=='none' && lfoDepth>0.005){
    const lfo=ctx.createOscillator();lfo.type='sine';
    lfo.frequency.value=spVal('lfoRate',k.lfoRate??.5);
    const lg=ctx.createGain();
    if(lfoTarget==='filter'){
      lg.gain.value=cutoff*0.8*lfoDepth;
      lfo.connect(lg);lg.connect(voice.filter.frequency);
    }else if(lfoTarget==='pitch'){
      // detune in cents (±50c at full depth)
      lg.gain.value=50*lfoDepth;
      lfo.connect(lg);voice.oscs.forEach(o=>{try{lg.connect(o.detune)}catch(_){}});
    }else if(lfoTarget==='amp'){
      // tremolo — modulate gain around the ADSR level
      lg.gain.value=0.35*lfoDepth;
      lfo.connect(lg);lg.connect(voice.gain.gain);
    }
    lfo.start(t);voice.lfo=lfo;voice.lfoGain=lg;
  }
  SP.synth.voices.set(midi,voice);
}
function spSynthNoteOff(midi){
  const v=SP.synth.voices.get(midi);if(!v)return;
  if(v._releaseScheduled)return;v._releaseScheduled=true;
  const ctx=audioCtx,t=ctx.currentTime;
  const R=spVal('ampR',SP.synth.knobs.ampR??.3)/1000;
  const g=v.gain.gain;
  g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);
  g.linearRampToValueAtTime(0,t+R);
  setTimeout(()=>{try{v.oscs.forEach(o=>{try{o.stop()}catch(_){}});if(v.subOsc)try{v.subOsc.stop()}catch(_){}if(v.lfo)try{v.lfo.stop()}catch(_){}}catch(_){}
    try{v.gain.disconnect();v.filter.disconnect();if(v.delayTap)v.delayTap.disconnect();if(v.reverbTap)v.reverbTap.disconnect();if(v.lfoGain)v.lfoGain.disconnect();}catch(_){}
    // only remove from map if this voice is still the owner (prevents wiping a new overlapping voice)
    if(SP.synth.voices.get(midi)===v)SP.synth.voices.delete(midi);
  },(R+0.1)*1000);
}

/* ---------- Organ voice (additive drawbars + Leslie) ---------- */
const ORGAN_RATIOS=[0.5,1.5,1,2,3,4,5,6,8]; // 16',5 1/3',8',4',2 2/3',2',1 3/5',1 1/3',1'
function spOrganNoteOn(midi){
  spInitAudio();const ctx=audioCtx,t=ctx.currentTime,k=SP.organ.knobs;
  // retrigger protection
  if(SP.organ.voices.has(midi)){
    const old=SP.organ.voices.get(midi);
    try{old.gain.gain.cancelScheduledValues(t);old.gain.gain.setValueAtTime(old.gain.gain.value||0.001,t);
      old.gain.gain.linearRampToValueAtTime(0,t+0.02);}catch(_){}
    try{old.oscs.forEach(o=>{try{o.stop(t+0.03)}catch(_){}});if(old.leslieLFO){try{old.leslieLFO.stop(t+0.03)}catch(_){}}}catch(_){}
    SP.organ.voices.delete(midi);
  }
  const baseHz=spMidiToHz(midi);
  const voice={oscs:[],gain:ctx.createGain(),leslieLFO:null,_r:false};
  voice.gain.gain.value=0;voice.gain.gain.setValueAtTime(0,t);voice.gain.gain.linearRampToValueAtTime(1,t+0.008);
  const outGain=ctx.createGain();outGain.gain.value=spVal('organVol',k.organVol??.7)/100;
  voice.gain.connect(outGain);outGain.connect(SP.nodes.organBus);voice.outGain=outGain;
  // Leslie (tremolo via amp LFO)
  const leslieAmt=spVal('organLeslie',k.organLeslie??0)/100;
  if(leslieAmt>0.01){
    const lfo=ctx.createOscillator();lfo.frequency.value=spVal('organLeslieRate',k.organLeslieRate??.5);
    const lfoGain=ctx.createGain();lfoGain.gain.value=leslieAmt*0.35;
    lfo.connect(lfoGain);lfoGain.connect(outGain.gain);lfo.start(t);voice.leslieLFO=lfo;
  }
  // 9 drawbars
  SP.organ.drawbars.forEach((bar,i)=>{
    if(bar<=0)return;
    const o=ctx.createOscillator();o.type='sine';o.frequency.value=baseHz*ORGAN_RATIOS[i];
    const g=ctx.createGain();g.gain.value=(bar/8)*0.22;
    o.connect(g);g.connect(voice.gain);o.start(t);voice.oscs.push(o);
  });
  // percussion
  const perc=spVal('organPerc',k.organPerc??0)/100;
  if(perc>0.01){
    const tone=Math.round(spVal('organPercTone',k.organPercTone??0));
    const p=ctx.createOscillator();p.type='sine';p.frequency.value=baseHz*(tone?3:2);
    const pg=ctx.createGain();pg.gain.value=0;
    p.connect(pg);pg.connect(voice.gain);p.start(t);
    const dec=spVal('organPercDec',k.organPercDec??.2)/1000;
    pg.gain.setValueAtTime(0,t);pg.gain.linearRampToValueAtTime(perc*0.5,t+0.005);
    pg.gain.setTargetAtTime(0,t+0.005,Math.max(0.02,dec/3));
    setTimeout(()=>{try{p.stop();p.disconnect();pg.disconnect();}catch(_){}},(dec+.3)*1000);
  }
  SP.organ.voices.set(midi,voice);
}
function spOrganNoteOff(midi){
  const v=SP.organ.voices.get(midi);if(!v||v._r)return;v._r=true;
  const ctx=audioCtx,t=ctx.currentTime;
  v.gain.gain.cancelScheduledValues(t);v.gain.gain.setValueAtTime(v.gain.gain.value,t);
  v.gain.gain.linearRampToValueAtTime(0,t+0.1);
  setTimeout(()=>{try{v.oscs.forEach(o=>{try{o.stop()}catch(_){}});if(v.leslieLFO)try{v.leslieLFO.stop()}catch(_){}}catch(_){}
    try{v.gain.disconnect();v.outGain.disconnect();}catch(_){}
    if(SP.organ.voices.get(midi)===v)SP.organ.voices.delete(midi);
  },150);
}

/* ---------- TB-303 bass voice ---------- */
function spBassNoteOn(midi,accent,slide){
  spInitAudio();const ctx=audioCtx,t=ctx.currentTime,k=SP.bass.knobs;
  const hz=spMidiToHz(midi);
  // Slide: re-use existing voice if slide & one is active
  if(slide&&SP.bass.voice){
    const v=SP.bass.voice;
    try{v.osc.frequency.setTargetAtTime(hz,t,0.04);}catch(_){}
    SP.bass.currentMidi=midi;return;
  }
  // Otherwise stop existing
  if(SP.bass.voice)spBassNoteOff(true);
  const voice={osc:ctx.createOscillator(),filter:ctx.createBiquadFilter(),gain:ctx.createGain(),drive:ctx.createWaveShaper(),outGain:ctx.createGain()};
  voice.osc.type=(Math.round(spVal('bassWave',k.bassWave??0))===0)?'sawtooth':'square';
  voice.osc.frequency.value=hz;
  voice.filter.type='lowpass';
  const baseCut=spVal('bassCutoff',k.bassCutoff??.3);
  voice.filter.frequency.value=baseCut;voice.filter.Q.value=spVal('bassRes',k.bassRes??.5);
  voice.drive.curve=spMakeDriveCurve(spVal('bassDrive',k.bassDrive??.3)/100);voice.drive.oversample='2x';
  voice.gain.gain.value=0;
  voice.osc.connect(voice.filter);voice.filter.connect(voice.drive);voice.drive.connect(voice.gain);
  voice.gain.connect(voice.outGain);voice.outGain.connect(SP.nodes.bassBus);
  const vol=spVal('bassVol',k.bassVol??.8)/100;
  const accentAmt=spVal('bassAccent',k.bassAccent??.6)/100;
  voice.outGain.gain.value=vol*(accent?(1+accentAmt*0.8):1);
  // amp env (click-style)
  voice.gain.gain.setValueAtTime(0,t);voice.gain.gain.linearRampToValueAtTime(0.9,t+0.003);
  const dec=spVal('bassDecay',k.bassDecay??.25)/1000;
  voice.gain.gain.setTargetAtTime(0.2,t+0.005,Math.max(0.03,dec/3));
  // filter env
  const envAmt=spVal('bassEnv',k.bassEnv??.7)/100*(accent?1.4:1);
  const peak=Math.min(14000,baseCut*(1+envAmt*8));
  voice.filter.frequency.cancelScheduledValues(t);
  voice.filter.frequency.setValueAtTime(baseCut,t);
  voice.filter.frequency.linearRampToValueAtTime(peak,t+0.005);
  voice.filter.frequency.setTargetAtTime(baseCut,t+0.008,Math.max(0.03,dec/3));
  voice.osc.start(t);
  SP.bass.voice=voice;SP.bass.currentMidi=midi;
}
function spBassNoteOff(immediate){
  const v=SP.bass.voice;if(!v)return;SP.bass.voice=null;SP.bass.currentMidi=null;
  const ctx=audioCtx,t=ctx.currentTime;
  const R=immediate?0.02:0.06;
  v.gain.gain.cancelScheduledValues(t);v.gain.gain.setValueAtTime(v.gain.gain.value,t);
  v.gain.gain.linearRampToValueAtTime(0,t+R);
  setTimeout(()=>{try{v.osc.stop()}catch(_){}
    try{v.osc.disconnect();v.filter.disconnect();v.drive.disconnect();v.gain.disconnect();v.outGain.disconnect();}catch(_){}
  },(R+.05)*1000);
}

/* ---------- Drum voices ---------- */
function spDrumHit(name,time,vel){
  spInitAudio();const ctx=audioCtx,v=vel||1;
  const bus=(SP.mix.drumVoiceIns&&SP.mix.drumVoiceIns[name])||SP.nodes.drumBus;
  const out=ctx.createGain();out.gain.value=v;out.connect(bus);
  const t=time;
  const noise=()=>{const b=ctx.createBuffer(1,ctx.sampleRate*0.6,ctx.sampleRate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const s=ctx.createBufferSource();s.buffer=b;return s;};
  // --- PRO KICK — sub sweep + body + transient click (saturated) ---
  if(name==='KICK'){
    // Sub (40-150Hz sweep) — foundation
    const sub=ctx.createOscillator();sub.type='sine';
    sub.frequency.setValueAtTime(150,t);
    sub.frequency.exponentialRampToValueAtTime(42,t+0.1);
    const subG=ctx.createGain();
    sub.connect(subG);subG.connect(out);
    subG.gain.setValueAtTime(1.45,t);
    subG.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
    sub.start(t);sub.stop(t+0.6);
    // Mid body (80-280Hz) — thump
    const body=ctx.createOscillator();body.type='triangle';
    body.frequency.setValueAtTime(280,t);
    body.frequency.exponentialRampToValueAtTime(80,t+0.04);
    const bodyG=ctx.createGain();
    body.connect(bodyG);bodyG.connect(out);
    bodyG.gain.setValueAtTime(0.55,t);
    bodyG.gain.exponentialRampToValueAtTime(0.0001,t+0.12);
    body.start(t);body.stop(t+0.15);
    // Transient click — attack
    const cl=noise();
    const clhp=ctx.createBiquadFilter();clhp.type='highpass';clhp.frequency.value=2800;
    const cllp=ctx.createBiquadFilter();cllp.type='lowpass';cllp.frequency.value=7000;
    const clg=ctx.createGain();
    cl.connect(clhp);clhp.connect(cllp);cllp.connect(clg);clg.connect(out);
    clg.gain.setValueAtTime(0.55,t);
    clg.gain.exponentialRampToValueAtTime(0.0001,t+0.008);
    cl.start(t);cl.stop(t+0.02);
    // Sidechain — every kick ducks bass + organ briefly
    spSidechainDuck(t);
  // --- PRO SNARE — pitched body + bandpass crack + hi-noise snap ---
  }else if(name==='SNARE'){
    // Pitched body
    const o=ctx.createOscillator();o.type='triangle';
    o.frequency.setValueAtTime(220,t);
    o.frequency.exponentialRampToValueAtTime(155,t+0.06);
    const og=ctx.createGain();
    o.connect(og);og.connect(out);
    og.gain.setValueAtTime(0.55,t);
    og.gain.exponentialRampToValueAtTime(0.0001,t+0.11);
    o.start(t);o.stop(t+0.13);
    // Mid bandpass noise — crack
    const nz=noise();
    const nf=ctx.createBiquadFilter();nf.type='bandpass';nf.frequency.value=3200;nf.Q.value=1.0;
    const ng=ctx.createGain();
    nz.connect(nf);nf.connect(ng);ng.connect(out);
    ng.gain.setValueAtTime(0.9,t);
    ng.gain.exponentialRampToValueAtTime(0.0001,t+0.17);
    nz.start(t);nz.stop(t+0.2);
    // High-noise snap (2-3kHz bandpass + highshelf)
    const snap=noise();
    const snf=ctx.createBiquadFilter();snf.type='highpass';snf.frequency.value=5500;
    const sng=ctx.createGain();
    snap.connect(snf);snf.connect(sng);sng.connect(out);
    sng.gain.setValueAtTime(0.65,t);
    sng.gain.exponentialRampToValueAtTime(0.0001,t+0.04);
    snap.start(t);snap.stop(t+0.05);
  // --- PRO CLAP — 4 stacked attacks + diffuse tail ---
  }else if(name==='CLAP'){
    const offsets=[0,0.009,0.019,0.028];
    offsets.forEach((off,i)=>{
      const nz=noise();
      const f=ctx.createBiquadFilter();f.type='bandpass';
      f.frequency.value=1500+i*220;f.Q.value=1.6;
      const g=ctx.createGain();
      nz.connect(f);f.connect(g);g.connect(out);
      g.gain.setValueAtTime(0,t+off);
      g.gain.linearRampToValueAtTime(1.1,t+off+0.002);
      g.gain.exponentialRampToValueAtTime(0.0001,t+off+0.032);
      nz.start(t+off);nz.stop(t+off+0.06);
    });
    // Diffuse airy tail
    const tail=noise();
    const tf=ctx.createBiquadFilter();tf.type='bandpass';tf.frequency.value=1900;tf.Q.value=0.8;
    const tg=ctx.createGain();
    tail.connect(tf);tf.connect(tg);tg.connect(out);
    tg.gain.setValueAtTime(0.28,t+0.03);
    tg.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
    tail.start(t+0.03);tail.stop(t+0.33);
  // --- PRO CHH — 6-op metallic FM + 2 stacked bandpass filters ---
  }else if(name==='CHH'){
    const ratios=[1,1.504,1.944,2.414,2.946,3.534];
    const mg=ctx.createGain();
    const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=7200;hp.Q.value=0.6;
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=9500;bp.Q.value=0.9;
    mg.connect(hp);hp.connect(bp);bp.connect(out);
    ratios.forEach(r=>{
      const o=ctx.createOscillator();o.type='square';
      o.frequency.value=420*r;
      o.connect(mg);o.start(t);o.stop(t+0.08);
    });
    mg.gain.setValueAtTime(0.25,t);
    mg.gain.exponentialRampToValueAtTime(0.0001,t+0.048);
  // --- PRO OHH — same FM recipe, longer tail, less HP ---
  }else if(name==='OHH'){
    const ratios=[1,1.504,1.944,2.414,2.946,3.534];
    const mg=ctx.createGain();
    const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=6800;hp.Q.value=0.6;
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=8800;bp.Q.value=0.7;
    mg.connect(hp);hp.connect(bp);bp.connect(out);
    ratios.forEach(r=>{
      const o=ctx.createOscillator();o.type='square';
      o.frequency.value=420*r;
      o.connect(mg);o.start(t);o.stop(t+0.45);
    });
    mg.gain.setValueAtTime(0.22,t);
    mg.gain.exponentialRampToValueAtTime(0.0001,t+0.38);
  // --- PRO CRASH — bright airy noise with highpass sweep ---
  }else if(name==='CRASH'){
    const nz=noise();
    const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=4500;
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=8000;bp.Q.value=0.5;
    const ng=ctx.createGain();
    nz.connect(hp);hp.connect(bp);bp.connect(ng);ng.connect(out);
    ng.gain.setValueAtTime(0.55,t);
    ng.gain.exponentialRampToValueAtTime(0.0001,t+1.6);
    nz.start(t);nz.stop(t+1.7);
    // Metallic body
    const ratios=[1,1.504,1.944,2.414];
    const mg=ctx.createGain();
    mg.connect(ng);
    ratios.forEach(r=>{
      const o=ctx.createOscillator();o.type='square';
      o.frequency.value=320*r;
      o.connect(mg);o.start(t);o.stop(t+1.4);
    });
    mg.gain.setValueAtTime(0.1,t);
    mg.gain.exponentialRampToValueAtTime(0.0001,t+1.2);
  // --- Toms: sine with pitch env + tiny noise click ---
  }else if(name==='LOWTOM'){
    const o=ctx.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(115,t);
    o.frequency.exponentialRampToValueAtTime(68,t+0.14);
    const og=ctx.createGain();
    o.connect(og);og.connect(out);
    og.gain.setValueAtTime(0.85,t);
    og.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
    o.start(t);o.stop(t+0.35);
  }else if(name==='HITOM'){
    const o=ctx.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(210,t);
    o.frequency.exponentialRampToValueAtTime(145,t+0.1);
    const og=ctx.createGain();
    o.connect(og);og.connect(out);
    og.gain.setValueAtTime(0.75,t);
    og.gain.exponentialRampToValueAtTime(0.0001,t+0.22);
    o.start(t);o.stop(t+0.28);
  // --- RIM — sharp bandpass click ---
  }else if(name==='RIM'){
    const o=ctx.createOscillator();o.type='square';o.frequency.value=1700;
    const f=ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=2200;f.Q.value=3;
    const og=ctx.createGain();
    o.connect(f);f.connect(og);og.connect(out);
    og.gain.setValueAtTime(0.35,t);
    og.gain.exponentialRampToValueAtTime(0.0001,t+0.03);
    o.start(t);o.stop(t+0.04);
  // --- PRO RIDE — FM metallic + high-shimmer noise ---
  }else if(name==='RIDE'){
    const ratios=[1,1.618,2.414,3.01];
    const mg=ctx.createGain();
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=5600;bp.Q.value=1.5;
    mg.connect(bp);bp.connect(out);
    ratios.forEach(r=>{
      const o=ctx.createOscillator();o.type='square';
      o.frequency.value=620*r;
      o.connect(mg);o.start(t);o.stop(t+0.7);
    });
    mg.gain.setValueAtTime(0.2,t);
    mg.gain.exponentialRampToValueAtTime(0.0001,t+0.6);
    const nz=noise();
    const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=5200;
    const ng=ctx.createGain();
    nz.connect(hp);hp.connect(ng);ng.connect(out);
    ng.gain.setValueAtTime(0.1,t);
    ng.gain.exponentialRampToValueAtTime(0.0001,t+0.55);
    nz.start(t);nz.stop(t+0.6);
  // --- PRO SHAKER — short bandpass noise with velocity-shaped attack ---
  }else if(name==='SHAKER'){
    const nz=noise();
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=7200;bp.Q.value=2.5;
    const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=5000;
    const ng=ctx.createGain();
    nz.connect(hp);hp.connect(bp);bp.connect(ng);ng.connect(out);
    ng.gain.setValueAtTime(0,t);
    ng.gain.linearRampToValueAtTime(0.28,t+0.012);
    ng.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
    nz.start(t);nz.stop(t+0.1);
  // --- PRO PERC (conga-style) — sine thunk + bright bandpass attack ---
  }else if(name==='PERC'){
    const o=ctx.createOscillator();o.type='sine';
    o.frequency.setValueAtTime(310,t);
    o.frequency.exponentialRampToValueAtTime(155,t+0.08);
    const og=ctx.createGain();
    o.connect(og);og.connect(out);
    og.gain.setValueAtTime(0.7,t);
    og.gain.exponentialRampToValueAtTime(0.0001,t+0.18);
    o.start(t);o.stop(t+0.22);
    const nz=noise();
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=3200;bp.Q.value=4;
    const ng=ctx.createGain();
    nz.connect(bp);bp.connect(ng);ng.connect(out);
    ng.gain.setValueAtTime(0.28,t);
    ng.gain.exponentialRampToValueAtTime(0.0001,t+0.04);
    nz.start(t);nz.stop(t+0.05);
  // --- PRO COWBELL — two square oscillators + tight bandpass ---
  }else if(name==='COWBELL'){
    const o1=ctx.createOscillator();o1.type='square';o1.frequency.value=560;
    const o2=ctx.createOscillator();o2.type='square';o2.frequency.value=838;
    const mg=ctx.createGain();
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.frequency.value=720;bp.Q.value=6;
    o1.connect(mg);o2.connect(mg);mg.connect(bp);bp.connect(out);
    mg.gain.setValueAtTime(0.42,t);
    mg.gain.exponentialRampToValueAtTime(0.0001,t+0.3);
    o1.start(t);o1.stop(t+0.35);o2.start(t);o2.stop(t+0.35);
  }
}


/* ====================================================================
   TITAN LAB — drum presets + transport scheduler
   ==================================================================== */
const SP_DRUM_PRESETS={
  // rows = KICK, SNARE, CHH, OHH, CLAP, CRASH, LOWTOM, HITOM, RIM, RIDE, SHAKER, PERC, COWBELL
  house:[
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],  // KICK
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],  // SNARE
    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],  // CHH
    [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],  // OHH
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // CLAP
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // CRASH
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // LOWTOM
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // HITOM
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // RIM
    [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],  // RIDE
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],  // SHAKER
    [0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1],  // PERC
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],  // COWBELL
  ],
  'house-2':[
    [1,0,0,0,1,0,0,1,1,0,0,0,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
    [0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,0,1,0,0,1,0,0,1,0,0,1,0,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],
  ],
  techno:[
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
    [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0],
    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
    [0,0,1,0,0,0,0,1,0,0,1,0,0,1,0,0],
    [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],
  ],
  'techno-2':[
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],  // straight 4-on-floor
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],  // driving CHH
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,0,1,0,1,0,0,0,1,0,1,0,1,0],
    [0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0],
  ],
  trance:[
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  'trance-2':[
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,0],  // with ghosts
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  ],
  psytrance:[
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],   // 4 on floor (145 BPM feel)
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],   // offbeat CHH (trademark)
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],   // RIDE offbeat
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  'tech-house':[
    [1,0,0,0,1,0,0,1,1,0,0,0,1,0,1,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],
    [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],
    [0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,0,0,1,0,0,0,0,1,0,0,1,0,0],
    [0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0],
  ],
  'deep-house':[
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,0,0,0,0,1,0,0,1,0,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  minimal:[
    [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],
    [0,0,1,0,1,0,0,0,1,0,0,1,0,0,1,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  'big-room':[
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  /* ═══ NEW PRO-GRADE DROP PATTERNS ═══
     Crafted to the conventions of top-tier producers — Above & Beyond / Armin
     (trance-peak), Adam Beyer / Amelie Lens (techno-drive), FISHER / Chris
     Lake (tech-house-peak), Kerri Chandler (house-groove). Every pattern is
     a DROP-phase layout: full kick, layered clap + snare, proper offbeat hat
     placement, realistic percussive fills. Drop them straight into a club
     and they feel right. */
  'trance-peak':[
    /* 138-140 BPM drop. Kick 4-on-floor, clap/snare stacked on 2+4,
       closed hat 16ths for driving energy, open hat on the "&" of 2+4
       (classic EDM trance offbeat), shaker constant, ride hitting
       every 8th from the 2nd half for lift. */
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],   // KICK
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],   // SNARE (layered with clap)
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],   // CHH 16ths
    [0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0],   // OHH on "&" of 2/4
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],   // CLAP
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],   // CRASH bar 1
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],   // LOWTOM fill
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],   // HITOM fill
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],   // RIM
    [0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0],   // RIDE from half-bar
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],   // SHAKER
    [0,0,1,0,0,0,0,1,0,0,1,0,0,0,0,1],   // PERC syncopated
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  'techno-drive':[
    /* 128-132 BPM Berlin peak-time. Kick 4-on-floor — no snare, no clap
       (pure techno). CHH offbeat 8ths, RIDE ticking 16ths for relentless
       forward push. Heavy RIM accents + COWBELL for industrial feel.
       Toms used as transitional fills at phrase ends. */
    [1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],   // KICK
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],   // CHH offbeat 8ths
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],   // OHH at very end for tension
    [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],   // CLAP on 4 only
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1],   // LOWTOM fill
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],   // RIM accent 2+4
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],   // RIDE driving 16ths
    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],   // SHAKER 8th
    [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],   // PERC offbeat
    [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],   // COWBELL accent
  ],
  'house-groove':[
    /* 122-124 BPM NYC / Chicago groove. Kick 4-on-floor with a ghost kick
       on the "&" of 3 (step 7) — classic Kerri Chandler move. Clap 2+4,
       offbeat CHH, open hat on "&" of 4 (step 15) for lift.  Swung
       shakers + syncopated congas = proper soul-house feel. */
    [1,0,0,0,1,0,0,1,1,0,0,0,1,0,0,0],   // KICK w/ ghost on 7
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],   // no snare (clap does the work)
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],   // CHH offbeat
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],   // OHH on "&" of 4
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],   // CLAP 2+4
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],   // CRASH bar 1
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],   // HITOM pickup
    [0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0],   // RIM syncopation
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],   // SHAKER 16ths (swung by engine)
    [0,0,1,0,1,0,0,1,0,0,1,0,0,1,0,0],   // CONGAS polyrhythmic
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  'tech-house-peak':[
    /* 124-126 BPM big-club drop — FISHER / Chris Lake. Bouncy kick with
       extra sixteenth on step 2 + 14, clap on 2+4 (always), offbeat CHH,
       open hat on every "&", ride bell from mid-bar, heavy percussion
       layer for tribal drive.  This is the pattern that fills dancefloors. */
    [1,0,1,0,1,0,0,1,1,0,0,0,1,0,1,0],   // KICK bouncy
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],   // SNARE 2+4 (stacked w/ clap)
    [1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],   // CHH 8ths
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],   // OHH "&"s
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],   // CLAP 2+4
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],   // HITOM end-of-bar fill
    [0,0,1,0,0,0,0,1,0,0,1,0,0,1,0,0],   // RIM syncopated accents
    [0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0],   // RIDE from mid-bar for lift
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],   // SHAKER
    [0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1],   // PERC tribal 8ths
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],   // COWBELL accent
  ],
  'deep-house-garage':[
    /* 120-122 BPM UK garage / NY deep. Kick mostly on 1+3, extra on "&"
       of 2 for swing. Snare + clap stacked on 2+4. CHH 16ths but
       with ghosted beats for a swung feel. Open hat on "&" of 4.
       Sparse perc, warm ride. */
    [1,0,0,0,1,0,1,0,1,0,0,0,1,0,0,0],   // KICK w/ ghost
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],   // SNARE
    [1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,0],   // CHH w/ ghosts
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],   // OHH final "&"
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],   // CLAP
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0],   // RIM syncopation
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],   // RIDE 2+4
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],   // PERC
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
};
function spDrumPresetCopy(key){
  const src=SP_DRUM_PRESETS[key];
  const numRows=SP.drum.voices.length;
  const out=[];
  for(let i=0;i<numRows;i++){
    const srcRow=src&&src[i];
    out.push(srcRow?srcRow.slice(0,16):new Array(16).fill(0));
  }
  return out;
}
function spDrumPresetClear(){return SP.drum.voices.map(()=>new Array(16).fill(0))}

function spBuildDrumGrid(){
  const grid=document.getElementById('spDrumGrid');
  if(!grid)return;
  grid.innerHTML='';
  SP.drum.stepEls=SP.drum.voices.map(()=>new Array(16).fill(null));
  if(!SP.drum.mutes)SP.drum.mutes=SP.drum.voices.map(()=>false);
  SP.drum.voices.forEach((name,row)=>{
    const lbl=document.createElement('div');
    lbl.className='sp-seq-label';
    lbl.innerHTML=`<span>${name}</span>`;
    const m=document.createElement('div');
    m.className='sp-mute'+(SP.drum.mutes[row]?' muted':'');
    m.textContent='M';
    m.addEventListener('click',e=>{e.stopPropagation();SP.drum.mutes[row]=!SP.drum.mutes[row];m.classList.toggle('muted',SP.drum.mutes[row]);});
    lbl.appendChild(m);
    grid.appendChild(lbl);
    for(let step=0;step<16;step++){
      const cell=document.createElement('div');
      cell.className='sp-seq-cell'+(step%4===0?' beat1':'');
      cell.dataset.spRow=row;cell.dataset.spStep=step;
      const paint=()=>{
        const v=SP.drum.pattern[row][step];
        cell.classList.toggle('on',v>0);
        cell.classList.toggle('accent',v>1);
      };
      paint();
      cell.addEventListener('click',()=>{
        const cur=SP.drum.pattern[row][step]||0;
        SP.drum.pattern[row][step]=cur===0?1:(cur===1?1.4:0);
        paint();
      });
      grid.appendChild(cell);
      SP.drum.stepEls[row][step]=cell;
    }
  });
}

/* --- Transport scheduler --- */
function spTransportStart(){
  spInitAudio();
  if(SP.transport.playing)return;
  SP.transport.playing=true;
  SP.transport.step=0;
  SP.transport.nextTime=audioCtx.currentTime+0.06;
  // Reset song section pointer so we always start at INTRO when SONG mode is on
  if(SP.song && SP.song.enabled){
    SP.song.sectionIdx=0;SP.song.barInSection=0;
  }
  const btn=document.getElementById('spPlayBtn');
  if(btn){btn.classList.add('active');btn.style.background='linear-gradient(180deg,#ff8a1a,#cc6a0a)';btn.style.color='#0a0a0c';}
  spTransportTick();
}
function spTransportStop(){
  if(!SP.transport.playing)return;
  SP.transport.playing=false;
  if(SP.transport.timerId){clearTimeout(SP.transport.timerId);SP.transport.timerId=null;}
  // cancel any pending per-step scheduled timeouts
  if(SP.transport._pending){SP.transport._pending.forEach(id=>clearTimeout(id));SP.transport._pending=[];}
  if(SP.bass.voice)spBassNoteOff(true);
  if(SP.chords)spChordNoteOff();
  // belt-and-braces: release any stray synth voices
  if(SP.synth && SP.synth.voices){
    try{SP.synth.voices.forEach((_,m)=>spSynthNoteOff(m));}catch(_){}
  }
  const ind=document.getElementById('spStepIndicator');
  if(ind)ind.textContent='— / 16';
  document.querySelectorAll('.sp-seq-cell.playing,.sp-bass-step.playing').forEach(el=>el.classList.remove('playing'));
  const btn=document.getElementById('spPlayBtn');
  if(btn){btn.classList.remove('active');btn.style.background='';btn.style.color='';}
}
function spTransportTick(){
  if(!SP.transport.playing)return;
  const look=0.12;
  while(SP.transport.nextTime<audioCtx.currentTime+look){
    spScheduleStep(SP.transport.step,SP.transport.nextTime);
    const sixteenth=60/SP.transport.bpm/4;
    let dur=sixteenth;
    if(SP.transport.step%2===0 && SP.transport.swing>0){
      dur=sixteenth*(1+SP.transport.swing/100*0.5);
    }else if(SP.transport.step%2===1 && SP.transport.swing>0){
      dur=sixteenth*(1-SP.transport.swing/100*0.5);
    }
    SP.transport.nextTime+=dur;
    SP.transport.step=(SP.transport.step+1)%16;
  }
  SP.transport.timerId=setTimeout(spTransportTick,25);
}
function spScheduleStep(step,time){
  if(!SP.transport._pending)SP.transport._pending=[];
  const pend=SP.transport._pending;
  const addTimer=(fn,ms)=>{const id=setTimeout(()=>{pend.splice(pend.indexOf(id),1);if(SP.transport.playing)fn();},ms);pend.push(id);return id;};
  // Song-mode: advance section state at every bar start
  if(step===0 && SP.song && SP.song.enabled)spSongAdvanceBar();
  const song=SP.song||{};
  const songOn=!!song.enabled;
  const drumsOk=!songOn||song.activeDrums!==false;
  const bassOk=!songOn||song.activeBass!==false;
  const synthOk=!songOn||song.activeSynth!==false;
  // drums
  if(SP.drum.pattern && drumsOk){
    SP.drum.voices.forEach((name,i)=>{
      if(SP.drum.mutes&&SP.drum.mutes[i])return;
      const v=SP.drum.pattern[i]?.[step]||0;
      if(v>0)spDrumHit(name,time,spHumanizeVel(v));
    });
    // Snare roll on the last bar of a build
    if(song.snareRoll){
      const vel=0.4+0.6*(step/15);
      spDrumHit('SNARE',time,vel);
      // ghost closed-hat on every step during the roll
      if(step%2===0)spDrumHit('CHH',time,0.35);
    }
  }
  // bass
  if(SP.bass.pattern && bassOk){
    const s=SP.bass.pattern[step];
    if(s && s.on){
      const uiMidi=s.midi+(s.octave||0)*12;
      const delay=Math.max(0,(time-audioCtx.currentTime)*1000);
      addTimer(()=>{spBassNoteOn(uiMidi,!!s.accent,!!s.slide);},delay);
      // release after 1 step unless next step is a slide continuation
      const next=SP.bass.pattern[(step+1)%16];
      const gate=(next&&next.on&&next.slide)?(60/SP.transport.bpm/4*1000*0.95):(60/SP.transport.bpm/4*1000*0.75);
      addTimer(()=>{
        if(SP.bass.currentMidi===uiMidi && !(next&&next.on&&next.slide))spBassNoteOff(false);
      },delay+gate);
    }
  }
  // VIBE chord progression — advance one chord per bar, legato with a short gap
  if(SP.chords && SP.chords.progression && SP.chords.progression.length && synthOk){
    const delay=Math.max(0,(time-audioCtx.currentTime)*1000);
    if(step===0){
      addTimer(()=>{
        spChordNoteOff();
        const chord=SP.chords.progression[SP.chords.index%SP.chords.progression.length];
        spChordNoteOn(chord);
        SP.chords.current=chord;
        SP.chords.index=(SP.chords.index+1)%SP.chords.progression.length;
      },delay);
    }else if(step===15){
      const barMs=60/SP.transport.bpm/4*1000;
      addTimer(()=>{spChordNoteOff();},delay+barMs*0.85);
    }
    // Pro arpeggio on drop sections — chord tones on each 8th-note step
    const isDrop=SP.song.enabled && SP.song.sections && SP.song.sections[SP.song.sectionIdx] &&
      /drop/i.test(SP.song.sections[SP.song.sectionIdx].kind||'');
    if(isDrop && step%2===0 && step!==0 && SP.chords.current){
      const chord=SP.chords.current;
      // arpeggio pattern — up-down-octave sequence through the chord tones
      const pat=[2,3,2,3,2,3,2,3]; // index into chord[] over the 8 8th-notes in a bar (excl step 0)
      // Actually step can be 2,4,6,8,10,12,14 — 7 values. Use modulo on pat.
      const idx=(step/2-1)%chord.length;
      const note=chord[idx]+12; // one octave up for melody
      addTimer(()=>{
        spSynthNoteOn(note);
        // short release (quarter step length)
        const relMs=60/SP.transport.bpm/4*1000*0.8;
        setTimeout(()=>{spSynthNoteOff(note);},relMs);
      },delay);
    }
  }else if(!synthOk && SP.chords && SP.chords.held && SP.chords.held.length){
    // silence chords when the section disables synth (e.g. intro / outro / break)
    addTimer(()=>{spChordNoteOff();},Math.max(0,(time-audioCtx.currentTime)*1000));
  }
  // UI highlight
  const uid=Math.max(0,(time-audioCtx.currentTime)*1000);
  addTimer(()=>{
    document.querySelectorAll('.sp-seq-cell.playing,.sp-bass-step.playing').forEach(el=>el.classList.remove('playing'));
    if(SP.drum.stepEls){
      SP.drum.stepEls.forEach(row=>{const el=row[step];if(el)el.classList.add('playing');});
    }
    if(SP.bass.stepEls && SP.bass.stepEls[step])SP.bass.stepEls[step].classList.add('playing');
    const ind=document.getElementById('spStepIndicator');
    if(ind)ind.textContent=(step+1)+' / 16';
  },uid);
}

/* ====================================================================
   TITAN LAB — synth / organ / bass presets
   ==================================================================== */
const SP_SYNTH_PRESETS={
  'house-piano':{osc1Wave:'triangle',osc2Wave:'sine',filterType:'lowpass',lfoTarget:'none',
    knobs:{oscMix:.3,subLevel:.2,filterCutoff:.85,filterRes:.1,ampA:.05,ampD:.3,ampS:.35,ampR:.35,reverbSend:.3,chorusMix:.3}},
  'trance-supersaw':{osc1Wave:'sawtooth',osc2Wave:'sawtooth',filterType:'lowpass',lfoTarget:'none',
    knobs:{osc2Detune:.55,oscMix:.5,unison:.9,unisonDetune:.75,filterCutoff:.92,filterRes:.12,
           ampA:.25,ampD:.4,ampS:.9,ampR:.5,delaySend:.25,reverbSend:.45,chorusMix:.45}},
  'techno-reese':{osc1Wave:'sawtooth',osc2Wave:'sawtooth',filterType:'lowpass',lfoTarget:'filter',
    knobs:{osc2Detune:.35,osc2Octave:.25,oscMix:.55,subLevel:.3,unison:.5,unisonDetune:.55,
           filterCutoff:.45,filterRes:.3,filterEnv:.25,filterDecay:.4,
           ampA:.02,ampD:.5,ampS:.85,ampR:.3,lfoRate:.15,lfoDepth:.4,drive:.4}},
  'deep-pluck':{osc1Wave:'triangle',osc2Wave:'square',filterType:'lowpass',lfoTarget:'none',
    knobs:{oscMix:.35,filterCutoff:.6,filterRes:.2,filterEnv:.65,filterDecay:.35,
           ampA:.01,ampD:.35,ampS:.2,ampR:.25,delaySend:.3,reverbSend:.3}},
  'warm-pad':{osc1Wave:'sawtooth',osc2Wave:'triangle',filterType:'lowpass',lfoTarget:'filter',
    knobs:{oscMix:.45,subLevel:.15,unison:.35,unisonDetune:.4,filterCutoff:.5,filterRes:.08,
           ampA:.55,ampD:.5,ampS:.9,ampR:.6,lfoRate:.1,lfoDepth:.3,chorusMix:.4,reverbSend:.6}},
  'acid-303':{osc1Wave:'sawtooth',osc2Wave:'sine',filterType:'lowpass',lfoTarget:'none',
    knobs:{oscMix:0,subLevel:0,filterCutoff:.35,filterRes:.55,filterEnv:.8,filterDecay:.3,
           ampA:.02,ampD:.25,ampS:.4,ampR:.2,drive:.55}},
  'hammond':{osc1Wave:'sine',osc2Wave:'sine',filterType:'highpass',lfoTarget:'amp',
    knobs:{oscMix:.5,filterCutoff:.2,filterRes:.05,ampA:.03,ampD:.2,ampS:.9,ampR:.2,
           lfoRate:.55,lfoDepth:.35,drive:.2,reverbSend:.25}},
  'church-organ':{osc1Wave:'sine',osc2Wave:'sine',filterType:'lowpass',lfoTarget:'none',
    knobs:{oscMix:.5,subLevel:.5,osc2Octave:.75,filterCutoff:.75,filterRes:.05,
           ampA:.1,ampD:.3,ampS:.95,ampR:.55,reverbSend:.75}},
  'fm-bell':{osc1Wave:'sine',osc2Wave:'sine',filterType:'highpass',lfoTarget:'pitch',
    knobs:{osc2Detune:.75,osc2Octave:.9,oscMix:.4,filterCutoff:.7,filterRes:.05,
           ampA:.005,ampD:.5,ampS:.3,ampR:.45,lfoRate:.4,lfoDepth:.15,delaySend:.3,reverbSend:.45}},
  'tech-stab':{osc1Wave:'square',osc2Wave:'sawtooth',filterType:'bandpass',lfoTarget:'none',
    knobs:{osc2Detune:.55,oscMix:.5,filterCutoff:.55,filterRes:.4,filterEnv:.5,filterDecay:.2,
           ampA:.005,ampD:.15,ampS:.15,ampR:.15,drive:.3,delaySend:.4,reverbSend:.2}},
  'hoover':{osc1Wave:'sawtooth',osc2Wave:'sawtooth',filterType:'lowpass',lfoTarget:'pitch',
    knobs:{osc2Detune:.85,osc2Octave:.25,oscMix:.5,unison:.8,unisonDetune:.8,
           filterCutoff:.55,filterRes:.35,filterEnv:.2,filterDecay:.4,
           ampA:.08,ampD:.4,ampS:.8,ampR:.35,
           lfoRate:.2,lfoDepth:.25,drive:.55,delaySend:.35,reverbSend:.55,chorusMix:.4}},
  'big-room':{osc1Wave:'sawtooth',osc2Wave:'square',filterType:'lowpass',lfoTarget:'filter',
    knobs:{osc2Detune:.55,osc2Octave:.75,oscMix:.55,unison:.7,unisonDetune:.65,
           filterCutoff:.85,filterRes:.2,filterEnv:.15,filterDecay:.3,
           ampA:.02,ampD:.3,ampS:.85,ampR:.4,
           lfoRate:.15,lfoDepth:.2,drive:.5,delaySend:.3,reverbSend:.45,chorusMix:.35}},
  'saw-lead':{osc1Wave:'sawtooth',osc2Wave:'square',filterType:'lowpass',lfoTarget:'none',
    knobs:{oscMix:.45,unison:.3,unisonDetune:.35,filterCutoff:.75,filterRes:.15,
           ampA:.02,ampD:.3,ampS:.7,ampR:.3,drive:.3,delaySend:.3,reverbSend:.35}},
  'pluck-lead':{osc1Wave:'sawtooth',osc2Wave:'triangle',filterType:'lowpass',lfoTarget:'none',
    knobs:{oscMix:.3,filterCutoff:.55,filterRes:.25,filterEnv:.7,filterDecay:.2,
           ampA:.005,ampD:.25,ampS:.1,ampR:.2,delaySend:.35,reverbSend:.3}},
  'reese-bass':{osc1Wave:'sawtooth',osc2Wave:'sawtooth',filterType:'lowpass',lfoTarget:'filter',
    knobs:{osc2Detune:.7,osc2Octave:.45,oscMix:.5,subLevel:.35,unison:.7,unisonDetune:.6,
           filterCutoff:.3,filterRes:.35,filterEnv:.1,filterDecay:.5,
           ampA:.02,ampD:.4,ampS:.9,ampR:.35,lfoRate:.1,lfoDepth:.3,drive:.5}},
  'sub-bass':{osc1Wave:'sine',osc2Wave:'sine',filterType:'lowpass',lfoTarget:'none',
    knobs:{oscMix:0,subLevel:.75,filterCutoff:.15,filterRes:.05,
           ampA:.02,ampD:.2,ampS:.95,ampR:.25,drive:.1}},
  'dark-bass':{osc1Wave:'sawtooth',osc2Wave:'square',filterType:'lowpass',lfoTarget:'none',
    knobs:{osc2Detune:.2,osc2Octave:.25,oscMix:.35,subLevel:.4,
           filterCutoff:.2,filterRes:.15,filterEnv:.45,filterDecay:.3,
           ampA:.005,ampD:.3,ampS:.7,ampR:.25,drive:.4}},
  'fm-bass':{osc1Wave:'sine',osc2Wave:'square',filterType:'lowpass',lfoTarget:'pitch',
    knobs:{osc2Detune:.9,osc2Octave:.25,oscMix:.6,subLevel:.3,
           filterCutoff:.4,filterRes:.2,filterEnv:.3,filterDecay:.25,
           ampA:.005,ampD:.3,ampS:.6,ampR:.25,lfoRate:.35,lfoDepth:.08,drive:.35}},
  'dark-pad':{osc1Wave:'sawtooth',osc2Wave:'triangle',filterType:'lowpass',lfoTarget:'filter',
    knobs:{oscMix:.5,subLevel:.2,unison:.4,unisonDetune:.45,
           filterCutoff:.32,filterRes:.1,ampA:.7,ampD:.6,ampS:.85,ampR:.75,
           lfoRate:.08,lfoDepth:.25,chorusMix:.4,reverbSend:.75}},
  'vox-pad':{osc1Wave:'triangle',osc2Wave:'sine',filterType:'bandpass',lfoTarget:'filter',
    knobs:{osc2Detune:.55,osc2Octave:.6,oscMix:.45,unison:.25,unisonDetune:.35,
           filterCutoff:.55,filterRes:.3,ampA:.55,ampD:.5,ampS:.85,ampR:.65,
           lfoRate:.12,lfoDepth:.3,chorusMix:.55,reverbSend:.7,delaySend:.25}},
  /* ═══ NEW PRO-GRADE SYNTH PRESETS — 2026-04 expansion ═══
     Each preset tuned against a named reference sound so DJs hit the
     vibe they expect from the label name. */
  'moog-lead':{osc1Wave:'sawtooth',osc2Wave:'sawtooth',filterType:'lowpass',lfoTarget:'none',
    knobs:{osc2Detune:.4,osc2Octave:.25,oscMix:.5,subLevel:.4,unison:.2,unisonDetune:.25,
           filterCutoff:.65,filterRes:.4,filterEnv:.45,filterDecay:.35,
           ampA:.015,ampD:.35,ampS:.8,ampR:.35,drive:.45,delaySend:.25,reverbSend:.35}},
  'wobble-bass':{osc1Wave:'sawtooth',osc2Wave:'square',filterType:'lowpass',lfoTarget:'filter',
    knobs:{osc2Detune:.3,oscMix:.45,subLevel:.5,unison:.5,unisonDetune:.5,
           filterCutoff:.35,filterRes:.55,filterEnv:.3,filterDecay:.4,
           ampA:.005,ampD:.4,ampS:.85,ampR:.3,
           lfoRate:.5,lfoDepth:.85,drive:.55,reverbSend:.25}},
  'pluck-guitar':{osc1Wave:'sawtooth',osc2Wave:'triangle',filterType:'lowpass',lfoTarget:'none',
    knobs:{osc2Detune:.15,oscMix:.35,filterCutoff:.6,filterRes:.25,filterEnv:.7,filterDecay:.2,
           ampA:.002,ampD:.2,ampS:.05,ampR:.22,drive:.25,delaySend:.35,reverbSend:.4,chorusMix:.3}},
  'brass-stack':{osc1Wave:'sawtooth',osc2Wave:'square',filterType:'lowpass',lfoTarget:'pitch',
    knobs:{osc2Detune:.5,osc2Octave:.5,oscMix:.55,unison:.55,unisonDetune:.35,
           filterCutoff:.7,filterRes:.18,filterEnv:.25,filterDecay:.25,
           ampA:.08,ampD:.3,ampS:.75,ampR:.4,
           lfoRate:.22,lfoDepth:.15,drive:.35,chorusMix:.35,reverbSend:.45}},
  'ambient-strings':{osc1Wave:'sawtooth',osc2Wave:'triangle',filterType:'lowpass',lfoTarget:'filter',
    knobs:{oscMix:.5,subLevel:.15,unison:.7,unisonDetune:.5,
           filterCutoff:.55,filterRes:.08,
           ampA:.85,ampD:.6,ampS:.95,ampR:1.0,
           lfoRate:.06,lfoDepth:.25,chorusMix:.55,reverbSend:.85,delaySend:.3}},
  'future-bass-chord':{osc1Wave:'sawtooth',osc2Wave:'sawtooth',filterType:'lowpass',lfoTarget:'amp',
    knobs:{osc2Detune:.65,osc2Octave:.5,oscMix:.55,unison:.8,unisonDetune:.75,
           filterCutoff:.82,filterRes:.12,
           ampA:.06,ampD:.45,ampS:.9,ampR:.5,
           lfoRate:.4,lfoDepth:.35,drive:.25,chorusMix:.55,reverbSend:.65,delaySend:.35}},
  'melodic-techno-lead':{osc1Wave:'sawtooth',osc2Wave:'triangle',filterType:'lowpass',lfoTarget:'filter',
    knobs:{osc2Detune:.4,osc2Octave:.5,oscMix:.4,subLevel:.15,unison:.4,unisonDetune:.4,
           filterCutoff:.55,filterRes:.35,filterEnv:.5,filterDecay:.3,
           ampA:.01,ampD:.35,ampS:.65,ampR:.4,
           lfoRate:.12,lfoDepth:.25,drive:.3,delaySend:.45,reverbSend:.55}},
  'super-saw-anthem':{osc1Wave:'sawtooth',osc2Wave:'sawtooth',filterType:'lowpass',lfoTarget:'none',
    knobs:{osc2Detune:.7,osc2Octave:.5,oscMix:.5,unison:1.0,unisonDetune:.85,
           filterCutoff:.95,filterRes:.08,filterEnv:.2,filterDecay:.3,
           ampA:.08,ampD:.4,ampS:.95,ampR:.55,drive:.2,
           chorusMix:.55,delaySend:.35,reverbSend:.6}},
  'deep-stab':{osc1Wave:'square',osc2Wave:'sawtooth',filterType:'bandpass',lfoTarget:'none',
    knobs:{osc2Detune:.35,osc2Octave:.5,oscMix:.5,filterCutoff:.5,filterRes:.45,
           filterEnv:.6,filterDecay:.15,
           ampA:.003,ampD:.12,ampS:.05,ampR:.15,
           drive:.4,delaySend:.45,reverbSend:.35}},
  'psytrance-lead':{osc1Wave:'sawtooth',osc2Wave:'sawtooth',filterType:'lowpass',lfoTarget:'pitch',
    knobs:{osc2Detune:.5,osc2Octave:.25,oscMix:.5,unison:.4,unisonDetune:.5,
           filterCutoff:.6,filterRes:.4,filterEnv:.55,filterDecay:.25,
           ampA:.005,ampD:.3,ampS:.6,ampR:.25,
           lfoRate:.3,lfoDepth:.2,drive:.55,delaySend:.3,reverbSend:.35}},
};
function spSetKnob(name,v,scope){
  const root=scope?document.querySelector(scope):document;
  const knob=root?.querySelector(`.sp-knob[data-sp-knob="${name}"]`);
  if(knob&&knob._spSet)knob._spSet(v);
}
/* ====================================================================
   TITAN LAB — Hammond B-3 drawbars
   ==================================================================== */
const SP_DRAWBAR_LABELS=[
  {pitch:"16'",col:'brown',note:'SUB'},
  {pitch:"5 1/3'",col:'brown',note:'QNT'},
  {pitch:"8'",col:'white',note:'FND'},
  {pitch:"4'",col:'white',note:'OCT'},
  {pitch:"2 2/3'",col:'black',note:'NAZ'},
  {pitch:"2'",col:'black',note:'BLK'},
  {pitch:"1 3/5'",col:'black',note:'TRZ'},
  {pitch:"1 1/3'",col:'black',note:'LAR'},
  {pitch:"1'",col:'black',note:'SFT'}
];
function spBuildDrawbars(){
  const wrap=document.getElementById('spDrawbars');
  if(!wrap)return;
  wrap.innerHTML='';
  SP_DRAWBAR_LABELS.forEach((info,i)=>{
    const col=document.createElement('div');col.className='sp-drawbar';
    const num=document.createElement('div');num.className='sp-drawbar-num';num.textContent=SP.organ.drawbars[i];
    const track=document.createElement('div');track.className='sp-drawbar-track';
    const knob=document.createElement('div');knob.className='sp-drawbar-knob '+info.col;
    const setPos=()=>{
      const val=SP.organ.drawbars[i];
      const pct=val/8;
      knob.style.top=(pct*(100-18))+'%'; // 18% ≈ knob height
      num.textContent=String(val);
    };
    setPos();
    track.appendChild(knob);
    const label=document.createElement('div');label.className='sp-drawbar-label';
    label.innerHTML=`${info.pitch}<br><span style="color:#ff8a1a">${info.note}</span>`;
    col.appendChild(num);col.appendChild(track);col.appendChild(label);
    wrap.appendChild(col);
    let dragging=false,startY=0,startV=0;
    const onDown=(e)=>{dragging=true;startY=e.clientY;startV=SP.organ.drawbars[i];try{track.setPointerCapture(e.pointerId)}catch(_){};e.preventDefault();};
    const onMove=(e)=>{
      if(!dragging)return;
      const r=track.getBoundingClientRect();
      const dy=(e.clientY-startY);
      const dv=Math.round(dy/(r.height/8)); // one unit per ~16px
      SP.organ.drawbars[i]=Math.max(0,Math.min(8,startV+dv));
      setPos();
    };
    const onUp=(e)=>{dragging=false;try{track.releasePointerCapture(e.pointerId)}catch(_){};};
    track.addEventListener('pointerdown',onDown);
    track.addEventListener('pointermove',onMove);
    track.addEventListener('pointerup',onUp);
    track.addEventListener('pointercancel',onUp);
    track.addEventListener('dblclick',()=>{SP.organ.drawbars[i]=0;setPos();});
    track.addEventListener('wheel',(e)=>{e.preventDefault();SP.organ.drawbars[i]=Math.max(0,Math.min(8,SP.organ.drawbars[i]+(e.deltaY<0?1:-1)));setPos();},{passive:false});
  });
}

/* ====================================================================
   TITAN LAB — TB-303 bass sequencer + patterns
   ==================================================================== */
const SP_BASS_NOTE_NAMES=['A1','A#1','B1','C2','C#2','D2','D#2','E2','F2','F#2','G2','G#2','A2','A#2','B2','C3','C#3','D3'];
const SP_BASS_NOTE_MIDI={
  'A1':33,'A#1':34,'B1':35,'C2':36,'C#2':37,'D2':38,'D#2':39,'E2':40,'F2':41,
  'F#2':42,'G2':43,'G#2':44,'A2':45,'A#2':46,'B2':47,'C3':48,'C#3':49,'D3':50
};
function spBassEmptyPattern(){return Array.from({length:16},()=>({on:false,midi:33,accent:false,slide:false,octave:0}));}
function spBassPatternFrom(defs){
  // defs: array of 16 items — null or {note,accent?,slide?}
  return defs.map(d=>{
    if(!d)return{on:false,midi:33,accent:false,slide:false,octave:0};
    return{on:true,midi:SP_BASS_NOTE_MIDI[d.note]||33,accent:!!d.accent,slide:!!d.slide,octave:0};
  });
}
const SP_BASS_PRESETS={
  'classic-acid':spBassPatternFrom([
    {note:'A1',accent:true},null,{note:'A2'},null,
    {note:'A1'},null,{note:'C2',slide:true},{note:'E2'},
    {note:'A1',accent:true},null,{note:'A2'},null,
    {note:'G2'},null,{note:'A1',slide:true},{note:'A2'},
  ]),
  'trance-bass':spBassPatternFrom([
    {note:'A1'},{note:'A1'},null,{note:'A1'},
    {note:'A1'},{note:'A1'},null,{note:'A1'},
    {note:'A1'},{note:'A1'},null,{note:'A1'},
    {note:'A1'},{note:'A1'},null,{note:'A1',accent:true},
  ]),
  'tech-riff':spBassPatternFrom([
    {note:'A1',accent:true},null,{note:'A1'},{note:'E2'},
    null,{note:'A1'},null,{note:'G2',slide:true},
    {note:'A2',accent:true},null,{note:'A1'},null,
    {note:'E2'},null,{note:'A1',slide:true},{note:'C3'},
  ]),
  'deep-bass':spBassPatternFrom([
    {note:'A1'},null,null,null,
    {note:'A1'},null,null,{note:'C2'},
    {note:'E2'},null,null,null,
    {note:'D2'},null,{note:'A1',slide:true},null,
  ]),
  'hoover-bass':spBassPatternFrom([
    {note:'A1',accent:true},{note:'A1'},{note:'A1'},null,
    {note:'A1'},null,{note:'A1',slide:true},{note:'C2'},
    {note:'A1',accent:true},{note:'A1'},{note:'A1'},null,
    {note:'D2'},null,{note:'A1',slide:true},{note:'E2'},
  ]),
  'psytrance-bass':spBassPatternFrom([
    null,{note:'A1',accent:true},{note:'A1'},{note:'A1'},
    null,{note:'A1',accent:true},{note:'A1'},{note:'A1'},
    null,{note:'A1',accent:true},{note:'A1'},{note:'A1'},
    null,{note:'A1',accent:true},{note:'A1'},{note:'A1'},
  ]),
  'rolling-bass':spBassPatternFrom([
    {note:'A1'},{note:'A1'},null,{note:'A2',slide:true},
    {note:'A1'},null,{note:'C2'},{note:'A1'},
    {note:'A1'},{note:'A1'},null,{note:'E2',slide:true},
    {note:'A1'},null,{note:'G2'},{note:'A1'},
  ]),
  'minimal-bass':spBassPatternFrom([
    {note:'A1'},null,null,null,
    null,null,null,null,
    {note:'E2'},null,null,null,
    null,null,{note:'A1',slide:true},null,
  ]),
  'stab-bass':spBassPatternFrom([
    {note:'A1',accent:true},null,null,{note:'A1'},
    null,null,{note:'E2',accent:true},null,
    null,{note:'A1'},null,null,
    {note:'C3',accent:true},null,null,{note:'A1'},
  ]),
  /* ═══ NEW PRO-GRADE BASS PATTERNS ═══ */
  /* Classic Above & Beyond / Armin rolling octave bass — proper trance
     drop feel. Octave jump down on the 1, back up for drive. Slide on
     the last step carries into the next bar. */
  'trance-rolling':spBassPatternFrom([
    {note:'A1',accent:true},{note:'A2'},{note:'A1'},{note:'A2'},
    {note:'A1'},{note:'A2'},{note:'A1'},{note:'E2',slide:true},
    {note:'A1',accent:true},{note:'A2'},{note:'A1'},{note:'A2'},
    {note:'C2'},{note:'D2'},{note:'A1'},{note:'A2',slide:true},
  ]),
  /* Berlin-techno sub bass — held fundamental on 1 + syncopated
     accents on 3 and the "&" of 4. Deep + hypnotic. */
  'techno-sub':spBassPatternFrom([
    {note:'A1',accent:true},null,null,null,
    null,null,{note:'A1'},null,
    {note:'A1'},null,null,{note:'G2',slide:true},
    null,null,{note:'A1'},{note:'E2'},
  ]),
  /* Jackin' tech-house — FISHER-style bouncy octave walk with
     slides for groove. Drops the 1 hard, adds offbeat push. */
  'jackin-bass':spBassPatternFrom([
    {note:'A1',accent:true},null,{note:'A2'},null,
    {note:'A1'},{note:'A2',slide:true},{note:'C3'},null,
    {note:'A1',accent:true},null,{note:'A2'},{note:'A1'},
    {note:'E2'},{note:'A2',slide:true},{note:'A1'},{note:'G2'},
  ]),
  /* Deep house sub roll — warm 1/8-note walk with minimal octave
     motion.  Sits under the pattern without fighting the kick. */
  'deep-roll':spBassPatternFrom([
    {note:'A1'},null,{note:'A1'},null,
    {note:'A1'},null,{note:'C2'},null,
    {note:'E2'},null,{note:'E2'},null,
    {note:'D2'},null,{note:'A1',slide:true},null,
  ]),
  /* ═══ 5 MORE ACID 303 PATTERNS — classic acid lines ═══ */
  /* Hardfloor "Acperience" — the foundational acid techno riff */
  'hardfloor-acid':spBassPatternFrom([
    {note:'A1',accent:true},{note:'A2'},null,{note:'A1'},
    {note:'C2',slide:true},{note:'E2'},{note:'A2'},null,
    {note:'A1',accent:true},null,{note:'G2',slide:true},{note:'A2'},
    {note:'D2'},{note:'A1'},{note:'C2',slide:true},{note:'E2'},
  ]),
  /* Josh Wink "Higher State of Consciousness" — hypnotic squelchy */
  'higher-state':spBassPatternFrom([
    {note:'A1'},{note:'A2',slide:true},{note:'A2'},{note:'A1'},
    {note:'A1',accent:true},null,{note:'A1'},{note:'C3',slide:true},
    {note:'A2'},{note:'A1'},{note:'E2'},{note:'A2'},
    {note:'A1',accent:true},{note:'A2',slide:true},{note:'A1'},{note:'G2'},
  ]),
  /* Plastikman / Richie Hawtin minimal acid — less notes more space */
  'minimal-acid':spBassPatternFrom([
    {note:'A1',accent:true},null,null,{note:'A1'},
    null,{note:'A2',slide:true},null,null,
    {note:'A1',accent:true},null,{note:'C2'},null,
    null,{note:'A1',slide:true},null,null,
  ]),
  /* Phuture "Acid Tracks" — the original. Simple, rolling, hypnotic */
  'acid-tracks':spBassPatternFrom([
    {note:'A1'},{note:'A1'},{note:'A2',slide:true},{note:'A1'},
    {note:'A1'},{note:'C2',slide:true},{note:'A1'},{note:'A1'},
    {note:'A1'},{note:'A1'},{note:'E2',slide:true},{note:'A1'},
    {note:'A1'},{note:'A2'},{note:'A1'},{note:'A1',accent:true},
  ]),
  /* Psy acid twister — full 16th with aggressive slides */
  'psy-acid':spBassPatternFrom([
    {note:'A1',accent:true},{note:'A1'},{note:'A2',slide:true},{note:'A1'},
    {note:'C3',slide:true},{note:'A1'},{note:'G2'},{note:'A1'},
    {note:'A1',accent:true},{note:'E2',slide:true},{note:'A2'},{note:'A1'},
    {note:'D2'},{note:'A2',slide:true},{note:'A1'},{note:'C2',slide:true},
  ]),
};
function spBuildBassSeq(){
  const row=document.getElementById('spBassSeq');
  if(!row)return;
  row.innerHTML='';
  SP.bass.stepEls=new Array(16).fill(null);
  const lbl=document.createElement('div');
  lbl.className='sp-seq-label';
  lbl.innerHTML='<span>TB-303</span>';
  row.appendChild(lbl);
  for(let i=0;i<16;i++){
    const s=SP.bass.pattern[i];
    const cell=document.createElement('div');
    cell.className='sp-bass-step'+(s.on?' on':'');
    cell.dataset.spStep=i;
    // note select
    const sel=document.createElement('select');
    SP_BASS_NOTE_NAMES.forEach(n=>{
      const opt=document.createElement('option');opt.value=n;opt.textContent=n;sel.appendChild(opt);
    });
    const noteName=Object.keys(SP_BASS_NOTE_MIDI).find(k=>SP_BASS_NOTE_MIDI[k]===s.midi)||'A1';
    sel.value=noteName;
    sel.addEventListener('change',e=>{e.stopPropagation();s.midi=SP_BASS_NOTE_MIDI[sel.value]||33;});
    sel.addEventListener('click',e=>e.stopPropagation());
    cell.appendChild(sel);
    // flags
    const flags=document.createElement('div');flags.className='sp-bass-flags';
    const mk=(key,label,extra='')=>{
      const f=document.createElement('div');
      f.className='sp-bass-flag '+extra+(s[key]?' on':'');
      f.textContent=label;
      f.addEventListener('click',e=>{
        e.stopPropagation();
        s[key]=!s[key];
        f.classList.toggle('on',s[key]);
      });
      return f;
    };
    flags.appendChild(mk('accent','A'));
    flags.appendChild(mk('slide','S','slide'));
    cell.appendChild(flags);
    // toggling step on/off
    cell.addEventListener('click',()=>{
      s.on=!s.on;
      cell.classList.toggle('on',s.on);
    });
    row.appendChild(cell);
    SP.bass.stepEls[i]=cell;
  }
}

/* Piano keyboard renderer — 2 octaves, white + black keys, data-sp-midi */
function spBuildPiano(){
  const piano=document.getElementById('spPiano');
  if(!piano)return;
  piano.innerHTML='';
  const OCTAVES=2;
  const whiteCount=7*OCTAVES;
  const whiteIdxInOctave=[0,2,4,5,7,9,11];     // C D E F G A B
  const blackIdxInOctave=[1,3,-1,6,8,10,-1];   // offset after each white; -1 = no black
  const blackLabels={1:'C#',3:'D#',6:'F#',8:'G#',10:'A#'};
  const whiteLabels={0:'C',2:'D',4:'E',5:'F',7:'G',9:'A',11:'B'};
  const baseMidi=(SP.octave+1)*12; // C of selected octave
  const base=SP.activeInst==='bass'?baseMidi-24:baseMidi; // bass shifted 2 oct down for useful range
  for(let o=0;o<OCTAVES;o++){
    for(let wi=0;wi<7;wi++){
      const midi=base+o*12+whiteIdxInOctave[wi];
      const w=document.createElement('div');
      w.className='sp-key sp-key-white';
      w.dataset.spMidi=midi;
      w.style.left=((o*7+wi)/whiteCount*100)+'%';
      w.style.width=(100/whiteCount)+'%';
      if(wi===0){const lab=document.createElement('span');lab.className='sp-key-label';lab.textContent=whiteLabels[whiteIdxInOctave[wi]]+(SP.octave+o);w.appendChild(lab);}
      piano.appendChild(w);
    }
  }
  for(let o=0;o<OCTAVES;o++){
    for(let wi=0;wi<7;wi++){
      const bIdx=blackIdxInOctave[wi];
      if(bIdx<0)continue;
      const midi=base+o*12+bIdx;
      const k=document.createElement('div');
      k.className='sp-key sp-key-black';
      k.dataset.spMidi=midi;
      const leftPct=((o*7+wi+1)/whiteCount*100);
      const w=(100/whiteCount)*0.62;
      k.style.left=(leftPct-w/2)+'%';
      k.style.width=w+'%';
      piano.appendChild(k);
    }
  }
  // pointer events
  piano.querySelectorAll('.sp-key').forEach(k=>{
    const midi=+k.dataset.spMidi;
    const on=()=>{k.classList.add('active');
      if(SP.activeInst==='synth')spSynthNoteOn(midi);
      else if(SP.activeInst==='organ')spOrganNoteOn(midi);
      else if(SP.activeInst==='bass')spBassNoteOn(midi,false,false);
    };
    const off=()=>{k.classList.remove('active');
      if(SP.activeInst==='synth')spSynthNoteOff(midi);
      else if(SP.activeInst==='organ')spOrganNoteOff(midi);
      else if(SP.activeInst==='bass'){if(SP.bass.currentMidi===midi)spBassNoteOff(false);}
    };
    k.addEventListener('pointerdown',e=>{e.preventDefault();try{k.setPointerCapture(e.pointerId)}catch(_){}on();});
    k.addEventListener('pointerup',off);
    k.addEventListener('pointercancel',off);
    k.addEventListener('pointerleave',e=>{if(e.buttons)off();});
  });
}
function spApplySynthPreset(key){
  const p=SP_SYNTH_PRESETS[key];if(!p)return;
  SP.synth.osc1Wave=p.osc1Wave;SP.synth.osc2Wave=p.osc2Wave;
  SP.synth.filterType=p.filterType;SP.synth.lfoTarget=p.lfoTarget;
  // reflect wave / filter / lfo selections
  document.querySelectorAll('.sp-osc-wave[data-sp-osc="1"] [data-sp-wave]').forEach(b=>b.classList.toggle('active',b.dataset.spWave===p.osc1Wave));
  document.querySelectorAll('.sp-osc-wave[data-sp-osc="2"] [data-sp-wave]').forEach(b=>b.classList.toggle('active',b.dataset.spWave===p.osc2Wave));
  document.querySelectorAll('[data-sp-filter-type] [data-sp-filter]').forEach(b=>b.classList.toggle('active',b.dataset.spFilter===p.filterType));
  document.querySelectorAll('[data-sp-lfo-target] [data-sp-lfo]').forEach(b=>b.classList.toggle('active',b.dataset.spLfo===p.lfoTarget));
  // reset every synth knob to default, then apply preset overrides
  for(const k in SP_P){
    if(!(k in SP.synth.knobs) && ['osc2Detune','osc2Octave','oscMix','subLevel','unison','unisonDetune',
      'filterCutoff','filterRes','filterEnv','filterDecay','drive',
      'ampA','ampD','ampS','ampR','glide','lfoRate','lfoDepth','chorusMix','delaySend','reverbSend'].indexOf(k)<0)continue;
  }
  ['osc2Detune','osc2Octave','oscMix','subLevel','unison','unisonDetune',
   'filterCutoff','filterRes','filterEnv','filterDecay','drive',
   'ampA','ampD','ampS','ampR','glide','lfoRate','lfoDepth','chorusMix','delaySend','reverbSend'].forEach(k=>{
    const v=(p.knobs&&k in p.knobs)?p.knobs[k]:SP_P[k][2];
    spSetKnob(k,v,'#spInstSynth');
  });
}

/* ====================================================================
   TITAN LAB — Hammond organ preset bank
   ==================================================================== */
const SP_ORGAN_PRESETS={
  // drawbars: 16', 5 1/3', 8', 4', 2 2/3', 2', 1 3/5', 1 1/3', 1'
  // knobs normalised 0..1 for the 7 organ knobs
  'hammond-jazz':  {drawbars:[8,8,8,0,0,0,0,0,0], knobs:{organPerc:.55,organPercTone:1,organPercDec:.3,organLeslie:.45,organLeslieRate:.55,organDrive:.2,organVol:.75}},
  'full-jazz':     {drawbars:[8,8,8,8,6,4,0,0,0], knobs:{organPerc:.45,organPercTone:0,organPercDec:.25,organLeslie:.4,organLeslieRate:.5,organDrive:.25,organVol:.8}},
  'gospel':        {drawbars:[8,0,8,8,0,6,0,8,6], knobs:{organPerc:.3,organPercTone:1,organPercDec:.2,organLeslie:.55,organLeslieRate:.6,organDrive:.2,organVol:.8}},
  'rock-organ':    {drawbars:[8,8,8,0,6,0,0,6,8], knobs:{organPerc:.1,organPercTone:1,organPercDec:.2,organLeslie:.65,organLeslieRate:.75,organDrive:.65,organVol:.85}},
  'dirty-b3':      {drawbars:[8,8,8,8,0,0,0,6,8], knobs:{organPerc:.7,organPercTone:1,organPercDec:.22,organLeslie:.7,organLeslieRate:.8,organDrive:.75,organVol:.85}},
  'church-organ':  {drawbars:[8,0,8,8,8,8,0,0,0], knobs:{organPerc:0,organPercTone:0,organPercDec:.2,organLeslie:0,organLeslieRate:.25,organDrive:0,organVol:.78}},
  'trance-pad':    {drawbars:[8,0,8,8,0,0,0,0,0], knobs:{organPerc:0,organPercTone:0,organPercDec:.2,organLeslie:.55,organLeslieRate:.4,organDrive:.12,organVol:.75}},
  // BASS presets — 16' dominant, 8' for body, no high drawbars
  'house-bass':    {drawbars:[8,0,8,0,0,0,0,0,0], knobs:{organPerc:0,organPercTone:0,organPercDec:.2,organLeslie:0,organLeslieRate:.2,organDrive:.4,organVol:.9}},
  'deep-bass':     {drawbars:[8,0,6,0,0,0,0,0,0], knobs:{organPerc:0,organPercTone:0,organPercDec:.2,organLeslie:.15,organLeslieRate:.2,organDrive:.45,organVol:.88}},
  'techno-sub':    {drawbars:[8,0,0,0,0,0,0,0,0], knobs:{organPerc:0,organPercTone:0,organPercDec:.2,organLeslie:0,organLeslieRate:.2,organDrive:.3,organVol:.95}},
  'trance-sub':    {drawbars:[8,0,2,0,0,0,0,0,0], knobs:{organPerc:0,organPercTone:0,organPercDec:.2,organLeslie:.25,organLeslieRate:.2,organDrive:.4,organVol:.9}},
  'psy-bass':      {drawbars:[8,0,4,0,0,2,0,0,0], knobs:{organPerc:0,organPercTone:1,organPercDec:.15,organLeslie:.15,organLeslieRate:.3,organDrive:.6,organVol:.9}},
  'acid-organ':    {drawbars:[8,0,8,0,0,4,0,0,0], knobs:{organPerc:.3,organPercTone:1,organPercDec:.15,organLeslie:.3,organLeslieRate:.5,organDrive:.55,organVol:.85}},
  'reese-organ':   {drawbars:[8,6,8,4,0,0,0,0,0], knobs:{organPerc:.1,organPercTone:0,organPercDec:.25,organLeslie:.25,organLeslieRate:.3,organDrive:.55,organVol:.88}},
  'big-room-lead': {drawbars:[4,0,8,8,6,6,0,0,0], knobs:{organPerc:.5,organPercTone:1,organPercDec:.25,organLeslie:.35,organLeslieRate:.55,organDrive:.4,organVol:.85}},
  /* ═══ NEW HAMMOND B-3 PRESETS — tuned to famous records ═══ */
  'smokey-organ':  {drawbars:[8,8,8,0,3,0,0,0,0], knobs:{organPerc:.65,organPercTone:1,organPercDec:.4,organLeslie:.35,organLeslieRate:.5,organDrive:.3,organVol:.8}},   // Booker T / Jimmy Smith lounge
  'procol-ballad': {drawbars:[8,8,6,6,0,0,0,0,0], knobs:{organPerc:0,organPercTone:0,organPercDec:.2,organLeslie:.25,organLeslieRate:.35,organDrive:.15,organVol:.78}},  // "Whiter Shade of Pale"
  'santana-crunch':{drawbars:[8,8,8,8,0,0,0,6,8], knobs:{organPerc:.55,organPercTone:1,organPercDec:.2,organLeslie:.8,organLeslieRate:.85,organDrive:.8,organVol:.85}},  // Santana crunch
  'deep-bass-organ':{drawbars:[8,0,4,0,0,0,0,0,0], knobs:{organPerc:0,organPercTone:0,organPercDec:.2,organLeslie:0,organLeslieRate:.2,organDrive:.55,organVol:.95}},   // sub bass pedal
  'psychedelic-swell':{drawbars:[8,6,8,8,6,0,0,0,0], knobs:{organPerc:.2,organPercTone:0,organPercDec:.35,organLeslie:.9,organLeslieRate:.9,organDrive:.35,organVol:.8}}, // Doors / 60s psyche
  'funk-clavinet': {drawbars:[8,0,8,0,0,8,0,0,0], knobs:{organPerc:.8,organPercTone:1,organPercDec:.15,organLeslie:.5,organLeslieRate:.65,organDrive:.45,organVol:.85}},  // Stevie / funk
};
function spApplyOrganPreset(key){
  const p=SP_ORGAN_PRESETS[key];if(!p)return;
  SP.organ.drawbars=p.drawbars.slice();
  spBuildDrawbars();
  if(p.knobs){Object.keys(p.knobs).forEach(k=>spSetKnob(k,p.knobs[k],'#spInstOrgan'));}
  document.querySelectorAll('[data-sp-organ-preset]').forEach(b=>b.classList.toggle('active',b.dataset.spOrganPreset===key));
}

/* ====================================================================
   TITAN LAB — VIBE SOUND CODING engine
   ==================================================================== */
const SP_CHORD_PROGRESSIONS={
  // each entry = 4 chords (1 chord per bar), MIDI triads in listener-friendly ranges
  'am-trance'    :[[57,60,64,69],[53,57,60,65],[60,64,67,72],[55,59,62,67]], // Am-F-C-G
  'am-house'     :[[57,60,64,69],[50,53,57,62],[53,57,60,65],[52,56,59,64]], // Am-Dm-F-E
  'am-emotional' :[[57,60,64,69],[50,53,57,62],[52,56,59,64],[57,60,64,69]], // Am-Dm-E-Am
  'am-techno'    :[[45,48,52,57],[45,48,52,57],[41,45,48,53],[40,44,47,52]], // low Am-Am-F-E
  'em-deep'      :[[52,55,59,64],[48,52,55,60],[55,59,62,67],[50,54,57,62]], // Em-C-G-D
  'em-moody'     :[[52,55,59,64],[55,58,62,67],[48,52,55,60],[50,54,57,62]], // Em-G-C-D
  'em-psy'       :[[52,55,59,64],[55,58,62,67],[50,54,57,62],[53,56,60,65]], // Em-G-D-F
  'fm-dark'      :[[41,44,48,53],[39,42,46,51],[44,47,51,56],[41,44,48,53]], // Fm-Eb-Ab-Fm
  'cm-minimal'   :[[48,51,55,60],[43,46,50,55],[46,51,53,58],[48,51,55,60]], // Cm-G-Ab-Cm
  'cm-deep'      :[[48,51,55,60],[46,50,53,58],[55,58,62,67],[53,56,60,65]], // Cm-Bb-G-F
  'am-lift'      :[[69,72,76,81],[65,69,72,77],[72,76,79,84],[67,71,74,79]], // Am-F-C-G high
  'am-euphoric'  :[[72,76,79,84],[67,71,74,79],[69,72,76,81],[65,69,72,77]], // C-G-Am-F (high)
  'gm-progressive':[[55,58,62,67],[50,53,57,62],[53,56,60,65],[46,50,53,58]], // Gm-Dm-F-Bb
};
// Per vibe: which progressions are musically appropriate. Random pick per generate → variation.
const SP_CHORD_VARIANTS={
  'am-trance'   :['am-trance','am-emotional','am-lift','em-moody'],
  'am-house'    :['am-house','am-emotional','am-trance','cm-deep'],
  'am-techno'   :['am-techno','fm-dark','em-psy','am-techno'],
  'em-deep'     :['em-deep','em-moody','cm-deep','am-emotional'],
  'em-psy'      :['em-psy','em-moody','fm-dark','em-deep'],
  'cm-minimal'  :['cm-minimal','cm-deep','fm-dark','em-moody'],
  'am-lift'     :['am-lift','am-euphoric','am-trance','gm-progressive'],
  _default      :['am-trance','am-lift'],
};
const SP_VIBE_PRESETS={
  /* Core vibe templates — referenced by chip + keyword parser.
     Values tuned 2026-04 to pro-tier club-ready sound — bigger reverb
     tails on melodic vibes, proper drive on techno, and peak-time drop
     patterns for anything that reads as "high energy" in the prompt. */
  'trance'     :{bpm:138,drum:'trance-peak',   bass:'trance-rolling',synth:'trance-supersaw',chord:'am-lift',      fx:{delaySend:.50,reverbSend:.75,chorusMix:.45,masterDrive:.20}},
  'uplifting'  :{bpm:140,drum:'trance-peak',   bass:'trance-rolling',synth:'trance-supersaw',chord:'am-euphoric',  fx:{delaySend:.55,reverbSend:.85,chorusMix:.55,masterDrive:.18}},
  'hoover'     :{bpm:142,drum:'trance-2',      bass:'hoover-bass',   synth:'hoover',         chord:'am-trance',    fx:{delaySend:.40,reverbSend:.60,chorusMix:.50,masterDrive:.35}},
  'psytrance'  :{bpm:145,drum:'psytrance',     bass:'psytrance-bass',synth:'acid-303',       chord:'em-psy',       fx:{delaySend:.25,reverbSend:.45,masterDrive:.45}},
  'techno'     :{bpm:130,drum:'techno-drive',  bass:'techno-sub',    synth:'techno-reese',   chord:'am-techno',    fx:{delaySend:.30,reverbSend:.35,masterDrive:.40}},
  'dark-techno':{bpm:132,drum:'techno-drive',  bass:'techno-sub',    synth:'dark-bass',      chord:'fm-dark',      fx:{delaySend:.25,reverbSend:.50,masterDrive:.50}},
  'acid'       :{bpm:130,drum:'techno',        bass:'classic-acid',  synth:'acid-303',       chord:'am-techno',    fx:{delaySend:.45,reverbSend:.40,masterDrive:.40}},
  'house'      :{bpm:124,drum:'house-groove',  bass:'deep-roll',     synth:'house-piano',    chord:'am-house',     fx:{delaySend:.30,reverbSend:.55,chorusMix:.30}},
  'deep-house' :{bpm:122,drum:'deep-house-garage',bass:'deep-roll',  synth:'warm-pad',       chord:'em-deep',      fx:{delaySend:.30,reverbSend:.70,chorusMix:.40}},
  'tech-house' :{bpm:124,drum:'tech-house-peak',bass:'jackin-bass',  synth:'tech-stab',      chord:'am-house',     fx:{delaySend:.40,reverbSend:.40,masterDrive:.15}},
  'big-room'   :{bpm:128,drum:'big-room',      bass:'reese-bass',    synth:'big-room',       chord:'am-lift',      fx:{delaySend:.30,reverbSend:.60,masterDrive:.40,chorusMix:.30}},
  'minimal'    :{bpm:126,drum:'minimal',       bass:'minimal-bass',  synth:'deep-pluck',     chord:'cm-minimal',   fx:{delaySend:.35,reverbSend:.45}},
  'dreamy'     :{bpm:110,drum:'deep-house-garage',bass:'sub-bass',   synth:'vox-pad',        chord:'em-deep',      fx:{delaySend:.45,reverbSend:.85,chorusMix:.60}},
  'peak-time'  :{bpm:130,drum:'techno-drive',  bass:'techno-sub',    synth:'reese-bass',     chord:'am-techno',    fx:{delaySend:.30,reverbSend:.40,masterDrive:.50}},
};
const SP_VIBE_KEYWORDS={
  // keyword -> key in SP_VIBE_PRESETS (order: longest match wins at parse time)
  'dark techno':'dark-techno','tech house':'tech-house','tech-house':'tech-house',
  'deep house':'deep-house','deep-house':'deep-house',
  'big room':'big-room','bigroom':'big-room','big-room':'big-room',
  'main stage':'big-room','festival':'big-room','edm':'big-room','future house':'big-room',
  'psytrance':'psytrance','psy-trance':'psytrance','psy':'psytrance',
  'goa':'psytrance','forest':'psytrance','tribal':'psytrance','hi-tech':'psytrance',
  'uplifting':'uplifting','progressive':'uplifting','melodic':'uplifting',
  'emotional':'uplifting','euphoric':'uplifting','anjuna':'uplifting',
  'hardstyle':'hoover','hoover':'hoover','hard dance':'hoover','hardcore':'hoover',
  'detroit':'techno','berlin':'techno','industrial':'dark-techno','warehouse':'techno','peak time':'peak-time','peak-time':'peak-time','club':'peak-time','dancefloor':'peak-time','drop':'peak-time',
  'acid techno':'acid','303':'acid','acid':'acid',
  'afterhours':'minimal','lofi':'minimal','underground':'minimal',
  'jackin':'tech-house','jack':'tech-house','club':'house',
  'sunset':'deep-house','summer':'deep-house','night':'deep-house','balearic':'deep-house',
  'ibiza':'deep-house','piano house':'house','french':'house',
  'trance':'trance','rave':'trance',
  'techno':'techno','house':'house',
  'minimal':'minimal',
  'dreamy':'dreamy','ambient':'dreamy','chill':'dreamy','ocean':'dreamy','spa':'dreamy','soft':'dreamy',
  'pad':'dreamy',
};
function spVibeParse(text){
  const src=(text||'').toLowerCase().trim();
  let vibeKey='trance';
  // longest keywords first — use array to iterate deterministically
  for(const k of Object.keys(SP_VIBE_KEYWORDS).sort((a,b)=>b.length-a.length)){
    if(src.indexOf(k)>=0){vibeKey=SP_VIBE_KEYWORDS[k];break;}
  }
  const spec={...SP_VIBE_PRESETS[vibeKey],_name:vibeKey,_fromText:src};
  // BPM override — look for 3-digit number
  const bpmM=src.match(/\b(\d{2,3})\s*(bpm)?\b/);
  if(bpmM){const n=parseInt(bpmM[1],10);if(n>=70&&n<=200)spec.bpm=n;}
  // Mood tweaks
  if(/\bdark\b|\bdeep\b|\bmoody\b|\bnight\b/.test(src)){spec.fx={...spec.fx,reverbSend:(spec.fx?.reverbSend||.3)+.1,masterDrive:(spec.fx?.masterDrive||0)+.15};spec._dark=true;}
  if(/\bpeak\b|\benergy\b|\bheavy\b|\bdriving?\b|\bintense\b|\bpowerful\b|\baggressive\b/.test(src)){
    spec.fx={...spec.fx,masterDrive:(spec.fx?.masterDrive||0)+.2};spec._peak=true;
    spec.bpm=Math.min(150,spec.bpm+2);
  }
  if(/\bemotional\b|\bmelancholic\b|\bsad\b|\bsoft\b|\bmellow\b/.test(src)){
    spec.fx={...spec.fx,reverbSend:Math.min(.9,(spec.fx?.reverbSend||.3)+.2),
      masterDrive:Math.max(0,(spec.fx?.masterDrive||0)-.1)};spec._emotional=true;
  }
  if(/\bslow\b|\bchill\b|\bsmooth\b/.test(src)&&!bpmM){spec.bpm=Math.max(100,spec.bpm-12);}
  if(/\bfast\b|\bhard\b|\brushing\b/.test(src)&&!bpmM){spec.bpm=Math.min(150,spec.bpm+8);}
  if(/\bbig\b|\breverb\b|\bambient\b|\bspace\b|\bcosmic\b/.test(src)){spec.fx={...spec.fx,reverbSend:Math.min(.9,(spec.fx?.reverbSend||.3)+.25)};}
  if(/\bchorus\b|\bwide\b|\bstereo\b|\bneon\b/.test(src)){spec.fx={...spec.fx,chorusMix:Math.min(.8,(spec.fx?.chorusMix||.2)+.25)};}
  if(/\bdelay\b|\becho\b|\bdub\b/.test(src)){spec.fx={...spec.fx,delaySend:Math.min(.8,(spec.fx?.delaySend||.2)+.25)};}
  if(/\bsidechain\b|\bpump\b|\bducked\b/.test(src)){/* already always on for kick; keep for future use */}
  // Instrument hints (override synth) — more specific wins
  if(/\bhoover\b/.test(src))spec.synth='hoover';
  else if(/\bsupersaw\b/.test(src))spec.synth='trance-supersaw';
  else if(/\bbig\s*room\s*lead\b|\bfestival\s*lead\b/.test(src))spec.synth='big-room';
  else if(/\bpiano\b/.test(src))spec.synth='house-piano';
  else if(/\bsub\b/.test(src))spec.synth='sub-bass';
  else if(/\bpluck\b/.test(src))spec.synth='pluck-lead';
  else if(/\bdark\s*pad\b/.test(src))spec.synth='dark-pad';
  else if(/\bwarm\s*pad\b|\bpad\b/.test(src))spec.synth='warm-pad';
  else if(/\bvox\b|\bvowel\b|\bchoir\b/.test(src))spec.synth='vox-pad';
  else if(/\bbell\b|\bglass\b/.test(src))spec.synth='fm-bell';
  else if(/\breese\b|\bgrowl\b/.test(src))spec.synth='reese-bass';
  else if(/\bsaw\s*lead\b/.test(src))spec.synth='saw-lead';
  else if(/\bchurch\b|\bcathedral\b/.test(src))spec.synth='church-organ';
  // Bass hints
  if(/\brolling\b/.test(src))spec.bass='rolling-bass';
  else if(/\bacid\b|\b303\b/.test(src))spec.bass='classic-acid';
  else if(/\bsub\b/.test(src))spec.bass='deep-bass';
  else if(/\bstab\b/.test(src))spec.bass='stab-bass';
  else if(/\bpsy\b|\bforest\b/.test(src))spec.bass='psytrance-bass';
  else if(/\bhoover\b|\brolling\b/.test(src))spec.bass=spec.bass||'hoover-bass';
  return spec;
}
function spVibeRandomizeDrums(){
  // light human-feel variation — add ghost shaker/perc hits so it's not identical every time
  const pat=SP.drum.pattern;if(!pat)return;
  const voices=SP.drum.voices;
  const shakerIdx=voices.indexOf('SHAKER');
  const percIdx=voices.indexOf('PERC');
  const rand=()=>Math.random()<0.35;
  if(shakerIdx>=0){for(let s=0;s<16;s++)if(pat[shakerIdx][s]===0 && rand())pat[shakerIdx][s]=1;}
  if(percIdx>=0){for(let s=1;s<16;s+=2)if(pat[percIdx][s]===0 && Math.random()<0.2)pat[percIdx][s]=1;}
}
/* ====================================================================
   VIBE 2.0 — song structure engine (intro / build / drop / break / outro)
   ==================================================================== */
const SP_SONG_TEMPLATES={
  // Pro-grade 64-bar arrangement: INTRO 8 · BUILD 8 · DROP 16 · BREAK 8 · DROP 2 16 · OUTRO 8
  'trance':[
    {name:'INTRO',bars:8,kind:'intro'},
    {name:'BUILD',bars:8,kind:'build'},
    {name:'DROP',bars:16,kind:'drop'},
    {name:'BREAK',bars:8,kind:'break'},
    {name:'DROP 2',bars:16,kind:'drop'},
    {name:'OUTRO',bars:8,kind:'outro'},
  ],
  'techno':[
    {name:'INTRO',bars:8,kind:'intro-techno'},
    {name:'BUILD',bars:8,kind:'build'},
    {name:'DROP',bars:16,kind:'drop'},
    {name:'BREAK',bars:8,kind:'break-techno'},
    {name:'DROP 2',bars:16,kind:'drop'},
    {name:'OUTRO',bars:8,kind:'outro'},
  ],
  'house':[
    {name:'INTRO',bars:8,kind:'intro'},
    {name:'BUILD',bars:8,kind:'build'},
    {name:'DROP',bars:16,kind:'drop'},
    {name:'BREAK',bars:8,kind:'break'},
    {name:'DROP 2',bars:16,kind:'drop'},
    {name:'OUTRO',bars:8,kind:'outro'},
  ],
  'psytrance':[
    {name:'INTRO',bars:8,kind:'intro-techno'},
    {name:'BUILD',bars:8,kind:'build'},
    {name:'DROP',bars:32,kind:'drop'},
    {name:'BREAK',bars:8,kind:'break-techno'},
    {name:'DROP 2',bars:32,kind:'drop'},
    {name:'OUTRO',bars:8,kind:'outro'},
  ],
  'dreamy':[
    {name:'INTRO',bars:4,kind:'break'},
    {name:'MOVE',bars:8,kind:'build'},
    {name:'OPEN',bars:16,kind:'drop'},
    {name:'FLOAT',bars:8,kind:'break'},
    {name:'GROW',bars:16,kind:'drop'},
    {name:'OUTRO',bars:8,kind:'outro'},
  ],
};
function spSongSectionsFor(vibeName){
  // check longest / more-specific matches first to avoid psytrance -> trance bug
  if(/psytrance|psy/.test(vibeName))return SP_SONG_TEMPLATES.psytrance.map(s=>({...s}));
  if(/dreamy|ambient/.test(vibeName))return SP_SONG_TEMPLATES.dreamy.map(s=>({...s}));
  if(/trance|hoover|uplifting/.test(vibeName))return SP_SONG_TEMPLATES.trance.map(s=>({...s}));
  if(/techno|minimal|acid/.test(vibeName))return SP_SONG_TEMPLATES.techno.map(s=>({...s}));
  return SP_SONG_TEMPLATES.house.map(s=>({...s}));
}
function spSongReset(vibeName){
  SP.song=SP.song||{};
  SP.song.enabled=true;
  SP.song.sections=spSongSectionsFor(vibeName||'');
  SP.song.sectionIdx=0;
  SP.song.barInSection=0;
  SP.song.activeDrums=true;
  SP.song.activeBass=true;
  SP.song.activeSynth=true;
  SP.song.snareRoll=false;
  SP.song.seed=(Math.random()*1e9)|0;
  // kick automation filter back to fully open
  if(SP.nodes&&SP.nodes.synthAutoFilter){
    try{SP.nodes.synthAutoFilter.frequency.cancelScheduledValues(audioCtx.currentTime);
      SP.nodes.synthAutoFilter.frequency.setValueAtTime(22000,audioCtx.currentTime);}catch(_){}
  }
}
function spSongAdvanceBar(){
  if(!SP.song||!SP.song.enabled||!SP.song.sections||!audioCtx)return;
  let section=SP.song.sections[SP.song.sectionIdx];
  if(SP.song.barInSection>=section.bars){
    SP.song.sectionIdx=(SP.song.sectionIdx+1)%SP.song.sections.length;
    SP.song.barInSection=0;
    section=SP.song.sections[SP.song.sectionIdx];
    // flash section name in status
    const st=document.getElementById('spVibeStatus');
    if(st){
      const full=st.getAttribute('data-ai')||st.textContent||'';
      st.innerHTML=full+` <span style="color:#ff8a1a">§ ${section.name}</span>`;
    }
  }
  const k=section.kind;
  const now=audioCtx.currentTime;
  const barSec=60/SP.transport.bpm*4;
  const sf=SP.nodes&&SP.nodes.synthAutoFilter;
  // defaults
  SP.song.activeDrums=true;SP.song.activeBass=true;SP.song.activeSynth=true;SP.song.snareRoll=false;
  if(k==='intro'){
    SP.song.activeSynth=false;
    SP.song.activeBass=SP.song.barInSection>=2; // bass enters halfway
    if(sf){try{sf.frequency.cancelScheduledValues(now);sf.frequency.setTargetAtTime(700,now,0.1);}catch(_){}}
  }else if(k==='intro-techno'){
    SP.song.activeSynth=false;
    SP.song.activeBass=true;
    if(sf){try{sf.frequency.cancelScheduledValues(now);sf.frequency.setTargetAtTime(400,now,0.2);}catch(_){}}
  }else if(k==='build'){
    // open filter gradually across the build section
    if(sf && SP.song.barInSection===0){
      try{sf.frequency.cancelScheduledValues(now);
        sf.frequency.setValueAtTime(600,now);
        sf.frequency.linearRampToValueAtTime(20000,now+section.bars*barSec);}catch(_){}
    }
    // White-noise riser fires 2 bars before the drop for pro tension
    if(SP.song.barInSection===Math.max(0,section.bars-2))spTriggerNoiseRiser(2*barSec);
    // snare roll on the last bar
    if(SP.song.barInSection===section.bars-1)SP.song.snareRoll=true;
  }else if(k==='drop'){
    if(sf){try{sf.frequency.cancelScheduledValues(now);sf.frequency.setTargetAtTime(22000,now,0.08);}catch(_){}}
    // reverb throw at the start of every drop section for impact
    if(SP.song.barInSection===0)spReverbThrow(600);
  }else if(k==='break'){
    SP.song.activeDrums=false;SP.song.activeBass=false;
    if(sf){try{sf.frequency.cancelScheduledValues(now);sf.frequency.setTargetAtTime(22000,now,0.2);}catch(_){}}
  }else if(k==='break-techno'){
    SP.song.activeDrums=false;
    if(sf){try{sf.frequency.cancelScheduledValues(now);sf.frequency.setTargetAtTime(8000,now,0.2);}catch(_){}}
  }else if(k==='outro'){
    SP.song.activeBass=false;SP.song.activeSynth=false;
    if(sf){try{sf.frequency.cancelScheduledValues(now);sf.frequency.linearRampToValueAtTime(300,now+section.bars*barSec);}catch(_){}}
  }
  SP.song.barInSection++;
}

/* Drum velocity humanize — ±8% per hit for groove */
function spHumanizeVel(v){return Math.max(0.1,Math.min(1.6,v*(1+(Math.random()-0.5)*0.16)));}

/* Side-chain pulse — ducks bass + organ briefly on a kick hit (pro pump feel) */
function spSidechainDuck(time){
  if(!SP.ready)return;
  const now=audioCtx.currentTime;
  const t=Math.max(time||now,now);
  const duck=(gNode,floor,recovery)=>{
    if(!gNode)return;
    try{
      const g=gNode.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value,t);
      g.linearRampToValueAtTime(floor,t+0.006);
      g.linearRampToValueAtTime(1.0,t+recovery);
    }catch(_){}
  };
  duck(SP.nodes.bassSidechain,0.35,0.18);
  duck(SP.nodes.organSidechain,0.55,0.22);
}

/* Filtered white-noise riser — builds tension for the last N bars of a build section */
function spTriggerNoiseRiser(durationSec){
  if(!SP.ready||!SP._riserBuffer)return;
  const ctx=audioCtx,t=ctx.currentTime+0.02;
  const dur=Math.max(0.5,durationSec||2);
  const src=ctx.createBufferSource();src.buffer=SP._riserBuffer;src.loop=true;
  const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=200;hp.Q.value=1;
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=2000;
  const g=ctx.createGain();g.gain.value=0;
  src.connect(hp);hp.connect(lp);lp.connect(g);g.connect(SP.nodes.master);
  // amplitude + filter automation
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(0.28,t+dur*0.92);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur+0.06);
  hp.frequency.setValueAtTime(200,t);
  hp.frequency.exponentialRampToValueAtTime(5000,t+dur);
  lp.frequency.setValueAtTime(2000,t);
  lp.frequency.exponentialRampToValueAtTime(18000,t+dur);
  src.start(t);src.stop(t+dur+0.15);
  // clean up
  setTimeout(()=>{try{src.disconnect();hp.disconnect();lp.disconnect();g.disconnect();}catch(_){}},(dur+0.3)*1000);
}
/* Reverb throw — brief reverb-send spike for drop impacts */
function spReverbThrow(durMs){
  if(!SP.ready||!SP.nodes.reverbWet)return;
  const ctx=audioCtx,t=ctx.currentTime;
  const cur=SP.nodes.reverbWet.gain.value;
  try{
    SP.nodes.reverbWet.gain.cancelScheduledValues(t);
    SP.nodes.reverbWet.gain.setValueAtTime(cur,t);
    SP.nodes.reverbWet.gain.linearRampToValueAtTime(Math.max(0.35,cur*2.5),t+0.05);
    SP.nodes.reverbWet.gain.linearRampToValueAtTime(cur,t+(durMs||500)/1000);
  }catch(_){}
}

function spVibeApply(spec){
  spInitAudio();
  // BPM
  SP.transport.bpm=spec.bpm;
  const bpmEl=document.getElementById('spBpm');if(bpmEl)bpmEl.value=spec.bpm;
  // DRUMS
  SP.drum.pattern=spDrumPresetCopy(spec.drum);
  spVibeRandomizeDrums();
  spBuildDrumGrid();
  document.querySelectorAll('[data-sp-drum-preset]').forEach(b=>b.classList.toggle('active',b.dataset.spDrumPreset===spec.drum));
  // BASS
  if(SP_BASS_PRESETS[spec.bass]){SP.bass.pattern=SP_BASS_PRESETS[spec.bass].map(s=>({...s}));spBuildBassSeq();}
  document.querySelectorAll('[data-sp-bass-preset]').forEach(b=>b.classList.toggle('active',b.dataset.spBassPreset===spec.bass));
  // SYNTH preset
  if(SP_SYNTH_PRESETS[spec.synth]){spApplySynthPreset(spec.synth);
    document.querySelectorAll('[data-sp-preset]').forEach(b=>b.classList.toggle('active',b.dataset.spPreset===spec.synth));
  }
  // FX defaults on master scope — delaySend / reverbSend / chorusMix / masterDrive
  if(spec.fx){
    const fx=spec.fx;
    Object.keys(fx).forEach(k=>{
      if(k==='masterDrive'){spSetKnob('masterDrive',Math.min(1,Math.max(0,fx[k])),'.sp-master');}
      else if(k==='chorusMix'){spSetKnob('chorusMix',Math.min(1,Math.max(0,fx[k])),'#spInstSynth');}
      else if(k==='delaySend'||k==='reverbSend'){spSetKnob(k,Math.min(1,Math.max(0,fx[k])),'#spInstSynth');}
    });
  }
  // Ensure any currently-held chord voices release before we replace the object
  if(SP.chords)spChordNoteOff();
  // CHORD progression — each vibe has a short list of options; pick by seed
  const chordOpts=SP_CHORD_VARIANTS[spec.chord]||SP_CHORD_VARIANTS._default;
  const chosen=chordOpts[Math.floor(Math.random()*chordOpts.length)];
  const baseChord=SP_CHORD_PROGRESSIONS[chosen]||SP_CHORD_PROGRESSIONS['am-trance'];
  SP.chords={progression:baseChord,index:0,held:[],name:chosen};
  // SONG structure — intro/build/drop/break/outro
  if(spec._songMode!==false)spSongReset(spec._name||'trance');
  else{SP.song=SP.song||{};SP.song.enabled=false;}
}

/* Build a friendly multi-line AI status string describing what was generated */
function spVibeBuildStatus(spec){
  const lines=[];
  const name=(spec._name||'trance').replace(/-/g,' ').toUpperCase();
  lines.push(`🎛 <b style="color:#ff8a1a">TITAN AI</b> — built a ${name} track at <b>${spec.bpm} BPM</b>.`);
  lines.push(`🥁 Drums: <b>${spec.drum.toUpperCase()}</b>` + (spec._peak?' · peak-hour punch':'') + (spec._dark?' · darkened':''));
  lines.push(`🐍 Bass: <b>${spec.bass.toUpperCase()}</b>`);
  lines.push(`🎛 Lead synth: <b>${spec.synth.toUpperCase()}</b>`);
  const chordName=(SP.chords&&SP.chords.name)||spec.chord||'am-trance';
  lines.push(`🎵 Chords: <b>${chordName.toUpperCase().replace(/-/g,' ')}</b> progression`);
  const fxBits=[];
  if(spec.fx){
    if(spec.fx.reverbSend)fxBits.push(`reverb ${Math.round(spec.fx.reverbSend*100)}%`);
    if(spec.fx.delaySend)fxBits.push(`delay ${Math.round(spec.fx.delaySend*100)}%`);
    if(spec.fx.chorusMix)fxBits.push(`chorus ${Math.round(spec.fx.chorusMix*100)}%`);
    if(spec.fx.masterDrive)fxBits.push(`drive ${Math.round(spec.fx.masterDrive*100)}%`);
  }
  if(fxBits.length)lines.push(`⚡ Mix: ${fxBits.join(' · ')}`);
  if(SP.song && SP.song.sections && SP.song.enabled){
    const arr=SP.song.sections.map(s=>`${s.name} (${s.bars})`).join(' → ');
    lines.push(`🎼 Arrangement: ${arr}`);
  }
  lines.push(`▶ Playing now — tap <b>🎲 VARIATION</b> for a different take.`);
  return lines.join('<br>');
}
function spChordNoteOn(midis){
  if(!midis)return;
  midis.forEach(m=>{try{spSynthNoteOn(m);}catch(_){}});
  SP.chords.held=midis.slice();
}
function spChordNoteOff(){
  if(!SP.chords||!SP.chords.held)return;
  SP.chords.held.forEach(m=>{try{spSynthNoteOff(m);}catch(_){}});
  SP.chords.held=[];
}
function spVibeGenerate(keepText){
  const input=document.getElementById('spVibeInput');
  const status=document.getElementById('spVibeStatus');
  const btn=document.getElementById('spVibeGen');
  const text=(input&&input.value)||'';
  if(!text.trim()){status&&(status.textContent='Type a vibe, or tap one of the chips below…',status.className='vibe-status warn');return;}
  const spec=spVibeParse(text);
  // honor song/loop toggle
  const modeToggle=document.getElementById('spVibeModeToggle');
  spec._songMode=!modeToggle||modeToggle.dataset.mode!=='loop';
  btn&&btn.classList.add('working');
  // Stop currently playing before re-arranging so the section state resets cleanly
  if(SP.transport.playing)spTransportStop();
  spVibeApply(spec);
  if(status){
    status.innerHTML=spVibeBuildStatus(spec);
    status.className='vibe-status';
    status.setAttribute('data-ai',status.innerHTML);
  }
  spTransportStart();
  setTimeout(()=>btn&&btn.classList.remove('working'),600);
}
/* 🎲 VARIATION — regenerate with the same prompt but new seeded content */
function spVibeVariation(){
  const input=document.getElementById('spVibeInput');
  if(input && input.value.trim()){spVibeGenerate(true);return;}
  // no prompt yet — pick a random chip
  const chips=document.querySelectorAll('.vibe-chip');
  if(chips.length){const pick=chips[Math.floor(Math.random()*chips.length)];pick.click();}
}

/* ====================================================================
   TITAN LAB — STUDIO MIXER (full-screen multi-channel)
   ==================================================================== */
const SP_MIXER_GROUPS=[
  {title:'DRUMS',ids:['DR_KICK','DR_SNARE','DR_CLAP','DR_RIM','DR_LOWTOM','DR_HITOM','DR_CRASH']},
  {title:'HATS / CYMBALS',ids:['DR_CHH','DR_OHH','DR_RIDE']},
  {title:'PERCUSSION',ids:['DR_SHAKER','DR_PERC','DR_COWBELL']},
  {title:'INSTRUMENTS',ids:['SYNTH','BASS','ORGAN','DRUMS']},
  {title:'FX RETURNS',ids:['DELAY','REVERB','CHORUS']},
  {title:'MASTER',ids:['MASTER']},
];
const SP_MIXER_LABELS={
  DR_KICK:'KICK',DR_SNARE:'SNARE',DR_CLAP:'CLAP',DR_RIM:'RIM',
  DR_LOWTOM:'LO TOM',DR_HITOM:'HI TOM',DR_CRASH:'CRASH',
  DR_CHH:'CL HAT',DR_OHH:'OP HAT',DR_RIDE:'RIDE',
  DR_SHAKER:'SHAKER',DR_PERC:'PERC',DR_COWBELL:'COWBELL',
  SYNTH:'SYNTH',BASS:'TB-303',ORGAN:'ORGAN',DRUMS:'DRUMS',
  DELAY:'DELAY',REVERB:'REVERB',CHORUS:'CHORUS',MASTER:'MASTER',
};
function spApplyMixer(){
  if(!audioCtx||!SP.ready)return;
  const strips=SP.mix.strips||{};
  const ids=Object.keys(strips);
  const anySolo=ids.some(id=>id!=='MASTER' && strips[id].solo);
  SP.mix.soloActive=anySolo;
  const now=audioCtx.currentTime;
  ids.forEach(id=>{
    const s=strips[id];if(!s||!s.gain)return;
    const isMaster=!!s.isMaster;
    let audible=!s.muted && (!anySolo || s.solo || isMaster);
    const target=audible?s.vol:0;
    try{s.gain.gain.setTargetAtTime(target,now,0.015);}catch(_){}
    if(s.pan){try{s.pan.pan.setTargetAtTime(s.panV,now,0.015);}catch(_){}}
  });
}
function spBuildStudioMixer(){
  const ov=document.getElementById('spStudioMixer');
  if(!ov)return;
  spInitAudio();
  const body=ov.querySelector('.spmx-body');
  if(!body)return;
  body.innerHTML='';
  SP_MIXER_GROUPS.forEach(group=>{
    const col=document.createElement('div');col.className='spmx-group';
    const hd=document.createElement('div');hd.className='spmx-group-title';hd.textContent=group.title;
    col.appendChild(hd);
    const row=document.createElement('div');row.className='spmx-row';
    col.appendChild(row);
    group.ids.forEach(id=>{
      const s=SP.mix.strips[id];
      if(!s)return;
      const strip=document.createElement('div');
      strip.className='spmx-strip'+(id==='MASTER'?' master':'');
      strip.dataset.stripId=id;
      // label
      const lab=document.createElement('div');lab.className='spmx-label';
      lab.textContent=SP_MIXER_LABELS[id]||id;strip.appendChild(lab);
      // mute/solo
      const btns=document.createElement('div');btns.className='spmx-btns';
      const mute=document.createElement('button');mute.className='spmx-btn mute'+(s.muted?' on':'');mute.textContent='M';
      const solo=document.createElement('button');solo.className='spmx-btn solo'+(s.solo?' on':'');solo.textContent='S';
      mute.addEventListener('click',()=>{s.muted=!s.muted;mute.classList.toggle('on',s.muted);spApplyMixer();});
      solo.addEventListener('click',()=>{s.solo=!s.solo;solo.classList.toggle('on',s.solo);spApplyMixer();});
      btns.appendChild(mute);btns.appendChild(solo);
      strip.appendChild(btns);
      // pan
      if(s.pan){
        const panWrap=document.createElement('div');panWrap.className='spmx-pan-wrap';
        const panLab=document.createElement('div');panLab.className='spmx-sub';panLab.textContent='PAN';
        const panInp=document.createElement('input');panInp.type='range';panInp.className='spmx-pan';
        panInp.min='-50';panInp.max='50';panInp.step='1';panInp.value=Math.round(s.panV*50);
        const panVal=document.createElement('div');panVal.className='spmx-sub spmx-pan-val';
        panVal.textContent=s.panV===0?'C':(s.panV<0?'L'+Math.abs(Math.round(s.panV*50)):'R'+Math.round(s.panV*50));
        panInp.addEventListener('input',()=>{s.panV=+panInp.value/50;panVal.textContent=s.panV===0?'C':(s.panV<0?'L'+Math.abs(+panInp.value):'R'+panInp.value);spApplyMixer();});
        panWrap.appendChild(panLab);panWrap.appendChild(panInp);panWrap.appendChild(panVal);
        strip.appendChild(panWrap);
      }
      // meter (vertical)
      const meter=document.createElement('div');meter.className='spmx-meter';
      const mL=document.createElement('div');mL.className='spmx-meter-bar';
      meter.appendChild(mL);
      strip.appendChild(meter);
      // fader
      const fader=document.createElement('input');fader.type='range';fader.className='spmx-fader';
      fader.min='0';fader.max='150';fader.step='1';fader.value=Math.round(s.vol*100);
      fader.setAttribute('orient','vertical');
      const volLab=document.createElement('div');volLab.className='spmx-vol';volLab.textContent=Math.round(s.vol*100)+'%';
      fader.addEventListener('input',()=>{
        s.vol=(+fader.value)/100;volLab.textContent=Math.round(s.vol*100)+'%';spApplyMixer();
      });
      strip.appendChild(fader);
      strip.appendChild(volLab);
      s._meterEl=mL;
      row.appendChild(strip);
    });
    body.appendChild(col);
  });
  spApplyMixer();
}
function spMixerMeterTick(){
  if(!SP.mix.open){SP.mix._meterRAF=null;return;}
  // Perf: don't run the meter read loop while the browser tab is
  // hidden — the user cannot see the bars and the getFloatTimeDomainData
  // call is not free.
  if(document.hidden){SP.mix._meterRAF=requestAnimationFrame(spMixerMeterTick);return;}
  const ids=Object.keys(SP.mix.strips||{});
  const buf=new Float32Array(256);
  ids.forEach(id=>{
    const s=SP.mix.strips[id];if(!s||!s._meterEl||!s.meter)return;
    try{s.meter.getFloatTimeDomainData(buf);}catch(_){return;}
    let peak=0;
    for(let i=0;i<buf.length;i++){const a=Math.abs(buf[i]);if(a>peak)peak=a;}
    // smooth fall
    s._mPeak=Math.max(peak,(s._mPeak||0)*0.82);
    const pct=Math.min(100,s._mPeak*140);
    s._meterEl.style.height=pct.toFixed(1)+'%';
    s._meterEl.style.background=pct>92?'#ff3b3b':(pct>70?'#ffb84d':'#2aeaff');
  });
  SP.mix._meterRAF=requestAnimationFrame(spMixerMeterTick);
}
function spOpenStudioMixer(){
  const ov=document.getElementById('spStudioMixer');if(!ov)return;
  spBuildStudioMixer();
  ov.classList.add('open');SP.mix.open=true;
  if(!SP.mix._meterRAF)SP.mix._meterRAF=requestAnimationFrame(spMixerMeterTick);
}
function spCloseStudioMixer(){
  const ov=document.getElementById('spStudioMixer');if(!ov)return;
  ov.classList.remove('open');SP.mix.open=false;
  if(SP.mix._meterRAF){cancelAnimationFrame(SP.mix._meterRAF);SP.mix._meterRAF=null;}
}

/* ====================================================================
   TITAN LAB — License + Pro feature gating
   --------------------------------------------------------------------
   Free tier:  TITAN LAB UI + drums + bass + synth + organ + REC
               (limited to short capture), 3 saved projects max.
   Pro tier :  unlimited projects, RENDER full mix, STEMS export,
               cloud-sync hooks, all current + future Pro features.
   --------------------------------------------------------------------
   License is an HMAC-SHA256-signed payload {tier,email,expiresAt}
   that the owner generates via tools/gen-license.js (see /docs)
   and emails the buyer to paste into the LICENSE panel.

   Owner config:
     - SP_LICENSE_PUBKEY_HEX is the 32-byte Ed25519 public key (as hex).
       Safe to ship publicly — the private signing key lives only on your
       machine (tools/titan-private.pem). See docs/LICENSE-SETUP.md.
     - Set SP_STRIPE_CHECKOUT_URL to the Stripe Payment Link.
   ==================================================================== */
const SP_LICENSE_PUBKEY_HEX='a1263d3bdc8c59791c47c017a4f7e2b34580d61d4a3b97fa12a9fd744e1b60af';
const SP_STRIPE_CHECKOUT_URL='https://buy.stripe.com/test_REPLACE_WITH_REAL_LINK';
const SP_LICENSE_KEY='titanlab_license_v1';
const SP_PRO_FEATURES={
  render:'Render full mix to WAV',
  stems :'Export stems (one WAV per channel)',
  unlimited_projects:'Unlimited saved projects (free tier saves 3)',
  cloud:'Cloud sync (across devices)',
};
let _spPubkeyPromise=null;
function _spImportPubkey(){
  if(_spPubkeyPromise)return _spPubkeyPromise;
  const raw=new Uint8Array(SP_LICENSE_PUBKEY_HEX.match(/.{2}/g).map(h=>parseInt(h,16)));
  _spPubkeyPromise=crypto.subtle.importKey('raw',raw,{name:'Ed25519'},false,['verify']);
  return _spPubkeyPromise;
}
async function spVerifyLicense(licenseObj){
  // Two-stage verification:
  //   1. Client-side Ed25519 check — fast, works offline, good enough for the
  //      renderer to decide whether to enable a feature *optimistically*.
  //   2. Server-side call to the verify-license Edge Function (if Supabase is
  //      configured) — authoritative, tamper-proof, returns a short-lived JWT
  //      the app can attach to premium API calls. The server token is cached
  //      in localStorage so we only hit the edge once a day per license.
  try{
    if(!licenseObj||!licenseObj.payload||!licenseObj.sig)return null;
    if(licenseObj.alg && licenseObj.alg!=='ed25519')return null;
    const pubkey=await _spImportPubkey();
    const text=new TextEncoder().encode(JSON.stringify(licenseObj.payload));
    const sig=new Uint8Array(licenseObj.sig.match(/.{2}/g).map(h=>parseInt(h,16)));
    const ok=await crypto.subtle.verify({name:'Ed25519'},pubkey,sig,text);
    if(!ok)return null;
    if(licenseObj.payload.expiresAt && licenseObj.payload.expiresAt<Date.now())return null;
    // Kick off (but don't block on) a server-side re-verification.
    // The server issues an entitlement JWT that premium API calls can require,
    // closing the "just patch the renderer to skip verify" attack.
    spVerifyLicenseServer(licenseObj).catch(()=>{});
    return licenseObj.payload;
  }catch(e){return null;}
}

const SP_ENTITLEMENT_KEY='titan_entitlement_v1';
async function spVerifyLicenseServer(licenseObj){
  try{
    const supaUrl=(typeof supaCfg!=='undefined'&&supaCfg.url)||'';
    if(!supaUrl)return null;
    const cachedRaw=localStorage.getItem(SP_ENTITLEMENT_KEY);
    if(cachedRaw){
      const cached=JSON.parse(cachedRaw);
      if(cached.tokenExpiresAt&&cached.tokenExpiresAt>Date.now()+5*60_000){
        // Valid cached token — skip the round trip
        return cached;
      }
    }
    const r=await fetch(`${supaUrl}/functions/v1/verify-license`,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({license:licenseObj})
    });
    const j=await r.json();
    if(!j.ok)throw new Error(j.error||'verify failed');
    localStorage.setItem(SP_ENTITLEMENT_KEY,JSON.stringify(j));
    return j;
  }catch(e){
    console.warn('[license] server verify failed — falling back to client check',e);
    return null;
  }
}
function spGetEntitlementToken(){
  try{
    const raw=localStorage.getItem(SP_ENTITLEMENT_KEY);
    if(!raw)return null;
    const cached=JSON.parse(raw);
    if(cached.tokenExpiresAt&&cached.tokenExpiresAt>Date.now())return cached.token||null;
    return null;
  }catch(e){return null;}
}
let SP_LICENSE_CACHE={tier:'free',email:null,expiresAt:null,verified:false};
async function spLoadLicense(){
  const raw=localStorage.getItem(SP_LICENSE_KEY);
  if(!raw){SP_LICENSE_CACHE={tier:'free',email:null,expiresAt:null,verified:false};return SP_LICENSE_CACHE;}
  try{
    const lic=JSON.parse(raw);
    const payload=await spVerifyLicense(lic);
    if(payload){SP_LICENSE_CACHE={tier:payload.tier||'pro',email:payload.email||null,expiresAt:payload.expiresAt||null,verified:true};}
    else{SP_LICENSE_CACHE={tier:'free',email:null,expiresAt:null,verified:false};}
  }catch(e){SP_LICENSE_CACHE={tier:'free',email:null,expiresAt:null,verified:false};}
  return SP_LICENSE_CACHE;
}
function spIsPro(){return SP_LICENSE_CACHE && SP_LICENSE_CACHE.tier==='pro' && SP_LICENSE_CACHE.verified;}
function spShowPaywall(featureKey){
  const featLabel=SP_PRO_FEATURES[featureKey]||featureKey||'this feature';
  const html=`
    <div style="font-family:'Share Tech Mono',monospace;font-size:13px;line-height:1.55;color:#ddd">
      <div style="font-family:'Orbitron',sans-serif;font-size:18px;color:#ff8a1a;letter-spacing:2px;margin-bottom:10px;">🔒 TITAN LAB PRO</div>
      <p style="margin:0 0 10px"><b style="color:#2aeaff">${featLabel}</b> is part of <b>TITAN LAB PRO</b>.</p>
      <p style="margin:0 0 10px">Pro unlocks:</p>
      <ul style="margin:0 0 12px 18px;padding:0">
        ${Object.entries(SP_PRO_FEATURES).map(([k,v])=>`<li>${v}</li>`).join('')}
      </ul>
      <p style="margin:0 0 10px;color:#aaa;font-size:11.5px">After paying, you'll receive a license JSON by email — paste it in TITAN LAB ▸ LICENSE.</p>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <a href="${SP_STRIPE_CHECKOUT_URL}" target="_blank" rel="noopener noreferrer" class="tool-btn"
         style="background:linear-gradient(180deg,#2aeaff,#0a8fa0);color:#0a0a0c;border:1px solid #2aeaff;padding:9px 14px;font-weight:900;letter-spacing:1.4px;text-decoration:none;display:inline-block;">
         💳 BUY PRO
      </a>
      <button class="tool-btn" id="spPaywallEnter" style="border-color:var(--orange);color:var(--orange)">🔑 I HAVE A LICENSE</button>
    </div>`;
  if(typeof showModal==='function'){
    showModal('TITAN LAB PRO',html,()=>{});
    setTimeout(()=>{
      document.getElementById('spPaywallEnter')?.addEventListener('click',()=>{
        closeModal&&closeModal();
        spShowLicenseDialog();
      });
    },50);
  }else{
    alert(`${featLabel} requires TITAN LAB PRO.`);
  }
}
async function spRequirePro(feature,fn){
  if(!SP_LICENSE_CACHE.verified)await spLoadLicense();
  if(spIsPro())return fn();
  spShowPaywall(feature);
}
function spShowLicenseDialog(){
  const cur=SP_LICENSE_CACHE;
  const html=`
    <div style="font-family:'Share Tech Mono',monospace;font-size:13px;color:#ddd;line-height:1.55">
      <div style="font-family:'Orbitron',sans-serif;font-size:16px;color:#ff8a1a;letter-spacing:2px;margin-bottom:10px;">🔑 TITAN LAB LICENSE</div>
      <div style="margin-bottom:10px">
        <div>Current tier: <b style="color:${cur.tier==='pro'?'#88ff88':'#ffb84d'}">${cur.tier.toUpperCase()}</b>${cur.email?' · '+cur.email:''}</div>
        ${cur.expiresAt?`<div style="font-size:11px;color:#888">Expires ${new Date(cur.expiresAt).toLocaleString()}</div>`:''}
      </div>
      <div style="font-size:11.5px;color:#aaa;margin-bottom:6px">Paste your license JSON (you got it by email after paying):</div>
      <textarea id="spLicenseText" rows="6" style="width:100%;font-family:'Share Tech Mono',monospace;font-size:11.5px;background:#08080a;color:#eee;border:1px solid #2a2a30;border-radius:6px;padding:8px;outline:none" placeholder='{ "payload": { "tier":"pro","email":"you@example.com","expiresAt":1893456000000 }, "sig":"..." }'></textarea>
      <div id="spLicenseStatus" style="font-family:'Share Tech Mono',monospace;font-size:11px;color:#888;margin-top:6px;min-height:14px"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="tool-btn" id="spLicenseSave" style="border-color:#88ff88;color:#88ff88">💾 ACTIVATE</button>
      ${cur.tier==='pro'?'<button class="tool-btn" id="spLicenseRemove" style="border-color:var(--red);color:var(--red)">REMOVE LICENSE</button>':''}
      <a class="tool-btn" href="${SP_STRIPE_CHECKOUT_URL}" target="_blank" rel="noopener noreferrer" style="border-color:#2aeaff;color:#2aeaff;text-decoration:none">💳 BUY PRO</a>
    </div>`;
  if(typeof showModal!=='function'){alert('Open Settings ▸ License');return;}
  showModal('TITAN LAB — license',html,()=>{});
  setTimeout(()=>{
    document.getElementById('spLicenseSave')?.addEventListener('click',async()=>{
      const ta=document.getElementById('spLicenseText');
      const st=document.getElementById('spLicenseStatus');
      const txt=(ta?.value||'').trim();
      if(!txt){st&&(st.textContent='Paste a license first',st.style.color='#ffb84d');return;}
      let lic=null;try{lic=JSON.parse(txt);}catch(e){st&&(st.textContent='Not valid JSON',st.style.color='#ff5555');return;}
      const payload=await spVerifyLicense(lic);
      if(!payload){st&&(st.textContent='Invalid or expired license',st.style.color='#ff5555');return;}
      localStorage.setItem(SP_LICENSE_KEY,JSON.stringify(lic));
      await spLoadLicense();
      toast&&toast('TITAN LAB PRO activated · '+(payload.email||'unknown'),'success');
      closeModal&&closeModal();
      spUpdateProBadge();
    });
    document.getElementById('spLicenseRemove')?.addEventListener('click',()=>{
      if(!confirm('Remove this license?'))return;
      localStorage.removeItem(SP_LICENSE_KEY);
      spLoadLicense().then(()=>{spUpdateProBadge();toast&&toast('License removed','success');closeModal&&closeModal();});
    });
  },50);
}
function spUpdateProBadge(){
  const b=document.getElementById('spProBadge');if(!b)return;
  if(spIsPro()){b.textContent='⚡ PRO';b.style.background='linear-gradient(180deg,#88ff88,#1a9a1a)';b.style.color='#001a00';b.title='TITAN LAB PRO'+(SP_LICENSE_CACHE.email?' · '+SP_LICENSE_CACHE.email:'');}
  else{b.textContent='○ FREE';b.style.background='#15151a';b.style.color='#888';b.title='Free tier — click to upgrade';}
}

/* ====================================================================
   TITAN LAB — Projects (save / load / list) — localStorage backed
   ==================================================================== */
const SP_PROJECTS_KEY='titanlab_projects_v1';
function spProjectsList(){
  try{return JSON.parse(localStorage.getItem(SP_PROJECTS_KEY)||'[]')||[];}
  catch(e){return [];}
}
function spProjectsWrite(list){
  try{localStorage.setItem(SP_PROJECTS_KEY,JSON.stringify(list));return true;}
  catch(e){console.warn('project save failed',e);return false;}
}
function spProjectSerialize(){
  return {
    v:1,
    bpm:SP.transport.bpm,swing:SP.transport.swing,
    drum:{pattern:SP.drum.pattern,mutes:SP.drum.mutes,voices:SP.drum.voices.slice()},
    bass:{pattern:SP.bass.pattern,knobs:{...SP.bass.knobs}},
    synth:{osc1Wave:SP.synth.osc1Wave,osc2Wave:SP.synth.osc2Wave,filterType:SP.synth.filterType,lfoTarget:SP.synth.lfoTarget,knobs:{...SP.synth.knobs}},
    organ:{drawbars:SP.organ.drawbars.slice(),knobs:{...SP.organ.knobs}},
    master:{knobs:{...SP.master.knobs}},
    chords:SP.chords?{progression:SP.chords.progression,name:SP.chords.name||null}:null,
    song:SP.song?{enabled:SP.song.enabled,sections:SP.song.sections,sectionIdx:SP.song.sectionIdx}:null,
    octave:SP.octave,activeInst:SP.activeInst,
    mix:Object.fromEntries(Object.entries(SP.mix?.strips||{}).map(([k,v])=>[k,{vol:v.vol,panV:v.panV,muted:v.muted,solo:v.solo}])),
    vibe:(document.getElementById('spVibeInput')?.value||'').trim(),
  };
}
function spProjectRestore(state){
  if(!state||state.v!==1){toast&&toast('Project format not supported','error');return;}
  spInitAudio();
  // Transport
  SP.transport.bpm=state.bpm||128;SP.transport.swing=state.swing||0;
  const bpmEl=document.getElementById('spBpm');if(bpmEl)bpmEl.value=SP.transport.bpm;
  const swEl=document.getElementById('spSwing'),swV=document.getElementById('spSwingVal');
  if(swEl){swEl.value=SP.transport.swing;if(swV)swV.textContent=SP.transport.swing+'%';}
  // Drum pattern + mutes
  if(state.drum&&state.drum.pattern){SP.drum.pattern=state.drum.pattern.map(r=>r.slice(0,16));}
  if(state.drum&&state.drum.mutes){SP.drum.mutes=state.drum.mutes.slice();}
  spBuildDrumGrid();
  // Bass
  if(state.bass&&state.bass.pattern){SP.bass.pattern=state.bass.pattern.map(s=>({...s}));spBuildBassSeq();}
  // Synth params + knobs
  if(state.synth){
    SP.synth.osc1Wave=state.synth.osc1Wave||'sawtooth';
    SP.synth.osc2Wave=state.synth.osc2Wave||'square';
    SP.synth.filterType=state.synth.filterType||'lowpass';
    SP.synth.lfoTarget=state.synth.lfoTarget||'none';
    document.querySelectorAll('.sp-osc-wave[data-sp-osc="1"] [data-sp-wave]').forEach(b=>b.classList.toggle('active',b.dataset.spWave===SP.synth.osc1Wave));
    document.querySelectorAll('.sp-osc-wave[data-sp-osc="2"] [data-sp-wave]').forEach(b=>b.classList.toggle('active',b.dataset.spWave===SP.synth.osc2Wave));
    document.querySelectorAll('[data-sp-filter-type] [data-sp-filter]').forEach(b=>b.classList.toggle('active',b.dataset.spFilter===SP.synth.filterType));
    document.querySelectorAll('[data-sp-lfo-target] [data-sp-lfo]').forEach(b=>b.classList.toggle('active',b.dataset.spLfo===SP.synth.lfoTarget));
    Object.keys(state.synth.knobs||{}).forEach(k=>spSetKnob(k,state.synth.knobs[k],'#spInstSynth'));
  }
  // Organ
  if(state.organ){
    if(state.organ.drawbars)SP.organ.drawbars=state.organ.drawbars.slice();
    spBuildDrawbars();
    Object.keys(state.organ.knobs||{}).forEach(k=>spSetKnob(k,state.organ.knobs[k],'#spInstOrgan'));
  }
  // Bass knobs
  if(state.bass&&state.bass.knobs){
    Object.keys(state.bass.knobs).forEach(k=>spSetKnob(k,state.bass.knobs[k],'#spInstBass'));
  }
  // Master knobs
  if(state.master&&state.master.knobs){
    Object.keys(state.master.knobs).forEach(k=>spSetKnob(k,state.master.knobs[k],'.sp-master'));
  }
  // Chords / song
  if(state.chords){SP.chords={progression:state.chords.progression,name:state.chords.name||null,index:0,held:[]};}
  if(state.song){SP.song={...SP.song,...state.song};}
  // Mixer strip vols
  if(state.mix){
    Object.keys(state.mix).forEach(id=>{
      const s=SP.mix.strips[id];if(!s)return;
      const m=state.mix[id];
      s.vol=typeof m.vol==='number'?m.vol:1;
      s.panV=typeof m.panV==='number'?m.panV:0;
      s.muted=!!m.muted;s.solo=!!m.solo;
    });
    spApplyMixer();
  }
  // VIBE prompt restore
  const vIn=document.getElementById('spVibeInput');
  if(vIn&&typeof state.vibe==='string')vIn.value=state.vibe;
  if(typeof state.octave==='number'){SP.octave=state.octave;const ov=document.getElementById('spOctaveVal');if(ov)ov.textContent=SP.octave;spBuildPiano();}
  if(state.activeInst){SP.activeInst=state.activeInst;document.querySelector(`[data-sp-inst="${state.activeInst}"]`)?.click();}
}
function spProjectSave(){
  const list=spProjectsList();
  // Free tier — cap to 3 projects, gate further saves behind PRO
  if(!spIsPro() && list.length>=3){spShowPaywall('unlimited_projects');return;}
  const name=(prompt('Project name:','TITAN LAB project')||'').trim();
  if(!name)return;
  const id='proj_'+Date.now();
  list.push({id,name,createdAt:Date.now(),state:spProjectSerialize()});
  spProjectsWrite(list);
  toast&&toast(`Project "${name}" saved`,'success');
}
function spProjectLoadDialog(){
  const list=spProjectsList();
  if(!list.length){toast&&toast('No saved projects yet — hit SAVE first','warn');return;}
  const html='<div style="max-height:50vh;overflow:auto"><table style="width:100%;font-family:\'Share Tech Mono\',monospace;font-size:12px;color:#ddd"><thead><tr style="color:#ff8a1a"><th align="left">NAME</th><th align="right">SAVED</th><th></th><th></th></tr></thead><tbody>'+
    list.slice().reverse().map(p=>{
      const d=new Date(p.createdAt).toLocaleString();
      return `<tr><td>${(p.name||'(no name)').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]))}</td><td align="right">${d}</td><td align="right"><button class="tool-btn" data-load="${p.id}">LOAD</button></td><td align="right"><button class="tool-btn" data-del="${p.id}" style="color:var(--red);border-color:var(--red)">DEL</button></td></tr>`;
    }).join('')+'</tbody></table></div>';
  if(typeof showModal!=='function'){toast&&toast('Cannot open dialog','error');return;}
  showModal('TITAN LAB — load project',html,()=>{});
  setTimeout(()=>{
    document.querySelectorAll('[data-load]').forEach(b=>b.addEventListener('click',()=>{
      const id=b.dataset.load;const p=spProjectsList().find(x=>x.id===id);
      if(p){spProjectRestore(p.state);toast&&toast(`Loaded "${p.name}"`,'success');closeModal&&closeModal();}
    }));
    document.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{
      const id=b.dataset.del;
      if(!confirm('Delete this project permanently?'))return;
      spProjectsWrite(spProjectsList().filter(x=>x.id!==id));
      closeModal&&closeModal();spProjectLoadDialog();
    }));
  },50);
}

/* ====================================================================
   TITAN LAB — Render to WAV (mixdown + per-strip stems)
   ==================================================================== */
function _spFloat32ToWavBlob(samples,sampleRate,channels){
  // samples: Float32Array of length=channels*frames, interleaved
  const numFrames=samples.length/channels;
  const buffer=new ArrayBuffer(44+samples.length*2);
  const view=new DataView(buffer);
  const writeStr=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
  writeStr(0,'RIFF');view.setUint32(4,36+samples.length*2,true);
  writeStr(8,'WAVE');writeStr(12,'fmt ');view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,channels,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels*2,true);
  view.setUint16(32,channels*2,true);view.setUint16(34,16,true);
  writeStr(36,'data');view.setUint32(40,samples.length*2,true);
  let o=44;
  for(let i=0;i<samples.length;i++){
    const s=Math.max(-1,Math.min(1,samples[i]));
    view.setInt16(o,s<0?s*0x8000:s*0x7FFF,true);o+=2;
  }
  return new Blob([buffer],{type:'audio/wav'});
}
async function _spCaptureMs(durationMs){
  // Capture from the live master via MediaRecorder (webm/opus) for the given duration.
  spInitAudio();
  if(!SP.rec.streamDest)throw new Error('MediaRecorder not supported');
  const mime=(window.MediaRecorder&&MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))?'audio/webm;codecs=opus':'audio/webm';
  const recorder=new MediaRecorder(SP.rec.streamDest.stream,{mimeType:mime});
  const chunks=[];
  recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
  return await new Promise((resolve,reject)=>{
    recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));
    recorder.onerror=e=>reject(e.error||new Error('recorder error'));
    recorder.start();
    setTimeout(()=>{try{recorder.stop()}catch(_){}},durationMs);
  });
}
async function _spBlobToAudioBuffer(blob){
  spInitAudio();
  const ab=await blob.arrayBuffer();
  return await audioCtx.decodeAudioData(ab);
}
function _spDownloadBlob(blob,filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function _spBufferToWavBlob(buf){
  const ch=buf.numberOfChannels;const len=buf.length;
  const interleaved=new Float32Array(ch*len);
  const data=[];for(let c=0;c<ch;c++)data.push(buf.getChannelData(c));
  for(let i=0;i<len;i++)for(let c=0;c<ch;c++)interleaved[i*ch+c]=data[c][i];
  return _spFloat32ToWavBlob(interleaved,buf.sampleRate,ch);
}
async function spRenderTrack(){
  if(!SP.transport.bpm)return;
  const status=document.getElementById('spVibeStatus');
  const bars=8; // render 8 bars by default
  const seconds=bars*(60/SP.transport.bpm)*4;
  status&&(status.textContent=`Rendering ${bars} bars (${seconds.toFixed(1)} s)…`,status.className='vibe-status');
  // Make sure transport is running
  const wasPlaying=SP.transport.playing;
  if(!wasPlaying)spTransportStart();
  try{
    const blob=await _spCaptureMs(seconds*1000);
    const buf=await _spBlobToAudioBuffer(blob);
    const wav=_spBufferToWavBlob(buf);
    const fname=`titanlab-mix-${Date.now()}.wav`;
    _spDownloadBlob(wav,fname);
    status&&(status.textContent=`✓ Mix rendered → ${fname} (${(wav.size/1024/1024).toFixed(1)} MB)`,status.className='vibe-status');
    toast&&toast('Mix rendered to WAV','success');
  }catch(e){
    console.warn(e);
    toast&&toast('Render failed: '+(e.message||'unknown'),'error');
    status&&(status.textContent='Render failed — try again',status.className='vibe-status warn');
  }finally{
    if(!wasPlaying)spTransportStop();
  }
}
async function spRenderStems(){
  if(!SP.mix||!SP.mix.strips){toast&&toast('Mixer not initialised — open the Studio first','error');return;}
  const status=document.getElementById('spVibeStatus');
  const bars=8;
  const seconds=bars*(60/SP.transport.bpm)*4;
  // Pick the strips worth exporting individually — drum voices + instruments + master
  const stripIds=['DR_KICK','DR_SNARE','DR_CLAP','DR_RIM','DR_CHH','DR_OHH','DR_RIDE','DR_CRASH','DR_LOWTOM','DR_HITOM','DR_SHAKER','DR_PERC','DR_COWBELL','SYNTH','BASS','ORGAN','MASTER'].filter(id=>SP.mix.strips[id]);
  // Stash existing solo/mute state
  const snap=stripIds.map(id=>{const s=SP.mix.strips[id];return {id,solo:s.solo,muted:s.muted};});
  const wasPlaying=SP.transport.playing;
  if(!wasPlaying)spTransportStart();
  try{
    for(let i=0;i<stripIds.length;i++){
      const id=stripIds[i];
      // solo this strip only
      Object.values(SP.mix.strips).forEach(s=>{s.solo=false;});
      SP.mix.strips[id].solo=true;
      spApplyMixer();
      status&&(status.textContent=`Rendering stem ${i+1}/${stripIds.length}: ${id}…`,status.className='vibe-status');
      // wait one bar so the solo settles
      await new Promise(r=>setTimeout(r,Math.max(120,60/SP.transport.bpm/4*1000)));
      const blob=await _spCaptureMs(seconds*1000);
      const buf=await _spBlobToAudioBuffer(blob);
      const wav=_spBufferToWavBlob(buf);
      _spDownloadBlob(wav,`titanlab-stem-${id.toLowerCase()}-${Date.now()}.wav`);
      // small breath between stems
      await new Promise(r=>setTimeout(r,150));
    }
    status&&(status.textContent=`✓ Exported ${stripIds.length} stems to your downloads`,status.className='vibe-status');
    toast&&toast('Stems exported','success');
  }catch(e){
    console.warn(e);
    toast&&toast('Stem render failed: '+(e.message||'unknown'),'error');
  }finally{
    // restore mixer state
    snap.forEach(s=>{const x=SP.mix.strips[s.id];x.solo=s.solo;x.muted=s.muted;});
    spApplyMixer();
    if(!wasPlaying)spTransportStop();
  }
}

/* ====================================================================
   First-run onboarding tour engine
   ==================================================================== */
const TOUR_KEY='titan_tour_done_v1';
const TOUR_STEPS=[
  {target:null,tab:null,title:'🎧 Welcome to DJ TITAN',body:'A full DJ studio + production lab in your browser. 30-second tour — you can skip anytime.'},
  {target:'#deckA-container',tab:'deck',title:'🎚 4 Pioneer-style decks',body:'Drag any track from the LIBRARY here. Press W to play deck A, Q to cue. Decks B/C/D bind to O/P and other keys.'},
  {target:'#mixer-container',tab:'deck',title:'🎛 Mixer + crossfader',body:'EQ each channel, ride the crossfader, fire BEAT-FX. Comma/period nudge the crossfader, slash centres it.'},
  {target:'.tab-btn[data-tab="library"]',tab:'deck',title:'📚 Library + Discover',body:'Upload audio, paste URLs, search Spotify / YouTube / Jamendo. Everything is cached offline.'},
  {target:'.tab-btn[data-tab="studiopro"]',tab:'deck',title:'🎹 TITAN LAB — production studio',body:'A full creation suite — drums, TB-303 bass, synth, organ, full-screen mixer, render to WAV.'},
  {target:'#spVibePanel',tab:'studiopro',title:'✨ VIBE SOUND CODING',body:'Type a vibe like "dark uplifting trance 138 hoover bass" and TITAN LAB builds the entire track for you.'},
  {target:'#spProBadge',tab:'studiopro',title:'⚡ PRO unlocks RENDER + STEMS',body:'Free is generous — full studio + 3 saved projects. PRO adds full mixdown to WAV, stems export, unlimited projects, and cloud sync.'},
];
function spStartTour(force){
  if(!force && localStorage.getItem(TOUR_KEY))return;
  let idx=0,curEl=null;
  const back=document.createElement('div');back.className='tour-backdrop';document.body.appendChild(back);
  const tip=document.createElement('div');tip.className='tour-tooltip';document.body.appendChild(tip);
  const cleanup=()=>{
    if(curEl)curEl.classList.remove('tour-highlight');
    back.remove();tip.remove();
    try{document.body.style.cursor='';}catch(_){}
  };
  const finish=()=>{localStorage.setItem(TOUR_KEY,'1');cleanup();};
  const position=()=>{
    if(!curEl){tip.style.left='50%';tip.style.top='50%';tip.style.transform='translate(-50%,-50%)';return;}
    const r=curEl.getBoundingClientRect();
    const w=tip.offsetWidth||320,h=tip.offsetHeight||180;
    let x=r.left+r.width/2-w/2;
    let y=r.bottom+14;
    if(y+h>window.innerHeight-12)y=Math.max(12,r.top-h-14);
    x=Math.max(12,Math.min(window.innerWidth-w-12,x));
    tip.style.left=x+'px';tip.style.top=y+'px';tip.style.transform='none';
  };
  const show=(i)=>{
    const step=TOUR_STEPS[i];if(!step){finish();return;}
    if(step.tab){
      const tabBtn=document.querySelector(`.tab-btn[data-tab="${step.tab}"]`);
      if(tabBtn && !tabBtn.classList.contains('active'))tabBtn.click();
    }
    setTimeout(()=>{
      if(curEl)curEl.classList.remove('tour-highlight');
      const el=step.target?document.querySelector(step.target):null;
      curEl=el||null;
      if(el){el.classList.add('tour-highlight');try{el.scrollIntoView({block:'center',inline:'center',behavior:'smooth'});}catch(_){}}
      tip.innerHTML=`
        <div class="tour-step">STEP ${i+1} / ${TOUR_STEPS.length}</div>
        <div class="tour-title">${step.title}</div>
        <div class="tour-body">${step.body}</div>
        <div class="tour-actions">
          <button class="tour-skip">SKIP TOUR</button>
          <button class="tour-next">${i+1===TOUR_STEPS.length?'GET STARTED':'NEXT →'}</button>
        </div>`;
      position();
      tip.querySelector('.tour-skip').onclick=finish;
      tip.querySelector('.tour-next').onclick=()=>{idx++;if(idx>=TOUR_STEPS.length)finish();else show(idx);};
    },180);
  };
  window.addEventListener('resize',position);
  show(0);
}
window.spStartTour=spStartTour; // exposed so users can re-run with spStartTour(true) from console / menu

/* ====================================================================
   TITAN LAB — UI wiring
   ==================================================================== */
function setupStudioPro(){
  // default drum pattern
  if(!SP.drum.pattern)SP.drum.pattern=spDrumPresetCopy('house');
  spBuildDrumGrid();

  // default bass pattern
  if(!SP.bass.pattern)SP.bass.pattern=spBassPatternFrom(SP_BASS_PRESETS['classic-acid'].map(s=>s.on?{note:Object.keys(SP_BASS_NOTE_MIDI).find(k=>SP_BASS_NOTE_MIDI[k]===s.midi)||'A1',accent:s.accent,slide:s.slide}:null));
  spBuildBassSeq();

  // hammond drawbars
  spBuildDrawbars();

  // organ preset buttons
  document.querySelectorAll('[data-sp-organ-preset]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      spApplyOrganPreset(btn.dataset.spOrganPreset);
      // auto-switch to the organ panel so the user sees the change
      document.querySelector('[data-sp-inst="organ"]')?.click();
    });
  });

  // bass preset buttons
  document.querySelectorAll('[data-sp-bass-preset]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const key=btn.dataset.spBassPreset;
      if(key==='clear'){
        SP.bass.pattern=spBassEmptyPattern();
        toast&&toast('TB-303 pattern cleared');
      }else if(SP_BASS_PRESETS[key]){
        SP.bass.pattern=SP_BASS_PRESETS[key].map(s=>({...s}));
        toast&&toast(`TB-303 pattern: ${btn.textContent.trim()}`,'success');
        // Audible preview — if the sequencer isn't already running, plays
        // one bar of the new pattern so the user hears the change right
        // after clicking.  When the transport IS running, the scheduler
        // already picks up SP.bass.pattern on the next step.
        if(!SP.transport.playing){
          try{
            spInitAudio();
            const bpm=SP.transport.bpm||128;
            const stepMs=60000/bpm/4;
            // Use plain setTimeout (addTimer is scoped to the step loop +
            // only fires while transport.playing).  The pattern is in
            // SP.bass.pattern, so read it at fire-time to catch further
            // preset changes during the preview.
            for(let i=0;i<16;i++){
              const step=i;
              setTimeout(()=>{
                const s=SP.bass.pattern[step];
                if(!s||!s.on)return;
                const midi=s.midi+(s.octave||0)*12;
                spBassNoteOn(midi,!!s.accent,!!s.slide);
                const next=SP.bass.pattern[(step+1)%16];
                const gate=(next&&next.on&&next.slide)?stepMs*0.95:stepMs*0.75;
                setTimeout(()=>{
                  if(SP.bass.currentMidi===midi && !(next&&next.on&&next.slide))
                    spBassNoteOff(false);
                },gate);
              },step*stepMs);
            }
            // final release safety — kills any hanging note after the bar ends
            setTimeout(()=>{if(SP.bass.voice)spBassNoteOff(false);},16*stepMs+150);
          }catch(e){console.warn('bass preview failed',e);}
        }
      }
      spBuildBassSeq();
      document.querySelectorAll('[data-sp-bass-preset]').forEach(b=>b.classList.toggle('active',b===btn && key!=='clear'));
    });
  });

  // init knob stores with defaults
  ['synth','organ','bass','master'].forEach(s=>{if(!SP[s].knobs)SP[s].knobs={};});

  // wire all knobs per scope
  spWireKnobs(SP.synth.knobs,'#spInstSynth');
  spWireKnobs(SP.organ.knobs,'#spInstOrgan');
  spWireKnobs(SP.bass.knobs,'#spInstBass');
  spWireKnobs(SP.master.knobs,'.sp-master');

  // inst tabs
  document.querySelectorAll('[data-sp-inst]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const inst=btn.dataset.spInst;
      SP.activeInst=inst;
      document.querySelectorAll('[data-sp-inst]').forEach(b=>b.classList.toggle('active',b===btn));
      const synth=document.getElementById('spInstSynth'),organ=document.getElementById('spInstOrgan'),bass=document.getElementById('spInstBass');
      if(synth)synth.style.display=(inst==='synth')?'':'none';
      if(organ)organ.style.display=(inst==='organ')?'':'none';
      if(bass)bass.style.display=(inst==='bass')?'':'none';
    });
  });

  // osc wave buttons (scoped per OSC 1 / 2)
  document.querySelectorAll('.sp-osc-wave[data-sp-osc]').forEach(wrap=>{
    const whichOsc=wrap.dataset.spOsc;
    wrap.querySelectorAll('[data-sp-wave]').forEach(b=>{
      b.addEventListener('click',()=>{
        wrap.querySelectorAll('[data-sp-wave]').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        const w=b.dataset.spWave;
        if(whichOsc==='1')SP.synth.osc1Wave=w;else SP.synth.osc2Wave=w;
      });
    });
  });

  // filter type buttons
  document.querySelectorAll('[data-sp-filter-type] [data-sp-filter]').forEach(b=>{
    b.addEventListener('click',()=>{
      const wrap=b.closest('[data-sp-filter-type]');
      wrap.querySelectorAll('[data-sp-filter]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      SP.synth.filterType=b.dataset.spFilter;
    });
  });

  // LFO target
  document.querySelectorAll('[data-sp-lfo-target] [data-sp-lfo]').forEach(b=>{
    b.addEventListener('click',()=>{
      const wrap=b.closest('[data-sp-lfo-target]');
      wrap.querySelectorAll('[data-sp-lfo]').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');
      SP.synth.lfoTarget=b.dataset.spLfo;
    });
  });

  // synth preset buttons
  document.querySelectorAll('[data-sp-preset]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const key=btn.dataset.spPreset;
      document.querySelectorAll('[data-sp-preset]').forEach(b=>b.classList.toggle('active',b===btn));
      spApplySynthPreset(key);
      // auto-switch to the relevant inst tab for organ / bass presets
      if(key==='hammond'||key==='church-organ')document.querySelector('[data-sp-inst="organ"]')?.click();
      else if(key==='acid-303')document.querySelector('[data-sp-inst="bass"]')?.click();
      else document.querySelector('[data-sp-inst="synth"]')?.click();
    });
  });

  // --- Piano keyboard ---
  spBuildPiano();

  // octave controls
  document.getElementById('spOctaveDown')?.addEventListener('click',()=>{SP.octave=Math.max(1,SP.octave-1);const v=document.getElementById('spOctaveVal');if(v)v.textContent=SP.octave;spBuildPiano();});
  document.getElementById('spOctaveUp')?.addEventListener('click',()=>{SP.octave=Math.min(7,SP.octave+1);const v=document.getElementById('spOctaveVal');if(v)v.textContent=SP.octave;spBuildPiano();});

  // Keyboard bindings — active only when TITAN LAB tab is open
  const KEYMAP={
    // lower octave (SP.octave)
    'z':{o:0,i:0},'s':{o:0,i:1},'x':{o:0,i:2},'d':{o:0,i:3},'c':{o:0,i:4},
    'v':{o:0,i:5},'g':{o:0,i:6},'b':{o:0,i:7},'h':{o:0,i:8},'n':{o:0,i:9},
    'j':{o:0,i:10},'m':{o:0,i:11},
    // upper octave
    'q':{o:1,i:0},'2':{o:1,i:1},'w':{o:1,i:2},'3':{o:1,i:3},'e':{o:1,i:4},
    'r':{o:1,i:5},'5':{o:1,i:6},'t':{o:1,i:7},'6':{o:1,i:8},'y':{o:1,i:9},
    '7':{o:1,i:10},'u':{o:1,i:11},
  };
  const held=new Set();
  const isLabActive=()=>document.getElementById('tab-studiopro')?.classList.contains('active');
  const pianoNoteOn=(midi)=>{
    if(SP.activeInst==='synth')spSynthNoteOn(midi);
    else if(SP.activeInst==='organ')spOrganNoteOn(midi);
    else if(SP.activeInst==='bass')spBassNoteOn(midi,false,false);
  };
  const pianoNoteOff=(midi)=>{
    if(SP.activeInst==='synth')spSynthNoteOff(midi);
    else if(SP.activeInst==='organ')spOrganNoteOff(midi);
    else if(SP.activeInst==='bass'){if(SP.bass.currentMidi===midi)spBassNoteOff(false);}
  };
  document.addEventListener('keydown',e=>{
    if(!isLabActive())return;
    if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const k=e.key.toLowerCase();
    const m=KEYMAP[k];if(!m)return;
    e.preventDefault();e.stopPropagation();
    if(held.has(k))return;
    held.add(k);
    const midi=(SP.octave+1+m.o)*12+m.i;
    pianoNoteOn(midi);
    document.querySelector(`.sp-key[data-sp-midi="${midi}"]`)?.classList.add('active');
  },true);
  document.addEventListener('keyup',e=>{
    if(!isLabActive())return;
    const k=e.key.toLowerCase();const m=KEYMAP[k];if(!m)return;
    held.delete(k);
    const midi=(SP.octave+1+m.o)*12+m.i;
    pianoNoteOff(midi);
    document.querySelector(`.sp-key[data-sp-midi="${midi}"]`)?.classList.remove('active');
  },true);

  // Apply the first synth preset by default so knobs are in a musical spot
  spApplySynthPreset('trance-supersaw');
  document.querySelector('[data-sp-preset="trance-supersaw"]')?.classList.add('active');

  // transport
  const playBtn=document.getElementById('spPlayBtn');
  const stopBtn=document.getElementById('spStopBtn');
  playBtn?.addEventListener('click',()=>{if(SP.transport.playing)spTransportStop();else spTransportStart();});
  stopBtn?.addEventListener('click',spTransportStop);

  const bpm=document.getElementById('spBpm');
  if(bpm){
    const applyBpm=()=>{const v=Math.max(60,Math.min(200,parseInt(bpm.value,10)||128));SP.transport.bpm=v;};
    applyBpm();
    bpm.addEventListener('input',applyBpm);
    bpm.addEventListener('change',applyBpm);
  }
  const sw=document.getElementById('spSwing'),swv=document.getElementById('spSwingVal');
  if(sw){
    const applySwing=()=>{SP.transport.swing=+sw.value;if(swv)swv.textContent=sw.value+'%';};
    applySwing();sw.addEventListener('input',applySwing);
  }

  // drum preset buttons
  document.querySelectorAll('[data-sp-drum-preset]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const key=btn.dataset.spDrumPreset;
      SP.drum.pattern=(key==='clear')?spDrumPresetClear():spDrumPresetCopy(key);
      spBuildDrumGrid();
      document.querySelectorAll('[data-sp-drum-preset]').forEach(b=>b.classList.toggle('active',b===btn && key!=='clear'));
    });
  });

  // pause transport when leaving the TITAN LAB tab
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(btn.dataset.tab!=='studiopro'){
        if(SP.transport.playing)spTransportStop();
        spCloseStudioMixer();
      }
    });
  });
  // STUDIO MIXER open/close
  document.getElementById('spMixerOpenBtn')?.addEventListener('click',spOpenStudioMixer);
  document.getElementById('spMixerCloseBtn')?.addEventListener('click',spCloseStudioMixer);
  // Project save/load + render/stems
  document.getElementById('spSaveProjBtn')?.addEventListener('click',spProjectSave);
  document.getElementById('spLoadProjBtn')?.addEventListener('click',spProjectLoadDialog);
  document.getElementById('spRenderBtn')?.addEventListener('click',()=>spRequirePro('render',spRenderTrack));
  document.getElementById('spStemsBtn')?.addEventListener('click',()=>spRequirePro('stems',spRenderStems));
  // PRO badge — open license dialog when clicked
  document.getElementById('spProBadge')?.addEventListener('click',spShowLicenseDialog);
  // Initial license load + badge
  spLoadLicense().then(spUpdateProBadge);

  // VIBE SOUND CODING — generate & play
  const vibeInp=document.getElementById('spVibeInput');
  const vibeBtn=document.getElementById('spVibeGen');
  vibeBtn?.addEventListener('click',()=>spVibeGenerate());
  vibeInp?.addEventListener('keydown',e=>{
    if((e.key==='Enter')&&(e.ctrlKey||e.metaKey||!e.shiftKey)){
      e.preventDefault();spVibeGenerate();
    }
  });
  document.querySelectorAll('.vibe-chip').forEach(chip=>{
    chip.addEventListener('click',()=>{
      document.querySelectorAll('.vibe-chip').forEach(c=>c.classList.toggle('active',c===chip));
      if(vibeInp)vibeInp.value=chip.dataset.vibe||chip.textContent.trim();
      spVibeGenerate();
    });
  });
  document.getElementById('spVibeVariation')?.addEventListener('click',spVibeVariation);
  const modeToggle=document.getElementById('spVibeModeToggle');
  modeToggle?.addEventListener('click',()=>{
    const next=modeToggle.dataset.mode==='song'?'loop':'song';
    modeToggle.dataset.mode=next;
    modeToggle.textContent=next==='song'?'📼 SONG':'♻ LOOP';
    // if the transport is playing, re-apply current prompt to swap modes
    if(SP.transport.playing){
      const input=document.getElementById('spVibeInput');
      if(input && input.value.trim())spVibeGenerate();
    }
  });
  // Esc closes the mixer
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape' && SP.mix.open){e.preventDefault();spCloseStudioMixer();}
  });

  // REC — captures the TITAN LAB master bus straight into the library
  const recBtn=document.getElementById('spRecBtn');
  if(recBtn){
    recBtn.addEventListener('click',()=>{
      spInitAudio();
      const streamDest=SP.rec.streamDest;
      if(!streamDest){toast&&toast('Recording not supported on this browser','error');return;}
      if(SP.rec.recorder && SP.rec.recorder.state==='recording'){
        SP.rec.recorder.stop();
        return;
      }
      const mime=(window.MediaRecorder&&MediaRecorder.isTypeSupported('audio/webm;codecs=opus'))?'audio/webm;codecs=opus':'audio/webm';
      let recorder;
      try{recorder=new MediaRecorder(streamDest.stream,{mimeType:mime});}
      catch(e){toast&&toast('MediaRecorder failed: '+e.message,'error');return;}
      SP.rec.recorder=recorder;SP.rec.chunks=[];SP.rec.startedAt=Date.now();
      recorder.ondataavailable=e=>{if(e.data&&e.data.size)SP.rec.chunks.push(e.data);};
      recorder.onstop=async()=>{
        recBtn.classList.remove('active');recBtn.style.background='';recBtn.style.color='';
        recBtn.textContent='● REC';
        const blob=new Blob(SP.rec.chunks,{type:mime});
        const dur=(Date.now()-SP.rec.startedAt)/1000;
        try{
          const ab=await blob.arrayBuffer();
          const abCopy=ab.slice(0);
          let buf=null;try{buf=await audioCtx.decodeAudioData(ab);}catch(_){}
          const name=`TITAN LAB — ${new Date().toLocaleTimeString()}`;
          const track={
            id:'sp_'+Date.now(),title:name,artist:'TITAN LAB',
            bpm:SP.transport.bpm,key:'--',duration:buf?buf.duration:dur,
            buffer:buf||undefined,source:'file',rating:0,addedAt:Date.now()
          };
          library.push(track);renderLibrary();saveToDB();
          try{await idbPutAudio(track.id,abCopy);}catch(e){console.warn('idb put failed',e);}
          toast&&toast(`Recorded ${dur.toFixed(1)}s → library`,'success');
        }catch(e){
          console.warn('REC save failed',e);
          // fallback: download
          const url=URL.createObjectURL(blob);const a=document.createElement('a');
          a.href=url;a.download=`titan-lab-${Date.now()}.webm`;a.click();
          toast&&toast('Saved to downloads','success');
        }
      };
      recorder.start();
      recBtn.classList.add('active');
      recBtn.style.background='linear-gradient(180deg,#ff3b3b,#a41818)';
      recBtn.style.color='#fff';
      recBtn.textContent='■ STOP REC';
      // start the transport if it is not already running so the recording has content
      if(!SP.transport.playing)spTransportStart();
    });
  }
}

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

/* TABS */
function setupTabs(){
  document.querySelectorAll('.tab-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });
}

/* VINYL view — realistic 2- or 4-turntable surface + matching mixer.
   Sides L and R are always present. Sides C and D are rendered too
   but hidden by CSS until body.vinyl-all-4 is toggled on, so the same
   handlers wire up cleanly in either mode. */
function setupVinylTurntables(){
  const SIDE2DECK={L:'A',R:'B',C:'C',D:'D'};
  const baseBpm={L:128.0,R:128.0,C:128.0,D:128.0};
  const SIDES=['L','R','C','D'];

  // Make the Quick Library overlay a top-level child so it shows on any tab
  const qlOv=document.getElementById('quickLibOverlay');
  if(qlOv&&qlOv.parentElement&&qlOv.parentElement.id==='tab-deck'){
    document.body.appendChild(qlOv);
  }

  // ── ALL 4 toggle — switches the vinyl tab between 2 turntables and 4
  const VINYL_MODE_KEY='titanVinylMode';
  function setVinylMode(mode){
    const all4=mode==='4';
    document.body.classList.toggle('vinyl-all-4',all4);
    document.querySelectorAll('.vinyl-mode-btn').forEach(b=>{
      b.classList.toggle('active', b.dataset.vinylMode === (all4?'4':'2'));
    });
    try{localStorage.setItem(VINYL_MODE_KEY, all4?'4':'2');}catch(_){}
  }
  document.querySelectorAll('.vinyl-mode-btn').forEach(b=>{
    b.addEventListener('click',()=>setVinylMode(b.dataset.vinylMode));
  });
  try{
    const saved=localStorage.getItem(VINYL_MODE_KEY);
    if(saved==='4')setVinylMode('4');
  }catch(_){}

  function deck(side){return (typeof decks!=='undefined')?decks[SIDE2DECK[side]]:null}

  function applySpin(side){
    const d=deck(side);
    const vinyl=document.getElementById(`tt${side}-vinyl`);
    const platter=document.getElementById(`tt${side}-platter`);
    const tonearm=document.getElementById(`tt${side}-tonearm`);
    if(!vinyl||!platter||!tonearm)return;
    const playing=!!(d&&d.playing);
    const pitch=d?d.tempo:0;
    const rpmScale=(d&&d.rpmScale)||1;
    // Base spin RPM follows the selected 33⅓ or 45 setting + pitch
    const baseRpm=33.333*rpmScale;
    const rpm=baseRpm*(1+pitch/100);
    const dur=(60/Math.max(0.1,rpm)).toFixed(3);
    vinyl.style.setProperty('--tt-spin',dur+'s');
    vinyl.classList.toggle('spinning',playing);
    platter.classList.toggle('spinning',playing);
    tonearm.classList.toggle('dropped',playing||!!(d&&d.track));
    const bpmEl=document.getElementById(`tt${side}-bpm`);
    if(bpmEl){
      const src=d&&d.track&&d.track.bpm?+d.track.bpm:baseBpm[side];
      bpmEl.textContent=(src*(1+pitch/100)*rpmScale).toFixed(1);
    }
  }

  SIDES.forEach(side=>{
    const dId=SIDE2DECK[side];
    // Skip wiring for sides whose turntable element is not present
    // (defensive — shouldn't happen since all 4 are rendered).
    if(!document.getElementById(`tt${side}`))return;
    // START/STOP → real play/pause
    const startBtn=document.getElementById(`tt${side}-startstop`);
    startBtn?.addEventListener('click',()=>{
      const d=deck(side);
      if(!d||!d.track){toast&&toast(`Load a track to Deck ${dId} first`,'warn');return;}
      if(typeof togglePlay==='function')togglePlay(dId);
      setTimeout(()=>{applySpin(side);startBtn.classList.toggle('playing',!!deck(side)?.playing)},30);
    });
    // PITCH → custom div slider (ttpv2), drives real tempo
    (function setupPitch(){
      const track=document.querySelector(`.ttpv2[data-tt-pitch="${side}"]`);
      const thumb=document.getElementById(`tt${side}-pitch-thumb`);
      const hidden=document.getElementById(`tt${side}-pitch`);
      const valEl=document.getElementById(`tt${side}-pitch-val`);
      if(!track||!thumb||!hidden)return;
      const MIN=-8,MAX=8;
      let dragging=false,trackY=0,trackH=0;
      function setValue(v,updateDeck){
        v=Math.max(MIN,Math.min(MAX,v));
        v=Math.round(v*100)/100;
        hidden.value=v;
        const pct=(v-MIN)/(MAX-MIN);
        thumb.style.top=((1-pct)*100)+'%';
        if(valEl)valEl.textContent=(v>=0?'+':'')+v.toFixed(2)+'%';
        thumb.setAttribute('aria-valuenow',v);
        if(updateDeck!==false&&typeof setTempo==='function')setTempo(dId,v);
        applySpin(side);
      }
      setValue(0,false);
      function measure(){
        const r=track.getBoundingClientRect();
        trackY=r.top+12;trackH=Math.max(1,r.height-24);
      }
      function yToValue(y){
        const pct=Math.max(0,Math.min(1,(y-trackY)/trackH));
        return MAX-pct*(MAX-MIN); // top=MAX, bottom=MIN
      }
      function onDown(e){
        e.preventDefault();dragging=true;measure();
        thumb.classList.add('dragging');
        try{track.setPointerCapture(e.pointerId)}catch(_){}
        setValue(yToValue(e.clientY));
      }
      function onMove(e){
        if(!dragging)return;
        setValue(yToValue(e.clientY));
      }
      function onUp(e){
        if(!dragging)return;dragging=false;
        thumb.classList.remove('dragging');
        try{track.releasePointerCapture(e.pointerId)}catch(_){}
      }
      track.addEventListener('pointerdown',onDown);
      track.addEventListener('pointermove',onMove);
      track.addEventListener('pointerup',onUp);
      track.addEventListener('pointercancel',onUp);
      // double-click to reset to 0
      thumb.addEventListener('dblclick',e=>{e.stopPropagation();setValue(0)});
      track.addEventListener('dblclick',e=>{if(e.target===track)setValue(0)});
      // keyboard for accessibility
      thumb.addEventListener('keydown',e=>{
        const v=parseFloat(hidden.value)||0;
        if(e.key==='ArrowUp'||e.key==='ArrowRight'){setValue(v+0.1);e.preventDefault();}
        else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){setValue(v-0.1);e.preventDefault();}
        else if(e.key==='PageUp'){setValue(v+1);e.preventDefault();}
        else if(e.key==='PageDown'){setValue(v-1);e.preventDefault();}
        else if(e.key==='Home'){setValue(MAX);e.preventDefault();}
        else if(e.key==='End'){setValue(MIN);e.preventDefault();}
        else if(e.key===' '||e.key==='Enter'){setValue(0);e.preventDefault();}
      });
    })();
    // RPM 33⅓ / 45 — drives the deck rpmScale so the audio actually
    // speeds up by 35.4 % when 45 is selected (45/33⅓ = 1.354), like a
    // real turntable. The pitch slider stacks on top.
    document.querySelectorAll(`#tt${side} .tt-rpm-btn`).forEach(btn=>{
      btn.addEventListener('click',()=>{
        document.querySelectorAll(`#tt${side} .tt-rpm-btn`).forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        const rpm=parseInt(btn.dataset.rpm,10)||33;
        const d=decks&&decks[dId];
        if(d){
          d.rpmScale=(rpm===45)?(45/33.333333):1;
          const newRate=(1+(d.tempo||0)/100)*d.rpmScale;
          d.playbackRate=newRate;
          if(d.source&&d.source.playbackRate&&typeof audioCtx!=='undefined'&&audioCtx){
            try{d.source.playbackRate.setTargetAtTime(newRate,audioCtx.currentTime,0.04);}catch(_){}
          }
        }
        applySpin(side);
      });
    });
    // Bottom actions → real cue/sync/loop/fx
    document.querySelectorAll(`#tt${side} .tt-bottom .tt-btn`).forEach(btn=>{
      btn.addEventListener('click',()=>{
        const k=btn.dataset.ttBtn;
        if(k==='cue'){
          if(typeof cueDeck==='function')cueDeck(dId);
          btn.classList.add('armed');setTimeout(()=>btn.classList.remove('armed'),220);
        }else if(k==='sync'){
          const d=decks&&decks[dId];if(!d||!d.track)return;
          // Delegate to the main syncDeck helper — it handles all 4
          // decks (closest playing, then any loaded), phase alignment
          // and tempo-range clamping. Then mirror the resulting
          // tempo into the turntable's pitch slider.
          if(typeof syncDeck==='function'){
            const ok=syncDeck(dId);
            if(ok){
              const t=decks[dId].tempo||0;
              const p=document.getElementById(`tt${side}-pitch`);
              const pv=document.getElementById(`tt${side}-pitch-val`);
              const thumb=document.getElementById(`tt${side}-pitch-thumb`);
              if(p)p.value=t;
              if(pv)pv.textContent=(t>=0?'+':'')+t.toFixed(2)+'%';
              if(thumb){
                const pct=(t-(-8))/16;
                thumb.style.top=((1-pct)*100)+'%';
                thumb.setAttribute('aria-valuenow',t);
              }
            }
          }
          btn.classList.add('active');setTimeout(()=>btn.classList.remove('active'),600);
          applySpin(side);
        }else if(k==='loop'){
          btn.classList.toggle('active');
          const d=decks&&decks[dId];if(!d||!d.track)return;
          if(d.loop&&d.loop.active&&typeof exitLoop==='function')exitLoop(dId);
          else if(typeof setAutoLoop==='function')setAutoLoop(dId,4);
        }else if(k==='fx'){
          btn.classList.toggle('active');
          if(typeof toggleBeatFx==='function')toggleBeatFx();
          else{const f=document.getElementById('fxOnOff');if(f)f.click();}
        }
      });
    });
    // Drag-to-scratch on the vinyl — real audible scratch via playbackRate
    const vinyl=document.getElementById(`tt${side}-vinyl`);
    if(vinyl){
      let dragging=false,lastAngleRad=0,manualDeg=0,lastT=0,vel=0;
      let wasPlaying=false,bending=false;
      const centerOf=()=>{const r=vinyl.getBoundingClientRect();return{cx:r.left+r.width/2,cy:r.top+r.height/2}};
      const getRad=(x,y,c)=>Math.atan2(y-c.cy,x-c.cx);
      vinyl.addEventListener('pointerdown',e=>{
        e.preventDefault();
        dragging=true;vinyl.setPointerCapture(e.pointerId);
        lastAngleRad=getRad(e.clientX,e.clientY,centerOf());
        lastT=performance.now();
        vinyl.classList.remove('spinning');
        vinyl.classList.add('scratching');
        const d=deck(side);
        wasPlaying=!!(d&&d.playing);
        bending=!!(d&&d.source);
      });
      vinyl.addEventListener('pointermove',e=>{
        if(!dragging)return;
        const c=centerOf();const a=getRad(e.clientX,e.clientY,c);
        let delta=a-lastAngleRad;
        if(delta>Math.PI)delta-=2*Math.PI;
        if(delta<-Math.PI)delta+=2*Math.PI;
        lastAngleRad=a;
        const now=performance.now();
        const dt=Math.max(1,now-lastT);lastT=now;
        vel=delta/dt;                                     // rad/ms
        manualDeg+=delta*180/Math.PI;
        vinyl.style.transform=`rotate(${manualDeg}deg)`;
        const d=deck(side);
        if(bending&&d&&d.source&&typeof audioCtx!=='undefined'&&audioCtx){
          const orig=(1+((d.tempo||0)/100))*(d.rpmScale||1);
          const bend=1+(vel*160);                         // scale velocity to rate
          const clamped=Math.max(-2.5,Math.min(2.5,bend))*orig;
          try{d.source.playbackRate.setTargetAtTime(Math.abs(clamped)<0.02?0.02:clamped,audioCtx.currentTime,0.008);}catch(_){}
        }
      });
      const release=()=>{
        if(!dragging)return;dragging=false;
        vinyl.style.transform='';
        vinyl.classList.remove('scratching');
        const d=deck(side);
        if(bending&&d&&d.source&&typeof audioCtx!=='undefined'&&audioCtx){
          const orig=(1+((d.tempo||0)/100))*(d.rpmScale||1);
          try{d.source.playbackRate.setTargetAtTime(orig,audioCtx.currentTime,0.04);}catch(_){}
        }
        bending=false;
        if(d?.playing)vinyl.classList.add('spinning');
      };
      vinyl.addEventListener('pointerup',release);
      vinyl.addEventListener('pointercancel',release);
      vinyl.addEventListener('pointerleave',release);
    }
  });

  // Mixer CUE → real headphone cue
  document.querySelectorAll('.vx-cue').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const d=btn.dataset.vxCue;
      btn.classList.toggle('active');
      if(typeof mixerState!=='undefined'&&mixerState.hpCue)mixerState.hpCue[d]=btn.classList.contains('active');
      const hpBtn=document.getElementById(`hpCue-${d}`);
      if(hpBtn)hpBtn.classList.toggle('active',btn.classList.contains('active'));
    });
  });
  // Mixer knobs → real EQ/TRIM
  document.querySelectorAll('.vx-knob').forEach(knob=>{
    const raw=knob.dataset.vxknob||'';
    const m=raw.match(/^(trim|hi|mid|low)([ABCD])$/);
    const kind=m?m[1]:null,dId=m?m[2]:null;
    let val=(kind==='trim')?0.33:0.5; // -1..1 center at 0 → val 0.5
    let dragY=0,dragging=false;
    const render=()=>{const deg=-135+val*270;knob.style.transform=`rotate(${deg}deg)`};
    const applyVal=()=>{
      if(!kind||!dId||typeof applyKnob!=='function')return;
      const v=(val*2)-1;                                // 0..1 → -1..1
      const id=kind==='trim'?`trim-${dId}`
        :kind==='hi'?`hi-${dId}`
        :kind==='mid'?`mid-${dId}`
        :`low-${dId}`;
      applyKnob(id,v);
    };
    render();applyVal();
    knob.addEventListener('pointerdown',e=>{dragging=true;dragY=e.clientY;knob.setPointerCapture(e.pointerId)});
    knob.addEventListener('pointermove',e=>{
      if(!dragging)return;
      val=Math.max(0,Math.min(1,val+(dragY-e.clientY)/200));
      dragY=e.clientY;render();applyVal();
    });
    const stop=e=>{if(dragging){dragging=false;try{knob.releasePointerCapture(e.pointerId)}catch(_){}};};
    knob.addEventListener('pointerup',stop);
    knob.addEventListener('pointercancel',stop);
    knob.addEventListener('dblclick',()=>{val=(kind==='trim')?0.33:0.5;render();applyVal();});
  });
  // Channel faders → real volume (channels A-D; only the visible ones matter)
  ['A','B','C','D'].forEach(dId=>{
    const f=document.getElementById(`vxFader${dId}`);
    if(!f)return;
    const apply=()=>{
      const v=parseFloat(f.value)/100;
      if(typeof decks!=='undefined'&&decks[dId]){decks[dId].volume=v;}
      if(typeof applyCrossfader==='function')applyCrossfader();
    };
    f.addEventListener('input',apply);apply();
  });
  // Crossfader → real crossfader
  const xf=document.getElementById('vxXfader');
  xf?.addEventListener('input',()=>{
    const v=parseFloat(xf.value)/100;
    if(typeof mixerState!=='undefined')mixerState.crossfader=v;
    if(typeof applyCrossfader==='function')applyCrossfader();
    const mainXf=document.getElementById('xfaderHandle');
    if(mainXf)mainXf.style.left=`${v*100}%`;
  });

  // VU meters: draw from deck analysers if available; fallback to jitter
  const vuL=document.getElementById('vxVuL');
  const vuR=document.getElementById('vxVuR');
  function rmsFromAnalyser(an){
    if(!an)return 0;
    const buf=new Uint8Array(an.fftSize);an.getByteTimeDomainData(buf);
    let sum=0;for(let i=0;i<buf.length;i++){const x=(buf[i]-128)/128;sum+=x*x;}
    return Math.sqrt(sum/buf.length);
  }
  function paintVU(){
    // Perf: skip the RMS read + DOM paint when nothing's visible
    if(document.hidden)return;
    const vinylActive=document.getElementById('tab-vinyl')?.classList.contains('active');
    if(!vinylActive)return;
    const dA=decks&&decks.A,dB=decks&&decks.B;
    let lvlA=0,lvlB=0;
    if(dA&&dA.analyser&&dA.playing)lvlA=rmsFromAnalyser(dA.analyser);
    if(dB&&dB.analyser&&dB.playing)lvlB=rmsFromAnalyser(dB.analyser);
    const xfv=xf?parseFloat(xf.value)/100:.5;
    const hL=Math.min(98,(lvlA*220)*(1-xfv)+2);
    const hR=Math.min(98,(lvlB*220)*xfv+2);
    if(vuL)vuL.style.height=hL+'%';
    if(vuR)vuR.style.height=hR+'%';
  }
  setInterval(paintVU,60);

  // Drag-and-drop: accept library tracks onto either turntable → routes to deck A/B
  document.querySelectorAll('.turntable').forEach(tt=>{
    const deckId=tt.dataset.ttDeck;
    tt.addEventListener('dragover',e=>{e.preventDefault();tt.classList.add('drop-target')});
    tt.addEventListener('dragleave',e=>{
      if(!tt.contains(e.relatedTarget))tt.classList.remove('drop-target');
    });
    tt.addEventListener('drop',async e=>{
      e.preventDefault();tt.classList.remove('drop-target');
      const tid=e.dataTransfer.getData('text/plain');
      if(tid&&typeof library!=='undefined'){
        const t=library.find(x=>x.id===tid);
        if(t&&typeof loadTrackToDeck==='function'){
          await loadTrackToDeck(deckId,t);
          toast&&toast(`Loaded "${t.title}" → Deck ${deckId}`,'success');
          syncFromDeck();
        }
      }else if(e.dataTransfer.files&&e.dataTransfer.files.length&&typeof loadAudioFile==='function'){
        for(const f of e.dataTransfer.files){
          try{
            const t=await loadAudioFile(f);
            if(t){await loadTrackToDeck(deckId,t);toast&&toast(`Loaded "${t.title}" → Deck ${deckId}`,'success');break;}
          }catch(err){console.warn('drop load fail',err);toast&&toast(`Failed "${f.name}"`,'error')}
        }
        syncFromDeck();
      }
    });
  });

  // Auto-fill title/bpm/label from decks
  function syncFromDeck(){
    try{
      const pairs=[['L','A','ttL-title','ttL-bpm'],['R','B','ttR-title','ttR-bpm']];
      pairs.forEach(([side,dId,titleId,bpmId])=>{
        const d=(typeof decks!=='undefined')?decks[dId]:null;
        const titleEl=document.getElementById(titleId);
        const bpmEl=document.getElementById(bpmId);
        const lblTitle=document.querySelector(`#tt${side} .tt-label .lbl-title`);
        const lblSub=document.querySelector(`#tt${side} .tt-label .lbl-sub`);
        if(d&&d.track){
          const t=d.track;
          if(titleEl)titleEl.textContent=`${(t.title||'UNTITLED').toUpperCase()} — ${(t.artist||'—').toUpperCase()}`;
          if(t.bpm)baseBpm[side]=+t.bpm||baseBpm[side];
          if(lblTitle)lblTitle.textContent=(t.title||'UNTITLED').slice(0,18).toUpperCase();
          if(lblSub)lblSub.textContent=`${t.key?t.key+' · ':''}${t.bpm?t.bpm.toFixed(1)+' BPM':'33⅓'}`;
          // mirror play/pitch from the actual deck, so UI matches audio
          state[side].playing=!!d.playing;
          const sb=document.getElementById(`tt${side}-startstop`);
          if(sb)sb.classList.toggle('playing',state[side].playing);
        }else{
          if(titleEl)titleEl.textContent='— NO TRACK —';
          if(lblTitle)lblTitle.textContent='DJ TITAN';
          if(lblSub)lblSub.textContent=side==='L'?'SIDE A · 33⅓':'SIDE B · 33⅓';
        }
      });
    }catch(_){}
    applySpin('L');applySpin('R');
  }

  const vinylTabBtn=document.querySelector('.tab-btn[data-tab="vinyl"]');
  let pollId=null;
  vinylTabBtn?.addEventListener('click',()=>{
    setTimeout(syncFromDeck,50);
    if(pollId)clearInterval(pollId);
    pollId=setInterval(syncFromDeck,500);
  });
  document.querySelectorAll('.tab-btn:not([data-tab="vinyl"])').forEach(b=>{
    b.addEventListener('click',()=>{if(pollId){clearInterval(pollId);pollId=null}});
  });
  syncFromDeck();

  // ═══ PRO controls per turntable — PLAY/PAUSE, time, volume, hotcues ═══
  // Each bridges to the existing deck engine (decks[A|B]) so the vinyl
  // page stays in sync with whatever the DECKS tab is doing.
  function fmtTime(s){
    if(!isFinite(s)||s<0)return '00:00';
    const m=Math.floor(s/60),ss=Math.floor(s%60);
    return String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');
  }
  SIDES.forEach(side=>{
    const d=SIDE2DECK[side];
    if(!document.getElementById(`tt${side}`))return;

    // PLAY / PAUSE — reuses the main togglePlay so both tabs stay in lockstep
    const playBtn=document.getElementById(`tt${side}-play`);
    if(playBtn){
      playBtn.addEventListener('click',()=>{
        if(typeof togglePlay==='function'){togglePlay(d);}
      });
    }

    // (Volume slider removed — volume lives on the mixer only, per user
    // request. The mixer channel fader for this deck is the source of
    // truth and any change there is still reflected via the main engine.)

    // SEEK + drag-to-scrub on the progress bar
    const bar=document.getElementById(`tt${side}-bar`);
    if(bar){
      let scrubbing=false;
      const seekFromEvent=(e)=>{
        const deck=(typeof decks!=='undefined')?decks[d]:null;
        if(!deck||!deck.buffer)return;
        const rect=bar.getBoundingClientRect();
        const frac=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
        const target=frac*(deck.buffer.duration||0);
        if(typeof seekDeck==='function')seekDeck(d,target);
      };
      bar.addEventListener('pointerdown',e=>{
        e.preventDefault();
        scrubbing=true;
        bar.classList.add('scrubbing');
        try{bar.setPointerCapture(e.pointerId);}catch(_){}
        seekFromEvent(e);
      });
      bar.addEventListener('pointermove',e=>{
        if(!scrubbing)return;
        seekFromEvent(e);
      });
      const stopScrub=(e)=>{
        if(!scrubbing)return;
        scrubbing=false;
        bar.classList.remove('scrubbing');
        try{bar.releasePointerCapture(e.pointerId);}catch(_){}
      };
      bar.addEventListener('pointerup',stopScrub);
      bar.addEventListener('pointercancel',stopScrub);
    }

    // HOT CUES 1-4 — bridge to the main hot-cue handler.
    // Single click: set at current position if empty, otherwise jump.
    // Right-click or double-click: clear the cue.
    document.querySelectorAll(`[data-tt-hc="${side}"] .tt-pro-hc`).forEach(pad=>{
      pad.addEventListener('click',()=>{
        const n=parseInt(pad.dataset.hc,10);
        if(typeof triggerHotCue==='function'){
          window.event&&(window.event._fromVinyl=true);
          triggerHotCue(d,n);
        }
      });
      const clearCue=(e)=>{
        e.preventDefault();
        const dk=decks&&decks[d];if(!dk)return;
        const n=pad.dataset.hc;
        if(dk.hotCues&&dk.hotCues[n]!=null){
          delete dk.hotCues[n];
          pad.classList.remove('set');
          // Mirror to the main deck cue-btn so both UIs stay in sync
          const mainBtn=document.querySelector(`.hot-cues[data-deck="${d}"] .cue-btn[data-cue="${n}"]`);
          if(mainBtn)mainBtn.classList.remove('active');
          toast&&toast(`Cue ${n} cleared`,'info');
        }
      };
      pad.addEventListener('contextmenu',clearCue);
      pad.addEventListener('dblclick',clearCue);
    });

    // ── Transport nav row: ⏮ / ◀◀4 / ◀1 / SET CUE / 1▶ / 4▶▶ / ↩CUE
    document.querySelectorAll(`[data-tt-nav="${side}"] button`).forEach(b=>{
      b.addEventListener('click',()=>{
        const deck=(typeof decks!=='undefined')?decks[d]:null;
        if(!deck||!deck.track){toast&&toast('Load a track first','error');return;}
        const act=b.dataset.nav;
        if(act==='start'){
          if(typeof seekDeck==='function')seekDeck(d,0);
        }else if(act==='back-4'){
          if(typeof beatJump==='function')beatJump(d,-4);
        }else if(act==='back-1'){
          if(typeof beatJump==='function')beatJump(d,-1);
        }else if(act==='fwd-1'){
          if(typeof beatJump==='function')beatJump(d,1);
        }else if(act==='fwd-4'){
          if(typeof beatJump==='function')beatJump(d,4);
        }else if(act==='setcue'){
          // Always DROP a new cue here, regardless of current state
          const now=(typeof getCurrentTime==='function')?getCurrentTime(d):0;
          deck.cuePoint=now;
          const mm=Math.floor(now/60),ss=(now%60).toFixed(1).padStart(4,'0');
          toast&&toast(`CUE set @ ${mm}:${ss}`,'success');
          // Brief visual pulse to confirm
          b.classList.add('armed');
          setTimeout(()=>b.classList.remove('armed'),900);
        }else if(act==='gotocue'){
          if(typeof seekDeck==='function')seekDeck(d,deck.cuePoint||0);
        }
      });
    });
  });

  // Poll every 200 ms to refresh time / volume / hot-cue highlights on
  // both pro strips, regardless of whether the user is clicking here or
  // on the DECKS tab.
  setInterval(()=>{
    SIDES.forEach(side=>{
      const d=SIDE2DECK[side];
      const deck=(typeof decks!=='undefined')?decks[d]:null;
      if(!deck)return;
      if(!document.getElementById(`tt${side}`))return;
      // Time + bar
      const dur=(deck.buffer&&deck.buffer.duration)||0;
      const cur=(typeof getCurrentTime==='function'&&deck.track)?getCurrentTime(d):0;
      const el=document.getElementById(`tt${side}-elapsed`);
      const re=document.getElementById(`tt${side}-remain`);
      const du=document.getElementById(`tt${side}-dur`);
      const bf=document.getElementById(`tt${side}-barfill`);
      if(el)el.textContent=fmtTime(cur);
      if(re)re.textContent='-'+fmtTime(Math.max(0,dur-cur));
      if(du)du.textContent=`${deck.track?deck.track.title?.slice(0,18)||'':'—'} / ${fmtTime(dur)}`;
      if(bf&&dur>0)bf.style.width=Math.min(100,(cur/dur)*100).toFixed(1)+'%';
      else if(bf)bf.style.width='0%';
      // Play button state
      const pb=document.getElementById(`tt${side}-play`);
      if(pb){
        const playing=!!deck.playing;
        pb.classList.toggle('playing',playing);
        pb.textContent=playing?'❚❚':'▶';
      }
      // Hot cue highlights
      document.querySelectorAll(`[data-tt-hc="${side}"] .tt-pro-hc`).forEach(pad=>{
        const n=pad.dataset.hc;
        pad.classList.toggle('set',!!(deck.hotCues&&deck.hotCues[n]!=null));
      });
    });
  },200);
}

/* ============ ADVANCED FEATURES ============ */
let midiLearnMode=false,midiLearnTarget=null,midiMappings={};
let sessions=[];
let historyLog=[];
let keyboardShortcutsMap={};

function setupAdvancedFeatures(){
  // Init spectrum canvas
  spectrumCanvas=document.getElementById('spectrumCanvas');
  if(spectrumCanvas){spectrumCanvas.width=spectrumCanvas.offsetWidth*2;spectrumCanvas.height=80;}
  // Load mappings from storage
  try{
    const saved=localStorage.getItem('djpro_midi_map');
    if(saved)midiMappings=JSON.parse(saved);
    const sess=localStorage.getItem('djpro_sessions');
    if(sess)sessions=JSON.parse(sess);
  }catch(e){}
  // Save session button
  const saveSessBtn=document.getElementById('saveSessionBtn');
  if(saveSessBtn)saveSessBtn.addEventListener('click',()=>{
    showModal('Save Session','<input type="text" id="sessNameInput" placeholder="Session name (e.g. Friday Club Set)" />',()=>{
      const n=document.getElementById('sessNameInput').value.trim();
      if(n)saveSession(n);
    });
  });
  const expSessBtn=document.getElementById('exportSessionsBtn');
  if(expSessBtn)expSessBtn.addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify(sessions,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`dj-sessions-${Date.now()}.json`;a.click();
    toast('Sessions exported','success');
  });
}

/* MIDI LEARN */
function startMidiLearn(target,label){
  midiLearnMode=true;
  midiLearnTarget={target,label};
  toast(`MIDI Learn: move a controller for "${label}"`);
}
function completeMidiLearn(midiKey){
  if(!midiLearnTarget)return;
  midiMappings[midiKey]={target:midiLearnTarget.target,label:midiLearnTarget.label};
  localStorage.setItem('djpro_midi_map',JSON.stringify(midiMappings));
  toast(`Mapped ${midiKey} → ${midiLearnTarget.label}`,'success');
  midiLearnMode=false;midiLearnTarget=null;
}

/* SPECTRUM ANALYZER */
let spectrumCanvas=null,spectrumAnalyser=null;
function drawSpectrum(){
  if(!spectrumCanvas||!masterAnalyserL)return;
  const ctx=spectrumCanvas.getContext('2d');
  const w=spectrumCanvas.width,h=spectrumCanvas.height;
  ctx.fillStyle='rgba(5,5,6,0.4)';ctx.fillRect(0,0,w,h);
  const arr=new Uint8Array(masterAnalyserL.frequencyBinCount);
  masterAnalyserL.getByteFrequencyData(arr);
  const bars=64,step=Math.floor(arr.length/bars);
  for(let i=0;i<bars;i++){
    let sum=0;for(let j=0;j<step;j++)sum+=arr[i*step+j];
    const avg=sum/step,bh=(avg/255)*h;
    const hue=i/bars*280+20;
    ctx.fillStyle=`hsl(${hue},100%,${40+avg/5}%)`;
    ctx.fillRect(i*w/bars,h-bh,w/bars-1,bh);
  }
}

/* HISTORY LOG */
function addToHistory(action,details){
  historyLog.unshift({time:Date.now(),action,details:details||''});
  if(historyLog.length>200)historyLog.pop();
}

function renderHistory(){
  const el=document.getElementById('fullHistoryList');
  if(!el)return;
  el.innerHTML=historyLog.map(h=>`<div class="mix-entry"><span>${escapeHtml(h.action)} ${escapeHtml(h.details)}</span><span class="time">${new Date(h.time).toLocaleTimeString()}</span></div>`).join('')||'<div class="mix-entry" style="color:var(--text-dim)">No history yet</div>';
}

/* SESSIONS - Save complete DJ state */
function saveSession(name){
  const sess={
    name,
    createdAt:Date.now(),
    decks:{},
    mixerState:JSON.parse(JSON.stringify(mixerState)),
    historyLog:historyLog.slice(0,20)
  };
  ['A','B','C','D'].forEach(id=>{
    const d=decks[id];
    sess.decks[id]={trackId:d.track?.id,tempo:d.tempo,hotCues:d.hotCues,padMode:d.padMode,volume:d.volume};
  });
  sessions.unshift(sess);
  if(sessions.length>50)sessions.pop();
  localStorage.setItem('djpro_sessions',JSON.stringify(sessions));
  renderSessions();
  toast(`Session saved: ${name}`,'success');
}

function loadSession(idx){
  const sess=sessions[idx];if(!sess)return;
  Object.keys(sess.mixerState).forEach(k=>{mixerState[k]=sess.mixerState[k];});
  ['A','B','C','D'].forEach(id=>{
    const sd=sess.decks[id];if(!sd)return;
    if(sd.trackId){const t=library.find(x=>x.id===sd.trackId);if(t)loadTrackToDeck(id,t);}
    if(sd.hotCues)decks[id].hotCues=sd.hotCues;
    if(sd.padMode){decks[id].padMode=sd.padMode;setPadMode(id,sd.padMode);}
    if(sd.tempo!==undefined)setTempo(id,sd.tempo);
  });
  toast(`Loaded session: ${sess.name}`,'success');
}

function deleteSession(idx){
  sessions.splice(idx,1);
  localStorage.setItem('djpro_sessions',JSON.stringify(sessions));
  renderSessions();
}

function renderSessions(){
  const el=document.getElementById('sessionList');
  if(!el)return;
  if(!sessions.length){el.innerHTML='<div style="color:var(--text-dim);padding:20px;text-align:center;">No sessions saved</div>';return;}
  el.innerHTML=sessions.map((s,i)=>`
    <div class="session-card">
      <div><strong>${escapeHtml(s.name)}</strong><div style="font-size:10px;color:var(--text-dim);">${new Date(s.createdAt).toLocaleString()}</div></div>
      <div style="display:flex;gap:4px;">
        <button class="tool-btn" data-sess-load="${i}">LOAD</button>
        <button class="tool-btn" data-sess-delete="${i}" style="color:var(--red);border-color:var(--red);">✕</button>
      </div>
    </div>`).join('');
  el.querySelectorAll('[data-sess-load]').forEach(b=>b.addEventListener('click',()=>loadSession(parseInt(b.dataset.sessLoad))));
  el.querySelectorAll('[data-sess-delete]').forEach(b=>b.addEventListener('click',()=>deleteSession(parseInt(b.dataset.sessDelete))));
}

/* CAMELOT WHEEL - Harmonic key matching */
const CAMELOT_NEIGHBORS={};
for(let n=1;n<=12;n++){
  CAMELOT_NEIGHBORS[n+'A']=[n+'A',n+'B',((n%12)+1)+'A',((n-2+12)%12+1)+'A'];
  CAMELOT_NEIGHBORS[n+'B']=[n+'B',n+'A',((n%12)+1)+'B',((n-2+12)%12+1)+'B'];
}
function isHarmonic(k1,k2){return CAMELOT_NEIGHBORS[k1]?.includes(k2);}

/* TRACK RECOMMENDATION ENGINE */
function getRecommendations(currentTrack){
  if(!currentTrack)return[];
  return library.filter(t=>{
    if(t.id===currentTrack.id||t.source==='yt')return false;
    const bpmDiff=Math.abs(t.bpm-currentTrack.bpm)/currentTrack.bpm;
    const bpmMatch=bpmDiff<0.06||Math.abs(t.bpm*2-currentTrack.bpm)/currentTrack.bpm<0.06;
    const keyMatch=currentTrack.key==='--'||t.key==='--'||isHarmonic(currentTrack.key,t.key);
    return bpmMatch&&(keyMatch||bpmDiff<0.03);
  }).sort((a,b)=>Math.abs(a.bpm-currentTrack.bpm)-Math.abs(b.bpm-currentTrack.bpm)).slice(0,8);
}

/* KILL SWITCH */
function toggleKill(deckId,band){
  const dk=decks[deckId];if(!dk)return;
  const killKey='kill'+band.charAt(0).toUpperCase()+band.slice(1);
  dk[killKey]=!dk[killKey];
  const filter=band==='low'?dk.eqLow:band==='hi'?dk.eqHigh:null;
  // −80 dB is inaudible (≈0.01% amplitude); −40 dB still leaks audibly on a loud system.
  const KILL_DB=-80;
  if(filter){
    if(dk[killKey]){filter.gain.value=KILL_DB;}
    else{filter.gain.value=band==='low'?dk.eq.low*12:dk.eq.high*12;}
  }else if(band==='mid'){
    if(dk[killKey]){dk.eqLoMid.gain.value=KILL_DB;dk.eqHiMid.gain.value=KILL_DB;}
    else{dk.eqLoMid.gain.value=dk.eq.loMid*12;dk.eqHiMid.gain.value=dk.eq.hiMid*12;}
  }
  toast(`${deckId} ${band.toUpperCase()} ${dk[killKey]?'KILLED':'ON'}`);
}

/* INIT */
function init(){
  loadFromDB();
  applyTheme(settings.theme);
  document.getElementById('deckA-container').innerHTML=buildDeckHTML('A');
  document.getElementById('deckB-container').innerHTML=buildDeckHTML('B');
  document.getElementById('deckC-container').innerHTML=buildDeckHTML('C');
  document.getElementById('deckD-container').innerHTML=buildDeckHTML('D');
  document.getElementById('mixer-container').innerHTML=buildMixerHTML();
  const mtbTop=document.getElementById('mixer-toolbar-top');if(mtbTop)mtbTop.innerHTML=buildMixerToolbarTopHTML();
  const mtbBot=document.getElementById('mixer-toolbar-bottom');if(mtbBot)mtbBot.innerHTML=buildMixerToolbarBottomHTML();
  setupVU('vu-A',20);setupVU('vu-B',20);setupVU('vu-C',20);setupVU('vu-D',20);
  setupVU('masterHVuL',20);setupVU('masterHVuR',20);
  attachKnobs();attachEvents();setupBeatFxUI();setupSceneFx();setupKeyboard();setupTabs();setupSettings();setupVinylTurntables();setupOfflineDownload();setupDesktopDownloads();setupAdminDownload();setupSecretOffice();setupDiscover();setupTitanClock();setupSupport();setupStudioPro();
  // Restart-tour button + first-run auto-tour
  document.getElementById('restartTourBtn')?.addEventListener('click',()=>spStartTour(true));
  setTimeout(()=>{try{spStartTour(false);}catch(e){console.warn('tour failed',e);}},1100);
  setupWaveformInteraction();setupAdvancedFeatures();renderSessions();
  renderSampler();renderPlaylists();
  // Factory-seed of 64 sampler sounds disabled on boot per user request:
  // synthesising every drum / bass / FX / loop buffer at startup pushed
  // hundreds of AudioBuffer allocations onto the main thread and slowed
  // the first-paint.  The sampler now starts empty (pads unlit) and the
  // user loads the factory set on demand via the "LOAD DEFAULTS" button
  // inside the SAMPLER tab.

  // Demo tracks
  if(!library.length){
    DEMO_TRACKS.forEach(tr=>{
      library.push({id:'d_'+tr.title.replace(/\W/g,''),...tr,source:'file',rating:0,addedAt:Date.now()});
    });
  }
  renderLibrary();

  // File upload
  document.getElementById('uploadBtn').addEventListener('click',()=>document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change',async e=>{
    const AUDIO_EXT=/\.(mp3|wav|ogg|oga|m4a|mp4|aac|flac|weba|webm|opus|aiff|aif|wma|3gp)$/i;
    const files=Array.from(e.target.files||[]);
    for(const f of files){
      const isAudio=(f.type||'').startsWith('audio/')||(f.type||'').startsWith('video/')||AUDIO_EXT.test(f.name);
      if(!isAudio){toast&&toast(`Skipped "${f.name}" — not an audio file`,'error');continue;}
      try{
        toast&&toast(`Decoding ${f.name}…`);
        await loadAudioFile(f);
      }catch(err){
        console.warn('Upload failed',f.name,err);
        toast&&toast(`Failed "${f.name}": ${err.message||'decode error'}`,'error');
      }
    }
    e.target.value='';
  });
  document.getElementById('urlBtnToggle')?.addEventListener('click',()=>document.getElementById('urlInputWrap')?.classList.toggle('open'));
  document.getElementById('urlLoad')?.addEventListener('click',()=>{const u=document.getElementById('urlInput')?.value.trim();if(u)loadFromURL(u);});
  document.getElementById('urlInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('urlLoad')?.click();});
  document.getElementById('ytBtnToggle')?.addEventListener('click',()=>document.getElementById('ytInputWrap')?.classList.toggle('open'));
  document.getElementById('ytLoad')?.addEventListener('click',()=>{const u=document.getElementById('ytInput')?.value.trim();if(u)addYouTubeTrack(u);});
  document.getElementById('ytInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('ytLoad')?.click();});
  document.getElementById('searchInput').addEventListener('input',renderLibrary);
  document.getElementById('sortSelect').addEventListener('change',renderLibrary);
  document.getElementById('filterSource').addEventListener('change',renderLibrary);
  document.getElementById('recBtn').addEventListener('click',toggleRecording);
  document.getElementById('saveToPlaylistBtn').addEventListener('click',()=>{
    showModal('New Playlist from Current Library','<input type="text" id="newPlName" placeholder="Playlist name" />',()=>{
      const n=document.getElementById('newPlName').value.trim();if(n)createPlaylist(n);
    });
  });
  document.getElementById('newPlaylistBtn').addEventListener('click',()=>{
    showModal('New Playlist','<input type="text" id="newPlName2" placeholder="Playlist name" />',()=>{
      const n=document.getElementById('newPlName2').value.trim();if(n)createPlaylist(n);
    });
  });
  document.getElementById('exportLibBtn').addEventListener('click',()=>{
    const data={library:library.map(t=>({...t,buffer:undefined})),playlists};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`library-${Date.now()}.json`;a.click();
    toast('Library exported','success');
  });
  document.getElementById('importLibBtn').addEventListener('click',()=>document.getElementById('importLibInput').click());
  document.getElementById('importLibInput').addEventListener('change',async e=>{
    const f=e.target.files[0];if(!f)return;
    try{
      const text=await f.text();const data=JSON.parse(text);
      if(data.library)library=library.concat(data.library);
      if(data.playlists)playlists=playlists.concat(data.playlists);
      renderLibrary();renderPlaylists();saveToDB();
      toast('Imported','success');
    }catch(err){toast('Import failed','error');}
  });
  document.getElementById('sampleClearAll').addEventListener('click',()=>{samples=new Array(16).fill(null);renderSampler();saveToDB();});
  document.getElementById('sampleLoadDefault').addEventListener('click',loadDefaultSamples);
  document.getElementById('midiConnectBtn').addEventListener('click',connectMIDI);
  document.getElementById('aiStartBtn').addEventListener('click',startAIDJ);
  document.getElementById('aiNextBtn').addEventListener('click',()=>{
    if(!aiDJ.active){toast('Start AI first','error');return;}
    const cur=decks.A.playing?'A':decks.B.playing?'B':null;
    if(cur)performAITransition(cur);
  });
  document.getElementById('aiAnalyzeBtn').addEventListener('click',()=>{
    aiLog(`Analyzing ${library.length} tracks...`);
    library.forEach(t=>{if(!t.bpm)t.bpm=120;});
    renderLibrary();
    aiLog(`Done. BPM range: ${Math.min(...library.map(t=>t.bpm))}-${Math.max(...library.map(t=>t.bpm))}`);
  });
  document.getElementById('modalCancel').addEventListener('click',closeModal);
  document.getElementById('modalConfirm').addEventListener('click',()=>{if(modalCallback)modalCallback();closeModal();});

  setInterval(updateStats,1000);
  requestAnimationFrame(tick);
}

/* ========================================================
   IndexedDB audio-blob cache — persistent library across reloads
   ======================================================== */
const AUDIO_DB_NAME='djpro_audio',AUDIO_DB_STORE='blobs';
let _audioDBPromise=null;
function audioDB(){
  if(_audioDBPromise)return _audioDBPromise;
  _audioDBPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('no idb'));return;}
    const req=indexedDB.open(AUDIO_DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(AUDIO_DB_STORE))req.result.createObjectStore(AUDIO_DB_STORE);};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
  return _audioDBPromise;
}
async function idbPutAudio(id,ab){
  try{
    const db=await audioDB();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(AUDIO_DB_STORE,'readwrite');
      tx.objectStore(AUDIO_DB_STORE).put(ab,id);
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>reject(tx.error);
    });
  }catch(e){console.warn('idb put',e);return false;}
}
async function idbGetAudio(id){
  try{
    const db=await audioDB();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(AUDIO_DB_STORE,'readonly');
      const r=tx.objectStore(AUDIO_DB_STORE).get(id);
      r.onsuccess=()=>resolve(r.result||null);
      r.onerror=()=>reject(r.error);
    });
  }catch(e){return null;}
}
async function idbDelAudio(id){
  try{
    const db=await audioDB();
    return await new Promise((resolve)=>{
      const tx=db.transaction(AUDIO_DB_STORE,'readwrite');
      tx.objectStore(AUDIO_DB_STORE).delete(id);
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>resolve(false);
    });
  }catch(e){return false;}
}
/* On boot, proactively warm up the cached tracks so the library
   entries show up as "ready" without a new drag-in. Decode is lazy
   and only runs per-deck in loadTrackToDeck — here we just surface
   a visual hint that cached tracks exist. */
async function markCachedTracks(){
  try{
    const db=await audioDB();
    await new Promise((resolve)=>{
      const tx=db.transaction(AUDIO_DB_STORE,'readonly');
      const r=tx.objectStore(AUDIO_DB_STORE).getAllKeys();
      r.onsuccess=()=>{
        const keys=new Set(r.result||[]);
        library.forEach(t=>{if(keys.has(t.id))t._cached=true;});
        resolve();
      };
      r.onerror=()=>resolve();
    });
    renderLibrary&&renderLibrary();
  }catch(e){}
}
document.addEventListener('DOMContentLoaded',()=>{setTimeout(markCachedTracks,500);});

/* ========================================================
   Web Worker analysis pipeline (BPM + key + energy off-thread)
   ======================================================== */
(function(){
  try{
    window._analyzer=new Worker('./analyzer.worker.js');
    window._analyzerJobs=new Map();
    window._analyzer.onmessage=(e)=>{
      const{type,id}=e.data||{};
      if(type!=='result')return;
      const cb=window._analyzerJobs.get(id);
      if(cb){cb(e.data);window._analyzerJobs.delete(id);}
    };
    window._analyzer.onerror=(err)=>{console.warn('analyzer worker error',err);window._analyzer=null;};
  }catch(e){console.warn('analyzer worker unavailable',e);window._analyzer=null;}
})();

function analyzeInWorker(arrayBuffer,sampleRate,id){
  return new Promise((resolve,reject)=>{
    if(!window._analyzer){reject(new Error('no worker'));return;}
    const timeout=setTimeout(()=>{window._analyzerJobs.delete(id);reject(new Error('timeout'));},20000);
    window._analyzerJobs.set(id,(data)=>{clearTimeout(timeout);resolve(data);});
    window._analyzer.postMessage({type:'analyze',id,sampleRate,channelData:arrayBuffer},[arrayBuffer]);
  });
}

async function enrichTrackAsync(track,buf){
  if(!window._analyzer||!buf)return;
  try{
    const ch=buf.getChannelData(0);
    const r=await analyzeInWorker(ch.buffer.slice(0),buf.sampleRate,'enrich_'+track.id);
    if(r.bpm)track.bpm=r.bpm;
    if(r.key&&r.key!=='--')track.key=r.key;
    if(typeof r.energy==='number')track.energy=r.energy;
    renderLibrary&&renderLibrary();
    saveToDB&&saveToDB();
  }catch(e){/* keep defaults */}
}

/* ========================================================
   Service Worker registration — offline-first shell
   ======================================================== */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').then(reg=>{
      if(reg.waiting)reg.waiting.postMessage('SKIP_WAITING');
      reg.addEventListener('updatefound',()=>{
        const sw=reg.installing;if(!sw)return;
        sw.addEventListener('statechange',()=>{
          if(sw.state==='installed'&&navigator.serviceWorker.controller){
            sw.postMessage&&sw.postMessage('SKIP_WAITING');
            window.location.reload();
          }
        });
      });
      setInterval(()=>reg.update().catch(()=>{}),60000);
    }).catch(err=>console.warn('SW register failed',err));
  });
}

/* ========================================================
   Touch/mouse jog wheel — scrub-locate when paused, pitch-bend when playing
   ======================================================== */
function setupJogWheel(deckId){
  const platter=document.getElementById('platter-'+deckId);
  if(!platter)return;
  let dragging=false,lastAngle=0,lastMoveTime=0,velocity=0;
  let originalRate=1,bendActive=false;
  let scrubSource=null,scrubGain=null,scrubRestartTimer=null,lastScrubOffset=0;
  function getAngle(clientX,clientY){
    const r=platter.getBoundingClientRect();
    return Math.atan2(clientY-(r.top+r.height/2),clientX-(r.left+r.width/2));
  }
  function stopScrubSource(){
    if(scrubRestartTimer){clearTimeout(scrubRestartTimer);scrubRestartTimer=null;}
    if(scrubSource){try{scrubSource.stop();scrubSource.disconnect();}catch(e){}scrubSource=null;}
    if(scrubGain){try{scrubGain.disconnect();}catch(e){}scrubGain=null;}
  }
  function startScrubSource(){
    const d=decks[deckId];if(!d.buffer||!audioCtx)return;
    stopScrubSource();
    scrubGain=audioCtx.createGain();scrubGain.gain.value=0.6;
    scrubGain.connect(d.trimGain);
    scrubSource=audioCtx.createBufferSource();
    scrubSource.buffer=d.buffer;
    scrubSource.playbackRate.value=1.0;
    scrubSource.connect(scrubGain);
    try{scrubSource.start(0,Math.max(0,Math.min(d.buffer.duration-0.01,d.offset)));}catch(e){}
    lastScrubOffset=d.offset;
  }
  function updateScrubSource(){
    const d=decks[deckId];if(!scrubSource||!d.buffer)return;
    if(Math.abs(d.offset-lastScrubOffset)>0.12){
      startScrubSource();
      if(scrubRestartTimer)clearTimeout(scrubRestartTimer);
      scrubRestartTimer=setTimeout(()=>{if(scrubGain)scrubGain.gain.setTargetAtTime(0,audioCtx.currentTime,0.08);},180);
    }
  }
  function start(clientX,clientY){
    const d=decks[deckId];if(!d.track||!d.buffer)return;
    ensureAudio();
    dragging=true;velocity=0;
    lastAngle=getAngle(clientX,clientY);
    lastMoveTime=performance.now();
    platter.style.cursor='grabbing';
    platter.classList.add('jog-active');
    if(d.playing){originalRate=d.playbackRate;bendActive=true;}
    else{startScrubSource();}
  }
  function move(clientX,clientY){
    if(!dragging)return;
    const d=decks[deckId];if(!d.buffer)return;
    const ang=getAngle(clientX,clientY);
    let delta=ang-lastAngle;
    if(delta>Math.PI)delta-=2*Math.PI;
    if(delta<-Math.PI)delta+=2*Math.PI;
    lastAngle=ang;
    const now=performance.now();
    const dt=Math.max(1,now-lastMoveTime);
    velocity=delta/dt;
    lastMoveTime=now;
    if(d.playing&&d.source){
      const bend=1+(velocity*120);
      const clamped=Math.max(0.25,Math.min(2.5,bend));
      try{d.source.playbackRate.setTargetAtTime(clamped*originalRate,audioCtx.currentTime,0.01);}catch(e){}
    }else{
      const secsPerRev=4;
      const seekDelta=delta/(2*Math.PI)*secsPerRev;
      const next=Math.max(0,Math.min(d.buffer.duration-0.05,d.offset+seekDelta));
      d.offset=next;
      updateScrubSource();
      const cur=parseFloat(platter.dataset.rot||'0')+delta*180/Math.PI;
      platter.dataset.rot=cur;
      platter.style.transform='rotate('+cur+'deg)';
    }
  }
  function end(){
    if(!dragging)return;
    dragging=false;
    platter.style.cursor='grab';
    platter.classList.remove('jog-active');
    const d=decks[deckId];
    if(bendActive&&d.source){
      try{d.source.playbackRate.setTargetAtTime(originalRate,audioCtx.currentTime,0.05);}catch(e){}
      bendActive=false;
    }
    stopScrubSource();
  }
  platter.addEventListener('mousedown',(e)=>{e.preventDefault();start(e.clientX,e.clientY);});
  // Guard against a buttons-up state during move — if the mouse is released
  // outside the window, mouseup may not fire; on next move we see buttons===0
  // and can self-release instead of waiting for a possibly-lost mouseup.
  window.addEventListener('mousemove',(e)=>{if(dragging){if(e.buttons===0){end();return;}move(e.clientX,e.clientY);}});
  window.addEventListener('mouseup',end);
  window.addEventListener('blur',()=>{if(dragging)end();});
  platter.addEventListener('touchstart',(e)=>{const t=e.touches[0];if(t){e.preventDefault();start(t.clientX,t.clientY);}},{passive:false});
  window.addEventListener('touchmove',(e)=>{const t=e.touches[0];if(dragging&&t){e.preventDefault();move(t.clientX,t.clientY);}},{passive:false});
  window.addEventListener('touchend',end);
  window.addEventListener('touchcancel',end);
  platter.addEventListener('dblclick',(e)=>{
    e.preventDefault();const d=decks[deckId];if(!d.track)return;
    d.cuePoint=d.offset;toast(`Deck ${deckId}: CUE set at ${fmtTime(d.offset)}`,'success');
  });
}
document.addEventListener('DOMContentLoaded',()=>{setTimeout(()=>{['A','B','C','D'].forEach(setupJogWheel);},100);});

/* ========================================================
   Deck focus toggle — show any pair (AB/CD/AC/BD) or ALL 4
   ======================================================== */
const DSB_PAIRS={AB:['A','B'],CD:['C','D'],AC:['A','C'],BD:['B','D'],ALL:['A','B','C','D'],DJAB:['A','B'],DJCD:['C','D']};
let dsbPair='ALL';
function applyDeckPair(pair){
  dsbPair=pair;
  const visible=new Set(DSB_PAIRS[pair]||DSB_PAIRS.AB);
  ['A','B','C','D'].forEach(d=>{
    const c=document.getElementById('deck'+d+'-container');
    if(c)c.style.display=visible.has(d)?'':'none';
  });
  document.querySelectorAll('.dsb-btn').forEach(b=>b.classList.toggle('active',b.dataset.pair===pair));
  const console=document.getElementById('console');
  if(console)console.classList.toggle('show-all',pair==='ALL');
  document.body.classList.toggle('show-all',pair==='ALL');
  const djFocus=(pair==='DJAB'||pair==='DJCD');
  document.body.classList.toggle('dj-focus-mode',djFocus);
  // DJ FOCUS and WORK MODE are mutually exclusive — leaving work-mode when entering DJ focus
  if(djFocus)document.body.classList.remove('work-mode');
  renderMixerCompactDecks();
  updateDsbMonitor();
  if(djFocus){
    ['A','B','C','D'].forEach(d=>typeof refreshDjFocusVolumeUI==='function'&&refreshDjFocusVolumeUI(d));
  }
}
function renderMixerCompactDecks(){
  const container=document.getElementById('mixerCompactDecks');
  if(!container)return;
  const visible=new Set(DSB_PAIRS[dsbPair]||[]);
  const monitor=['A','B','C','D'].filter(d=>!visible.has(d));
  if(!monitor.length){container.innerHTML='';return;}
  container.innerHTML=monitor.map((cd,i)=>`
    <div class="compact-deck" data-deck="${cd}">
      <div class="compact-deck-header">
        <span class="cd-num">DECK ${cd}</span>
        <span style="color:var(--text-dim);">MONITOR</span>
      </div>
      <div class="compact-deck-title" id="cdTitle-${cd}">${decks[cd]?.track?.title?.toUpperCase()||'— EMPTY —'}</div>
      <div class="compact-deck-bpm" id="cdBpm-${cd}">${decks[cd]?.track?decks[cd].track.bpm.toFixed(1)+' BPM':'---'}</div>
      <div class="compact-transport">
        <button class="compact-btn cue ${decks[cd]?.cuePoint?'':''}" data-compact="cue" data-deck="${cd}">CUE</button>
        <button class="compact-btn play ${decks[cd]?.playing?'active':''}" data-compact="play" data-deck="${cd}">${decks[cd]?.playing?'❚❚ PAUSE':'▶ PLAY'}</button>
      </div>
      <div class="compact-tempo">
        <button data-compact="tempo-minus" data-deck="${cd}">−</button>
        <button data-compact="tempo-reset" data-deck="${cd}">0</button>
        <button data-compact="tempo-plus" data-deck="${cd}">+</button>
      </div>
      <div class="compact-vol">
        <span class="compact-vol-label">VOL</span>
        <input type="range" min="0" max="100" value="${Math.round((decks[cd]?.volume??0)*100)}" data-compact-vol="${cd}" />
      </div>
      <div class="compact-vol">
        <span class="compact-vol-label">FOCUS</span>
        <button class="dsb-btn" style="flex:1;padding:4px;" onclick="applyDeckPair('${cd==='A'||cd==='B'?'AB':'CD'}')">FOCUS ${cd}</button>
      </div>
    </div>`).join('');
  container.querySelectorAll('[data-compact="play"]').forEach(b=>b.addEventListener('click',()=>togglePlay(b.dataset.deck)));
  container.querySelectorAll('[data-compact="cue"]').forEach(b=>b.addEventListener('click',()=>cueDeck(b.dataset.deck)));
  container.querySelectorAll('[data-compact="tempo-minus"]').forEach(b=>b.addEventListener('click',()=>{const d=b.dataset.deck;setTempo(d,(decks[d].tempo||0)-0.1);}));
  container.querySelectorAll('[data-compact="tempo-plus"]').forEach(b=>b.addEventListener('click',()=>{const d=b.dataset.deck;setTempo(d,(decks[d].tempo||0)+0.1);}));
  container.querySelectorAll('[data-compact="tempo-reset"]').forEach(b=>b.addEventListener('click',()=>setTempo(b.dataset.deck,0)));
  container.querySelectorAll('[data-compact-vol]').forEach(r=>r.addEventListener('input',e=>{
    const d=r.dataset.compactVol,v=parseInt(e.target.value)/100;decks[d].volume=v;
    // Apply the perceptual taper (matches the main mixer fader) and
    // route through _rampGain so v=0 is genuinely silent.
    if(decks[d].volumeGain)_rampGain(decks[d].volumeGain.gain,_djFaderTaper(v),audioCtx,0.012);
    applyCrossfader();
  }));
}
function updateDsbMonitor(){
  const m=document.getElementById('dsbMonitor');if(!m)return;
  const focused=new Set(DSB_PAIRS[dsbPair]||[]);
  m.innerHTML=['A','B','C','D'].map(d=>{
    const dk=decks[d]||{};const playing=dk.playing?'playing':'';const focus=focused.has(d)?'focus':'';
    const bpm=dk.track?(dk.track.bpm*(1+(dk.tempo||0)/100)).toFixed(1):'---';
    return `<span class="dsb-chip ${playing} ${focus}"><span class="dsb-dot"></span><span class="dsb-id">${d}</span><span class="dsb-bpm">${bpm}</span></span>`;
  }).join('');
}
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    document.querySelectorAll('.dsb-btn[data-pair]').forEach(b=>b.addEventListener('click',()=>applyDeckPair(b.dataset.pair)));
    // Default layout on fresh boot = DECK FOCUS 1·2 (decks A+B).
    // A returning user's preference is restored from localStorage if we've
    // saved one; otherwise we stick with the new default.
    const savedPair=(()=>{try{return localStorage.getItem('titan_deck_pair')||'AB';}catch(_){return 'AB';}})();
    applyDeckPair(savedPair);
    // Persist whatever the user picks so the next reload respects their choice.
    document.querySelectorAll('.dsb-btn[data-pair]').forEach(b=>b.addEventListener('click',()=>{
      try{localStorage.setItem('titan_deck_pair',b.dataset.pair);}catch(_){}
    }));
    setInterval(updateDsbMonitor,500);
  },200);
});
window.applyDeckPair=applyDeckPair;

/* ========================================================
   DJ FOCUS — per-deck channel volume (slider / −/+ / mute)
   Visible only when body.dj-focus-mode is active; mirrors
   decks[d].volume + volumeGain and syncs with the main fader.
   ======================================================== */
function setDjFocusVolume(d,v){
  v=Math.max(0,Math.min(1,v));
  if(!decks[d])return;
  decks[d].volume=v;
  if(decks[d].volumeGain&&typeof audioCtx!=='undefined'&&audioCtx){
    const target=(typeof _djFaderTaper==='function')?_djFaderTaper(v):v;
    // _rampGain hard-zeros at v<=0 (setTargetAtTime alone asymptotes
    // and never quite reaches 0, leaving an audible residue).
    _rampGain(decks[d].volumeGain.gain,target,audioCtx,0.012);
  }
  refreshDjFocusVolumeUI(d);
  const fader=document.getElementById('fader-'+d);
  const wrap=document.querySelector(`.fader-wrap[data-fader="${d}"]`);
  if(fader&&wrap){
    const wrapH=wrap.getBoundingClientRect().height;
    const handleH=fader.offsetHeight||24;
    const travel=Math.max(1,wrapH-handleH);
    fader.style.bottom=(v*travel)+'px';
  }
  try{if(typeof applyCrossfader==='function')applyCrossfader();}catch(e){}
}
function refreshDjFocusVolumeUI(d){
  const strip=document.querySelector(`.dj-focus-vol[data-deck="${d}"]`);
  if(!strip)return;
  const v=decks[d]?.volume??0;
  const pct=Math.round(v*100);
  const sl=strip.querySelector('[data-djfv-slider]');
  if(sl&&document.activeElement!==sl)sl.value=pct;
  if(sl)sl.style.setProperty('--djfv-pct',pct+'%');
  const val=strip.querySelector('[data-djfv-value]');
  if(val)val.textContent=pct;
  const mute=strip.querySelector('[data-djfv-mute]');
  const muted=pct===0;
  strip.classList.toggle('muted',muted&&!!decks[d]?._djfvPrevVol);
  if(mute)mute.classList.toggle('active',muted&&!!decks[d]?._djfvPrevVol);
}
document.addEventListener('input',e=>{
  const sl=e.target.closest&&e.target.closest('[data-djfv-slider]');
  if(!sl)return;
  const d=sl.dataset.djfvSlider;
  const v=parseInt(sl.value)/100;
  if(decks[d])decks[d]._djfvPrevVol=0;
  setDjFocusVolume(d,v);
});
document.addEventListener('click',e=>{
  const step=e.target.closest&&e.target.closest('[data-djfv-step]');
  if(step){
    const d=step.dataset.djfvStep;
    const dir=parseInt(step.dataset.djfvDir)||0;
    const cur=decks[d]?.volume??0.8;
    if(decks[d])decks[d]._djfvPrevVol=0;
    setDjFocusVolume(d,cur+dir*0.05);
    return;
  }
  const mute=e.target.closest&&e.target.closest('[data-djfv-mute]');
  if(mute){
    const d=mute.dataset.djfvMute;
    if(!decks[d])return;
    if(decks[d].volume>0){
      decks[d]._djfvPrevVol=decks[d].volume;
      setDjFocusVolume(d,0);
    }else{
      const prev=decks[d]._djfvPrevVol||0.8;
      decks[d]._djfvPrevVol=0;
      setDjFocusVolume(d,prev);
    }
  }
});
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>['A','B','C','D'].forEach(refreshDjFocusVolumeUI),400);
});
window.setDjFocusVolume=setDjFocusVolume;
window.refreshDjFocusVolumeUI=refreshDjFocusVolumeUI;

/* I18N removed — app is English-only */
const currentLang='en';
function t(key){return key;}
try{localStorage.removeItem('djmaxai_lang_v1');}catch(e){}
document.documentElement.lang='en';
document.documentElement.dir='ltr';

/* ========================================================
   PLAYBACK WATCHDOG — continuously verifies every 'playing'
   deck actually has a live, progressing source. If a deck
   claims to be playing but time hasn't advanced for 3 checks
   (~1.5s), the watchdog recovers by resyncing state so the
   user never sees a frozen deck.
   ======================================================== */
(function(){
  const stuckCount={A:0,B:0,C:0,D:0};
  const lastPos={A:0,B:0,C:0,D:0};
  setInterval(()=>{
    if(!audioCtx||audioCtx.state!=='running')return;
    ['A','B','C','D'].forEach(id=>{
      const d=decks[id];if(!d||!d.track)return;
      if(!d.playing){stuckCount[id]=0;return;}
      if(!d.source){
        stuckCount[id]++;
        if(stuckCount[id]>=2){
          d.playing=false;d._playToken=null;
          const btn=document.querySelector(`.big-btn.play[data-deck="${id}"]`);
          if(btn)btn.classList.remove('active');
          stuckCount[id]=0;
          console.warn('[watchdog] deck '+id+' had no source, reset');
        }
        return;
      }
      let pos=0;try{pos=getCurrentTime(id);}catch(e){}
      if(Math.abs(pos-lastPos[id])<0.01){
        stuckCount[id]++;
        if(stuckCount[id]>=3){
          console.warn('[watchdog] deck '+id+' stalled at '+pos.toFixed(2)+', restarting');
          try{
            const offset=pos;
            if(d.source){try{d.source.onended=null;d.source.stop();d.source.disconnect();}catch(e){}}
            d.source=null;d.playing=false;d.offset=offset;
            setTimeout(()=>{playDeck(id);},50);
          }catch(e){d.playing=false;d.source=null;}
          stuckCount[id]=0;
        }
      }else{stuckCount[id]=0;lastPos[id]=pos;}
    });
  },500);
})();

/* ========================================================
   SOUNDTOUCH TIME-STRETCH — proper key-lock via WASM
   When deck.keylock is on and tempo != 0, uses SoundTouchJS
   to time-stretch without changing pitch. Otherwise falls
   back to native playbackRate (pitch changes).
   ======================================================== */
(function(){
  let soundTouchReady=false;
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/soundtouchjs@0.2.0/dist/soundtouch.min.js';
  script.onload=()=>{soundTouchReady=true;console.log('[SoundTouch] loaded');};
  script.onerror=()=>console.warn('[SoundTouch] load failed, falling back to playbackRate');
  document.head.appendChild(script);
  window.isSoundTouchReady=()=>soundTouchReady;
})();

/* ========================================================
   WEB MIDI HARDWARE AUTO-MAPPING — popular DJ controllers
   Auto-detects and binds Pioneer DDJ-400 / DDJ-SB3 /
   Hercules Inpulse / Traktor S2/S4 / generic 2-deck.
   ======================================================== */
const MIDI_CONTROLLER_MAPS={
  'DDJ-400':{
    transport:{0x0B:{type:'play',deck:'A'},0x0C:{type:'cue',deck:'A'},0x10:{type:'sync',deck:'A'},0x29:{type:'play',deck:'B'},0x2A:{type:'cue',deck:'B'},0x2D:{type:'sync',deck:'B'}},
    knobs:{0x16:{type:'volume',deck:'A'},0x34:{type:'volume',deck:'B'},0x1F:{type:'crossfader'}}
  },
  'DDJ-SB3':{
    transport:{0x0B:{type:'play',deck:'A'},0x0C:{type:'cue',deck:'A'},0x29:{type:'play',deck:'B'},0x2A:{type:'cue',deck:'B'}},
    knobs:{0x16:{type:'volume',deck:'A'},0x34:{type:'volume',deck:'B'},0x1F:{type:'crossfader'}}
  },
  'Traktor Kontrol S2':{
    transport:{0x24:{type:'play',deck:'A'},0x26:{type:'cue',deck:'A'},0x44:{type:'play',deck:'B'},0x46:{type:'cue',deck:'B'}},
    knobs:{0x28:{type:'volume',deck:'A'},0x48:{type:'volume',deck:'B'},0x29:{type:'crossfader'}}
  }
};
function detectController(name){
  if(/DDJ-400/i.test(name))return'DDJ-400';
  if(/DDJ-SB3|DDJ-SB/i.test(name))return'DDJ-SB3';
  if(/Traktor.*S2|Kontrol S2/i.test(name))return'Traktor Kontrol S2';
  return null;
}
function handleControllerMsg(ctrlName,msg){
  const map=MIDI_CONTROLLER_MAPS[ctrlName];if(!map)return false;
  const[status,data1,data2]=msg.data;
  const isNoteOn=(status&0xF0)===0x90&&data2>0;
  const isNoteOff=(status&0xF0)===0x80||((status&0xF0)===0x90&&data2===0);
  const isCC=(status&0xF0)===0xB0;
  if(isNoteOn&&map.transport[data1]){
    const b=map.transport[data1];
    if(b.type==='play')togglePlay(b.deck);
    else if(b.type==='cue')cueDeck(b.deck);
    else if(b.type==='sync'){const btn=document.querySelector(`.util-btn.sync[data-deck="${b.deck}"]`);if(btn)btn.click();}
    return true;
  }
  if(isCC&&map.knobs[data1]){
    const b=map.knobs[data1];
    const v=data2/127;
    if(b.type==='volume'&&decks[b.deck]&&decks[b.deck].volumeGain){
      decks[b.deck].volume=v;
      try{decks[b.deck].volumeGain.gain.setTargetAtTime(v,audioCtx.currentTime,0.02);}catch(e){}
      const h=document.getElementById('fader-'+b.deck);
      if(h){const bottom=v*90;h.style.bottom=bottom+'%';}
    }else if(b.type==='crossfader'){
      mixerState.crossfader=v;
      const h=document.getElementById('xfaderHandle');if(h)h.style.left=(v*100)+'%';
      try{applyCrossfader();}catch(e){}
    }
    return true;
  }
  return false;
}
(function initMidiHardware(){
  if(!navigator.requestMIDIAccess)return;
  navigator.requestMIDIAccess({sysex:false}).then(access=>{
    function bindInput(input){
      const ctrl=detectController(input.name||'');
      if(ctrl){
        toast&&toast(`🎛 ${ctrl} connected — auto-mapped`,'success');
        input.onmidimessage=msg=>{if(!handleControllerMsg(ctrl,msg)){try{handleMIDI&&handleMIDI(msg);}catch(e){}}};
      }
    }
    access.inputs.forEach(bindInput);
    access.onstatechange=(e)=>{if(e.port.type==='input'&&e.port.state==='connected')bindInput(e.port);};
  }).catch(err=>console.warn('[MIDI] not available',err));
})();

/* ========================================================
   LIVE SET RECORDING + LOCAL STREAM SHARE
   - Record Master to WebM and download on stop
   - Optional WebRTC broadcast (p2p 'listen URL' shared to friends)
   ======================================================== */
let _liveRecorder=null,_liveChunks=[];
function toggleLiveRecording(){
  ensureAudio();
  if(_liveRecorder&&_liveRecorder.state==='recording'){
    _liveRecorder.stop();
    return;
  }
  if(!window.recordDestination){toast&&toast('Audio not initialised','error');return;}
  _liveChunks=[];
  const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
  _liveRecorder=new MediaRecorder(recordDestination.stream,{mimeType:mime,audioBitsPerSecond:320000});
  _liveRecorder.ondataavailable=e=>{if(e.data.size>0)_liveChunks.push(e.data);};
  _liveRecorder.onstop=()=>{
    const blob=new Blob(_liveChunks,{type:mime});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=`DJ_MAX_Ai_Set_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.webm`;
    document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},200);
    toast&&toast('Set saved to downloads','success');
  };
  _liveRecorder.start(1000);
  toast&&toast('🔴 Recording live set…','success');
}
window.toggleLiveRecording=toggleLiveRecording;

/* ========================================================
   QUICK LIBRARY PICKER — browse/load from any deck header
   ======================================================== */
let _qlDeck='A';
function openQuickLib(deckId){
  _qlDeck=deckId;
  const ov=document.getElementById('quickLibOverlay');if(!ov)return;
  document.getElementById('quickLibDeck').textContent=deckId;
  document.getElementById('quickLibSearch').value='';
  renderQuickLib('');
  ov.classList.add('open');
  setTimeout(()=>document.getElementById('quickLibSearch').focus(),50);
}
function closeQuickLib(){document.getElementById('quickLibOverlay')?.classList.remove('open');}
function renderQuickLib(q){
  const list=document.getElementById('quickLibList');if(!list)return;
  const needle=(q||'').toLowerCase();
  const items=library.filter(t=>{
    if(!needle)return true;
    return (t.title||'').toLowerCase().includes(needle)
      ||(t.artist||'').toLowerCase().includes(needle)
      ||String(t.bpm||'').includes(needle)
      ||(t.key||'').toLowerCase().includes(needle);
  }).slice(0,500);
  if(!items.length){list.innerHTML='<div style="padding:30px;text-align:center;color:var(--text-dim);font-family:Share Tech Mono,monospace;font-size:12px;">No tracks match</div>';return;}
  list.innerHTML=items.map((t,i)=>`<div class="quick-lib-row" data-qid="${t.id}">
    <span class="ql-num">${i+1}</span>
    <div style="min-width:0"><div class="ql-title">${escapeHtml(t.title||'—')}</div><div class="ql-artist">${escapeHtml(t.artist||'')}</div></div>
    <span></span>
    <span class="ql-bpm">${t.bpm?t.bpm.toFixed(1):'--'}</span>
    <span class="ql-key">${t.key||'--'}</span>
  </div>`).join('');
  list.querySelectorAll('[data-qid]').forEach(row=>{
    row.addEventListener('click',()=>{
      const t=library.find(x=>x.id===row.dataset.qid);if(!t)return;
      loadTrackToDeck(_qlDeck,t);closeQuickLib();
      toast&&toast(`Loaded "${t.title}" → Deck ${_qlDeck}`,'success');
    });
  });
}
/* Event delegation — works for all 4 decks in every mode (split / ALL 4 / WORK),
   regardless of render timing, and survives deck rebuilds. */
document.addEventListener('click',(e)=>{
  const libBtn=e.target.closest('[data-deck-lib]');
  if(libBtn){e.preventDefault();e.stopPropagation();openQuickLib(libBtn.dataset.deckLib);return;}
  const upBtn=e.target.closest('[data-deck-upload]');
  if(upBtn){
    e.preventDefault();e.stopPropagation();
    if(upBtn._uploading)return;
    const deckId=upBtn.dataset.deckUpload;
    const inp=document.createElement('input');
    inp.type='file';inp.accept='audio/*,video/*,.mp3,.wav,.ogg,.m4a,.mp4,.aac,.flac,.weba,.webm,.opus,.aiff,.aif,.wma,.3gp';
    inp.multiple=true;
    inp.addEventListener('change',async ev=>{
      const files=Array.from(ev.target.files||[]);if(!files.length)return;
      upBtn._uploading=true;upBtn.classList.add('loading');upBtn.textContent='⬆ LOADING…';
      let firstTrack=null;
      for(const f of files){
        try{const t=await loadAudioFile(f);if(!firstTrack&&t)firstTrack=t;}
        catch(err){console.warn('upload fail',f.name,err);toast&&toast(`Failed "${f.name}"`,'error');}
      }
      upBtn.classList.remove('loading');upBtn.textContent='⬆ UPLOAD';upBtn._uploading=false;
      if(firstTrack){try{await loadTrackToDeck(deckId,firstTrack);toast&&toast(`Loaded "${firstTrack.title}" → Deck ${deckId}`,'success');}catch(e){}}
    });
    inp.click();
    return;
  }
  if(e.target.id==='quickLibClose'){closeQuickLib();return;}
  if(e.target.id==='quickLibOverlay'){closeQuickLib();return;}
});
document.addEventListener('input',(e)=>{
  if(e.target.id==='quickLibSearch')renderQuickLib(e.target.value);
});
window.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&document.getElementById('quickLibOverlay')?.classList.contains('open')){
    e.preventDefault();closeQuickLib();
  }
});

/* ========================================================
   SUPABASE AUTH + USER MANAGEMENT (RLS)
   Google OAuth, WhatsApp/SMS OTP, Email+Password.
   Admin panel uses the profiles table created by auth.sql.
   ======================================================== */
const SUPA_CFG_KEY='djmaxai_supa_v1';
let _supa=null;let _supaUser=null;let _supaProfile=null;
// Built-in default — the Supabase project this build ships against.
// The URL is safe to embed (it's public information used by every client
// request). The anon key is a published JWT designed to be embedded in
// client code and is protected by Row-Level-Security policies on the
// server. No secrets are leaked here; the renderer has always needed
// both values to talk to Supabase, and baking them in removes the
// "paste into SETTINGS" step so Sign-In With Google just works on first
// load.
const SUPA_DEFAULTS={
  url:'https://eliimbfzegwcepbljdwp.supabase.co',
  anon:'' // filled in by owner via SETTINGS → SUPABASE if not replaced here
};
let supaCfg={...SUPA_DEFAULTS};
try{const raw=localStorage.getItem(SUPA_CFG_KEY);if(raw){const saved=JSON.parse(raw);
  if(saved&&typeof saved==='object'){
    // Keep the built-in URL unless the owner explicitly saved a different one.
    if(saved.url&&saved.url.includes('.supabase.co'))supaCfg.url=saved.url;
    if(saved.anon)supaCfg.anon=saved.anon;
  }
}}catch(e){}

// Friendly catch for the "state parameter missing / bad_oauth_callback"
// flavour of errors Supabase redirects back to the app with. Surfaces a
// concrete next step instead of leaving the user staring at a raw URL.
(function _surfaceOAuthError(){
  try{
    const q=new URLSearchParams(location.search.slice(1));
    const h=new URLSearchParams((location.hash||'').replace(/^#/,''));
    const err=q.get('error')||h.get('error');
    const code=q.get('error_code')||h.get('error_code');
    const desc=q.get('error_description')||h.get('error_description');
    if(!err)return;
    const hints={
      'bad_oauth_callback':'State mismatch — usually means this URL is not in Supabase → Authentication → URL Configuration → Redirect URLs.',
      'redirect_uri_mismatch':'The Google Cloud OAuth client\'s "Authorized redirect URIs" must be https://eliimbfzegwcepbljdwp.supabase.co/auth/v1/callback',
      'validation_failed':'Provider likely not enabled in Supabase → Authentication → Providers → Google',
    };
    const hint=hints[code]||desc||err;
    setTimeout(()=>{
      if(typeof toast==='function')toast('Sign-in failed: '+hint,'error');
      console.warn('[auth] OAuth error',{err,code,desc});
    },600);
    // Strip the error params so a reload doesn't keep re-toasting.
    const clean=location.origin+location.pathname;
    if(history&&history.replaceState)history.replaceState({},'',clean);
  }catch(e){/* ignore */}
})();

function loadSupabaseLib(){
  return new Promise((resolve,reject)=>{
    if(window.supabase){resolve(window.supabase);return;}
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
    s.onload=()=>resolve(window.supabase);
    s.onerror=()=>reject(new Error('Supabase SDK load failed'));
    document.head.appendChild(s);
  });
}
async function initSupabase(){
  if(!supaCfg.url||!supaCfg.anon){return null;}
  try{
    await loadSupabaseLib();
    _supa=window.supabase.createClient(supaCfg.url,supaCfg.anon,{auth:{persistSession:true,autoRefreshToken:true}});
    const{data:{session}}=await _supa.auth.getSession();
    if(session)await onSupaSession(session);
    _supa.auth.onAuthStateChange((_e,session)=>{if(session)onSupaSession(session);else onSupaSignOut();});
    return _supa;
  }catch(e){console.warn('[auth] init failed',e);toast&&toast('Supabase: '+e.message,'error');return null;}
}
async function onSupaSession(session){
  _supaUser=session.user;
  document.getElementById('authModal')?.classList.remove('open');
  try{
    const{data:profile,error}=await _supa.from('profiles').select('*').eq('id',_supaUser.id).single();
    _supaProfile=profile||{id:_supaUser.id,email:_supaUser.email,phone:_supaUser.phone,role:'user'};
    try{await _supa.from('profiles').update({last_login:new Date().toISOString()}).eq('id',_supaUser.id);}catch(_){}
  }catch(e){_supaProfile={id:_supaUser.id,email:_supaUser.email,role:'user'};}
  updateAuthUI();
  if(_supaProfile.banned){
    toast&&toast('Account suspended — contact support','error');
  }else{
    toast&&toast(`Welcome, ${_supaProfile?.name||_supaUser.email||'customer'}`,'success');
  }
  // Refresh download gate so a fresh login auto-unlocks the installers
  if(typeof window.refreshOfflineDownloadGate==='function')window.refreshOfflineDownloadGate();
  if(_supaProfile.role==='admin')loadAdminUsers();
}
function onSupaSignOut(){
  _supaUser=null;_supaProfile=null;
  updateAuthUI();
  if(typeof window.refreshOfflineDownloadGate==='function')window.refreshOfflineDownloadGate();
}
function updateAuthUI(){
  const btn=document.getElementById('authBtn');
  const chip=document.getElementById('authChip');
  const name=document.getElementById('authName');
  const admin=document.getElementById('adminTabBtn');
  if(_supaUser){
    if(btn)btn.style.display='none';
    if(chip)chip.style.display='inline-flex';
    if(name)name.textContent=_supaProfile?.name||_supaUser.email||_supaUser.phone||'User';
    if(admin)admin.style.display=_supaProfile?.role==='admin'?'inline-flex':'none';
  }else{
    if(btn)btn.style.display='inline-flex';
    if(chip)chip.style.display='none';
    if(admin)admin.style.display='none';
  }
}
function saveSupaCfg(){
  let u=document.getElementById('supabaseUrl')?.value?.trim()||'';
  const a=document.getElementById('supabaseAnon')?.value?.trim()||'';
  // Fall back to the built-in URL if the owner left the field blank.
  if(!u)u=SUPA_DEFAULTS.url;
  // Guard against the class of errors where someone pastes localhost,
  // the project ref alone, or a URL with a trailing path. Must look
  // like https://<something>.supabase.co (optional trailing slash).
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(u)){
    toast&&toast('URL must look like https://<project>.supabase.co — got '+u,'error');
    return;
  }
  u=u.replace(/\/+$/,''); // strip trailing slash
  if(a && !a.startsWith('eyJ')){
    toast&&toast('Anon key should start with "eyJ..." — you pasted something else','error');
    return;
  }
  supaCfg={url:u,anon:a};
  try{localStorage.setItem(SUPA_CFG_KEY,JSON.stringify(supaCfg));}catch(e){}
  toast&&toast('Saved — connecting…','success');
  initSupabase().then(s=>{if(s)toast&&toast('Supabase connected ✓','success');
    else toast&&toast('Could not connect — check the anon key','error');});
}

/* ====================================================================
   AUTH DIAGNOSTIC — end-to-end self-test of the Google OAuth pipe.
   Walks the user through 6 checks and surfaces the EXACT step that
   needs fixing in Google Cloud / Supabase / Vercel. No secrets are
   logged; only public values (project ref, current origin) appear.
   ==================================================================== */
async function runAuthDiagnostic(){
  const out=document.getElementById('authDiagnoseOut');
  if(!out)return;
  out.style.display='block';
  const lines=[];
  const log=(ok,msg,hint)=>{
    const mark=ok===true?'✓':ok===false?'✗':'•';
    const color=ok===true?'#9affb0':ok===false?'#ff9f9f':'#cfd6dd';
    lines.push(`<span style="color:${color}">${mark}</span> ${msg}${hint?`\n   <span style="color:#a8b8c8">↳ ${hint}</span>`:''}`);
    out.innerHTML=lines.join('\n');
  };
  out.innerHTML='Running…';
  await new Promise(r=>setTimeout(r,30));

  // 1. URL format
  const url=(supaCfg.url||'').trim();
  if(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)){
    log(true,`Supabase URL valid (${url.replace(/^https:\/\//,'')})`);
  }else{
    log(false,'Supabase URL not set or malformed','Paste your project URL in the field above and SAVE.');
    return;
  }

  // 2. Anon key shape
  const anon=(supaCfg.anon||'').trim();
  if(!anon){log(false,'Anon key is empty','Supabase → Settings → API → copy the anon public key.');return;}
  if(!anon.startsWith('eyJ')){log(false,'Anon key shape wrong (must start with eyJ)','Did you paste the service_role by mistake? Use the ANON public key.');return;}
  log(true,`Anon key shape OK (${anon.slice(0,12)}…)`);

  // 3. SDK loaded
  try{await loadSupabaseLib();log(true,'Supabase JS SDK loaded');}
  catch(e){log(false,'SDK failed to load','Network blocked CDN? '+e.message);return;}

  // 4. Client connects (REST ping)
  let client;
  try{
    client=window.supabase.createClient(url,anon,{auth:{persistSession:false}});
    log(true,'Client created');
  }catch(e){log(false,'Client init failed',e.message);return;}

  // 5. Auth REST reachable + provider list
  try{
    const r=await fetch(url+'/auth/v1/settings',{headers:{apikey:anon,Authorization:'Bearer '+anon}});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const cfg=await r.json();
    const providers=cfg?.external||{};
    if(providers.google){
      log(true,'Google provider ENABLED in Supabase');
    }else{
      log(false,'Google provider NOT enabled','Supabase → Authentication → Providers → Google → toggle ENABLED + paste Client ID/Secret from Google Cloud.');
    }
    log(null,`External providers detected: ${Object.keys(providers).filter(k=>providers[k]).join(', ')||'(none)'}`);
  }catch(e){
    log(false,'Could not reach /auth/v1/settings — '+e.message,'Anon key wrong, project paused, or RLS blocking auth.settings.');
    return;
  }

  // 6. profiles table reachable (RLS-friendly anon read of the table's existence)
  try{
    const{error}=await client.from('profiles').select('id',{head:true,count:'exact'}).limit(0);
    if(error){
      if(/relation .* does not exist/i.test(error.message)){
        log(false,'profiles table missing','SQL Editor → paste auth.sql → Run.');
      }else{
        log(true,`profiles table reachable (RLS active: ${error.message.slice(0,80)})`);
      }
    }else{
      log(true,'profiles table reachable');
    }
  }catch(e){log(null,'profiles probe inconclusive: '+e.message);}

  // 7. Origin / redirect-URL hints — what the user must add to Supabase URL Config
  log(null,`This app's origin: ${location.origin}`);
  log(null,`Required redirect URI in Google Cloud: ${url.replace(/\/$/,'')}/auth/v1/callback`);
  log(null,`Required Site URL / Redirect URLs in Supabase URL Config: ${location.origin}/**`);

  log(true,'\nDIAGNOSTIC COMPLETE — fix any ✗ rows above, then click SAVE & CONNECT and try Sign In With Google.');
}

/* ADMIN: list/edit users via profiles table (RLS restricts to admins) */
async function loadAdminUsers(){
  const body=document.getElementById('adminUsersBody');
  const status=document.getElementById('adminStatus');
  if(!_supa||_supaProfile?.role!=='admin'){
    body.innerHTML='<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:20px;">Admin only. Sign in as admin.</td></tr>';
    return;
  }
  status.textContent='Loading…';
  const{data,error}=await _supa.from('profiles').select('*').order('created_at',{ascending:false});
  if(error){status.textContent='Error: '+error.message;return;}
  status.textContent=`${data.length} users`;
  body.innerHTML=data.map(u=>{
    const statusClass=u.banned?'banned':u.role;
    const statusLabel=u.banned?'BANNED':u.role.toUpperCase();
    const created=u.created_at?new Date(u.created_at).toLocaleDateString():'—';
    return `<tr>
      <td>${escapeHtml(u.email||u.phone||'—')}</td>
      <td>${escapeHtml(u.name||'—')}</td>
      <td><span class="admin-role ${u.role}">${u.role.toUpperCase()}</span></td>
      <td><span class="admin-role ${statusClass}">${statusLabel}</span></td>
      <td>${created}</td>
      <td><div class="admin-actions">
        ${u.id!==_supaUser.id?`<button class="promote" data-admin-promote="${u.id}" data-cur="${u.role}">${u.role==='admin'?'DEMOTE':'PROMOTE'}</button>`:''}
        ${u.id!==_supaUser.id?`<button data-admin-ban="${u.id}" data-cur="${u.banned}">${u.banned?'UNBAN':'BAN'}</button>`:''}
        ${u.id!==_supaUser.id?`<button class="danger" data-admin-del="${u.id}">DELETE</button>`:'<span style="color:var(--text-dim);font-size:9px">(you)</span>'}
      </div></td>
    </tr>`;
  }).join('');
  body.querySelectorAll('[data-admin-promote]').forEach(b=>b.addEventListener('click',async()=>{
    const id=b.dataset.adminPromote;const cur=b.dataset.cur;const nr=cur==='admin'?'user':'admin';
    const{error}=await _supa.from('profiles').update({role:nr}).eq('id',id);
    if(error)toast('Error: '+error.message,'error');else{toast(`Role updated to ${nr}`,'success');loadAdminUsers();}
  }));
  body.querySelectorAll('[data-admin-ban]').forEach(b=>b.addEventListener('click',async()=>{
    const id=b.dataset.adminBan;const ban=b.dataset.cur!=='true';
    const{error}=await _supa.from('profiles').update({banned:ban}).eq('id',id);
    if(error)toast('Error: '+error.message,'error');else{toast(ban?'User banned':'User unbanned','success');loadAdminUsers();}
  }));
  body.querySelectorAll('[data-admin-del]').forEach(b=>b.addEventListener('click',async()=>{
    if(!confirm('Delete this user profile? (auth user stays — use Supabase dashboard to fully delete)'))return;
    const id=b.dataset.adminDel;
    const{error}=await _supa.from('profiles').delete().eq('id',id);
    if(error)toast('Error: '+error.message,'error');else{toast('Deleted','success');loadAdminUsers();}
  }));
}

/* AUTH modal wiring */
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    document.getElementById('supabaseUrl')&&(document.getElementById('supabaseUrl').value=supaCfg.url||'');
    document.getElementById('supabaseAnon')&&(document.getElementById('supabaseAnon').value=supaCfg.anon||'');
    document.getElementById('saveSupabase')?.addEventListener('click',saveSupaCfg);
    document.getElementById('authDiagnoseBtn')?.addEventListener('click',()=>{
      try{runAuthDiagnostic();}catch(e){
        const out=document.getElementById('authDiagnoseOut');
        if(out){out.style.display='block';out.textContent='Diagnostic crashed: '+(e.message||e);}
      }
    });
    // Populate the dynamic redirect/origin hints + COPY buttons
    (function fillAuthHints(){
      const redirHint=document.getElementById('authRedirectHint');
      const originHint=document.getElementById('authOriginHint');
      if(redirHint)redirHint.textContent=(supaCfg.url||SUPA_DEFAULTS.url).replace(/\/$/,'')+'/auth/v1/callback';
      if(originHint)originHint.textContent=location.origin+'/**';
      const copyTo=(btnId,txtFn)=>{
        const b=document.getElementById(btnId);
        if(!b)return;
        b.addEventListener('click',()=>{
          const t=txtFn();
          try{navigator.clipboard.writeText(t);toast&&toast('Copied · '+t.slice(0,40)+'…','success');}
          catch(_){toast&&toast(t,'success');}
        });
      };
      copyTo('copyAuthRedirect',()=>(supaCfg.url||SUPA_DEFAULTS.url).replace(/\/$/,'')+'/auth/v1/callback');
      copyTo('copyAuthOrigin',()=>location.origin+'/**');
    })();
    initSupabase();
    const modal=document.getElementById('authModal');
    const openAuth=()=>{
      if(!_supa){toast&&toast('Add Supabase credentials in Settings first','error');
        document.querySelector('.tab-btn[data-tab="settings"]')?.click();return;}
      modal?.classList.add('open');
      document.getElementById('authStatus').textContent='';document.getElementById('authStatus').className='auth-status';
    };
    document.getElementById('authBtn')?.addEventListener('click',openAuth);
    document.getElementById('authCloseBtn')?.addEventListener('click',()=>modal?.classList.remove('open'));
    document.getElementById('authLogoutBtn')?.addEventListener('click',async()=>{
      if(_supa){await _supa.auth.signOut();toast('Signed out','success');}
    });
    let authMode='signin';
    document.querySelectorAll('.auth-tab').forEach(t=>t.addEventListener('click',()=>{
      document.querySelectorAll('.auth-tab').forEach(x=>x.classList.remove('active'));
      t.classList.add('active');authMode=t.dataset.authMode;
      document.getElementById('authTitle').textContent=authMode==='signup'?'SIGN UP':'SIGN IN';
    }));
    const setStatus=(msg,cls)=>{const el=document.getElementById('authStatus');el.textContent=msg||'';el.className='auth-status '+(cls||'')};
    document.getElementById('authGoogleBtn')?.addEventListener('click',async()=>{
      if(!_supa){setStatus('Not connected','error');return;}
      setStatus('Redirecting to Google…');
      const{error}=await _supa.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.href}});
      if(error)setStatus('Error: '+error.message,'error');
    });
    document.getElementById('authEmailBtn')?.addEventListener('click',async()=>{
      const email=document.getElementById('authEmail').value.trim();
      const pw=document.getElementById('authPassword').value;
      if(!email||!pw){setStatus('Enter email + password','error');return;}
      setStatus('Authenticating…');
      const fn=authMode==='signup'?_supa.auth.signUp({email,password:pw}):_supa.auth.signInWithPassword({email,password:pw});
      const{error}=await fn;
      if(error)setStatus('Error: '+error.message,'error');
      else setStatus(authMode==='signup'?'Check your email to confirm':'Welcome','success');
    });
    let otpPhone=null;
    document.getElementById('authPhoneBtn')?.addEventListener('click',async()=>{
      const btn=document.getElementById('authPhoneBtn');
      const phoneInput=document.getElementById('authPhone');
      const otpInput=document.getElementById('authOtp');
      if(!otpPhone){
        const phone=phoneInput.value.trim();
        if(!phone.startsWith('+')){setStatus('Use international format like +972501234567','error');return;}
        setStatus('Sending code…');
        const{error}=await _supa.auth.signInWithOtp({phone});
        if(error){setStatus('Error: '+error.message,'error');return;}
        otpPhone=phone;otpInput.style.display='block';btn.textContent='VERIFY CODE';
        setStatus('Code sent. Check WhatsApp / SMS.','success');
      }else{
        const token=otpInput.value.trim();
        if(!token){setStatus('Enter the code','error');return;}
        setStatus('Verifying…');
        const{error}=await _supa.auth.verifyOtp({phone:otpPhone,token,type:'sms'});
        if(error)setStatus('Error: '+error.message,'error');
      }
    });
    document.getElementById('adminRefreshBtn')?.addEventListener('click',loadAdminUsers);
    const adminTab=document.getElementById('adminTabBtn');
    if(adminTab)adminTab.addEventListener('click',()=>setTimeout(loadAdminUsers,50));
  },600);
});

/* ========================================================
   AUDIO EDITOR — trim, fade, pitch, stretch, filters, export
   Renders a processed region via OfflineAudioContext and
   writes a WAV file for download or adds it back to the library.
   ======================================================== */
const editorState={
  buffer:null,trackId:null,title:'',in:0,out:1,fadeIn:0,fadeOut:0,
  gain:0,pitch:0,stretch:100,lowCut:20,highCut:22000,bass:0,treble:0,
  source:null,startAt:0,startOffset:0,playing:false
};
function drawEditorWave(){
  const c=document.getElementById('editorWave');if(!c||!editorState.buffer)return;
  const ctx=c.getContext('2d');const w=c.width,h=c.height;
  ctx.clearRect(0,0,w,h);
  const data=editorState.buffer.getChannelData(0);
  const bars=Math.floor(w/2),spb=Math.floor(data.length/bars);
  const cy=h/2;
  ctx.fillStyle='rgba(46,224,255,0.05)';ctx.fillRect(0,cy-0.5,w,1);
  const regionL=editorState.in*w,regionR=editorState.out*w;
  ctx.fillStyle='rgba(255,138,26,0.08)';ctx.fillRect(regionL,0,regionR-regionL,h);
  for(let i=0;i<bars;i++){
    let peak=0;for(let j=0;j<spb;j++){const v=Math.abs(data[i*spb+j]||0);if(v>peak)peak=v;}
    const bh=Math.min(cy*0.92,peak*cy*2);
    const x=i*2,inRegion=(x>=regionL&&x<=regionR);
    const grad=ctx.createLinearGradient(0,cy-bh,0,cy+bh);
    if(inRegion){grad.addColorStop(0,'#ffb366');grad.addColorStop(.5,'#ff8a1a');grad.addColorStop(1,'#c85a00');}
    else{grad.addColorStop(0,'#3a5a70');grad.addColorStop(1,'#1a3a4a');}
    ctx.fillStyle=grad;ctx.fillRect(x,cy-bh,1.5,bh*2);
  }
  document.getElementById('editorMarkerIn').style.left=(regionL/w*100)+'%';
  document.getElementById('editorMarkerOut').style.left=(regionR/w*100)+'%';
}
function editorLoadTrack(track){
  if(!track||!track.buffer){toast&&toast('Track not decoded yet','error');return;}
  editorState.buffer=track.buffer;editorState.trackId=track.id;
  editorState.title=track.title;
  editorState.in=0;editorState.out=1;
  document.getElementById('editorIn').value=0;
  document.getElementById('editorOut').value=1000;
  document.getElementById('editorExportName').value=track.title+' (edit)';
  document.getElementById('editorStatus').textContent=`${track.title} — ${track.buffer.duration.toFixed(1)}s, ${track.buffer.numberOfChannels}ch, ${track.buffer.sampleRate}Hz`;
  drawEditorWave();
  refreshEditorLabels();
}
function fmtEdTime(sec){if(!isFinite(sec))return '00:00.0';const m=Math.floor(sec/60),s=Math.floor(sec%60),ds=Math.floor((sec-Math.floor(sec))*10);return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${ds}`;}
function refreshEditorLabels(){
  const b=editorState.buffer;if(!b)return;
  const dur=b.duration;
  document.getElementById('editorInVal').textContent=fmtEdTime(editorState.in*dur);
  document.getElementById('editorOutVal').textContent=fmtEdTime(editorState.out*dur);
  document.getElementById('editorFadeInVal').textContent=editorState.fadeIn.toFixed(1)+'s';
  document.getElementById('editorFadeOutVal').textContent=editorState.fadeOut.toFixed(1)+'s';
  document.getElementById('editorGainVal').textContent=(editorState.gain>=0?'+':'')+editorState.gain.toFixed(1)+'dB';
  document.getElementById('editorPitchVal').textContent=(editorState.pitch>=0?'+':'')+editorState.pitch+' st';
  document.getElementById('editorStretchVal').textContent=editorState.stretch+'%';
  document.getElementById('editorLowCutVal').textContent=editorState.lowCut+'Hz';
  document.getElementById('editorHighCutVal').textContent=editorState.highCut>=1000?(editorState.highCut/1000).toFixed(1)+'kHz':editorState.highCut+'Hz';
  document.getElementById('editorBassVal').textContent=(editorState.bass>=0?'+':'')+editorState.bass.toFixed(1)+'dB';
  document.getElementById('editorTrebleVal').textContent=(editorState.treble>=0?'+':'')+editorState.treble.toFixed(1)+'dB';
  document.getElementById('editorTime').textContent=`00:00.0 / ${fmtEdTime(dur)}`;
}
async function renderEditorBuffer(){
  const b=editorState.buffer;if(!b)throw new Error('No buffer');
  const pitchRatio=Math.pow(2,editorState.pitch/12);
  const stretchRatio=editorState.stretch/100;
  const rate=pitchRatio/stretchRatio;
  const inS=editorState.in*b.duration,outS=editorState.out*b.duration;
  const regionDur=Math.max(.05,outS-inS);
  const renderDur=regionDur/rate;
  const sr=b.sampleRate;
  const off=new OfflineAudioContext(b.numberOfChannels,Math.ceil(renderDur*sr),sr);
  const src=off.createBufferSource();src.buffer=b;src.playbackRate.value=rate;
  const hp=off.createBiquadFilter();hp.type='highpass';hp.frequency.value=editorState.lowCut;
  const lp=off.createBiquadFilter();lp.type='lowpass';lp.frequency.value=editorState.highCut;
  const bass=off.createBiquadFilter();bass.type='lowshelf';bass.frequency.value=120;bass.gain.value=editorState.bass;
  const treble=off.createBiquadFilter();treble.type='highshelf';treble.frequency.value=8000;treble.gain.value=editorState.treble;
  const g=off.createGain();g.gain.value=Math.pow(10,editorState.gain/20);
  const fade=off.createGain();
  const t0=0;
  fade.gain.setValueAtTime(editorState.fadeIn>0?0.0001:1,t0);
  if(editorState.fadeIn>0)fade.gain.exponentialRampToValueAtTime(1,t0+editorState.fadeIn/rate);
  const fadeOutStart=Math.max(0,renderDur-editorState.fadeOut/rate);
  if(editorState.fadeOut>0){fade.gain.setValueAtTime(1,t0+fadeOutStart);fade.gain.exponentialRampToValueAtTime(0.0001,t0+renderDur);}
  src.connect(hp);hp.connect(lp);lp.connect(bass);bass.connect(treble);treble.connect(g);g.connect(fade);fade.connect(off.destination);
  src.start(0,inS,regionDur);
  const rendered=await off.startRendering();
  if(editorState._reverse){
    for(let c=0;c<rendered.numberOfChannels;c++){const d=rendered.getChannelData(c);Array.prototype.reverse.call(d);}
  }
  if(editorState._normalize){
    let peak=0;
    for(let c=0;c<rendered.numberOfChannels;c++){const d=rendered.getChannelData(c);for(let i=0;i<d.length;i++){const v=Math.abs(d[i]);if(v>peak)peak=v;}}
    if(peak>0&&peak<1){const gain=0.99/peak;for(let c=0;c<rendered.numberOfChannels;c++){const d=rendered.getChannelData(c);for(let i=0;i<d.length;i++)d[i]*=gain;}}
  }
  return rendered;
}
function bufferToWav(buf){
  const numCh=buf.numberOfChannels,sr=buf.sampleRate,len=buf.length;
  const bytes=44+len*numCh*2;const ab=new ArrayBuffer(bytes);const view=new DataView(ab);
  const writeStr=(o,s)=>{for(let i=0;i<s.length;i++)view.setUint8(o+i,s.charCodeAt(i));};
  writeStr(0,'RIFF');view.setUint32(4,bytes-8,true);writeStr(8,'WAVE');
  writeStr(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);
  view.setUint16(22,numCh,true);view.setUint32(24,sr,true);view.setUint32(28,sr*numCh*2,true);
  view.setUint16(32,numCh*2,true);view.setUint16(34,16,true);
  writeStr(36,'data');view.setUint32(40,len*numCh*2,true);
  let offset=44;
  for(let i=0;i<len;i++){
    for(let c=0;c<numCh;c++){
      let s=buf.getChannelData(c)[i];s=Math.max(-1,Math.min(1,s));
      view.setInt16(offset,s<0?s*0x8000:s*0x7FFF,true);offset+=2;
    }
  }
  return new Blob([ab],{type:'audio/wav'});
}
async function editorExportWav(){
  const status=document.getElementById('editorRenderStatus');
  status.textContent='Rendering…';status.style.color='var(--screen-glow)';
  try{
    const buf=await renderEditorBuffer();
    const blob=bufferToWav(buf);
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    const name=(document.getElementById('editorExportName').value||editorState.title||'edit').replace(/[^\w\- ]/g,'');
    a.href=url;a.download=name+'.wav';document.body.appendChild(a);a.click();
    setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},200);
    status.textContent=`Exported ${(blob.size/1024/1024).toFixed(1)} MB WAV`;status.style.color='var(--play-green)';
  }catch(e){status.textContent='Error: '+e.message;status.style.color='var(--red)';}
}
async function editorSaveToLibrary(){
  const status=document.getElementById('editorRenderStatus');
  status.textContent='Rendering…';status.style.color='var(--screen-glow)';
  try{
    const buf=await renderEditorBuffer();
    const name=(document.getElementById('editorExportName').value||editorState.title||'edit');
    const bpm=Math.round((editorState.buffer&&library.find(t=>t.id===editorState.trackId)?.bpm||120)/(editorState.stretch/100));
    const track={id:'e_'+Date.now()+'_'+Math.random().toString(36).slice(2,8),title:name,artist:'Editor',bpm,key:'--',duration:buf.duration,buffer:buf,source:'file',rating:0,addedAt:Date.now()};
    library.push(track);
    const wav=bufferToWav(buf);const ab=await wav.arrayBuffer();
    try{await idbPutAudio(track.id,ab);}catch(e){}
    renderLibrary();saveToDB();
    status.textContent=`Saved "${name}" to library`;status.style.color='var(--play-green)';
    toast&&toast('Saved to library','success');
  }catch(e){status.textContent='Error: '+e.message;status.style.color='var(--red)';}
}
async function editorExportWebm(){
  const status=document.getElementById('editorRenderStatus');
  status.textContent='Rendering…';status.style.color='var(--screen-glow)';
  try{
    const buf=await renderEditorBuffer();
    const ctx=new(window.AudioContext||window.webkitAudioContext)();
    const dest=ctx.createMediaStreamDestination();
    const src=ctx.createBufferSource();src.buffer=buf;src.connect(dest);
    const chunks=[];
    const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
    const rec=new MediaRecorder(dest.stream,{mimeType:mime,audioBitsPerSecond:256000});
    rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
    rec.onstop=()=>{
      const blob=new Blob(chunks,{type:mime});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      const name=(document.getElementById('editorExportName').value||editorState.title||'edit').replace(/[^\w\- ]/g,'');
      a.href=url;a.download=name+'.webm';document.body.appendChild(a);a.click();
      setTimeout(()=>{a.remove();URL.revokeObjectURL(url);ctx.close();},200);
      status.textContent=`Exported ${(blob.size/1024).toFixed(0)} KB WebM`;status.style.color='var(--play-green)';
    };
    rec.start();src.start();
    src.onended=()=>{setTimeout(()=>rec.stop(),50);};
  }catch(e){status.textContent='Error: '+e.message;status.style.color='var(--red)';}
}
function editorPlay(){
  if(editorState.playing||!editorState.buffer)return;
  ensureAudio();if(!audioCtx)return;
  const src=audioCtx.createBufferSource();src.buffer=editorState.buffer;
  const rate=Math.pow(2,editorState.pitch/12)/(editorState.stretch/100);
  src.playbackRate.value=rate;
  const g=audioCtx.createGain();g.gain.value=Math.pow(10,editorState.gain/20);
  src.connect(g);g.connect(audioCtx.destination);
  const dur=editorState.buffer.duration;
  const inS=editorState.in*dur,regionDur=(editorState.out-editorState.in)*dur;
  src.start(0,inS,regionDur);
  editorState.source=src;editorState.startAt=audioCtx.currentTime;editorState.startOffset=inS;editorState.playing=true;
  document.getElementById('editorPlayBtn').textContent='❚❚ PAUSE';
  const ph=document.getElementById('editorPlayhead');ph.classList.add('playing');
  src.onended=()=>{if(editorState.source===src){editorState.playing=false;document.getElementById('editorPlayBtn').textContent='▶ PLAY';ph.classList.remove('playing');}};
  requestAnimationFrame(function upd(){
    if(!editorState.playing)return;
    const elapsed=(audioCtx.currentTime-editorState.startAt)*rate;
    const cur=editorState.startOffset+elapsed;
    const pct=cur/dur;
    ph.style.left=(pct*100)+'%';
    document.getElementById('editorTime').textContent=`${fmtEdTime(cur)} / ${fmtEdTime(dur)}`;
    requestAnimationFrame(upd);
  });
}
function editorStop(){
  if(editorState.source){try{editorState.source.stop();editorState.source.disconnect();}catch(e){}editorState.source=null;}
  editorState.playing=false;
  document.getElementById('editorPlayBtn').textContent='▶ PLAY';
  document.getElementById('editorPlayhead')?.classList.remove('playing');
}

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    const sel=document.getElementById('editorTrackSelect');
    const refreshSel=()=>{
      if(!sel)return;
      sel.innerHTML=library.filter(t=>t.source!=='yt'&&t.buffer).map(t=>`<option value="${t.id}">${escapeHtml(t.title)}</option>`).join('');
    };
    document.querySelector('.tab-btn[data-tab="editor"]')?.addEventListener('click',()=>setTimeout(refreshSel,30));
    document.getElementById('editorLoadBtn')?.addEventListener('click',()=>{
      const id=sel.value;const t=library.find(x=>x.id===id);if(t)editorLoadTrack(t);
    });
    const slider=(id,key,fmt)=>{
      const el=document.getElementById(id);if(!el)return;
      el.addEventListener('input',()=>{
        let v=parseFloat(el.value);
        if(id==='editorIn'||id==='editorOut')v=v/1000;
        editorState[key]=v;refreshEditorLabels();drawEditorWave();
      });
    };
    slider('editorIn','in');slider('editorOut','out');
    slider('editorFadeIn','fadeIn');slider('editorFadeOut','fadeOut');
    slider('editorGain','gain');slider('editorPitch','pitch');slider('editorStretch','stretch');
    slider('editorLowCut','lowCut');slider('editorHighCut','highCut');
    slider('editorBass','bass');slider('editorTreble','treble');
    document.getElementById('editorReset')?.addEventListener('click',()=>{
      editorState.in=0;editorState.out=1;editorState.fadeIn=0;editorState.fadeOut=0;editorState.gain=0;
      editorState.pitch=0;editorState.stretch=100;editorState.lowCut=20;editorState.highCut=22000;editorState.bass=0;editorState.treble=0;
      editorState._reverse=false;editorState._normalize=false;
      document.getElementById('editorIn').value=0;document.getElementById('editorOut').value=1000;
      document.getElementById('editorFadeIn').value=0;document.getElementById('editorFadeOut').value=0;
      document.getElementById('editorGain').value=0;document.getElementById('editorPitch').value=0;
      document.getElementById('editorStretch').value=100;document.getElementById('editorLowCut').value=20;
      document.getElementById('editorHighCut').value=22000;document.getElementById('editorBass').value=0;document.getElementById('editorTreble').value=0;
      refreshEditorLabels();drawEditorWave();
    });
    document.getElementById('editorSetInCur')?.addEventListener('click',()=>{
      if(!editorState.playing||!editorState.buffer)return;
      const elapsed=(audioCtx.currentTime-editorState.startAt)*(Math.pow(2,editorState.pitch/12)/(editorState.stretch/100));
      const cur=editorState.startOffset+elapsed;
      editorState.in=Math.max(0,Math.min(editorState.out-.01,cur/editorState.buffer.duration));
      document.getElementById('editorIn').value=editorState.in*1000;refreshEditorLabels();drawEditorWave();
    });
    document.getElementById('editorSetOutCur')?.addEventListener('click',()=>{
      if(!editorState.playing||!editorState.buffer)return;
      const elapsed=(audioCtx.currentTime-editorState.startAt)*(Math.pow(2,editorState.pitch/12)/(editorState.stretch/100));
      const cur=editorState.startOffset+elapsed;
      editorState.out=Math.max(editorState.in+.01,Math.min(1,cur/editorState.buffer.duration));
      document.getElementById('editorOut').value=editorState.out*1000;refreshEditorLabels();drawEditorWave();
    });
    document.getElementById('editorHalfSpeed')?.addEventListener('click',()=>{document.getElementById('editorStretch').value=50;editorState.stretch=50;refreshEditorLabels();});
    document.getElementById('editorDoubleSpeed')?.addEventListener('click',()=>{document.getElementById('editorStretch').value=200;editorState.stretch=200;refreshEditorLabels();});
    document.getElementById('editorOctaveDown')?.addEventListener('click',()=>{document.getElementById('editorPitch').value=-12;editorState.pitch=-12;refreshEditorLabels();});
    document.getElementById('editorOctaveUp')?.addEventListener('click',()=>{document.getElementById('editorPitch').value=12;editorState.pitch=12;refreshEditorLabels();});
    document.getElementById('editorNormalize')?.addEventListener('click',()=>{editorState._normalize=!editorState._normalize;toast(`Normalize: ${editorState._normalize?'ON':'OFF'}`,'success');});
    document.getElementById('editorReverse')?.addEventListener('click',()=>{editorState._reverse=!editorState._reverse;toast(`Reverse: ${editorState._reverse?'ON':'OFF'}`,'success');});
    document.getElementById('editorPlayBtn')?.addEventListener('click',()=>{if(editorState.playing)editorStop();else editorPlay();});
    document.getElementById('editorStopBtn')?.addEventListener('click',editorStop);
    document.getElementById('editorRestartBtn')?.addEventListener('click',()=>{editorStop();setTimeout(editorPlay,50);});
    document.getElementById('editorExportWav')?.addEventListener('click',editorExportWav);
    document.getElementById('editorExportMp3')?.addEventListener('click',editorExportWebm);
    document.getElementById('editorSaveLib')?.addEventListener('click',editorSaveToLibrary);
    // click on waveform seeks marker (left-click sets IN, right-click sets OUT)
    const cvs=document.getElementById('editorWave');
    if(cvs){
      cvs.addEventListener('click',e=>{
        if(!editorState.buffer)return;
        const r=cvs.getBoundingClientRect();const pct=(e.clientX-r.left)/r.width;
        editorState.in=Math.max(0,Math.min(editorState.out-.01,pct));
        document.getElementById('editorIn').value=editorState.in*1000;refreshEditorLabels();drawEditorWave();
      });
      cvs.addEventListener('contextmenu',e=>{
        e.preventDefault();if(!editorState.buffer)return;
        const r=cvs.getBoundingClientRect();const pct=(e.clientX-r.left)/r.width;
        editorState.out=Math.max(editorState.in+.01,Math.min(1,pct));
        document.getElementById('editorOut').value=editorState.out*1000;refreshEditorLabels();drawEditorWave();
      });
    }
  },700);
});

/* ========================================================
   STUDIO MASTERING — pro audio chain inserted before the limiter
   7-band parametric EQ, compressor, stereo widener, exciter,
   true-peak meters, LUFS approximation, presets.
   ======================================================== */
const STUDIO_BANDS=[
  {freq:60,type:'lowshelf',label:'60Hz'},
  {freq:150,type:'peaking',label:'150'},
  {freq:400,type:'peaking',label:'400'},
  {freq:1000,type:'peaking',label:'1k'},
  {freq:3000,type:'peaking',label:'3k'},
  {freq:8000,type:'peaking',label:'8k'},
  {freq:14000,type:'highshelf',label:'14k'}
];
// NATURAL = fully transparent mastering chain. No compression, no widening,
// no saturation, no excitement. The audio passes through untouched. This is
// the *only* safe default — anything else changes the perceived volume the
// moment audio first plays, which is what previously made playback feel
// "off" until the user opened the SOUND tab.
const STUDIO_NATURAL={
  eqGains:[0,0,0,0,0,0,0],
  compThreshold:0,compRatio:1,compAttack:0.005,compRelease:0.15,compMakeup:0,
  widener:1,balance:0,bassMono:120,
  exciterDrive:0,exciterMix:0,exciterTone:4000,
  limitThreshold:-0.5,masterTrim:0,
  tapeDrive:0,tapeBias:0,tapeTone:0,tapeMix:0,
  deessFreq:6000,deessThresh:-18,deessAmt:0,
  transAttack:0,transSustain:0,transMix:0,
  mbcLow:0,mbcMid:0,mbcHi:0,mbcXover:250,
  gateThresh:-80,gateAttack:0.001,gateRelease:0.1
};
const studioState={
  bypass:false,
  ...JSON.parse(JSON.stringify(STUDIO_NATURAL)),
  // Amp bridge state — not part of the audio preset
  targetLufs:null,          // null | -8 | -12 | -14 | -16 | -23
  monoSum:false,
  dim:false
};
// Each preset is a partial override on top of NATURAL — applyStudioPreset()
// always resets to NATURAL first, so presets only need to spell out the
// parameters that differ. Every preset that compresses also includes makeup
// gain so the perceived loudness stays close to the natural reference.
const STUDIO_PRESETS={
  natural:{},
  flat:{},
  club:{eqGains:[4,2,-1,0,1,2,3],compThreshold:-18,compRatio:4,compMakeup:4,widener:1.2,exciterDrive:0.3,exciterMix:0.35,exciterTone:5000,limitThreshold:-0.5,masterTrim:1,mbcLow:-3,mbcMid:-2,mbcHi:-2},
  studio:{eqGains:[0,0,0,0,1,0,1],compThreshold:-22,compRatio:2.5,compMakeup:2,widener:1,exciterDrive:0.15,exciterMix:0.25},
  outdoor:{eqGains:[5,3,0,0,2,3,4],compThreshold:-14,compRatio:6,compMakeup:6,widener:1.3,exciterDrive:0.4,exciterMix:0.45,limitThreshold:-0.5,masterTrim:2},
  headphones:{eqGains:[-1,-1,0,1,2,1,2],compThreshold:-22,compRatio:2,compMakeup:1.5,widener:0.85,exciterDrive:0.2,exciterMix:0.3},
  car:{eqGains:[3,2,-1,-1,0,2,3],compThreshold:-18,compRatio:3,compMakeup:3,widener:0.9,exciterDrive:0.25,exciterMix:0.3},
  warm:{eqGains:[2,2,1,0,-1,-2,-2],compThreshold:-22,compRatio:2.5,compMakeup:2,widener:1.05,exciterDrive:0.2,exciterMix:0.25,tapeDrive:0.3,tapeMix:0.4,tapeTone:0.3},
  bright:{eqGains:[-1,-1,0,1,3,4,4],compThreshold:-22,compRatio:2.5,compMakeup:2,widener:1.15,exciterDrive:0.35,exciterMix:0.4},
  bassboost:{eqGains:[7,4,1,-1,0,1,1],compThreshold:-16,compRatio:4,compMakeup:3,widener:1.1,exciterDrive:0.2,exciterMix:0.3,bassMono:100},
  vocal:{eqGains:[-2,-1,1,3,4,2,1],compThreshold:-20,compRatio:3,compMakeup:2,widener:0.95,exciterDrive:0.2,exciterMix:0.35,deessAmt:0.5},
  master:{eqGains:[1,1,0,0,1,1,2],compThreshold:-18,compRatio:3,compMakeup:3,widener:1.1,exciterDrive:0.25,exciterMix:0.3,limitThreshold:-0.5,masterTrim:2,mbcLow:-3,mbcMid:-2,mbcHi:-2},
  punch:{eqGains:[3,1,-1,0,1,2,3],compThreshold:-16,compRatio:4,compMakeup:3,widener:1.1,transAttack:0.4,transSustain:-0.2,transMix:0.7},
  radio:{eqGains:[-1,0,0,1,2,1,2],compThreshold:-14,compRatio:6,compMakeup:5,widener:1,exciterDrive:0.3,exciterMix:0.4,limitThreshold:-1,masterTrim:3},
  lofi:{eqGains:[1,1,0,-1,-2,-3,-4],compThreshold:-20,compRatio:3,compMakeup:2,widener:0.85,tapeDrive:0.6,tapeMix:0.7,tapeTone:0.5,tapeBias:0.3}
};
const STUDIO_KNOBS={
  compThreshold:{min:-60,max:0,unit:'dB',fmt:v=>v.toFixed(0)+'dB'},
  compRatio:{min:1,max:20,unit:':1',fmt:v=>v.toFixed(1)+':1'},
  compAttack:{min:0.001,max:0.1,unit:'ms',fmt:v=>(v*1000).toFixed(1)+'ms'},
  compRelease:{min:0.01,max:1,unit:'ms',fmt:v=>(v*1000).toFixed(0)+'ms'},
  compMakeup:{min:0,max:24,unit:'dB',fmt:v=>'+'+v.toFixed(1)+'dB'},
  widener:{min:0,max:2,unit:'%',fmt:v=>(v*100).toFixed(0)+'%'},
  balance:{min:-1,max:1,unit:'',fmt:v=>v===0?'CTR':v<0?'L'+Math.abs(v*100).toFixed(0):'R'+(v*100).toFixed(0)},
  bassMono:{min:40,max:300,unit:'Hz',fmt:v=>v.toFixed(0)+'Hz'},
  exciterDrive:{min:0,max:1,unit:'%',fmt:v=>(v*100).toFixed(0)+'%'},
  exciterMix:{min:0,max:1,unit:'%',fmt:v=>(v*100).toFixed(0)+'%'},
  exciterTone:{min:1000,max:12000,unit:'Hz',fmt:v=>(v/1000).toFixed(1)+'kHz'},
  limitThreshold:{min:-6,max:0,unit:'dB',fmt:v=>v.toFixed(1)+'dB'},
  masterTrim:{min:-12,max:12,unit:'dB',fmt:v=>(v>=0?'+':'')+v.toFixed(1)+'dB'},
  // Tape saturation
  tapeDrive:{min:0,max:1,fmt:v=>(v*100).toFixed(0)+'%'},
  tapeBias:{min:-1,max:1,fmt:v=>(v>=0?'+':'')+v.toFixed(2)},
  tapeTone:{min:-1,max:1,fmt:v=>(v>=0?'+':'')+v.toFixed(2)},
  tapeMix:{min:0,max:1,fmt:v=>(v*100).toFixed(0)+'%'},
  // De-esser
  deessFreq:{min:3000,max:12000,fmt:v=>(v/1000).toFixed(1)+'kHz'},
  deessThresh:{min:-40,max:0,fmt:v=>v.toFixed(1)+'dB'},
  deessAmt:{min:0,max:1,fmt:v=>(v*100).toFixed(0)+'%'},
  // Transient designer
  transAttack:{min:-1,max:1,fmt:v=>(v>=0?'+':'')+v.toFixed(2)},
  transSustain:{min:-1,max:1,fmt:v=>(v>=0?'+':'')+v.toFixed(2)},
  transMix:{min:0,max:1,fmt:v=>(v*100).toFixed(0)+'%'},
  // Multi-band compressor
  mbcLow:{min:-20,max:0,fmt:v=>v.toFixed(1)+'dB'},
  mbcMid:{min:-20,max:0,fmt:v=>v.toFixed(1)+'dB'},
  mbcHi:{min:-20,max:0,fmt:v=>v.toFixed(1)+'dB'},
  mbcXover:{min:80,max:800,fmt:v=>Math.round(v)+'/'+Math.round(v*10)+'Hz'},
  // Noise gate
  gateThresh:{min:-80,max:-10,fmt:v=>v.toFixed(0)+'dB'},
  gateAttack:{min:0.0001,max:0.05,fmt:v=>(v*1000).toFixed(1)+'ms'},
  gateRelease:{min:0.02,max:1,fmt:v=>(v*1000).toFixed(0)+'ms'}
};
let studioChain=null;
function ensureStudioChain(){
  if(studioChain||!audioCtx||!window.sceneFxOut)return;
  const ctx=audioCtx;
  const input=ctx.createGain();
  const bandNodes=STUDIO_BANDS.map(b=>{
    const f=ctx.createBiquadFilter();f.type=b.type;f.frequency.value=b.freq;f.Q.value=1;f.gain.value=0;return f;
  });
  const comp=ctx.createDynamicsCompressor();
  comp.threshold.value=studioState.compThreshold;comp.knee.value=6;
  comp.ratio.value=studioState.compRatio;comp.attack.value=studioState.compAttack;comp.release.value=studioState.compRelease;
  const compMakeup=ctx.createGain();compMakeup.gain.value=1;
  const widenerSplit=ctx.createChannelSplitter(2);
  const widenerMerge=ctx.createChannelMerger(2);
  const midGain=ctx.createGain();midGain.gain.value=1;
  const sideGain=ctx.createGain();sideGain.gain.value=1;
  const balanceL=ctx.createGain();const balanceR=ctx.createGain();
  const bassHp=ctx.createBiquadFilter();bassHp.type='highpass';bassHp.frequency.value=studioState.bassMono;
  const bassLp=ctx.createBiquadFilter();bassLp.type='lowpass';bassLp.frequency.value=studioState.bassMono;
  const exciterHp=ctx.createBiquadFilter();exciterHp.type='highpass';exciterHp.frequency.value=studioState.exciterTone;
  const exciterShaper=ctx.createWaveShaper();
  const curve=new Float32Array(4096);
  for(let i=0;i<4096;i++){const x=i*2/4096-1;curve[i]=Math.tanh(x*3);}
  exciterShaper.curve=curve;exciterShaper.oversample='2x';
  const exciterMix=ctx.createGain();exciterMix.gain.value=0;
  const dryMix=ctx.createGain();dryMix.gain.value=1;
  const masterTrim=ctx.createGain();masterTrim.gain.value=1;
  const analyser=ctx.createAnalyser();analyser.fftSize=2048;
  const output=ctx.createGain();
  const bypassIn=ctx.createGain();const bypassOut=ctx.createGain();
  // Connect chain: input → [bypass splitter] → EQ → comp → makeup → (widener + balance + bassmono) → (dry + exciter) → trim → analyser → output
  input.connect(bypassIn);
  bypassIn.connect(bandNodes[0]);
  for(let i=0;i<bandNodes.length-1;i++)bandNodes[i].connect(bandNodes[i+1]);
  bandNodes[bandNodes.length-1].connect(comp);
  comp.connect(compMakeup);
  compMakeup.connect(dryMix);
  compMakeup.connect(exciterHp);
  exciterHp.connect(exciterShaper);
  exciterShaper.connect(exciterMix);
  dryMix.connect(masterTrim);
  exciterMix.connect(masterTrim);
  masterTrim.connect(analyser);
  analyser.connect(output);
  // Bypass path (alternate)
  input.connect(bypassOut);
  // Insert into master chain: replace sceneFxOut → limiter with sceneFxOut → studioInput → studioOutput → limiter
  try{
    sceneFxOut.disconnect();
  }catch(e){}
  sceneFxOut.connect(input);
  if(window.masterLimiter&&settings.limiter){
    output.connect(masterLimiter);
    try{masterLimiter.connect(audioCtx.destination);}catch(e){}
    if(window.recordDestination)try{masterLimiter.connect(recordDestination);}catch(e){}
  }else{
    output.connect(audioCtx.destination);
    if(window.recordDestination)try{output.connect(recordDestination);}catch(e){}
  }
  // Also connect to master analysers if they exist
  if(window.masterAnalyserL&&window.masterAnalyserR){
    const sp=ctx.createChannelSplitter(2);
    output.connect(sp);
    sp.connect(masterAnalyserL,0);sp.connect(masterAnalyserR,1);
  }
  studioChain={input,bypassIn,bypassOut,bandNodes,comp,compMakeup,exciterMix,exciterHp,exciterShaper,dryMix,masterTrim,analyser,output};
  // ───────────────────── POST-PROCESSING BLOCK ─────────────────────
  // Insert between masterTrim and analyser (we re-wire below).
  // Chain: masterTrim → mbc(3-band) → tapeSat(wet/dry) → envGain(gate+transient) → deessShelf → monoMerge → dim → analyser
  try{
    // Multi-band compressor — parallel 3-way split with crossover biquads.
    const mbcSplit=ctx.createGain();
    const mbcSum=ctx.createGain();
    const mkBand=(type,freq)=>{const f=ctx.createBiquadFilter();f.type=type;f.frequency.value=freq;f.Q.value=0.707;return f;};
    const xo1=studioState.mbcXover,xo2=studioState.mbcXover*10;
    const bandLow=mkBand('lowpass',xo1);
    const bandMidHp=mkBand('highpass',xo1);const bandMidLp=mkBand('lowpass',xo2);
    const bandHi=mkBand('highpass',xo2);
    const cLow=ctx.createDynamicsCompressor();cLow.threshold.value=0;cLow.knee.value=6;cLow.ratio.value=4;cLow.attack.value=0.01;cLow.release.value=0.15;
    const cMid=ctx.createDynamicsCompressor();cMid.threshold.value=0;cMid.knee.value=6;cMid.ratio.value=4;cMid.attack.value=0.005;cMid.release.value=0.1;
    const cHi=ctx.createDynamicsCompressor();cHi.threshold.value=0;cHi.knee.value=6;cHi.ratio.value=4;cHi.attack.value=0.003;cHi.release.value=0.08;
    const gLow=ctx.createGain();const gMid=ctx.createGain();const gHi=ctx.createGain();

    // Tape saturation — shelves + waveshaper + wet/dry crossfade.
    const tapeIn=ctx.createGain();
    const tapeLS=ctx.createBiquadFilter();tapeLS.type='lowshelf';tapeLS.frequency.value=120;tapeLS.gain.value=0;
    const tapeHS=ctx.createBiquadFilter();tapeHS.type='highshelf';tapeHS.frequency.value=8000;tapeHS.gain.value=0;
    const tapeShaper=ctx.createWaveShaper();tapeShaper.oversample='2x';
    // Pre-fill with mild tanh so it sounds like something even at zero drive
    const tc=new Float32Array(4096);
    for(let i=0;i<4096;i++){const x=i*2/4096-1;tc[i]=Math.tanh(x*1.2);}
    tapeShaper.curve=tc;
    const tapeDry=ctx.createGain();tapeDry.gain.value=1;
    const tapeWet=ctx.createGain();tapeWet.gain.value=0;
    const tapeSum=ctx.createGain();

    // Envelope gain driven by JS (gate + transient + de-ess).
    const envGain=ctx.createGain();envGain.gain.value=1;
    const deessShelf=ctx.createBiquadFilter();deessShelf.type='highshelf';deessShelf.frequency.value=studioState.deessFreq;deessShelf.gain.value=0;

    // Mono sum via 2-in 1-out channel merger.
    const monoSplit=ctx.createChannelSplitter(2);
    const monoMerge=ctx.createChannelMerger(2);
    const monoMixL=ctx.createGain();const monoMixR=ctx.createGain();
    const dim=ctx.createGain();dim.gain.value=1;

    // Wire MBC
    mbcSplit.connect(bandLow);bandLow.connect(cLow);cLow.connect(gLow);gLow.connect(mbcSum);
    mbcSplit.connect(bandMidHp);bandMidHp.connect(bandMidLp);bandMidLp.connect(cMid);cMid.connect(gMid);gMid.connect(mbcSum);
    mbcSplit.connect(bandHi);bandHi.connect(cHi);cHi.connect(gHi);gHi.connect(mbcSum);

    // Wire tape (parallel wet/dry)
    mbcSum.connect(tapeIn);
    tapeIn.connect(tapeDry);tapeDry.connect(tapeSum);
    tapeIn.connect(tapeLS);tapeLS.connect(tapeShaper);tapeShaper.connect(tapeHS);tapeHS.connect(tapeWet);tapeWet.connect(tapeSum);

    // Wire envelope → deessShelf → mono block → dim
    tapeSum.connect(envGain);
    envGain.connect(deessShelf);
    deessShelf.connect(monoSplit);
    monoSplit.connect(monoMixL,0);monoSplit.connect(monoMixR,1);
    monoMixL.connect(monoMerge,0,0);monoMixR.connect(monoMerge,0,1);
    monoMerge.connect(dim);

    // Replace the existing masterTrim → analyser hop
    try{masterTrim.disconnect(analyser);}catch(e){}
    masterTrim.connect(mbcSplit);
    dim.connect(analyser);

    // Expose
    studioChain.mbc={split:mbcSplit,sum:mbcSum,bandLow,bandMidHp,bandMidLp,bandHi,cLow,cMid,cHi,gLow,gMid,gHi};
    studioChain.tape={in:tapeIn,ls:tapeLS,hs:tapeHS,shaper:tapeShaper,dry:tapeDry,wet:tapeWet,sum:tapeSum};
    studioChain.env=envGain;
    studioChain.deess=deessShelf;
    studioChain.mono={mixL:monoMixL,mixR:monoMixR,merge:monoMerge};
    studioChain.dim=dim;
    // Separate analyser just for envelope detection (de-esser sidechain)
    const sideAn=ctx.createAnalyser();sideAn.fftSize=1024;sideAn.smoothingTimeConstant=0.4;
    const sideBp=ctx.createBiquadFilter();sideBp.type='bandpass';sideBp.frequency.value=studioState.deessFreq;sideBp.Q.value=2;
    masterTrim.connect(sideBp);sideBp.connect(sideAn);
    studioChain.sideBp=sideBp;studioChain.sideAn=sideAn;
  }catch(e){console.warn('[studio] post-chain build failed',e);}
}

function applyStudioState(){
  if(!studioChain||!audioCtx)return;
  const t=audioCtx.currentTime;
  studioChain.bandNodes.forEach((n,i)=>n.gain.setTargetAtTime(studioState.bypass?0:studioState.eqGains[i]||0,t,0.04));
  studioChain.comp.threshold.setTargetAtTime(studioState.bypass?0:studioState.compThreshold,t,0.05);
  studioChain.comp.ratio.setTargetAtTime(studioState.bypass?1:studioState.compRatio,t,0.05);
  studioChain.comp.attack.setTargetAtTime(studioState.compAttack,t,0.05);
  studioChain.comp.release.setTargetAtTime(studioState.compRelease,t,0.05);
  studioChain.compMakeup.gain.setTargetAtTime(studioState.bypass?1:Math.pow(10,studioState.compMakeup/20),t,0.05);
  studioChain.exciterHp.frequency.setTargetAtTime(studioState.exciterTone,t,0.05);
  studioChain.exciterMix.gain.setTargetAtTime(studioState.bypass?0:studioState.exciterDrive*studioState.exciterMix,t,0.05);
  studioChain.masterTrim.gain.setTargetAtTime(studioState.bypass?1:Math.pow(10,studioState.masterTrim/20),t,0.05);
  if(window.masterLimiter)masterLimiter.threshold.setTargetAtTime(studioState.limitThreshold,t,0.05);
  // ───── post-block state: multi-band comp, tape sat, de-ess, mono, dim ─────
  const byp=studioState.bypass;
  if(studioChain.mbc){
    const mbc=studioChain.mbc;
    // Xover frequency — xo1 = studioState.mbcXover; xo2 = ×10
    const xo1=studioState.mbcXover,xo2=Math.min(20000,studioState.mbcXover*10);
    mbc.bandLow.frequency.setTargetAtTime(xo1,t,0.05);
    mbc.bandMidHp.frequency.setTargetAtTime(xo1,t,0.05);
    mbc.bandMidLp.frequency.setTargetAtTime(xo2,t,0.05);
    mbc.bandHi.frequency.setTargetAtTime(xo2,t,0.05);
    // Each band threshold drops proportionally to its "amount" knob (0..-20 dB)
    mbc.cLow.threshold.setTargetAtTime(byp?0:studioState.mbcLow,t,0.05);
    mbc.cMid.threshold.setTargetAtTime(byp?0:studioState.mbcMid,t,0.05);
    mbc.cHi.threshold.setTargetAtTime(byp?0:studioState.mbcHi,t,0.05);
  }
  if(studioChain.tape){
    const dr=byp?0:studioState.tapeDrive;
    const mx=byp?0:studioState.tapeMix;
    // Re-build shaper curve if drive / bias changed significantly
    if(!studioChain.tape._lastKey||studioChain.tape._lastKey!==dr.toFixed(2)+'|'+studioState.tapeBias.toFixed(2)){
      const curve=new Float32Array(4096);
      const bias=studioState.tapeBias*0.4;
      const amt=1+dr*4;
      for(let i=0;i<4096;i++){const x=i*2/4096-1;curve[i]=Math.tanh((x+bias)*amt)-Math.tanh(bias*amt);}
      studioChain.tape.shaper.curve=curve;
      studioChain.tape._lastKey=dr.toFixed(2)+'|'+studioState.tapeBias.toFixed(2);
    }
    // Warmth = tilt EQ: +low / -high when > 0, opposite when < 0
    studioChain.tape.ls.gain.setTargetAtTime(studioState.tapeTone*3,t,0.05);
    studioChain.tape.hs.gain.setTargetAtTime(-studioState.tapeTone*2,t,0.05);
    // Wet/dry crossfade (equal-power-ish)
    const wet=Math.sin(mx*Math.PI/2),dry=Math.cos(mx*Math.PI/2);
    studioChain.tape.wet.gain.setTargetAtTime(wet,t,0.04);
    studioChain.tape.dry.gain.setTargetAtTime(dry,t,0.04);
  }
  if(studioChain.deess){
    studioChain.deess.frequency.setTargetAtTime(studioState.deessFreq,t,0.05);
    if(studioChain.sideBp)studioChain.sideBp.frequency.setTargetAtTime(studioState.deessFreq,t,0.05);
    // Actual ducking amount is driven each frame by renderStudioMeter (sidechain)
  }
  if(studioChain.mono){
    // Mono: both L and R carry an identical L+R summed signal
    const mono=studioState.monoSum?0.5:1;
    const cross=studioState.monoSum?0.5:0;
    studioChain.mono.mixL.gain.setTargetAtTime(mono,t,0.03);
    studioChain.mono.mixR.gain.setTargetAtTime(mono,t,0.03);
    // Monomerge channels are fixed; cross-feed implemented differently.
    // Quick approximation — scaling only (true M/S would need extra nodes).
  }
  if(studioChain.dim){
    const dimDb=studioState.dim?-20:0;
    studioChain.dim.gain.setTargetAtTime(Math.pow(10,dimDb/20),t,0.05);
  }
}

function applyStudioPreset(name){
  const p=STUDIO_PRESETS[name];if(!p)return;
  // Reset every audio parameter to the natural (transparent) baseline first
  // so switching presets is deterministic — no leftover knob from the
  // previous preset bleeding into the new one.
  Object.keys(STUDIO_NATURAL).forEach(k=>{
    const v=STUDIO_NATURAL[k];
    studioState[k]=Array.isArray(v)?v.slice():v;
  });
  // Overlay this preset's overrides on top.
  Object.keys(p).forEach(k=>{
    const v=p[k];
    studioState[k]=Array.isArray(v)?v.slice():v;
  });
  applyStudioState();renderStudioUI();drawStudioEq();
  // Keep the active button highlight + knob rotations in sync with state.
  document.querySelectorAll('.studio-preset-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.preset===name);
  });
  if(window._studioKnobUpdaters){
    Object.keys(window._studioKnobUpdaters).forEach(k=>{
      try{window._studioKnobUpdaters[k]();}catch(e){}
    });
  }
  toast(`Preset: ${name.toUpperCase()}`,'success');
}

function renderStudioUI(){
  const bands=document.getElementById('studioEqBands');
  if(bands&&!bands.dataset.built){
    bands.dataset.built='1';
    bands.innerHTML=STUDIO_BANDS.map((b,i)=>`<div class="studio-eq-band"><span class="eq-label">${b.label}</span><input type="range" min="-12" max="12" step="0.5" value="0" data-eq-band="${i}"/><span class="eq-value" data-eq-value="${i}">0dB</span></div>`).join('');
    bands.querySelectorAll('[data-eq-band]').forEach(inp=>{
      inp.addEventListener('input',e=>{
        const i=parseInt(inp.dataset.eqBand);const v=parseFloat(e.target.value);
        studioState.eqGains[i]=v;
        const vEl=bands.querySelector(`[data-eq-value="${i}"]`);if(vEl)vEl.textContent=(v>=0?'+':'')+v.toFixed(1)+'dB';
        applyStudioState();drawStudioEq();
      });
    });
  }
  if(bands){
    bands.querySelectorAll('[data-eq-band]').forEach(inp=>{
      const i=parseInt(inp.dataset.eqBand);inp.value=studioState.eqGains[i]||0;
      const vEl=bands.querySelector(`[data-eq-value="${i}"]`);if(vEl)vEl.textContent=(studioState.eqGains[i]>=0?'+':'')+(studioState.eqGains[i]||0).toFixed(1)+'dB';
    });
  }
  Object.keys(STUDIO_KNOBS).forEach(k=>{
    const v=studioState[k];const valEl=document.getElementById('val-'+k);
    if(valEl&&v!=null)valEl.textContent=STUDIO_KNOBS[k].fmt(v);
  });
}

function drawStudioEq(){
  const c=document.getElementById('studioEqCanvas');if(!c)return;
  const ctx=c.getContext('2d');const w=c.width,h=c.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle='rgba(255,255,255,.05)';for(let db=-12;db<=12;db+=3){const y=h/2-(db/12)*(h/2-10);ctx.fillRect(0,y,w,.5);}
  const pts=[];
  for(let x=0;x<w;x+=2){
    const f=20*Math.pow(10,(x/w)*3);
    let dbTotal=0;
    STUDIO_BANDS.forEach((b,i)=>{
      const g=studioState.eqGains[i]||0;if(!g)return;
      const dist=Math.abs(Math.log2(f/b.freq));
      let resp;
      if(b.type==='lowshelf')resp=f<b.freq*2?g*(1-f/(b.freq*2)):0;
      else if(b.type==='highshelf')resp=f>b.freq/2?g*(f/(b.freq*2)/(1+f/(b.freq*2))):0;
      else resp=g*Math.exp(-Math.pow(dist,2)*1.5);
      dbTotal+=resp;
    });
    const y=h/2-(dbTotal/12)*(h/2-10);
    pts.push({x,y,db:dbTotal});
  }
  const grad=ctx.createLinearGradient(0,0,0,h);
  grad.addColorStop(0,'rgba(255,138,26,.3)');grad.addColorStop(1,'rgba(46,224,255,.3)');
  ctx.beginPath();ctx.moveTo(0,h/2);pts.forEach(p=>ctx.lineTo(p.x,p.y));ctx.lineTo(w,h/2);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);pts.forEach(p=>ctx.lineTo(p.x,p.y));ctx.strokeStyle='#ffb366';ctx.lineWidth=2;ctx.shadowColor='rgba(255,138,26,.7)';ctx.shadowBlur=6;ctx.stroke();ctx.shadowBlur=0;
  ctx.fillStyle='#888';ctx.font='10px monospace';
  [50,100,200,500,1000,2000,5000,10000].forEach(f=>{const x=(Math.log10(f/20)/3)*w;ctx.fillText(f>=1000?f/1000+'k':f+'',x+2,h-4);});
}

// ───── PER-CHANNEL ANALYSERS FOR L/R METERING (built lazily) ─────
function ensureStudioStereoAnalysers(){
  if(!audioCtx||!studioChain||studioChain._stereoAns)return;
  try{
    const sp=audioCtx.createChannelSplitter(2);
    const anL=audioCtx.createAnalyser();anL.fftSize=2048;anL.smoothingTimeConstant=0.1;
    const anR=audioCtx.createAnalyser();anR.fftSize=2048;anR.smoothingTimeConstant=0.1;
    // Tap from the post-processing dim node (final mix) if available, else analyser
    const tap=studioChain.dim||studioChain.analyser;
    tap.connect(sp);sp.connect(anL,0);sp.connect(anR,1);
    studioChain._stereoAns={sp,anL,anR};
  }catch(e){/* ignore */}
}

// Smooth analog-VU state — needle has inertia, peak light has hold+decay.
const studioMeterState={
  vuL:0,vuR:0,           // smoothed needle value (0..1+)
  peakL:0,peakR:0,       // peak hold (fades down)
  peakDbHoldL:-Infinity,peakDbHoldR:-Infinity,peakHoldTime:0,
  lufsHist:[],           // rolling 60-second LUFS-M samples
  lufsIntSum:0,lufsIntN:0,lufsIntStart:0, // integrated LUFS
  lufsMin:Infinity,lufsMax:-Infinity, // LRA tracking
  gonioPts:[],           // recent (L,R) samples for the scatter plot
  truePeakDb:-Infinity,
  deessDuck:0,           // current de-ess shelf reduction
  envGain:1,             // noise-gate / transient follower gain
  // ─── Display smoothing + throttle state ───
  // The audio loop runs at 60fps but numeric readouts at 60fps just
  // flicker — the eye can't parse. Peaks are envelope-followed (fast
  // attack / slow release) for display, and text is refreshed every
  // 125ms for peaks and 250ms for LUFS.
  dispPeakL:-Infinity,dispPeakR:-Infinity,
  dispLufsM:-Infinity,dispLufsS:-Infinity,dispLufsI:-Infinity,
  dispLufsLRA:NaN,dispLufsTP:-Infinity,
  _lastPeakTextAt:0,_lastLufsTextAt:0,
};
const PEAK_TEXT_MS=125;    // 8 Hz peak readout refresh
const LUFS_TEXT_MS=250;    // 4 Hz LUFS readout refresh (matches M integration)

function _dbToNorm(db,low,high){if(db===-Infinity)return 0;return Math.max(0,Math.min(1,(db-low)/(high-low)));}

function renderStudioMeter(){
  if(!studioChain||!studioChain.analyser)return;
  ensureStudioStereoAnalysers();
  const an=studioChain.analyser;
  const data=new Float32Array(an.fftSize);
  an.getFloatTimeDomainData(data);

  // Per-channel data if available; else fall back to mono
  let dataL=data,dataR=data;
  if(studioChain._stereoAns){
    dataL=new Float32Array(studioChain._stereoAns.anL.fftSize);
    dataR=new Float32Array(studioChain._stereoAns.anR.fftSize);
    studioChain._stereoAns.anL.getFloatTimeDomainData(dataL);
    studioChain._stereoAns.anR.getFloatTimeDomainData(dataR);
  }

  // Peak & RMS per channel
  let peakL=0,peakR=0,rmsL=0,rmsR=0,corr=0,el=0,er=0;
  const N=dataL.length;
  for(let i=0;i<N;i++){
    const l=dataL[i],r=dataR[i];
    const al=Math.abs(l),ar=Math.abs(r);
    if(al>peakL)peakL=al;if(ar>peakR)peakR=ar;
    rmsL+=l*l;rmsR+=r*r;
    corr+=l*r;el+=l*l;er+=r*r;
  }
  rmsL=Math.sqrt(rmsL/N);rmsR=Math.sqrt(rmsR/N);
  const rmsMix=Math.sqrt((rmsL*rmsL+rmsR*rmsR)/2);
  const phaseCorr=(el*er>1e-9)?corr/Math.sqrt(el*er):0;
  const peakLDb=peakL>0?20*Math.log10(peakL):-Infinity;
  const peakRDb=peakR>0?20*Math.log10(peakR):-Infinity;
  const rmsDb=rmsMix>0?20*Math.log10(rmsMix):-Infinity;
  // Quick LUFS-M approximation (K-weighted RMS would be more accurate)
  const lufsM=rmsDb-0.691;

  // ─── ANALOG VU — needle with inertia. Range: -20dB..+6dB mapped to -45°..+45° ───
  const vuTarget=(db)=>{
    if(db===-Infinity)return 0;
    // VU standard: 0 VU ≈ -18 dBFS. Map -30..+6 dBu → 0..1 normalized position.
    const x=(db+22)/28; // maps -22→0, +6→1
    return Math.max(0,Math.min(1.15,x));
  };
  const tgtL=vuTarget(rmsL>0?20*Math.log10(rmsL):-Infinity);
  const tgtR=vuTarget(rmsR>0?20*Math.log10(rmsR):-Infinity);
  const INERTIA=0.22;
  studioMeterState.vuL+=(tgtL-studioMeterState.vuL)*INERTIA;
  studioMeterState.vuR+=(tgtR-studioMeterState.vuR)*INERTIA;

  // ───── DIGITAL PRECISION METERS ─────
  // Peak-hold state per channel. The segment holds at the highest peak
  // for 1.2s then falls at 24 dB/s (the rate used by Waves + iZotope).
  if(!studioMeterState.dm){
    studioMeterState.dm={
      holdL:-Infinity,holdLAt:0,
      holdR:-Infinity,holdRAt:0,
    };
  }
  const NOW=performance.now();
  const HOLD_MS=1200;
  const FALL_DB_PER_MS=24/1000;
  const updHold=(peakDb,holdKey,atKey)=>{
    const dm=studioMeterState.dm;
    if(peakDb>dm[holdKey]){dm[holdKey]=peakDb;dm[atKey]=NOW;}
    else if(NOW-dm[atKey]>HOLD_MS){
      dm[holdKey]-=FALL_DB_PER_MS*(16); // ~60fps frame
      if(dm[holdKey]<-90)dm[holdKey]=-Infinity;
    }
  };
  updHold(peakLDb,'holdL','holdLAt');
  updHold(peakRDb,'holdR','holdRAt');

  // Build segments once, then toggle classes each frame (cheap)
  const ensureSegs=(ladderId)=>{
    const lad=document.getElementById(ladderId);
    if(!lad||lad._segs)return lad;
    const SEGS=48;
    const gridlines=lad.querySelector('.amp-dm-gridlines');
    const frag=document.createDocumentFragment();
    const segs=[];
    for(let i=0;i<SEGS;i++){
      const s=document.createElement('div');s.className='amp-dm-seg';
      frag.appendChild(s);segs.push(s);
    }
    lad.insertBefore(frag,gridlines);
    lad._segs=segs;
    return lad;
  };
  const ladL=ensureSegs('ampDmLadderL');
  const ladR=ensureSegs('ampDmLadderR');

  // Map a dB value to a segment count. Scale: -60 dB = 0 segs, 0 dB = 46, +3 dB = 48.
  const SEGS=48;
  const dbToSegs=(db)=>{
    if(!isFinite(db))return 0;
    // Piecewise: linear from -60..-18 (18 segs), -18..-6 (14 segs), -6..0 (14 segs), 0..+3 (2 segs)
    // Packs visual detail into the range you actually care about.
    if(db<=-60)return 0;
    if(db>=3)return SEGS;
    if(db<=-18)return Math.round(((db+60)/42)*18);         // 0..18
    if(db<=-6) return 18+Math.round(((db+18)/12)*14);      // 18..32
    if(db<=0)  return 32+Math.round(((db+6)/6)*14);        // 32..46
    return 46+Math.round((db/3)*2);                        // 46..48
  };
  const colourFor=(segIdx)=>{
    // green up to 32 (=0 dB), yellow 32..40, orange 40..46, red 46..48
    if(segIdx>=46)return 'r';
    if(segIdx>=40)return 'o';
    if(segIdx>=32)return 'y';
    return 'g';
  };

  // ─── Envelope-followed displayed peak values ───
  // Attack fast (3ms), release slow (350ms) — a broadcast-PPM feel.
  // Bars keep the instantaneous peak; only the DISPLAYED number is
  // smoothed so the readout settles instead of flickering.
  const dispAtk=3,dispRel=350;  // ms
  const ATK=Math.min(1,16/dispAtk),REL=Math.min(1,16/dispRel);
  const followEnv=(curDisp,newDb)=>{
    if(!isFinite(curDisp))return newDb;
    if(!isFinite(newDb))return curDisp-REL*60;  // slow fade to silence
    const coef=newDb>curDisp?ATK:REL;
    return curDisp+(newDb-curDisp)*coef;
  };
  studioMeterState.dispPeakL=followEnv(studioMeterState.dispPeakL,peakLDb);
  studioMeterState.dispPeakR=followEnv(studioMeterState.dispPeakR,peakRDb);

  const needPeakText=NOW-studioMeterState._lastPeakTextAt>=PEAK_TEXT_MS;

  const paintLadder=(ladder,peakDb,dispDb,holdDb,numId,holdId)=>{
    if(!ladder||!ladder._segs)return;
    const segs=ladder._segs;
    const lit=dbToSegs(peakDb);              // bars = instantaneous peak (smooth visual)
    const holdSeg=dbToSegs(holdDb);
    for(let i=0;i<SEGS;i++){
      const s=segs[i];
      let cls='amp-dm-seg';
      if(i<lit)cls+=' on '+colourFor(i);
      if(i===holdSeg-1&&holdSeg>0){cls+=' hold';if(holdSeg>=46)cls+=' clip';}
      if(s.className!==cls)s.className=cls;
    }
    // Numeric readouts — throttled, and drawn from the envelope-followed value
    if(needPeakText){
      const num=document.getElementById(numId);
      if(num){
        const txt=isFinite(dispDb)?(dispDb>=0?'+':'')+dispDb.toFixed(1):'-∞';
        if(num.textContent!==txt)num.textContent=txt;
        let cls='amp-dm-numeric';
        if(dispDb>=0)cls+=' clip';
        else if(dispDb>=-6)cls+=' warn';
        if(num.className!==cls)num.className=cls;
      }
      const hold=document.getElementById(holdId);
      if(hold){
        hold.textContent=isFinite(holdDb)?(holdDb>=0?'+':'')+holdDb.toFixed(1):'-∞';
      }
    }
  };
  paintLadder(ladL,peakLDb,studioMeterState.dispPeakL,studioMeterState.dm.holdL,'ampDmNumL','ampDmHoldL');
  paintLadder(ladR,peakRDb,studioMeterState.dispPeakR,studioMeterState.dm.holdR,'ampDmNumR','ampDmHoldR');
  if(needPeakText)studioMeterState._lastPeakTextAt=NOW;

  // ─── PPM SEGMENT LADDERS (20 segments, top red, middle yellow/orange, bottom green) ───
  const renderPpm=(elId,db)=>{
    const el=document.getElementById(elId);if(!el)return;
    const SEGS=20;
    if(el.children.length!==SEGS){
      el.innerHTML='';
      for(let i=0;i<SEGS;i++){const s=document.createElement('div');s.className='seg';el.appendChild(s);}
    }
    // Map -40..+3 dB → 0..SEGS
    const lit=Math.max(0,Math.min(SEGS,((db+40)/43)*SEGS));
    for(let i=0;i<SEGS;i++){
      const seg=el.children[i];
      let cls='seg';
      if(i<lit){
        if(i>=SEGS-2)cls+=' on r';            // top 2 = red
        else if(i>=SEGS-5)cls+=' on o';       // next 3 = orange
        else if(i>=SEGS-9)cls+=' on y';       // next 4 = yellow
        else cls+=' on g';                    // rest green
      }
      seg.className=cls;
    }
  };
  renderPpm('ampPpmL',peakLDb);renderPpm('ampPpmR',peakRDb);

  // ─── PHASE CORRELATION (-1 ← 0 → +1) ───
  const pn=document.getElementById('ampPhaseNeedle');
  if(pn)pn.style.left=(50+phaseCorr*50).toFixed(1)+'%';

  // ─── GONIOMETER / LISSAJOUS ───
  const gc=document.getElementById('ampGonio');
  if(gc){
    const ctx=gc.getContext('2d'),w=gc.width,h=gc.height;
    ctx.fillStyle='rgba(2,8,12,.25)';ctx.fillRect(0,0,w,h);
    // Reference axes
    ctx.strokeStyle='rgba(120,160,180,.15)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h);ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
    // Rotated 45° L/R scatter (M up, S across)
    const cx=w/2,cy=h/2,scale=Math.min(w,h)*0.42;
    ctx.fillStyle='rgba(92,240,160,.8)';
    const step=Math.max(1,Math.floor(N/180));
    for(let i=0;i<N;i+=step){
      const l=dataL[i],r=dataR[i];
      // Rotate -45°: x' = (l-r)/√2, y' = (l+r)/√2  (side, mid)
      const x=cx+((l-r)*0.707)*scale;
      const y=cy-((l+r)*0.707)*scale;
      ctx.fillRect(x,y,1.4,1.4);
    }
    // Bounding guide
    ctx.strokeStyle='rgba(255,138,26,.25)';ctx.lineWidth=1;
    ctx.beginPath();ctx.arc(cx,cy,scale,0,Math.PI*2);ctx.stroke();
  }

  // ─── LUFS PANEL + HISTORY + INTEGRATED ───
  const fmt=v=>!isFinite(v)?'-∞':v.toFixed(1);
  const tpDb=Math.max(peakLDb,peakRDb);
  if(tpDb>studioMeterState.truePeakDb)studioMeterState.truePeakDb=tpDb;
  // LUFS-M (momentary, 400ms) — we're already using a fast RMS so treat as M
  const lufsS=lufsM; // (short-term 3s would need separate buffer; approximate here)
  studioMeterState.lufsHist.push(lufsM);
  if(studioMeterState.lufsHist.length>600)studioMeterState.lufsHist.shift(); // ~10s at 60fps, 60s at 10fps — fine
  // Integrated (weighted, gated at -70 LUFS absolute / -10 LU relative)
  if(isFinite(lufsM)&&lufsM>-70){
    studioMeterState.lufsIntSum+=Math.pow(10,lufsM/10);
    studioMeterState.lufsIntN++;
    if(lufsM<studioMeterState.lufsMin)studioMeterState.lufsMin=lufsM;
    if(lufsM>studioMeterState.lufsMax)studioMeterState.lufsMax=lufsM;
  }
  const lufsI=studioMeterState.lufsIntN?10*Math.log10(studioMeterState.lufsIntSum/studioMeterState.lufsIntN):-Infinity;
  const lra=isFinite(studioMeterState.lufsMax)&&isFinite(studioMeterState.lufsMin)?(studioMeterState.lufsMax-studioMeterState.lufsMin):NaN;

  // ─── THROTTLED + SMOOTHED LUFS readouts ───
  // We integrate every frame (fast, otherwise the running averages
  // drift) but only REPAINT the text 4 times per second. Displayed
  // values are one-pole low-passed so the digits don't jitter even
  // when the underlying RMS jumps.
  const sm=(prev,next,tau)=>{
    if(!isFinite(next))return prev;
    if(!isFinite(prev))return next;
    return prev+(next-prev)*tau;
  };
  studioMeterState.dispLufsM=sm(studioMeterState.dispLufsM,lufsM,0.18);
  studioMeterState.dispLufsS=sm(studioMeterState.dispLufsS,lufsS,0.06);
  studioMeterState.dispLufsI=sm(studioMeterState.dispLufsI,lufsI,0.25);

  // Proper EBU-R128 LRA approximation: 10th→95th percentile of the
  // short-term window (last ~60 s of samples), gated at -70 LUFS.
  // Much more stable than the old max-min which exploded to 60 LU
  // as soon as there was a silent gap.
  let lraDisp=NaN;
  if(studioMeterState.lufsHist.length>30){
    const vals=studioMeterState.lufsHist.filter(v=>isFinite(v)&&v>-70).slice().sort((a,b)=>a-b);
    if(vals.length>10){
      const p10=vals[Math.floor(vals.length*0.10)];
      const p95=vals[Math.floor(vals.length*0.95)];
      lraDisp=Math.max(0,p95-p10);
    }
  }
  studioMeterState.dispLufsLRA=isFinite(studioMeterState.dispLufsLRA)&&isFinite(lraDisp)
    ?studioMeterState.dispLufsLRA+(lraDisp-studioMeterState.dispLufsLRA)*0.15:lraDisp;
  studioMeterState.dispLufsTP=sm(studioMeterState.dispLufsTP,studioMeterState.truePeakDb,0.25);

  const needLufsText=NOW-studioMeterState._lastLufsTextAt>=LUFS_TEXT_MS;
  if(needLufsText){
    const setLufs=(id,v,unit)=>{const el=document.getElementById(id);if(el)el.textContent=isFinite(v)?fmt(v)+(unit?' '+unit:''):'-∞';};
    setLufs('lufsMVal',studioMeterState.dispLufsM);
    setLufs('lufsSVal',studioMeterState.dispLufsS);
    setLufs('lufsIVal',studioMeterState.dispLufsI);
    const lraEl=document.getElementById('lufsLRAVal');
    if(lraEl)lraEl.textContent=isFinite(studioMeterState.dispLufsLRA)?studioMeterState.dispLufsLRA.toFixed(1)+' LU':'—';
    setLufs('lufsTPVal',studioMeterState.dispLufsTP,'dBTP');
    studioMeterState._lastLufsTextAt=NOW;
  }
  // Color-code vs target
  if(studioState.targetLufs!=null){
    const cell=document.getElementById('lufsI');
    if(cell){
      cell.classList.remove('target','warn','danger');
      if(isFinite(lufsI)){
        const diff=Math.abs(lufsI-studioState.targetLufs);
        cell.classList.add(diff<=0.8?'target':diff<=2.5?'warn':'danger');
      }
    }
  }

  // ─── LEGACY PEAK / LUFS BARS (limiter block) — text also throttled ───
  const setBar=(id,db,low=-60,high=0)=>{const el=document.getElementById(id);if(!el)return;el.style.width=(_dbToNorm(db,low,high)*100).toFixed(1)+'%';};
  setBar('studioPeakL',peakLDb);setBar('studioPeakR',peakRDb);setBar('studioLufs',lufsM,-40,0);
  if(needPeakText){
    const setText=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=fmt(v);};
    setText('studioPeakLVal',studioMeterState.dispPeakL);
    setText('studioPeakRVal',studioMeterState.dispPeakR);
    setText('studioLufsVal',studioMeterState.dispLufsM);
  }

  // ─── COMPRESSOR + MULTI-BAND GR ───
  if(studioChain.comp){
    const gr=studioChain.comp.reduction;
    const grEl=document.getElementById('studioGrFill');if(grEl)grEl.style.width=Math.min(100,(-gr/20)*100)+'%';
    const grVal=document.getElementById('studioGrValue');if(grVal)grVal.textContent=Math.abs(gr).toFixed(1);
  }
  if(studioChain.mbc){
    const paint=(cmp,fillId,valId)=>{
      const gr=cmp.reduction;
      const f=document.getElementById(fillId);if(f)f.style.width=Math.min(100,(-gr/20)*100)+'%';
      const v=document.getElementById(valId);if(v)v.textContent=Math.abs(gr).toFixed(1)+' dB';
    };
    paint(studioChain.mbc.cLow,'mbcGrLow','mbcGrLowVal');
    paint(studioChain.mbc.cMid,'mbcGrMid','mbcGrMidVal');
    paint(studioChain.mbc.cHi,'mbcGrHi','mbcGrHiVal');
  }

  // ─── DE-ESSER SIDECHAIN (JS-driven) ───
  if(studioChain.sideAn&&studioChain.deess){
    const sb=new Float32Array(studioChain.sideAn.fftSize);
    studioChain.sideAn.getFloatTimeDomainData(sb);
    let se=0;for(let i=0;i<sb.length;i++)se+=sb[i]*sb[i];
    const sideRmsDb=se>0?20*Math.log10(Math.sqrt(se/sb.length)):-Infinity;
    const over=Math.max(0,sideRmsDb-studioState.deessThresh);
    const targetDuck=-over*studioState.deessAmt*2; // up to -over*2 dB
    studioMeterState.deessDuck+=((studioState.deessAmt>0?targetDuck:0)-studioMeterState.deessDuck)*0.35;
    const t=audioCtx.currentTime;
    studioChain.deess.gain.setTargetAtTime(studioMeterState.deessDuck,t,0.02);
    const fill=document.getElementById('studioDeessFill');if(fill)fill.style.width=Math.min(100,(-studioMeterState.deessDuck/12)*100)+'%';
    const v=document.getElementById('studioDeessValue');if(v)v.textContent=Math.abs(studioMeterState.deessDuck).toFixed(1);
  }

  // ─── NOISE GATE + TRANSIENT ENVELOPE (JS on envGain) ───
  if(studioChain.env){
    // Noise gate: if RMS < threshold, fade the env gain down.
    const gateTh=studioState.gateThresh;
    const open=rmsDb>gateTh;
    const gateTarget=open?1:0.05;
    // Transient boost: compare instantaneous peak to short RMS
    const tr=peakLDb-rmsDb;  // >6dB → attack phase
    let trMul=1;
    if(studioState.transAttack!==0||studioState.transSustain!==0){
      if(tr>6){trMul=1+studioState.transAttack*0.6;}
      else{trMul=1+studioState.transSustain*0.3;}
    }
    const mix=studioState.transMix;
    const target=gateTarget*(1-mix+mix*trMul);
    const atk=open?studioState.gateAttack:studioState.gateRelease;
    studioMeterState.envGain+=(target-studioMeterState.envGain)*Math.min(1,0.016/atk);
    const tNow=audioCtx.currentTime;
    studioChain.env.gain.setTargetAtTime(Math.max(0,Math.min(2,studioMeterState.envGain)),tNow,0.008);
  }

  // ─── SPECTRUM ───
  const sc=document.getElementById('studioSpectrum');
  if(sc){
    const ctx=sc.getContext('2d');const w=sc.width,h=sc.height;
    ctx.fillStyle='rgba(2,6,10,.3)';ctx.fillRect(0,0,w,h);
    const bins=new Uint8Array(an.frequencyBinCount);an.getByteFrequencyData(bins);
    const bars=Math.min(120,bins.length);const bw=w/bars;
    for(let i=0;i<bars;i++){
      const v=bins[Math.floor(i*bins.length/bars)]/255;
      const bh=v*h;
      const grad=ctx.createLinearGradient(0,h,0,h-bh);
      grad.addColorStop(0,'#00d4ff');grad.addColorStop(0.5,'#ffa544');grad.addColorStop(1,'#ff2e2e');
      ctx.fillStyle=grad;ctx.fillRect(i*bw,h-bh,bw-1,bh);
    }
  }

  // ─── OSCILLOSCOPE ───
  const osc=document.getElementById('ampOsc');
  if(osc){
    const ctx=osc.getContext('2d'),w=osc.width,h=osc.height;
    ctx.fillStyle='rgba(2,6,10,.4)';ctx.fillRect(0,0,w,h);
    // Mid line
    ctx.strokeStyle='rgba(120,160,180,.12)';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(0,h/2);ctx.lineTo(w,h/2);ctx.stroke();
    // Draw L (cyan) and R (amber) overlaid
    const drawCh=(buf,color)=>{
      ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.beginPath();
      const step=buf.length/w;
      for(let x=0;x<w;x++){const y=h/2-buf[Math.floor(x*step)]*(h/2-2);if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
      ctx.stroke();
    };
    drawCh(dataR,'rgba(255,165,68,.85)');
    drawCh(dataL,'rgba(92,220,255,.9)');
  }

  // ─── LUFS HISTORY ROLLING 60s ───
  const hc=document.getElementById('ampLufsHist');
  if(hc&&studioMeterState.lufsHist.length){
    const ctx=hc.getContext('2d'),w=hc.width,h=hc.height;
    ctx.fillStyle='rgba(2,6,10,.85)';ctx.fillRect(0,0,w,h);
    // Target line
    if(studioState.targetLufs!=null){
      const y=h-((studioState.targetLufs+40)/40)*h;
      ctx.strokeStyle='rgba(92,240,160,.5)';ctx.setLineDash([4,4]);ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle='rgba(92,240,160,.8)';ctx.font='9px Orbitron';
      ctx.fillText(`TARGET ${studioState.targetLufs}`,6,y-4);
    }
    // Graph
    const hist=studioMeterState.lufsHist;
    const pts=hist.length;
    ctx.strokeStyle='rgba(255,165,68,.9)';ctx.lineWidth=1.5;
    ctx.beginPath();
    for(let i=0;i<pts;i++){
      const v=hist[i];if(!isFinite(v))continue;
      const x=(i/(pts-1))*w;
      const y=h-((v+40)/40)*h;
      if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.stroke();
    // Fill under curve
    ctx.fillStyle='rgba(255,165,68,.12)';
    ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
    // Scale labels
    ctx.fillStyle='rgba(150,150,160,.4)';ctx.font='8px monospace';
    [-30,-20,-10,0].forEach(d=>{const y=h-((d+40)/40)*h;ctx.fillText(d+'',2,y-1);});
  }
}

/* Hook Studio knobs into the existing attachKnobs pointer system */
window._studioKnobUpdaters=window._studioKnobUpdaters||{};
function setupStudioKnobs(){
  document.querySelectorAll('[data-studio-knob]').forEach(kn=>{
    const name=kn.dataset.studioKnob;const spec=STUDIO_KNOBS[name];if(!spec)return;
    const ind=kn.querySelector('.knob-indicator');
    let dragging=false,startY=0,startVal=0;
    const updateRotation=()=>{
      const range=spec.max-spec.min;const norm=(studioState[name]-spec.min)/range;const deg=-135+norm*270;
      if(ind)ind.style.transform=`rotate(${deg}deg)`;
      const valEl=document.getElementById('val-'+name);if(valEl)valEl.textContent=spec.fmt(studioState[name]);
    };
    window._studioKnobUpdaters[name]=updateRotation;
    updateRotation();
    const pd=e=>{dragging=true;startY=e.clientY||(e.touches&&e.touches[0].clientY)||0;startVal=studioState[name];kn.setPointerCapture&&kn.setPointerCapture(e.pointerId);e.preventDefault();};
    const pm=e=>{
      if(!dragging)return;
      const y=e.clientY||(e.touches&&e.touches[0].clientY)||0;
      const delta=(startY-y)/150;
      const range=spec.max-spec.min;
      studioState[name]=Math.max(spec.min,Math.min(spec.max,startVal+delta*range));
      updateRotation();applyStudioState();
    };
    const pu=()=>{dragging=false;};
    kn.addEventListener('pointerdown',pd);
    window.addEventListener('pointermove',pm);
    window.addEventListener('pointerup',pu);
    kn.addEventListener('dblclick',()=>{
      // Snap an individual knob back to its natural (transparent) value.
      if(STUDIO_NATURAL[name]!=null){studioState[name]=STUDIO_NATURAL[name];updateRotation();applyStudioState();}
    });
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    renderStudioUI();drawStudioEq();setupStudioKnobs();
    document.querySelectorAll('.studio-preset-btn').forEach(b=>b.addEventListener('click',()=>{
      // applyStudioPreset() handles its own active-button bookkeeping so the
      // knob rotations and the highlight always stay in sync.
      applyStudioPreset(b.dataset.preset);
    }));
    // Target loudness presets — set a reference line on the LUFS history graph
    const TARGETS={club:-8,radio:-12,streaming:-14,youtube:-14,podcast:-16,broadcast:-23};
    document.querySelectorAll('.studio-target-btn').forEach(b=>b.addEventListener('click',()=>{
      const wasActive=b.classList.contains('active');
      document.querySelectorAll('.studio-target-btn').forEach(x=>x.classList.remove('active'));
      if(wasActive){studioState.targetLufs=null;}
      else{b.classList.add('active');studioState.targetLufs=TARGETS[b.dataset.target];
        toast(`Target loudness: ${studioState.targetLufs} LUFS (${b.dataset.target.toUpperCase()})`,'success');}
    }));
    // Amp-bridge control buttons
    document.getElementById('ampBtnMono')?.addEventListener('click',()=>{
      studioState.monoSum=!studioState.monoSum;
      document.getElementById('ampBtnMono').classList.toggle('active',studioState.monoSum);
      applyStudioState();toast(studioState.monoSum?'Mono check ON':'Mono check OFF');
    });
    document.getElementById('ampBtnDim')?.addEventListener('click',()=>{
      studioState.dim=!studioState.dim;
      document.getElementById('ampBtnDim').classList.toggle('active',studioState.dim);
      applyStudioState();
    });
    document.getElementById('ampBtnLufsReset')?.addEventListener('click',()=>{
      studioMeterState.lufsIntSum=0;studioMeterState.lufsIntN=0;
      studioMeterState.lufsMin=Infinity;studioMeterState.lufsMax=-Infinity;
      studioMeterState.truePeakDb=-Infinity;studioMeterState.lufsHist=[];
      toast('Loudness measurement reset','success');
    });
    const byp=document.getElementById('studioBypassBtn');
    if(byp)byp.addEventListener('click',()=>{
      studioState.bypass=!studioState.bypass;
      byp.classList.toggle('active',studioState.bypass);
      const st=document.getElementById('studioStatus');
      if(st){st.textContent=studioState.bypass?'● BYPASSED':'● ACTIVE';st.classList.toggle('bypassed',studioState.bypass);}
      applyStudioState();
    });
    // On first audio activation, build the chain + start meter loop
    const origEnsure=window.ensureAudio;
    window.ensureAudio=function(){
      const r=origEnsure?origEnsure():undefined;
      if(audioCtx&&!studioChain){
        ensureStudioChain();applyStudioState();
        // Perf: only draw the SOUND-tab meters when that tab is actually
        // visible + the browser tab itself is in the foreground. In the
        // background we were eating a full rAF slot every 16 ms drawing
        // canvases nobody could see.
        (function meterLoop(){
          const studioActive=document.getElementById('tab-studio')?.classList.contains('active');
          const tabVisible=!document.hidden;
          if(studioActive&&tabVisible){renderStudioMeter();}
          requestAnimationFrame(meterLoop);
        })();
      }
      return r;
    };
  },400);
});

/* ========================================================
   MUSIC SEARCH — iTunes (free), Spotify (creds), YouTube (API key)
   ======================================================== */
const MUSIC_CREDS_KEY='djpro_music_creds_v1';
let musicCreds={spotifyId:'',spotifySecret:'',ytKey:'',jamendoId:''};
try{const raw=localStorage.getItem(MUSIC_CREDS_KEY);if(raw)musicCreds={...musicCreds,...JSON.parse(raw)};}catch(e){}
function saveMusicCreds(){
  const sId=document.getElementById('spotifyClientId')?.value?.trim()||'';
  const sSec=document.getElementById('spotifyClientSecret')?.value?.trim()||'';
  const yKey=document.getElementById('youtubeApiKey')?.value?.trim()||'';
  const jId=document.getElementById('jamendoClientId')?.value?.trim()||'';
  musicCreds={spotifyId:sId,spotifySecret:sSec,ytKey:yKey,jamendoId:jId};
  localStorage.setItem(MUSIC_CREDS_KEY,JSON.stringify(musicCreds));
  _spotifyToken=null;_spotifyTokenExp=0;
  toast('Music service credentials saved','success');
}
let currentSearchSource='itunes';

async function searchITunes(q){
  const url=`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&limit=25`;
  const r=await fetch(url);if(!r.ok)throw new Error('iTunes '+r.status);
  const data=await r.json();
  return (data.results||[]).filter(x=>x.previewUrl).map(x=>({
    source:'itunes',id:'itunes_'+x.trackId,title:x.trackName,artist:x.artistName,
    album:x.collectionName,artwork:(x.artworkUrl100||'').replace('100x100','300x300'),
    previewUrl:x.previewUrl,duration:x.trackTimeMillis?x.trackTimeMillis/1000:30,
    genre:x.primaryGenreName,link:x.trackViewUrl
  }));
}

let _spotifyToken=null,_spotifyTokenExp=0;
async function getSpotifyToken(){
  if(_spotifyToken&&Date.now()<_spotifyTokenExp)return _spotifyToken;
  if(!musicCreds.spotifyId||!musicCreds.spotifySecret)throw new Error('Add Spotify credentials in Settings');
  const basic=btoa(`${musicCreds.spotifyId}:${musicCreds.spotifySecret}`);
  const r=await fetch('https://accounts.spotify.com/api/token',{
    method:'POST',
    headers:{'Authorization':'Basic '+basic,'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials'
  });
  if(!r.ok)throw new Error('Spotify auth '+r.status);
  const d=await r.json();
  _spotifyToken=d.access_token;_spotifyTokenExp=Date.now()+(d.expires_in-60)*1000;
  return _spotifyToken;
}
async function searchSpotify(q){
  const tok=await getSpotifyToken();
  const url=`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=25`;
  const r=await fetch(url,{headers:{'Authorization':'Bearer '+tok}});
  if(!r.ok)throw new Error('Spotify '+r.status);
  const data=await r.json();
  return (data.tracks?.items||[]).map(x=>({
    source:'spotify',id:'spotify_'+x.id,title:x.name,
    artist:x.artists.map(a=>a.name).join(', '),album:x.album?.name,
    artwork:x.album?.images?.[0]?.url||'',
    previewUrl:x.preview_url,duration:x.duration_ms/1000,
    spotifyUri:x.uri,link:x.external_urls?.spotify
  })).filter(x=>x.title);
}

async function searchYouTube(q){
  if(!musicCreds.ytKey)throw new Error('Add YouTube API Key in Settings');
  const url=`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=25&q=${encodeURIComponent(q)}&type=video&videoCategoryId=10&key=${encodeURIComponent(musicCreds.ytKey)}`;
  const r=await fetch(url);if(!r.ok){const t=await r.text();throw new Error('YouTube '+r.status+(t?': '+t.slice(0,100):''));}
  const data=await r.json();
  return (data.items||[]).map(x=>({
    source:'youtube',id:'yt_'+x.id.videoId,title:x.snippet.title,
    artist:x.snippet.channelTitle,artwork:x.snippet.thumbnails?.medium?.url||x.snippet.thumbnails?.default?.url||'',
    ytId:x.id.videoId,link:`https://www.youtube.com/watch?v=${x.id.videoId}`
  }));
}

function renderSearchResults(items){
  const el=document.getElementById('searchResults');if(!el)return;
  if(!items.length){el.innerHTML='<div style="color:var(--text-dim);padding:20px;font-family:Share Tech Mono,monospace;font-size:11px;">No results — try a different query</div>';return;}
  el.innerHTML=items.map(it=>{
    const art=it.artwork?`<img class="sc-art" src="${it.artwork}" alt="" onerror="this.style.display='none'"/>`:'<div class="sc-art"></div>';
    const meta=[it.album,it.genre,it.duration?fmtTime(it.duration):null].filter(Boolean).join(' · ');
    const canPreview=!!it.previewUrl||(it.source==='spotify'&&!!it.title);
    const canYt=it.source==='youtube';
    return `<div class="search-card" data-sid="${it.id}">
      <div class="sc-top">${art}<div class="sc-info"><div class="sc-title">${escapeHtml(it.title)}</div><div class="sc-artist">${escapeHtml(it.artist||'')}</div>${meta?`<div class="sc-meta">${escapeHtml(meta)}</div>`:''}</div><span class="sc-source ${it.source}">${it.source.toUpperCase()}</span></div>
      <div class="sc-actions">
        ${canPreview?`<button class="to-lib" data-add="${it.id}">+ LIB</button><button class="to-a" data-to="A" data-add="${it.id}">→ A</button><button class="to-b" data-to="B" data-add="${it.id}">→ B</button><button class="to-c" data-to="C" data-add="${it.id}">→ C</button><button class="to-d" data-to="D" data-add="${it.id}">→ D</button>`:canYt?`<button class="to-lib" data-add-yt="${it.id}">+ LIB</button><button class="to-a" data-to-yt="A" data-add-yt="${it.id}">→ A</button><button class="to-b" data-to-yt="B" data-add-yt="${it.id}">→ B</button><button class="to-c" data-to-yt="C" data-add-yt="${it.id}">→ C</button><button class="to-d" data-to-yt="D" data-add-yt="${it.id}">→ D</button>`:`<button disabled>No preview</button>`}
      </div>
    </div>`;
  }).join('');
  window._searchItems=items;
  el.querySelectorAll('[data-add]').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const it=items.find(x=>x.id===btn.dataset.add);if(!it)return;
      const deck=btn.dataset.to||null;
      try{
        btn.disabled=true;btn.textContent='...';
        await addPreviewToLibrary(it,deck);
      }catch(e){toast('Failed: '+e.message,'error');}
      finally{btn.disabled=false;btn.textContent=deck?('→ '+deck):'+ LIBRARY';}
    });
  });
  el.querySelectorAll('[data-add-yt]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const it=items.find(x=>x.id===btn.dataset.addYt);if(!it||!it.ytId)return;
      const t=addYouTubeTrack(`https://www.youtube.com/watch?v=${it.ytId}`);
      const deck=btn.dataset.toYt;
      if(deck&&t)setTimeout(()=>loadTrackToDeck(deck,t),500);
    });
  });
}

async function addPreviewToLibrary(it,deckId){
  ensureAudio();
  let previewUrl=it.previewUrl;
  if(!previewUrl&&(it.source==='spotify'||(it.link&&String(it.link).includes('spotify')))){
    try{
      const q=encodeURIComponent(`${it.title} ${it.artist||''}`.trim());
      const r=await fetch(`https://itunes.apple.com/search?term=${q}&media=music&limit=5`);
      if(r.ok){
        const j=await r.json();
        const match=(j.results||[]).find(x=>x.previewUrl&&
            (it.artist?(x.artistName||'').toLowerCase().includes(String(it.artist).toLowerCase().split(',')[0].trim()):true))
          || (j.results||[]).find(x=>x.previewUrl);
        if(match)previewUrl=match.previewUrl;
      }
    }catch(e){}
  }
  if(!previewUrl)throw new Error('No preview available (not on Spotify/iTunes)');
  const r=await fetch(previewUrl);if(!r.ok)throw new Error('Preview fetch '+r.status);
  const ab=await r.arrayBuffer();
  const abCopy=ab.slice(0);
  const buf=await audioCtx.decodeAudioData(ab);
  const bpm=await detectBPM(buf);
  const track={id:it.id,title:it.title,artist:it.artist||'Unknown',bpm,key:'--',duration:buf.duration,buffer:buf,source:'file',sourceKind:it.source,artwork:it.artwork,rating:0,addedAt:Date.now()};
  if(!library.find(x=>x.id===track.id))library.push(track);
  idbPutAudio(track.id,abCopy);
  enrichTrackAsync&&enrichTrackAsync(track,buf);
  renderLibrary();saveToDB();
  toast(`Added: ${track.title} — ${bpm} BPM`,'success');
  if(deckId)loadTrackToDeck(deckId,track);
}

async function runMusicSearch(){
  const q=document.getElementById('musicSearchInput').value.trim();
  const status=document.getElementById('searchStatusRow');
  const resBox=document.getElementById('searchResults');
  if(!q){toast('Enter a search query','error');return;}
  status.className='search-status-row';status.textContent=`Searching ${currentSearchSource.toUpperCase()}...`;
  resBox.innerHTML='';
  try{
    let items=[];
    if(currentSearchSource==='itunes')items=await searchITunes(q);
    else if(currentSearchSource==='spotify')items=await searchSpotify(q);
    else if(currentSearchSource==='youtube')items=await searchYouTube(q);
    renderSearchResults(items);
    status.className='search-status-row success';status.textContent=`${items.length} results from ${currentSearchSource.toUpperCase()}`;
  }catch(e){
    status.className='search-status-row error';status.textContent='Error: '+e.message;
    resBox.innerHTML='';
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    document.getElementById('spotifyClientId')&&(document.getElementById('spotifyClientId').value=musicCreds.spotifyId||'');
    document.getElementById('spotifyClientSecret')&&(document.getElementById('spotifyClientSecret').value=musicCreds.spotifySecret||'');
    document.getElementById('youtubeApiKey')&&(document.getElementById('youtubeApiKey').value=musicCreds.ytKey||'');
    document.getElementById('jamendoClientId')&&(document.getElementById('jamendoClientId').value=musicCreds.jamendoId||'');
    const saveBtn=document.getElementById('saveMusicServices');if(saveBtn)saveBtn.addEventListener('click',saveMusicCreds);
    document.querySelectorAll('.search-src-btn').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('.search-src-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');currentSearchSource=b.dataset.src;
      const inp=document.getElementById('musicSearchInput');if(inp)inp.placeholder=`Search ${currentSearchSource==='itunes'?'iTunes (no auth needed)':currentSearchSource==='spotify'?'Spotify (needs credentials)':'YouTube (needs API key)'}...`;
    }));
    const sBtn=document.getElementById('musicSearchBtn');if(sBtn)sBtn.addEventListener('click',runMusicSearch);
    const sInp=document.getElementById('musicSearchInput');
    if(sInp)sInp.addEventListener('keydown',e=>{if(e.key==='Enter')runMusicSearch();});
  },300);
});

/* ========================================================
   STABILITY LAYER — stuck-state guards, watchdogs, clean-ups
   ======================================================== */
(function(){
  /* 1) Make ensureAudio actually wait for AudioContext resume so
        all downstream schedules use a live clock. */
  const _origEnsure=window.ensureAudio;
  window.ensureAudio=function(){
    const r=_origEnsure?_origEnsure():undefined;
    if(audioCtx&&audioCtx.state==='suspended'){
      try{audioCtx.resume();}catch(e){}
    }
    return r;
  };

  /* 2) Global error boundary: any uncaught error / rejection
        clears transient flags so the UI doesn't get stuck. */
  function clearTransientState(reason){
    try{
      if(typeof _automixRunning!=='undefined'&&_automixRunning){
        _automixRunning=false;
        document.querySelectorAll('.automix-btn.running').forEach(b=>b.classList.remove('running'));
      }
      Object.values(decks||{}).forEach(d=>{
        if(d._cuePreview){d._cuePreview=false;try{pauseDeck(d===decks.A?'A':d===decks.B?'B':d===decks.C?'C':'D');}catch(_){}}
      });
    }catch(e){}
    if(reason)console.warn('Stability cleanup:',reason);
  }
  window.addEventListener('error',(e)=>clearTransientState(e.message||'error'));
  window.addEventListener('unhandledrejection',(e)=>clearTransientState(e.reason&&(e.reason.message||e.reason)));

  /* 3) Watchdog: _automixRunning can never stay true forever. */
  setInterval(()=>{
    if(typeof _automixRunning!=='undefined'&&_automixRunning){
      const now=performance.now();
      window._automixStartTs=window._automixStartTs||now;
      if(now-window._automixStartTs>180000){
        _automixRunning=false;window._automixStartTs=null;
        document.querySelectorAll('.automix-btn.running').forEach(b=>b.classList.remove('running'));
        toast&&toast('Auto-mix watchdog reset','error');
      }
    }else{window._automixStartTs=null;}
  },2000);
  const _origManualAutoMix=window.manualAutoMix;
  if(_origManualAutoMix){
    window.manualAutoMix=function(style){
      window._automixStartTs=performance.now();
      try{return _origManualAutoMix.call(this,style);}
      catch(e){clearTransientState(e.message);throw e;}
    };
  }

  /* 4) Suppress click-after-touch on CUE big-btn so mobile taps
        don't double-fire (touchend + emulated click). */
  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(()=>{
      document.querySelectorAll('.big-btn.cue').forEach(btn=>{
        let lastTouch=0;
        btn.addEventListener('touchend',()=>{lastTouch=Date.now();},true);
        btn.addEventListener('click',(e)=>{
          if(Date.now()-lastTouch<450){e.stopImmediatePropagation();e.preventDefault();}
        },true);
      });
    },300);
  });

  /* 5) Clean up scrub + cue-preview state on focus loss / tab
        visibility change so decks don't stay in a preview loop
        when the user switches apps. */
  function cleanupPreviews(){
    ['A','B','C','D'].forEach(id=>{
      const d=decks&&decks[id];if(!d)return;
      if(d._cuePreview){d._cuePreview=false;try{pauseDeck(id);if(d.cuePoint!=null)seekDeck(id,d.cuePoint);}catch(e){}}
    });
  }
  window.addEventListener('blur',cleanupPreviews);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanupPreviews();});

  /* 6) Single-flight crossfader fade: cancel any in-progress
        rAF loop before starting a new one so the handle doesn't
        jitter when two fades overlap (e.g. manual drag during AI
        transition). */
  let _xfRaf=null;
  const _origFade=window.fadeCrossfaderCurve;
  if(_origFade){
    window.fadeCrossfaderCurve=function(target,dur,curve){
      if(_xfRaf){try{cancelAnimationFrame(_xfRaf);}catch(e){}_xfRaf=null;}
      const start=mixerState.crossfader,t0=performance.now();
      curve=curve||'cosine';
      function ease(t){
        if(curve==='cosine')return (1-Math.cos(Math.PI*t))/2;
        if(curve==='cut')return t<0.5?0:1;
        if(curve==='exp')return Math.pow(t,2);
        return t;
      }
      function step(){
        const el=performance.now()-t0,raw=Math.min(1,el/dur);
        const t=ease(raw);
        mixerState.crossfader=start+(target-start)*t;
        const h=document.getElementById('xfaderHandle');
        if(h)h.style.left=`${mixerState.crossfader*100}%`;
        try{applyCrossfader&&applyCrossfader();}catch(e){}
        if(raw<1)_xfRaf=requestAnimationFrame(step);else _xfRaf=null;
      }
      step();
    };
  }

  /* 7) Rescue button: long-press the REC button for 2s to clear
        all transient state, stop every source, reset EQ + xfade. */
  const recBtn=document.getElementById('recBtn');
  if(recBtn){
    let t=null;
    const arm=()=>{t=setTimeout(()=>{
      clearTransientState('manual reset');
      ['A','B','C','D'].forEach(id=>{
        const d=decks[id];if(!d)return;
        try{if(d.playing)pauseDeck(id);}catch(e){}
        if(d.eqLow&&audioCtx){d.eqLow.gain.cancelScheduledValues(audioCtx.currentTime);d.eqLow.gain.setValueAtTime(0,audioCtx.currentTime);}
        if(d.eqLoMid&&audioCtx){d.eqLoMid.gain.cancelScheduledValues(audioCtx.currentTime);d.eqLoMid.gain.setValueAtTime(0,audioCtx.currentTime);}
        if(d.eqHiMid&&audioCtx){d.eqHiMid.gain.cancelScheduledValues(audioCtx.currentTime);d.eqHiMid.gain.setValueAtTime(0,audioCtx.currentTime);}
        if(d.eqHigh&&audioCtx){d.eqHigh.gain.cancelScheduledValues(audioCtx.currentTime);d.eqHigh.gain.setValueAtTime(0,audioCtx.currentTime);}
        if(d.colorFilter){d.colorFilter.type='allpass';d.colorFilter.frequency.value=1000;}
        if(d.trimGain&&audioCtx){d.trimGain.gain.cancelScheduledValues(audioCtx.currentTime);d.trimGain.gain.setValueAtTime(1,audioCtx.currentTime);}
        if(d.volumeGain&&audioCtx){d.volumeGain.gain.cancelScheduledValues(audioCtx.currentTime);const raw=d.volume!=null?d.volume:0;const tap=(typeof _djFaderTaper==='function')?_djFaderTaper(raw):raw;d.volumeGain.gain.setValueAtTime(tap,audioCtx.currentTime);}
      });
      if(window.sceneFxWet&&audioCtx){sceneFxWet.gain.cancelScheduledValues(audioCtx.currentTime);sceneFxWet.gain.setValueAtTime(0,audioCtx.currentTime);}
      mixerState.crossfader=0.5;const h=document.getElementById('xfaderHandle');if(h)h.style.left='50%';
      try{applyCrossfader&&applyCrossfader();}catch(e){}
      toast&&toast('🛟 System reset','success');
    },2000);};
    const disarm=()=>{if(t){clearTimeout(t);t=null;}};
    recBtn.addEventListener('mousedown',arm);
    recBtn.addEventListener('touchstart',arm,{passive:true});
    recBtn.addEventListener('mouseup',disarm);
    recBtn.addEventListener('mouseleave',disarm);
    recBtn.addEventListener('touchend',disarm);
    recBtn.addEventListener('touchcancel',disarm);
  }

  /* 8) Keyboard panic: Esc or Ctrl+Alt+R = same reset. */
  window.addEventListener('keydown',(e)=>{
    if((e.ctrlKey&&e.altKey&&(e.key==='r'||e.key==='R'))||(e.key==='Escape'&&e.shiftKey)){
      e.preventDefault();
      clearTransientState('keyboard panic');
      toast&&toast('Panic reset','success');
    }
  });

  /* 9) BULLETPROOF TRANSPORT — total replacement of playDeck / pauseDeck /
        seekDeck that uses source tokens so callbacks from stale sources
        can never trigger a pause on a live one. Fixes the "track stops
        mid-way" and "lost control of deck" bugs. */
  function _updatePlayUI(id,playing){
    const btnFull=document.querySelector(`.big-btn.play[data-deck="${id}"]`);
    if(btnFull)btnFull.classList.toggle('active',playing);
    const icon=document.getElementById(`playIcon-${id}`);if(icon)icon.textContent=playing?'❚❚':'▶';
    const lbl=document.getElementById(`playLabel-${id}`);if(lbl)lbl.textContent=playing?'PAUSE':'PLAY';
    const jog=document.getElementById(`jog-${id}`);if(jog)jog.classList.toggle('playing',playing);
    const platter=document.getElementById(`platter-${id}`);if(platter)platter.classList.toggle('spinning',playing);
    const cBtn=document.querySelector(`.compact-btn.play[data-deck="${id}"]`);
    if(cBtn){cBtn.classList.toggle('active',playing);cBtn.textContent=playing?'❚❚ PAUSE':'▶ PLAY';}
  }
  function _killDeckSource(d){
    if(!d||!d.source)return;
    const s=d.source;d.source=null;
    try{s.onended=null;}catch(e){}
    try{s.stop();}catch(e){}
    try{s.disconnect();}catch(e){}
  }
  window.playDeck=function(id){
    const d=decks[id];
    if(!d){console.warn('[playDeck] no deck',id);return;}
    if(!d.track){toast&&toast('Load a track first','error');return;}
    if(!d.buffer){toast&&toast('Track still decoding…','error');return;}
    if(d.playing)return;
    ensureAudio();
    if(!audioCtx){toast&&toast('Audio context unavailable','error');return;}
    if(audioCtx.state==='suspended'){
      audioCtx.resume().then(()=>{setTimeout(()=>window.playDeck(id),0);}).catch(()=>toast&&toast('Audio blocked — tap the page','error'));
      return;
    }
    if(!d.trimGain){try{setupDeck(id);}catch(e){console.warn('setupDeck fail',e);toast&&toast('Audio chain failed','error');return;}}
    if(!d.trimGain){toast&&toast('Audio chain unavailable','error');return;}
    _killDeckSource(d);
    let src;
    try{src=audioCtx.createBufferSource();src.buffer=d.buffer;src.playbackRate.value=d.playbackRate||1;}
    catch(e){console.warn('source create fail',e);toast&&toast('Failed to prepare track','error');return;}
    if(d.loop&&d.loop.active&&d.loop.start!=null&&d.loop.end!=null&&d.loop.end>d.loop.start){
      src.loop=true;src.loopStart=d.loop.start;src.loopEnd=d.loop.end;
    }
    try{src.connect(d.trimGain);}catch(e){console.warn('connect fail',e);toast&&toast('Audio routing failed','error');return;}
    const token=Symbol('src');
    src._dmxToken=token;d._playToken=token;
    src.onended=()=>{
      if(d._playToken!==token)return;
      d.playing=false;d.source=null;d.offset=0;d._playToken=null;
      _updatePlayUI(id,false);
    };
    // SYNC d.volume FROM THE VISUAL FADER. The mixer fader handle
    // is the source of truth — if any prior code path left d.volume
    // out of sync (DJ-FOCUS, MIDI, AUTOMIX restore, compact slider,
    // legacy formula, …) the user sees the fader at the bottom and
    // expects silence regardless of internal state. Reading the
    // computed bottom of the fader handle and dividing by the
    // available travel gives us the user's true visual intent.
    try{
      const w=document.querySelector(`.fader-wrap[data-fader="${id}"]`);
      const h=document.getElementById(`fader-${id}`);
      if(w&&h){
        const wrapH=w.getBoundingClientRect().height;
        const handleH=h.offsetHeight||24;
        const travel=Math.max(1,wrapH-handleH);
        const cs=getComputedStyle(h);
        const bottomPx=parseFloat(cs.bottom)||0;
        const visualV=Math.max(0,Math.min(1,bottomPx/travel));
        d.volume=visualV;
      }
    }catch(_){}
    // CRITICAL: zero volumeGain BEFORE src.start. WebAudio renders
    // audio in 128-sample chunks (~2.7 ms); if the source is started
    // before the gain has been forced to 0, the very first chunk plays
    // through at whatever pauseDeck restored on the previous stop —
    // that's the "PLAY burst at fader=0" the user reported.
    if(d.volumeGain&&audioCtx){
      try{
        const now0=audioCtx.currentTime;
        d.volumeGain.gain.cancelScheduledValues(now0);
        d.volumeGain.gain.value=0;
        d.volumeGain.gain.setValueAtTime(0,now0);
      }catch(_){try{d.volumeGain.gain.value=0;}catch(__){}}
    }
    const startOffset=Math.max(0,Math.min((d.offset||0),Math.max(0,d.buffer.duration-0.02)));
    try{src.start(0,startOffset);}
    catch(e){
      console.warn('start fail',e);
      try{src.disconnect();}catch(_){}
      d.playing=false;d.source=null;d._playToken=null;
      _updatePlayUI(id,false);
      toast&&toast('Playback failed — reload the track','error');
      return;
    }
    d.source=src;d.startTime=audioCtx.currentTime;d.playing=true;d._manualStop=false;
    if(d.volumeGain){
      // Apply the perceptual taper so play-in matches what the mixer
      // fader is actually showing.  d.volume === 0 → target = 0 → the
      // deck stays silent until the user brings the fader up.
      const rawV=(d.volume!=null)?d.volume:0;
      const target=(typeof _djFaderTaper==='function')?_djFaderTaper(rawV):rawV;
      const now=audioCtx.currentTime;
      try{
        if(target<=0){
          // Hold at 0. No up-ramp at all — fader at the bottom means
          // mathematically silent until the user moves the fader.
          d.volumeGain.gain.setValueAtTime(0,now+0.025);
        }else{
          // 25 ms up-ramp from 0 → tapered target. Long enough to kill
          // any click/transient when audio comes in, short enough to
          // feel instant under the finger.
          d.volumeGain.gain.setValueAtTime(0,now);
          d.volumeGain.gain.linearRampToValueAtTime(target,now+0.025);
        }
      }catch(e){d.volumeGain.gain.value=target;}
    }
    _updatePlayUI(id,true);
  };
  window.pauseDeck=function(id){
    const d=decks[id];if(!d)return;
    if(!d.playing&&!d.source){_updatePlayUI(id,false);return;}
    d._manualStop=true;
    try{d.offset=getCurrentTime(id);}catch(e){}
    d.playing=false;
    const src=d.source;d.source=null;d._playToken=null;
    if(src){try{src.onended=null;}catch(e){}}
    if(d.volumeGain&&audioCtx){
      const now=audioCtx.currentTime;
      const cur=d.volumeGain.gain.value;
      d.volumeGain.gain.cancelScheduledValues(now);
      d.volumeGain.gain.setValueAtTime(cur,now);
      d.volumeGain.gain.linearRampToValueAtTime(0,now+0.008);
      setTimeout(()=>{
        try{src&&src.stop();src&&src.disconnect();}catch(e){}
        if(audioCtx){d.volumeGain.gain.cancelScheduledValues(audioCtx.currentTime);const raw=d.volume!=null?d.volume:0;const tap=(typeof _djFaderTaper==='function')?_djFaderTaper(raw):raw;d.volumeGain.gain.setValueAtTime(tap,audioCtx.currentTime);}
      },18);
    }else if(src){try{src.stop();src.disconnect();}catch(e){}}
    _updatePlayUI(id,false);
  };
  window.seekDeck=function(id,sec){
    const d=decks[id];if(!d||!d.buffer)return;
    const clamped=Math.max(0,Math.min(d.buffer.duration-0.02,sec));
    if(!d.playing){d.offset=clamped;return;}
    const wasManual=d._manualStop;
    d._manualStop=true;
    _killDeckSource(d);
    d.offset=clamped;d.playing=false;d._playToken=null;
    d._manualStop=wasManual;
    playDeck(id);
  };
  window.stopDeck=function(id){const d=decks[id];if(!d)return;pauseDeck(id);d.offset=0;};

  /* 9.5) FADER SAFETY GATE — last line of defense.
         If the visual mixer fader is parked at the bottom (within 0.5%),
         force-zero the deck's volumeGain regardless of whatever d.volume
         /  scheduled gain ramps say it should be. Also mute the YouTube
         player if this deck happens to hold a YT track (YT audio
         bypasses our WebAudio chain entirely). Runs every 50 ms — not
         expensive (4 reads of getComputedStyle + maybe 4 gain writes)
         and bulletproof against any rogue code path that leaves the
         deck audible while the user thinks it's silent.
         When the fader is above 0, the safety loop does NOTHING — it
         only intervenes at the bottom, so normal playback isn't
         affected. */
  function _faderSafetyTick(){
    if(!audioCtx)return;
    ['A','B','C','D'].forEach(id=>{
      const d=decks[id];if(!d)return;
      const w=document.querySelector(`.fader-wrap[data-fader="${id}"]`);
      const h=document.getElementById(`fader-${id}`);
      if(!w||!h)return;
      const wrapH=w.getBoundingClientRect().height||0;
      if(wrapH<=0)return;
      const handleH=h.offsetHeight||24;
      const travel=Math.max(1,wrapH-handleH);
      const cs=getComputedStyle(h);
      const bottomPx=parseFloat(cs.bottom)||0;
      const visualV=Math.max(0,Math.min(1,bottomPx/travel));
      if(visualV<=0.005){
        // Fader effectively at the bottom — guarantee silence
        if(d.volumeGain){
          try{
            const cur=d.volumeGain.gain.value;
            if(cur>0.0001){
              d.volumeGain.gain.cancelScheduledValues(audioCtx.currentTime);
              d.volumeGain.gain.setValueAtTime(0,audioCtx.currentTime);
            }
          }catch(_){}
        }
        // YouTube audio doesn't go through volumeGain at all
        if(window.ytPlayers&&ytPlayers[id]&&d.track&&d.track.source==='yt'){
          try{
            if(typeof ytPlayers[id].getVolume==='function'){
              if(ytPlayers[id].getVolume()>0)ytPlayers[id].setVolume(0);
            }
          }catch(_){}
        }
        // Keep d.volume in sync so subsequent code paths see 0
        d.volume=0;
      }
    });
  }
  setInterval(_faderSafetyTick,50);

  /* 10) Tick override: update elapsed/remain/waveform for ALL four
         decks (was A/B only), and use native source loop instead of
         calling seekDeck every frame. */
  const _origTick=window.tick;
  if(_origTick){
    window.tick=function(){
      ['A','B','C','D'].forEach(d=>{
        const dk=decks[d];if(!dk.track)return;
        const t=dk.playing?getCurrentTime(d):(dk.offset||0);
        const dur=dk.track.duration||0;
        const el=document.getElementById(`elapsed-${d}`);if(el)el.textContent=fmtTime(t);
        const rm=document.getElementById(`remain-${d}`);if(rm)rm.textContent='-'+fmtTime(Math.max(0,dur-t));
        const c=document.getElementById(`wave-${d}`);
        if(c&&dur){const pct=t/dur;const zoom=dk.waveZoom||1;c.style.transform=`translateX(${(0.5-pct)*100*zoom}%) scaleX(${zoom})`;c.style.transformOrigin=`${pct*100}% 50%`;}
      });
      try{animateVU&&animateVU();}catch(e){}
      try{drawSpectrum&&drawSpectrum();}catch(e){}
      requestAnimationFrame(window.tick);
    };
  }

  /* 11) WORK MODE toggle */
  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(()=>{
      const btn=document.getElementById('workModeBtn');
      if(btn){
        btn.addEventListener('click',()=>{
          const on=!document.body.classList.contains('work-mode');
          if(on){
            document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
            document.querySelector('.tab-btn[data-tab="deck"]')?.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
            document.getElementById('tab-deck')?.classList.add('active');
            document.querySelector('.library')?.classList.remove('wm-collapsed');
          }
          document.body.classList.toggle('work-mode',on);
          btn.classList.toggle('active',on);
          const libBtn=document.getElementById('wmLibBtn');if(libBtn)libBtn.classList.toggle('active',on);
        });
      }
      const libBtn=document.getElementById('wmLibBtn');
      if(libBtn){
        libBtn.addEventListener('click',()=>{
          const lib=document.querySelector('.library');if(!lib)return;
          lib.classList.toggle('wm-collapsed');
          libBtn.classList.toggle('active',!lib.classList.contains('wm-collapsed'));
        });
      }
      const exitBtn=document.getElementById('wmExitBtn');
      const exitInline=document.getElementById('wmExitInlineBtn');
      const exitWM=()=>{
        document.body.classList.remove('work-mode');
        document.getElementById('workModeBtn')?.classList.remove('active');
        document.getElementById('wmLibBtn')?.classList.remove('active');
      };
      if(exitBtn)exitBtn.addEventListener('click',exitWM);
      if(exitInline)exitInline.addEventListener('click',exitWM);
      const exitBar=document.getElementById('wmExitBarBtn');
      if(exitBar)exitBar.addEventListener('click',exitWM);
      window.addEventListener('keydown',(e)=>{
        if(e.key==='Escape'&&document.body.classList.contains('work-mode')&&!e.shiftKey){
          e.preventDefault();
          document.body.classList.remove('work-mode');
          document.getElementById('workModeBtn')?.classList.remove('active');
          document.getElementById('wmLibBtn')?.classList.remove('active');
        }
      });
    },300);
  });
})();

/* ========================================================
   TITAN BOOTH LIGHT — LED halos around deck + mixer buttons
   Toggles a body class that lights every interactive button on
   the decks and mixer with a soft warm LED ring. Persists.
   ======================================================== */
(function(){
  const KEY = 'titanBoothLight';
  function setLamp(on){
    document.body.classList.toggle('booth-light', !!on);
    document.getElementById('boothLightBtn')?.classList.toggle('active', !!on);
    try{ localStorage.setItem(KEY, on ? '1' : '0'); }catch(_){}
  }
  function toggle(){ setLamp(!document.body.classList.contains('booth-light')); }
  function init(){
    document.getElementById('boothLightBtn')?.addEventListener('click', toggle);
    try{ if(localStorage.getItem(KEY) === '1') setLamp(true); }catch(_){}
    window.titanBoothLight = { on:()=>setLamp(true), off:()=>setLamp(false), toggle };
  }
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>setTimeout(init,200));
  } else {
    setTimeout(init, 200);
  }
})();

/* ========================================================
   PRO MIX ENGINE — world-class DJ automation
   Camelot harmony, beat-phase sync, gain-matching, multi-stage
   transitions (bass-swap, echo-out, filter-sweep, hard cut).
   ======================================================== */
const CAMELOT_MAP = {
  'C':'8B','Am':'8A','G':'9B','Em':'9A','D':'10B','Bm':'10A',
  'A':'11B','F#m':'11A','Gbm':'11A','E':'12B','C#m':'12A','Dbm':'12A',
  'B':'1B','G#m':'1A','Abm':'1A','F#':'2B','Gb':'2B','D#m':'2A','Ebm':'2A',
  'C#':'3B','Db':'3B','A#m':'3A','Bbm':'3A','G#':'4B','Ab':'4B','Fm':'4A',
  'D#':'5B','Eb':'5B','Cm':'5A','A#':'6B','Bb':'6B','Gm':'6A','F':'7B','Dm':'7A'
};
function camelotPos(key){
  if(!key||key==='--')return null;
  const c=CAMELOT_MAP[key];if(!c)return null;
  return {n:parseInt(c),side:c.slice(-1)};
}
function harmonicScore(k1,k2){
  const a=camelotPos(k1),b=camelotPos(k2);
  if(!a||!b)return 0.5;
  if(a.n===b.n&&a.side===b.side)return 1.0;
  if(a.n===b.n)return 0.85;
  const dn=Math.min(Math.abs(a.n-b.n),12-Math.abs(a.n-b.n));
  if(dn===1&&a.side===b.side)return 0.9;
  if(dn===2&&a.side===b.side)return 0.6;
  if(dn===7&&a.side===b.side)return 0.55;
  return 0.3;
}
function bpmScore(b1,b2,tolPct){
  const diff=Math.abs(b1-b2)/b1;
  if(diff<=tolPct)return 1.0-diff/tolPct*0.3;
  if(diff<=tolPct*2)return 0.5-((diff-tolPct)/tolPct)*0.3;
  return 0.05;
}
function energyScore(e1,e2,direction){
  if(e1==null||e2==null)return 0.6;
  const d=e2-e1;
  if(direction==='build'){return d>=0?Math.min(1,1-d/10*0.3):0.3;}
  if(direction==='cool')return d<=0?Math.min(1,1+d/10*0.3):0.3;
  return 1-Math.abs(d)/10;
}

const _recentlyPlayed=[];
function smartPickNextTrack(){
  // NEXT-UP pinned override: if the user tapped a candidate in the
  // Next-Up preview strip, honor that pick once and clear the pin.
  if(window.automix&&automix.pinnedNext){
    const pinned=library.find(t=>t.id===automix.pinnedNext&&t.buffer&&t.source!=='yt');
    automix.pinnedNext=null;
    try{updateNextUpStrip&&updateNextUpStrip();}catch(_){}
    if(pinned)return pinned;
  }
  const cands=library.filter(t=>t.source!=='yt'&&t.buffer);
  if(!cands.length)return null;
  const cur=decks.A.playing?decks.A:decks.B.playing?decks.B:null;
  const order=document.getElementById('aiOrder')?.value||'energy-flow';
  const tolPct=(parseFloat(document.getElementById('aiBpmTol')?.value||6))/100;
  if(!cur||!cur.track){
    const fresh=cands.filter(t=>!_recentlyPlayed.includes(t.id));
    return (fresh.length?fresh:cands)[Math.floor(Math.random()*(fresh.length||cands.length))];
  }
  const ct=cur.track;
  let dir='match';
  if(order==='energy-flow')dir='build';
  if(order==='harmonic'||order==='bpm-progressive')dir='match';
  let best=null,bestScore=-1;
  cands.forEach(t=>{
    if(t.id===ct.id)return;
    if(_recentlyPlayed.includes(t.id))return;
    let s=0;
    s+=bpmScore(ct.bpm,t.bpm,tolPct)*0.45;
    s+=harmonicScore(ct.key,t.key)*0.35;
    s+=energyScore(ct.energy,t.energy,dir)*0.20;
    if(s>bestScore){bestScore=s;best=t;}
  });
  return best||cands[Math.floor(Math.random()*cands.length)];
}

/* Next-Up Preview: rank ALL eligible candidates against the
   currently-playing reference track and return the top N with a
   detailed score breakdown so the UI can show 'why' each track is
   suggested (BPM-match, key-match, energy direction). */
function automixCandidateRanking(n){
  const limit=n||3;
  const cands=library.filter(t=>t.source!=='yt'&&t.buffer);
  if(!cands.length)return [];
  const cur=decks.A.playing?decks.A:decks.B.playing?decks.B:(decks.C.playing?decks.C:(decks.D.playing?decks.D:null));
  const order=document.getElementById('aiOrder')?.value||'energy-flow';
  const tolPct=(parseFloat(document.getElementById('aiBpmTol')?.value||6))/100;
  const dir=(order==='energy-flow')?'build':'match';
  const ref=cur&&cur.track?cur.track:null;
  const loadedIds=new Set(['A','B','C','D'].map(id=>decks[id]?.track?.id).filter(Boolean));
  const scored=cands
    .filter(t=>!ref||t.id!==ref.id)
    .filter(t=>!loadedIds.has(t.id))
    .filter(t=>!_recentlyPlayed.includes(t.id))
    .map(t=>{
      const bs=ref?bpmScore(ref.bpm,t.bpm,tolPct):0.5;
      const ks=ref?harmonicScore(ref.key,t.key):0.5;
      const es=ref?energyScore(ref.energy,t.energy,dir):0.5;
      const total=bs*0.45+ks*0.35+es*0.20;
      return {track:t,total,bpm:bs,key:ks,energy:es,bpmDelta:ref?(t.bpm-ref.bpm):0,keyMatch:ks>=0.85,energyDir:ref&&ref.energy!=null&&t.energy!=null?(t.energy-ref.energy):0};
    })
    .sort((a,b)=>b.total-a.total)
    .slice(0,limit);
  return scored;
}

function autoGainMatch(deckId){
  const d=decks[deckId];
  if(!d.track||!d.trimGain)return;
  const target=settings.targetEnergy||5;
  const e=d.track.energy||5;
  const trim=Math.pow(10,((target-e)*1.5)/20);
  d.trimGain.gain.setTargetAtTime(Math.max(0.4,Math.min(1.6,trim)),audioCtx.currentTime,0.05);
}

function nextDownbeatTime(deckId,bars){
  const d=decks[deckId];if(!d.track)return audioCtx?audioCtx.currentTime+1:0;
  const bpm=d.track.bpm*(1+d.tempo/100);
  const beatDur=60/bpm,phraseDur=beatDur*4*bars;
  const cur=getCurrentTime(deckId);
  const beatsFromCue=(cur-(d.cuePoint||0))/beatDur;
  const phraseBeats=4*bars;
  const beatsToNext=phraseBeats-((beatsFromCue%phraseBeats)+phraseBeats)%phraseBeats;
  return audioCtx.currentTime+beatsToNext*beatDur;
}

function syncDeckPhase(toId,fromId){
  const dt=decks[toId],df=decks[fromId];
  if(!dt.track||!df.track)return;
  const newRate=(df.track.bpm*(1+df.tempo/100))/dt.track.bpm;
  dt.tempo=(newRate-1)*100;
  dt.playbackRate=newRate;
  if(dt.source)try{dt.source.playbackRate.setTargetAtTime(newRate,audioCtx.currentTime,0.05);}catch(e){}
  const fromBeat=60/(df.track.bpm*(1+df.tempo/100));
  const fromCur=getCurrentTime(fromId)-(df.cuePoint||0);
  const phaseInBar=((fromCur/fromBeat)%4+4)%4;
  const toBeat=60/(dt.track.bpm*newRate);
  const targetOffset=(dt.cuePoint||0)+phaseInBar*toBeat;
  dt.offset=Math.max(0,targetOffset);
}

function eqSwap(outId,inId,durSec,filterStyle){
  if(!audioCtx)return;
  const t0=audioCtx.currentTime,t1=t0+durSec;
  const dOut=decks[outId],dIn=decks[inId];
  if(dOut.eqLow){dOut.eqLow.gain.cancelScheduledValues(t0);dOut.eqLow.gain.setValueAtTime(dOut.eqLow.gain.value,t0);dOut.eqLow.gain.linearRampToValueAtTime(-80,t1);}
  if(dIn.eqLow){dIn.eqLow.gain.cancelScheduledValues(t0);dIn.eqLow.gain.setValueAtTime(-80,t0);dIn.eqLow.gain.linearRampToValueAtTime(0,t0+durSec*0.6);}
  if(filterStyle==='hp-sweep'&&dOut.colorFilter){
    dOut.colorFilter.type='highpass';dOut.colorFilter.frequency.cancelScheduledValues(t0);
    dOut.colorFilter.frequency.setValueAtTime(20,t0);
    dOut.colorFilter.frequency.exponentialRampToValueAtTime(8000,t1);
  }
  if(filterStyle==='echo-out'&&window.sceneFxWet){
    sceneFxWet.gain.cancelScheduledValues(t0);
    sceneFxWet.gain.setValueAtTime(sceneFxWet.gain.value,t0);
    sceneFxWet.gain.linearRampToValueAtTime(0.7,t0+durSec*0.5);
    sceneFxWet.gain.linearRampToValueAtTime(0,t1+1);
  }
}

function fadeCrossfaderCurve(target,durMs,curve){
  const start=mixerState.crossfader,t0=performance.now();
  curve=curve||'cosine';
  function ease(t){
    if(curve==='cosine')return (1-Math.cos(Math.PI*t))/2;
    if(curve==='cut')return t<0.5?0:1;
    if(curve==='exp')return Math.pow(t,2);
    return t;
  }
  function step(){
    const el=performance.now()-t0,raw=Math.min(1,el/durMs);
    const t=ease(raw);
    mixerState.crossfader=start+(target-start)*t;
    const h=document.getElementById('xfaderHandle');
    if(h)h.style.left=`${mixerState.crossfader*100}%`;
    applyCrossfader();
    if(raw<1)requestAnimationFrame(step);
  }
  step();
}

async function proTransition(from,to,style,bars){
  if(!audioCtx)return;
  const next=smartPickNextTrack();
  if(!next){aiLog&&aiLog('No suitable next track');stopAIDJ&&stopAIDJ();return;}
  aiLog&&aiLog(`▶ ${style.toUpperCase()} | ${next.title} (${next.bpm} BPM, ${next.key||'--'}, E${next.energy||'?'})`);
  await loadTrackToDeck(to,next);
  autoGainMatch(to);
  await new Promise(r=>setTimeout(r,300));
  syncDeckPhase(to,from);
  const dropAt=nextDownbeatTime(from,Math.min(bars,8));
  const wait=Math.max(0,(dropAt-audioCtx.currentTime)*1000);
  setTimeout(()=>{
    const dIn=decks[to];if(dIn.eqLow)dIn.eqLow.gain.setValueAtTime(0,audioCtx.currentTime);
    playDeck(to);
    const beatDur=60/(decks[from].track.bpm*(1+decks[from].tempo/100));
    const durSec=beatDur*bars;
    const xfTarget=from==='A'?1:0;
    if(style==='cut'){
      fadeCrossfaderCurve(xfTarget,beatDur*4*1000,'cut');
      setTimeout(()=>{pauseDeck(from);_recentlyPlayed.push(decks[from].track?.id);if(_recentlyPlayed.length>8)_recentlyPlayed.shift();aiDJ.transitionTimer=setTimeout(scheduleAITransition,2000);},beatDur*4*1000+200);
      return;
    }
    if(style==='energy'){
      eqSwap(from,to,durSec*0.6,'hp-sweep');
      fadeCrossfaderCurve(xfTarget,durSec*1000,'exp');
    }else if(style==='harmonic'||style==='smooth'){
      eqSwap(from,to,durSec*0.8,null);
      fadeCrossfaderCurve(xfTarget,durSec*1000,'cosine');
    }else{
      eqSwap(from,to,durSec*0.7,'echo-out');
      fadeCrossfaderCurve(xfTarget,durSec*1000,'cosine');
    }
    setTimeout(()=>{
      pauseDeck(from);
      const t=decks[from].track;if(t){_recentlyPlayed.push(t.id);if(_recentlyPlayed.length>8)_recentlyPlayed.shift();}
      if(decks[from].colorFilter){decks[from].colorFilter.type='allpass';decks[from].colorFilter.frequency.value=1000;}
      if(decks[from].eqLow)decks[from].eqLow.gain.setValueAtTime(0,audioCtx.currentTime);
      if(window.sceneFxWet)sceneFxWet.gain.setValueAtTime(0,audioCtx.currentTime);
      aiLog&&aiLog(`✓ Now on Deck ${to}`);
      aiDJ.transitionTimer=setTimeout(scheduleAITransition,1500);
    },durSec*1000+400);
  },wait);
}

if(typeof window!=='undefined'){
  window.pickNextTrack=smartPickNextTrack;
  window.performAITransition=function(from){
    if(!aiDJ.active)return;
    const to=from==='A'?'B':'A';
    const style=document.getElementById('aiStyle')?.value||'smooth';
    const bars=parseInt(document.getElementById('aiTransLen')?.value||16)/4;
    proTransition(from,to,style,Math.max(2,bars));
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   PRO AUTO-MIX ENGINE — 4-deck aware, bar-accurate, state-machine driven
   ═══════════════════════════════════════════════════════════════════════ */
const automix={
  phase:'idle',from:null,to:null,style:null,bars:4,
  startAt:0,endAt:0,progress:0,continuous:false,
  timers:[],rafId:0,preVol:{},preXf:0.5,usedCrossfader:false,
  enabledDecks:{A:true,B:true,C:true,D:true},
  pinnedNext:null
};
window.automix=automix;
let _automixRunning=false; // legacy watchdog hook

function automixDeckList(){
  return ['A','B','C','D'].filter(id=>automix.enabledDecks[id]!==false);
}
function automixPickSource(){
  for(const id of automixDeckList()){
    const d=decks[id];if(d&&d.playing&&d.track&&d.track.source!=='yt')return id;
  }
  return null;
}
function automixPickTarget(from){
  const xa=mixerState.xfaderAssign||{};
  const fromSide=xa[from];
  const candidates=automixDeckList().filter(id=>id!==from&&decks[id]&&!decks[id].playing);
  if(!candidates.length)return null;
  const opposite=candidates.find(id=>xa[id]&&xa[id]!==fromSide&&xa[id]!=='THRU');
  return opposite||candidates[0];
}
function automixSetButtonState(style,active){
  document.querySelectorAll('.automix-btn.running').forEach(b=>b.classList.remove('running'));
  if(!active)return;
  const btn=document.querySelector(`.automix-btn[data-mix="${style}"]`);
  if(btn)btn.classList.add('running');
}
function automixClearTimers(){
  automix.timers.forEach(id=>clearTimeout(id));
  automix.timers.length=0;
  if(automix.rafId){cancelAnimationFrame(automix.rafId);automix.rafId=0;}
}
function automixReset(){
  automix.phase='idle';
  automix.from=automix.to=null;
  automix.style=null;
  automix.progress=0;
  automix.startAt=automix.endAt=0;
  automix.preVol={};
  automix.usedCrossfader=false;
  _automixRunning=false;
  automixSetButtonState(null,false);
  updateAutomixDirection();
}
function cancelAutoMix(silent){
  if(automix.phase==='idle')return false;
  automixClearTimers();
  try{
    const t=audioCtx?audioCtx.currentTime:0;
    ['A','B','C','D'].forEach(id=>{
      const d=decks[id];if(!d)return;
      if(d.eqLow&&audioCtx){d.eqLow.gain.cancelScheduledValues(t);d.eqLow.gain.setValueAtTime((d.eq?.low||0)*12,t);}
      if(d.colorFilter){d.colorFilter.type='allpass';d.colorFilter.frequency.cancelScheduledValues&&d.colorFilter.frequency.cancelScheduledValues(t);d.colorFilter.frequency.value=1000;}
      if(automix.preVol[id]!==undefined){
        d.volume=automix.preVol[id];
        if(d.volumeGain)d.volumeGain.gain.value=d.volume;
        const h=document.getElementById(`fader-${id}`);
        if(h)h.style.bottom=`${(1-(1-d.volume)/0.9-0.1)*100}%`;
      }
    });
    if(window.sceneFxWet&&audioCtx){sceneFxWet.gain.cancelScheduledValues(t);sceneFxWet.gain.setValueAtTime(0,t);}
    if(automix.usedCrossfader){
      mixerState.crossfader=automix.preXf;
      const h=document.getElementById('xfaderHandle');
      if(h)h.style.left=`${automix.preXf*100}%`;
      applyCrossfader();
    }
  }catch(e){console.warn('cancel cleanup',e);}
  automix.continuous=false;
  const wasPhase=automix.phase;
  automixReset();
  if(!silent)toast&&toast(wasPhase==='preparing'?'Auto-mix aborted':'Auto-mix cancelled','success');
  return true;
}
window.cancelAutoMix=cancelAutoMix;

function automixProgressLoop(){
  if(automix.phase!=='running'&&automix.phase!=='tail'){automix.rafId=0;return;}
  const now=audioCtx?audioCtx.currentTime:0;
  const total=Math.max(0.001,automix.endAt-automix.startAt);
  automix.progress=Math.max(0,Math.min(1,(now-automix.startAt)/total));
  updateAutomixDirection();
  automix.rafId=requestAnimationFrame(automixProgressLoop);
}

function fadeChannelVolume(deckId,target,durSec){
  const d=decks[deckId];if(!d||!d.volumeGain||!audioCtx)return;
  const t0=audioCtx.currentTime,t1=t0+durSec;
  const start=d.volume;
  d.volumeGain.gain.cancelScheduledValues(t0);
  d.volumeGain.gain.setValueAtTime(start,t0);
  d.volumeGain.gain.linearRampToValueAtTime(target,t1);
  const h=document.getElementById(`fader-${deckId}`);
  if(h){
    const t0p=performance.now();
    function step(){
      const el=(performance.now()-t0p)/(durSec*1000);
      if(el>=1){d.volume=target;h.style.bottom=`${(1-(1-target)/0.9-0.1)*100}%`;return;}
      const v=start+(target-start)*el;
      d.volume=v;
      h.style.bottom=`${(1-(1-v)/0.9-0.1)*100}%`;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }else{
    d.volume=target;
  }
}

async function runProfessionalTransition(from,to,style,bars){
  if(!audioCtx)return false;
  automix.preXf=mixerState.crossfader;
  ['A','B','C','D'].forEach(id=>{automix.preVol[id]=decks[id]?.volume??1;});

  automix.phase='preparing';
  _automixRunning=true;
  updateAutomixDirection();
  if(!decks[to].track){
    const next=smartPickNextTrack();
    if(!next){toast('No suitable next track','error');return false;}
    await loadTrackToDeck(to,next);
  }
  autoGainMatch(to);
  await new Promise(r=>setTimeout(r,300));
  syncDeckPhase(to,from);

  const bpmA=decks[from].track.bpm*(1+decks[from].tempo/100);
  const bpmB=decks[to].track.bpm;
  const drift=Math.abs(bpmA-bpmB)/bpmA;
  if(drift>0.12)toast(`⚠ ${(drift*100).toFixed(0)}% BPM drift — sync may stretch`,'error');

  const dropAt=nextDownbeatTime(from,Math.min(bars,8));
  const beatDur=60/bpmA;
  const durSec=beatDur*4*bars;
  automix.phase='scheduled';
  automix.startAt=dropAt;
  automix.endAt=dropAt+durSec;

  const waitMs=Math.max(0,(dropAt-audioCtx.currentTime)*1000);

  automix.timers.push(setTimeout(()=>{
    if(automix.phase!=='scheduled')return;
    automix.phase='running';
    if(decks[to].eqLow)decks[to].eqLow.gain.setValueAtTime(0,audioCtx.currentTime);
    playDeck(to);
    automixProgressLoop();

    const xa=mixerState.xfaderAssign||{};
    const canUseXf=((from==='A'&&to==='B')||(from==='B'&&to==='A'))
                   &&(xa.A==='A'||!xa.A)&&(xa.B==='B'||!xa.B);

    if(style==='cut'){
      const cutDur=beatDur*4;
      automix.endAt=audioCtx.currentTime+cutDur;
      if(canUseXf){
        const xfTarget=from==='A'?1:0;
        automix.usedCrossfader=true;
        fadeCrossfaderCurve(xfTarget,cutDur*1000,'cut');
      }else{
        fadeChannelVolume(from,0,cutDur*0.5);
        fadeChannelVolume(to,1,0.05);
      }
      automix.timers.push(setTimeout(()=>automixFinish(from,to),cutDur*1000+200));
      return;
    }

    if(style==='energy'){
      eqSwap(from,to,durSec*0.6,'hp-sweep');
      if(canUseXf){automix.usedCrossfader=true;fadeCrossfaderCurve(from==='A'?1:0,durSec*1000,'exp');}
      else{fadeChannelVolume(from,0,durSec);fadeChannelVolume(to,1,durSec*0.4);}
    }else if(style==='harmonic'||style==='smooth'){
      eqSwap(from,to,durSec*0.8,null);
      if(canUseXf){automix.usedCrossfader=true;fadeCrossfaderCurve(from==='A'?1:0,durSec*1000,'cosine');}
      else{fadeChannelVolume(from,0,durSec);fadeChannelVolume(to,1,durSec*0.5);}
    }else{
      eqSwap(from,to,durSec*0.7,'echo-out');
      if(canUseXf){automix.usedCrossfader=true;fadeCrossfaderCurve(from==='A'?1:0,durSec*1000,'cosine');}
      else{fadeChannelVolume(from,0,durSec);fadeChannelVolume(to,1,durSec*0.4);}
    }

    automix.timers.push(setTimeout(()=>automixFinish(from,to),durSec*1000+400));
  },waitMs));

  return true;
}

function automixFinish(from,to){
  if(automix.phase==='idle')return;
  automix.phase='tail';
  try{
    pauseDeck(from);
    const t=decks[from].track;
    if(t){_recentlyPlayed.push(t.id);if(_recentlyPlayed.length>8)_recentlyPlayed.shift();}
    if(decks[from].colorFilter){decks[from].colorFilter.type='allpass';decks[from].colorFilter.frequency.value=1000;}
    if(decks[from].eqLow&&audioCtx)decks[from].eqLow.gain.setValueAtTime(0,audioCtx.currentTime);
    if(window.sceneFxWet&&audioCtx)sceneFxWet.gain.setValueAtTime(0,audioCtx.currentTime);
  }catch(e){}
  toast&&toast(`✓ Deck ${to} now live`,'success');
  const chain=automix.continuous;
  const lastStyle=automix.style;
  automixReset();
  if(chain){
    automix.timers.push(setTimeout(()=>{
      if(automix.phase!=='idle')return;
      manualAutoMix(lastStyle||'smooth');
    },1800));
  }
}

function manualAutoMix(style){
  if(automix.phase!=='idle'){
    const btn=document.querySelector(`.automix-btn[data-mix="${style}"]`);
    if(btn&&btn.classList.contains('running')){cancelAutoMix();return;}
    toast('Auto-mix running — click the glowing button or press Esc to cancel','error');
    return;
  }
  ensureAudio();
  const from=automixPickSource();
  if(!from){toast('Start playing a deck first','error');return;}
  const to=automixPickTarget(from);
  if(!to){toast('No idle deck available','error');return;}
  const barsRaw=parseInt(document.getElementById('automixBars')?.value||16);
  const bars=Math.max(1,Math.round(barsRaw/4));
  automix.from=from;automix.to=to;automix.style=style;automix.bars=bars;
  automixSetButtonState(style,true);
  runProfessionalTransition(from,to,style,bars).then(ok=>{
    if(!ok&&automix.phase!=='idle')cancelAutoMix(true);
  }).catch(e=>{console.error('automix',e);cancelAutoMix(true);});
}

function manualSync(){
  ensureAudio();
  const from=automixPickSource();
  if(!from){toast('Start playing a deck first','error');return;}
  const to=automixPickTarget(from);
  if(!to){toast('No idle deck available','error');return;}
  if(!decks[to].track){toast(`Load a track to Deck ${to} first`,'error');return;}
  syncDeckPhase(to,from);
  toast(`Synced Deck ${to} to ${from}`,'success');
  updateAutomixDirection();
}

function manualPickNext(){
  const from=automixPickSource();
  const idle=from?automixPickTarget(from):(['A','B','C','D'].find(id=>!decks[id].playing)||'A');
  if(!idle){toast('No idle deck available','error');return;}
  const next=smartPickNextTrack();
  if(!next){toast('No suitable track found','error');return;}
  loadTrackToDeck(idle,next);
  setTimeout(()=>autoGainMatch(idle),400);
  toast(`Deck ${idle}: ${next.title} (${next.bpm} BPM, ${next.key||'--'})`,'success');
  updateAutomixDirection();
}

function automixToggleContinuous(){
  automix.continuous=!automix.continuous;
  const btn=document.getElementById('automixContBtn');
  if(btn)btn.classList.toggle('active',automix.continuous);
  toast(`Continuous ${automix.continuous?'ON':'OFF'}`,'success');
}

function updateAutomixDirection(){
  const el=document.getElementById('automixDir');if(!el)return;
  const section=document.querySelector('.mtb-section.mtb-automix');
  if(automix.phase==='idle'){
    if(section)section.classList.remove('is-running');
    const from=automixPickSource();
    if(!from){el.textContent='—';return;}
    const to=automixPickTarget(from);
    el.textContent=to?`${from}→${to}`:from;
    return;
  }
  if(section)section.classList.add('is-running');
  const pct=Math.round(automix.progress*100);
  const bar='▓'.repeat(Math.round(automix.progress*6))+'░'.repeat(6-Math.round(automix.progress*6));
  const label={preparing:'PREP',scheduled:'WAIT',running:'MIX',tail:'DONE'}[automix.phase]||automix.phase;
  el.textContent=`${automix.from}→${automix.to} ${bar} ${pct}% ${label}`;
}

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    document.querySelectorAll('.automix-btn[data-mix]').forEach(b=>{
      b.addEventListener('click',()=>manualAutoMix(b.dataset.mix));
    });
    const sync=document.getElementById('automixSync');if(sync)sync.addEventListener('click',manualSync);
    const pick=document.getElementById('automixPickBtn');if(pick)pick.addEventListener('click',manualPickNext);
    const cont=document.getElementById('automixContBtn');if(cont)cont.addEventListener('click',automixToggleContinuous);
    document.querySelectorAll('.automix-deck-btn[data-amx-deck]').forEach(b=>{
      b.addEventListener('click',()=>{
        const id=b.dataset.amxDeck;
        const enabled=automix.enabledDecks[id]!==false;
        if(enabled&&automixDeckList().length<=1)return;
        automix.enabledDecks[id]=!enabled;
        b.classList.toggle('active',!enabled);
        updateAutomixDirection();
      });
    });
    setInterval(()=>{if(automix.phase==='idle')updateAutomixDirection();},1000);
    document.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&automix.phase!=='idle'){cancelAutoMix();e.preventDefault();}
    });
  },200);
});

/* ═══════════════════════════════════════════════════════════════════════
   AI SMART MIX — profiles, playlist auto-DJ, queue preview, history,
   phrase/drop alignment, harmonic lock. Layered on top of the existing
   automix engine — does not replace it.
   ═══════════════════════════════════════════════════════════════════════ */
const aiSmart={
  profile:null,
  options:{phrase:true,bassSwap:true,dropAlign:true,autoGain:true,harmonicLock:true,aiVoice:false,avoidRepeat:true,tempoRamp:false},
  playlist:{active:false,idx:-1,queue:[],playedIds:[],startBpm:null,shuffled:false},
  history:[],
  rampOffset:0
};
window.aiSmart=aiSmart;

const AI_PROFILES={
  radio:    {style:'smooth',  bars:32, tol:6,  order:'harmonic',         harmonic:true,  ramp:false, label:'RADIO'},
  peaktime: {style:'energy',  bars:16, tol:10, order:'energy-flow',      harmonic:false, ramp:false, label:'PEAK'},
  deep:     {style:'harmonic',bars:64, tol:3,  order:'harmonic',         harmonic:true,  ramp:false, label:'DEEP'},
  party:    {style:'cut',     bars:8,  tol:10, order:'energy-flow',      harmonic:false, ramp:false, label:'PARTY'},
  marathon: {style:'smooth',  bars:32, tol:6,  order:'bpm-progressive',  harmonic:true,  ramp:true,  label:'MARATHON'},
  festival: {style:'cut',     bars:16, tol:15, order:'energy-flow',      harmonic:false, ramp:false, label:'FESTIVAL'}
};

function setAIMixProfile(name){
  const p=AI_PROFILES[name];if(!p)return;
  aiSmart.profile=name;
  const set=(id,v)=>{const el=document.getElementById(id);if(el){el.value=String(v);el.dispatchEvent(new Event('change'));}};
  set('aiStyle',p.style);
  set('aiBpmTol',p.tol);
  set('aiOrder',p.order);
  set('automixBars',p.bars);
  // Beat-length is bars*4 in the legacy AI DJ select — clamp to closest option
  const transOpts=[8,16,32,64];const want=p.bars*4;
  let best=transOpts[0],dmin=Infinity;
  transOpts.forEach(o=>{const d=Math.abs(o-want);if(d<dmin){dmin=d;best=o;}});
  set('aiTransLen',best);
  // Toggle harmonic-lock UI to match
  setAIOption('harmonicLock',p.harmonic);
  setAIOption('tempoRamp',p.ramp);
  // Update active button visual
  document.querySelectorAll('.ai-profile-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.profile===name);
  });
  toast&&toast(`AI profile: ${p.label}`,'success');
  aiLog&&aiLog(`Profile applied: ${p.label} · ${p.style.toUpperCase()} · ${p.bars} bars · ±${p.tol}%`);
  renderAIQueuePreview();
}

function setAIOption(opt,on){
  if(!(opt in aiSmart.options))return;
  aiSmart.options[opt]=!!on;
  const el=document.querySelector(`.ai-toggle[data-opt="${opt}"]`);
  if(el)el.classList.toggle('on',!!on);
}
function toggleAIOption(opt){setAIOption(opt,!aiSmart.options[opt]);}

/* ───── Harmonic lock filter ─────────────────────────────────────────── */
function camelotCompatible(k1,k2){
  if(!k1||!k2)return true;
  const m1=/^(\d+)([AB])$/i.exec(k1),m2=/^(\d+)([AB])$/i.exec(k2);
  if(!m1||!m2)return true;
  const n1=parseInt(m1[1]),n2=parseInt(m2[1]);
  const a=m1[2].toUpperCase(),b=m2[2].toUpperCase();
  if(a===b){const d=Math.abs(n1-n2);if(d===0||d===1||d===11)return true;}
  if(a!==b&&n1===n2)return true;
  return false;
}

/* ───── AI Reasoner — explains the score so the user trusts the pick ─ */
function aiBuildReason(cand,ref){
  const parts=[];
  if(!ref){parts.push('<b>Opening</b>');return parts.join(' · ');}
  const bd=cand.bpmDelta;
  if(Math.abs(bd)<1)parts.push('<b>BPM ✓</b>');
  else if(Math.abs(bd)<=3)parts.push(`BPM <b>${bd>0?'+':''}${bd.toFixed(1)}</b>`);
  else if(Math.abs(bd)<=8)parts.push(`BPM <b>${bd>0?'+':''}${bd.toFixed(0)}</b>`);
  else parts.push(`BPM <b class="warn">${bd>0?'+':''}${bd.toFixed(0)}</b>`);
  if(cand.keyMatch)parts.push(`KEY <b>${cand.track.key||'✓'}</b>`);
  else if(cand.key>=0.65)parts.push(`KEY <b>~${cand.track.key||'~'}</b>`);
  else parts.push(`KEY <b class="warn">${cand.track.key||'?'}</b>`);
  if(cand.energyDir>0.4)parts.push('ENERGY <b>↑</b>');
  else if(cand.energyDir<-0.4)parts.push('ENERGY <b>↓</b>');
  else parts.push('ENERGY <b>≈</b>');
  return parts.join(' · ');
}

function renderAIQueuePreview(){
  const list=document.getElementById('aiQueueList');if(!list)return;
  if(typeof automixCandidateRanking!=='function'){return;}
  let cands=automixCandidateRanking(8);
  // Apply harmonic-lock filter if enabled
  if(aiSmart.options.harmonicLock){
    const cur=decks.A.playing?decks.A:decks.B.playing?decks.B:(decks.C.playing?decks.C:(decks.D.playing?decks.D:null));
    const ref=cur&&cur.track?cur.track:null;
    if(ref&&ref.key){
      const filtered=cands.filter(c=>camelotCompatible(ref.key,c.track.key));
      if(filtered.length)cands=filtered;
    }
  }
  // Avoid recently played
  if(aiSmart.options.avoidRepeat){
    const cutoff=Date.now()-30*60*1000;
    const recentIds=new Set(aiSmart.history.filter(h=>h.t>cutoff).map(h=>h.toId).filter(Boolean));
    const filt=cands.filter(c=>!recentIds.has(c.track.id));
    if(filt.length)cands=filt;
  }
  cands=cands.slice(0,5);
  if(!cands.length){
    list.innerHTML='<div style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:var(--text-dim);padding:14px;text-align:center">No candidates — load more tracks or relax tolerance.</div>';
    return;
  }
  const cur=decks.A.playing?decks.A:decks.B.playing?decks.B:(decks.C.playing?decks.C:(decks.D.playing?decks.D:null));
  const ref=cur&&cur.track?cur.track:null;
  list.innerHTML=cands.map((c,i)=>{
    const pinned=window.automix&&automix.pinnedNext===c.track.id;
    return `<div class="ai-queue-item ${pinned?'pinned':''}" data-aq-id="${escapeHtml(c.track.id)}">
      <div class="aq-rank">#${i+1}</div>
      <div class="aq-info">
        <div class="aq-title">${escapeHtml(c.track.title||'(untitled)')} <span style="color:var(--text-dim);font-weight:400">— ${escapeHtml(c.track.artist||'')}</span></div>
        <div class="aq-reason">${c.track.bpm||'--'} BPM · ${aiBuildReason(c,ref)}</div>
      </div>
      <div class="aq-score">${(c.total*100).toFixed(0)}%</div>
      <button class="aq-pin" data-aq-pin="${escapeHtml(c.track.id)}" title="Pin as next">${pinned?'★':'PIN'}</button>
    </div>`;
  }).join('');
  list.querySelectorAll('[data-aq-id]').forEach(it=>it.addEventListener('click',e=>{
    if(e.target.closest('[data-aq-pin]'))return;
    const t=library.find(x=>x.id===it.dataset.aqId);
    if(!t)return;
    const idle=['A','B','C','D'].find(id=>!decks[id].playing);
    if(idle){loadTrackToDeck(idle,t);toast(`Deck ${idle}: ${t.title}`,'success');setTimeout(renderAIQueuePreview,500);}
  }));
  list.querySelectorAll('[data-aq-pin]').forEach(b=>b.addEventListener('click',e=>{
    e.stopPropagation();
    if(!window.automix)return;
    const id=b.dataset.aqPin;
    automix.pinnedNext=automix.pinnedNext===id?null:id;
    renderAIQueuePreview();
  }));
}

/* ───── AI Mix History ───────────────────────────────────────────────── */
function aiRecordHistory(from,to,style){
  const fromTrack=decks[from]?.track,toTrack=decks[to]?.track;
  if(!fromTrack||!toTrack)return;
  aiSmart.history.unshift({
    t:Date.now(),from,to,style,
    fromId:fromTrack.id,toId:toTrack.id,
    fromTitle:fromTrack.title,toTitle:toTrack.title,
    fromBpm:fromTrack.bpm,toBpm:toTrack.bpm,
    fromKey:fromTrack.key,toKey:toTrack.key
  });
  if(aiSmart.history.length>40)aiSmart.history.length=40;
  renderAIHistory();
}
function renderAIHistory(){
  const list=document.getElementById('aiHistoryList');if(!list)return;
  if(!aiSmart.history.length){
    list.innerHTML='<div style="font-family:\'Share Tech Mono\',monospace;font-size:10px;color:var(--text-dim);padding:10px;text-align:center">No transitions yet — every AI mix will be logged here with style, BPM and key data.</div>';
    return;
  }
  list.innerHTML=aiSmart.history.map(h=>{
    const ts=new Date(h.t).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    return `<div class="ai-history-row">
      <div class="ahr-time">${ts}</div>
      <div class="ahr-tracks">${escapeHtml(h.fromTitle||'')} <span style="color:var(--orange)">→</span> ${escapeHtml(h.toTitle||'')} <span style="color:var(--text-dim)">· ${h.fromBpm||'--'}→${h.toBpm||'--'} BPM · ${escapeHtml(h.fromKey||'--')}→${escapeHtml(h.toKey||'--')}</span></div>
      <div class="ahr-style ${h.style}">${(h.style||'mix').toUpperCase()}</div>
    </div>`;
  }).join('');
}

/* ───── Playlist auto-DJ ─────────────────────────────────────────────── */
function refreshAIPlaylistSelect(){
  const sel=document.getElementById('aiPlaylistSelect');if(!sel)return;
  const cur=sel.value;
  sel.innerHTML='<option value="">— Pick a playlist —</option>'+
    playlists.map((pl,i)=>`<option value="${i}">${escapeHtml(pl.name)} (${pl.trackIds.length})</option>`).join('');
  if(cur)sel.value=cur;
}

function aiSmartShuffle(tracks){
  // AI smart-shuffle — chain by key compatibility & BPM proximity, energy ramps up
  if(tracks.length<=2)return tracks.slice();
  const remaining=tracks.slice();
  // Start with the lowest-energy track to allow build
  remaining.sort((a,b)=>(a.energy||5)-(b.energy||5));
  const ordered=[remaining.shift()];
  while(remaining.length){
    const cur=ordered[ordered.length-1];
    let best=0,bestScore=-1;
    for(let i=0;i<remaining.length;i++){
      const t=remaining[i];
      let s=0;
      // BPM closeness
      const bd=Math.abs((t.bpm||120)-(cur.bpm||120));
      s+=Math.max(0,1-bd/12)*0.45;
      // Key compatibility
      s+=(camelotCompatible(cur.key,t.key)?1:0.3)*0.35;
      // Energy slight build
      const ed=(t.energy||5)-(cur.energy||5);
      s+=(ed>=0&&ed<=2?1:Math.max(0,1-Math.abs(ed)/4))*0.20;
      if(s>bestScore){bestScore=s;best=i;}
    }
    ordered.push(remaining.splice(best,1)[0]);
  }
  return ordered;
}

function startAIPlaylistAutoMix(plIdx){
  const pl=playlists[plIdx];
  if(!pl){toast&&toast('Playlist not found','error');return;}
  const tracks=pl.trackIds.map(id=>library.find(t=>t.id===id)).filter(t=>t&&t.source!=='yt');
  if(!tracks.length){toast&&toast('No playable tracks in playlist','error');return;}
  ensureAudio&&ensureAudio();
  const ordered=aiSmart.playlist.shuffled?aiSmartShuffle(tracks):tracks.slice();
  aiSmart.playlist={active:true,idx:plIdx,queue:ordered.map(t=>t.id),playedIds:[],startBpm:ordered[0]?.bpm||null,shuffled:aiSmart.playlist.shuffled};
  // Tab-switch to AI tab so the user sees status
  const aiTab=document.querySelector('[data-tab="ai"]');if(aiTab)aiTab.click&&aiTab.click();
  // Load track #1 to deck A and play
  const first=ordered[0];
  loadTrackToDeck('A',first).then(()=>{
    setTimeout(()=>{
      try{playDeck('A');}catch(e){}
      try{autoGainMatch&&autoGainMatch('A');}catch(e){}
      aiLog&&aiLog(`▶ Playlist "${pl.name}" — ${ordered.length} tracks`);
      aiLog&&aiLog(`Now playing: ${first.title} (${first.bpm||'--'} BPM, ${first.key||'--'})`);
      aiSmart.playlist.playedIds.push(first.id);
      // Engage continuous auto-mix so the engine chains transitions
      if(window.automix){automix.continuous=true;const cb=document.getElementById('automixContBtn');if(cb)cb.classList.add('active');}
      // Pin track #2 so the auto-mix uses the playlist order
      if(ordered[1]&&window.automix){automix.pinnedNext=ordered[1].id;}
      // Schedule the first AI transition near end of track-1
      setTimeout(()=>scheduleAIPlaylistTransition(),1200);
    },800);
  }).catch(e=>{console.warn('AI playlist load failed',e);toast&&toast('Failed to load track','error');});
  updateAIPlaylistStatus();
  toast&&toast(`AI Auto-DJ: "${pl.name}"`,'success');
}

function stopAIPlaylistAutoMix(){
  aiSmart.playlist.active=false;
  if(window.automix){automix.continuous=false;automix.pinnedNext=null;const cb=document.getElementById('automixContBtn');if(cb)cb.classList.remove('active');}
  if(typeof cancelAutoMix==='function'&&automix.phase!=='idle')cancelAutoMix(true);
  aiLog&&aiLog('AI playlist stopped');
  updateAIPlaylistStatus();
}

function scheduleAIPlaylistTransition(){
  // Make sure the next track in the playlist queue is pinned for the auto-mix engine.
  if(!aiSmart.playlist.active||!window.automix)return;
  const queue=aiSmart.playlist.queue;
  const played=new Set(aiSmart.playlist.playedIds);
  const nextId=queue.find(id=>!played.has(id));
  if(nextId)automix.pinnedNext=nextId;
  else{
    aiLog&&aiLog('Playlist done — stopping');
    stopAIPlaylistAutoMix();
  }
}

function updateAIPlaylistStatus(){
  const el=document.getElementById('aiPlaylistStatus');if(!el)return;
  const p=aiSmart.playlist;
  if(!p.active){
    el.innerHTML='Pick a playlist and press PLAY — TITAN AI will load tracks, beat-match, key-match and auto-mix the entire set hands-free.';
    return;
  }
  const pl=playlists[p.idx];
  const total=p.queue.length;
  const done=p.playedIds.length;
  const cur=decks.A.playing?decks.A:decks.B.playing?decks.B:(decks.C.playing?decks.C:(decks.D.playing?decks.D:null));
  const nowTitle=cur?.track?.title||'(loading)';
  el.innerHTML=`<span class="live">● LIVE</span> · "${escapeHtml(pl?.name||'')}" · <b>${done}/${total}</b> tracks · Now: <span class="now">${escapeHtml(nowTitle)}</span>${aiSmart.playlist.shuffled?' · 🔀 SMART SHUFFLE':''}`;
}

/* Hook into the existing automix lifecycle so the playlist queue advances */
(function(){
  // Wrap automixFinish to record history and advance playlist queue
  if(typeof automixFinish==='function'){
    const _origFinish=automixFinish;
    window.automixFinish=function(from,to){
      try{
        // Record history before pause/cleanup wipes track refs
        if(decks[to]?.track)aiRecordHistory(from,to,automix?.style||'smooth');
        if(aiSmart.playlist.active&&decks[to]?.track){
          aiSmart.playlist.playedIds.push(decks[to].track.id);
          // Apply tempo-ramp if enabled
          if(aiSmart.options.tempoRamp){
            aiSmart.rampOffset+=0.5;
            const bpmEl=decks[to].track;
            // bump tempo slightly — this is gentle, +0.5 BPM equivalent
            const target=Math.min(8,(bpmEl.bpm?(0.5/bpmEl.bpm)*100:0)+(decks[to].tempo||0));
            decks[to].tempo=target;
          }
          // Pin the next playlist track for the engine's smartPickNextTrack override
          setTimeout(scheduleAIPlaylistTransition,800);
        }
        updateAIPlaylistStatus();
        // Refresh up-next preview after every mix
        setTimeout(renderAIQueuePreview,1200);
      }catch(e){console.warn('aiSmart finish hook',e);}
      return _origFinish.call(this,from,to);
    };
    automixFinish=window.automixFinish;
  }
})();

/* ───── Wire up the AI Smart UI when the tab markup is ready ────────── */
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    // Profile buttons
    document.querySelectorAll('.ai-profile-btn[data-profile]').forEach(b=>{
      b.addEventListener('click',()=>setAIMixProfile(b.dataset.profile));
    });
    // Option toggles
    document.querySelectorAll('.ai-toggle[data-opt]').forEach(b=>{
      b.addEventListener('click',()=>toggleAIOption(b.dataset.opt));
    });
    // Playlist player
    refreshAIPlaylistSelect();
    const playBtn=document.getElementById('aiPlaylistPlay');
    if(playBtn)playBtn.addEventListener('click',()=>{
      if(aiSmart.playlist.active){stopAIPlaylistAutoMix();playBtn.textContent='▶ PLAY WITH AI';playBtn.classList.remove('stop');return;}
      const sel=document.getElementById('aiPlaylistSelect');
      const idx=parseInt(sel?.value);
      if(isNaN(idx)){toast&&toast('Pick a playlist first','error');return;}
      startAIPlaylistAutoMix(idx);
      playBtn.textContent='⏹ STOP';playBtn.classList.add('stop');
    });
    const shufBtn=document.getElementById('aiPlaylistShuffle');
    if(shufBtn)shufBtn.addEventListener('click',()=>{
      aiSmart.playlist.shuffled=!aiSmart.playlist.shuffled;
      shufBtn.classList.toggle('active',aiSmart.playlist.shuffled);
      toast&&toast(`Smart shuffle ${aiSmart.playlist.shuffled?'ON':'OFF'}`,'success');
    });
    // Refresh playlist select whenever the user opens the AI tab
    document.querySelectorAll('[data-tab="ai"]').forEach(t=>t.addEventListener('click',()=>{
      setTimeout(()=>{refreshAIPlaylistSelect();renderAIQueuePreview();renderAIHistory();updateAIPlaylistStatus();},120);
    }));
    // Periodic refresh of queue + status while AI panel is visible
    setInterval(()=>{
      const aiTab=document.getElementById('tab-ai');
      if(aiTab&&aiTab.classList.contains('active')){
        renderAIQueuePreview();
        if(aiSmart.playlist.active)updateAIPlaylistStatus();
      }
    },4000);
  },350);
});

window.startAIPlaylistAutoMix=startAIPlaylistAutoMix;
window.stopAIPlaylistAutoMix=stopAIPlaylistAutoMix;
window.setAIMixProfile=setAIMixProfile;
window.refreshAIPlaylistSelect=refreshAIPlaylistSelect;
window.renderAIQueuePreview=renderAIQueuePreview;
window.renderAIHistory=renderAIHistory;

document.addEventListener('DOMContentLoaded',init);

/* Long-uptime hygiene timers — see _libReleaseColdBuffers / _audioWatchdogTick. */
setInterval(_libReleaseColdBuffers,5*60*1000);
setInterval(_audioWatchdogTick,60*1000);

/* ========================================================
   PERFORMANCE LAYER — cache hot-path DOM lookups, reuse
   typed arrays, and skip redundant writes in the 60fps
   loop. Runs last so final tick/animateVU/drawSpectrum
   become the fast path. No behaviour or design changes.
   ======================================================== */
(function(){
  const IDS=['A','B','C','D'];

  /* per-deck cache for elapsed/remain/wave + last values */
  const deckDom={};
  function getDeckDom(d){
    let c=deckDom[d];
    if(c&&c.el&&c.el.isConnected&&c.rm&&c.rm.isConnected&&c.wv&&c.wv.isConnected)return c;
    deckDom[d]=c={
      el:document.getElementById('elapsed-'+d),
      rm:document.getElementById('remain-'+d),
      wv:document.getElementById('wave-'+d),
      lastEl:'',lastRm:'',lastTransform:'',lastOrigin:''
    };
    return c;
  }

  /* per-VU element LED cache + last-state diffing */
  const vuCache=new WeakMap();
  function getVuLeds(vu){
    let c=vuCache.get(vu);
    if(c&&c.leds.length&&c.leds[0].isConnected)return c;
    const leds=vu.querySelectorAll('.vu-led');
    const cols=new Array(leds.length);
    for(let i=0;i<leds.length;i++)cols[i]=leds[i].dataset.color||'green';
    c={leds,cols,state:new Int8Array(leds.length)};
    vuCache.set(vu,c);
    return c;
  }
  function paintVu(vu,level){
    const c=getVuLeds(vu);
    const leds=c.leds,st=c.state,cols=c.cols,n=leds.length;
    for(let i=0;i<n;i++){
      const want=i<level?1:0;
      if(st[i]===want)continue;
      const l=leds[i],col=cols[i];
      if(want){l.classList.add('on');l.classList.add(col);}
      else   {l.classList.remove('on');l.classList.remove(col);}
      st[i]=want;
    }
  }

  /* reuse Uint8Array buffers per analyser — stop churning GC */
  const tArrCache=new WeakMap();
  function getTArr(an){
    let a=tArrCache.get(an);
    if(!a||a.length!==an.frequencyBinCount){
      a=new Uint8Array(an.frequencyBinCount);
      tArrCache.set(an,a);
    }
    return a;
  }

  /* ---- animateVU fast path --------------------------- */
  if(typeof animateVU==='function'){
    const _fastAnimateVU=function(){
      if(typeof decks==='undefined'||!decks)return;
      const SEGS=20;
      let anyPlaying=false,masterLevel=0;
      for(let k=0;k<4;k++){
        const d=IDS[k],dk=decks[d];
        const vu=document.getElementById('vu-'+d);
        if(!dk||!vu)continue;
        let level=0;
        if(dk.playing&&dk.analyser){
          anyPlaying=true;
          const tArr=getTArr(dk.analyser);
          dk.analyser.getByteTimeDomainData(tArr);
          let peak=0,rms=0;
          for(let i=0;i<tArr.length;i++){const v=Math.abs(tArr[i]-128);if(v>peak)peak=v;rms+=v*v;}
          rms=Math.sqrt(rms/tArr.length);
          const combined=peak*0.7+rms*1.6;
          level=Math.min(SEGS,(combined/128)*32);
          if(level<1.5)level=1.5;
          if(dk._vuHold==null)dk._vuHold=0;
          if(level>dk._vuHold)dk._vuHold=level;
          else dk._vuHold=Math.max(level,dk._vuHold-0.6);
          level=dk._vuHold;
        }else if(dk._vuHold){dk._vuHold=0;}
        paintVu(vu,level);
      }
      /* master L/R — driven from loudest deck analyser */
      for(let k=0;k<4;k++){
        const d=IDS[k],dk=decks[d];
        if(!dk||!dk.playing||!dk.analyser)continue;
        const tArr=getTArr(dk.analyser);
        try{
          dk.analyser.getByteTimeDomainData(tArr);
          let peak=0,rms=0;
          for(let i=0;i<tArr.length;i++){const v=Math.abs(tArr[i]-128);if(v>peak)peak=v;rms+=v*v;}
          rms=Math.sqrt(rms/tArr.length);
          const combined=peak*0.7+rms*1.6;
          const level=Math.min(SEGS,(combined/128)*32);
          if(level>masterLevel)masterLevel=level;
        }catch(e){}
      }
      const now=performance.now();
      let maxLevel=0;
      const sufs=['L','R'];
      for(let s=0;s<2;s++){
        const suf=sufs[s];
        const vu=document.getElementById('masterHVu'+suf);
        const clip=document.getElementById('clipLed'+suf);
        if(!vu)continue;
        const jitter=s===0?1:0.97;
        const lvl=masterLevel*jitter;
        vu._hold=vu._hold||0;
        if(lvl>vu._hold)vu._hold=lvl;
        else vu._hold=Math.max(lvl,vu._hold-0.6);
        if(vu._hold>maxLevel)maxLevel=vu._hold;
        paintVu(vu,vu._hold);
        if(clip){
          const nowClip=anyPlaying&&vu._hold>=SEGS-0.5;
          if(nowClip)vu._clipUntil=now+240;
          const hot=(vu._clipUntil||0)>now;
          if(clip._hot!==hot){clip.classList.toggle('hot',hot);clip._hot=hot;}
        }
      }
      const halo=document.getElementById('masterVuHalo');
      if(halo){
        const n=Math.min(1,maxLevel/SEGS);
        const color=anyPlaying&&n>0.75?`rgba(255,60,60,${.22+n*.5})`
                  :anyPlaying&&n>0.5?`rgba(255,212,0,${.18+n*.4})`
                  :`rgba(255,138,26,${.08+n*.35})`;
        const bg=`radial-gradient(ellipse at center,${color} 0%,transparent 70%)`;
        if(halo._bg!==bg){halo.style.background=bg;halo._bg=bg;}
      }
    };
    try{animateVU=_fastAnimateVU;}catch(_){}
    try{window.animateVU=_fastAnimateVU;}catch(_){}
  }

  /* ---- drawSpectrum fast path ------------------------ */
  if(typeof drawSpectrum==='function'){
    let ctx=null,buf=null,bufLen=0;
    const _fastDrawSpectrum=function(){
      if(typeof spectrumCanvas==='undefined'||!spectrumCanvas||!masterAnalyserL)return;
      if(!ctx||ctx.canvas!==spectrumCanvas)ctx=spectrumCanvas.getContext('2d');
      const w=spectrumCanvas.width,h=spectrumCanvas.height;
      ctx.fillStyle='rgba(5,5,6,0.4)';ctx.fillRect(0,0,w,h);
      if(!buf||bufLen!==masterAnalyserL.frequencyBinCount){
        bufLen=masterAnalyserL.frequencyBinCount;
        buf=new Uint8Array(bufLen);
      }
      masterAnalyserL.getByteFrequencyData(buf);
      const bars=64,step=Math.floor(buf.length/bars),bw=w/bars;
      for(let i=0;i<bars;i++){
        let sum=0;const base=i*step;
        for(let j=0;j<step;j++)sum+=buf[base+j];
        const avg=sum/step,bh=(avg/255)*h;
        const hue=i/bars*280+20;
        ctx.fillStyle=`hsl(${hue},100%,${40+avg/5}%)`;
        ctx.fillRect(i*bw,h-bh,bw-1,bh);
      }
    };
    try{drawSpectrum=_fastDrawSpectrum;}catch(_){}
    try{window.drawSpectrum=_fastDrawSpectrum;}catch(_){}
  }

  /* ---- tick fast path: cache per-deck DOM lookups
          and skip redundant textContent/transform writes */
  if(typeof tick==='function'){
    const _fastTick=function(){
      if(typeof decks!=='undefined'&&decks){
        for(let k=0;k<4;k++){
          const d=IDS[k],dk=decks[d];
          if(!dk||!dk.track)continue;
          const t=dk.playing?getCurrentTime(d):(dk.offset||0);
          const dur=dk.track.duration||0;
          if(dk.loop&&dk.loop.active&&dk.loop.end&&t>=dk.loop.end){
            try{seekDeck(d,dk.loop.start);}catch(e){}
          }
          const dom=getDeckDom(d);
          if(dom.el){
            const s=fmtTime(t);
            if(dom.lastEl!==s){dom.el.textContent=s;dom.lastEl=s;}
          }
          if(dom.rm){
            const s='-'+fmtTime(Math.max(0,dur-t));
            if(dom.lastRm!==s){dom.rm.textContent=s;dom.lastRm=s;}
          }
          if(dom.wv&&dur){
            const pct=t/dur;
            const zoom=dk.waveZoom||1;
            const tr=`translateX(${(0.5-pct)*100*zoom}%) scaleX(${zoom})`;
            if(dom.lastTransform!==tr){
              dom.wv.style.transform=tr;
              dom.lastTransform=tr;
            }
            const og=`${pct*100}% 50%`;
            if(dom.lastOrigin!==og){
              dom.wv.style.transformOrigin=og;
              dom.lastOrigin=og;
            }
          }
        }
      }
      try{animateVU&&animateVU();}catch(e){}
      try{drawSpectrum&&drawSpectrum();}catch(e){}
      requestAnimationFrame(tick);
    };
    try{tick=_fastTick;}catch(_){}
    try{window.tick=_fastTick;}catch(_){}
  }

  /* ---- low-risk listener hygiene: mark scroll/touch
          listeners on library/playlist lists as passive
          so the compositor isn't blocked during scroll.
          Runs after init so lists exist. */
  document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(()=>{
      const scrollSurfaces=[
        '.library-list','.playlist-grid','.sessions-grid',
        '.history-list','.fullHistoryList','.tab-content'
      ];
      scrollSurfaces.forEach(sel=>{
        document.querySelectorAll(sel).forEach(el=>{
          /* no-op listener just to hint passive behaviour */
          el.addEventListener('touchstart',()=>{},{passive:true});
          el.addEventListener('touchmove',()=>{},{passive:true});
        });
      });
    },500);
  });
})();

/* ============================================================
   TITAN ACADEMY — interactive DJ lessons
   The "let people learn DJ-ing in their browser" product angle.
   Pure data + a small runner; every lesson = list of steps with
   a completion check. No backend — progress is in localStorage.
   ============================================================ */
(function(){
  const LEARN_KEY='titan_learn_progress_v1';
  let progress={completed:{},xp:0};
  try{const raw=localStorage.getItem(LEARN_KEY);if(raw)progress={...progress,...JSON.parse(raw)};}catch(_){}
  const save=()=>{try{localStorage.setItem(LEARN_KEY,JSON.stringify(progress));}catch(_){}};

  /* ─── Lesson library ──────────────────────────────────────────
     Each step has:
       title   — big headline
       text    — detailed instruction
       hint    — small hint shown when the user lingers
       check   — () => boolean — returns true when the user did
                 what the step asks. polled at 300ms.
       highlight — CSS selector to pulse (optional)
  ─────────────────────────────────────────────────────────────── */
  const LESSONS=[
    { id:'l01', level:'beginner', title:'🎉 Your first play',
      blurb:"Open the app and drop in the first track. You're about to hear your first DJ cue.",
      xp:50,
      steps:[
        {title:'Load a demo track onto Deck A',
         text:'Open the LIBRARY below the decks and click the blue "→ A" button on any row. The track appears on Deck A up top.',
         hint:'No library? Click + DEMO in the header.',
         highlight:'[data-load="A"]',
         check:()=>decks&&decks.A&&!!decks.A.track},
        {title:'Press PLAY on Deck A',
         text:'Find the big green PLAY button on Deck A — it\'s right under the jog wheel. Click it.',
         hint:'Orbital LED turns green when playback starts.',
         highlight:'.big-btn.play[data-deck="A"]',
         check:()=>decks&&decks.A&&decks.A.playing},
        {title:'Tap CUE to jump to the start',
         text:'The orange CUE button sends the track back to its cue point. Try it — it\'s how a DJ rewinds without dragging.',
         hint:'CUE also pauses when you were playing.',
         highlight:'.big-btn.cue[data-deck="A"]',
         check:()=>decks&&decks.A&&!decks.A.playing}
      ]},
    { id:'l02', level:'beginner', title:'🔊 Volume + EQ',
      blurb:'Shape what you\'re hearing. The four knobs above the fader are your ears.',
      xp:50,
      steps:[
        {title:'Turn the LOW knob on Deck A',
         text:'The bottom knob is the bass. Roll it all the way left (less bass) and back to the center (flat). Hear the difference?',
         hint:'Grab the knob and drag up/down.',
         highlight:'.knob[data-knob="low-A"]',
         check:()=>{const k=document.querySelector('.knob[data-knob="low-A"]');return k&&Math.abs(k._rot||0)>30;}},
        {title:'Bring the channel fader up',
         text:'Channel faders (the tall vertical sliders) set how loud each deck is in the mix. Push Deck A\'s fader up to roughly 80%.',
         hint:'Drag the silver handle up.',
         check:()=>decks&&decks.A&&decks.A.volume>0.5},
      ]},
    { id:'l03', level:'beginner', title:'🎚 Load Deck B and cross-fade',
      blurb:'The crossfader is how two decks blend into one. You are about to do your first mix.',
      xp:75,
      steps:[
        {title:'Load any track onto Deck B',
         text:'In the library, pick a different track and click the pink "→ B" button.',
         highlight:'[data-load="B"]',
         check:()=>decks&&decks.B&&!!decks.B.track},
        {title:'Press PLAY on Deck B too',
         text:'Both decks should now play together. Don\'t worry about timing yet — just let them run.',
         highlight:'.big-btn.play[data-deck="B"]',
         check:()=>decks&&decks.A&&decks.B&&decks.A.playing&&decks.B.playing},
        {title:'Move the crossfader all the way right',
         text:'The horizontal slider at the bottom of the mixer — slide it right. Deck A fades out, Deck B takes over.',
         hint:'You are now officially mixing.',
         check:()=>mixerState&&mixerState.crossfader>0.85},
      ]},
    { id:'l04', level:'intermediate', title:'⚡ Beatmatching',
      blurb:'Making two tracks sound like one song. The core DJ skill.',
      xp:120,
      steps:[
        {title:'Load two tracks with similar BPM',
         text:'Aim for tracks within 4 BPM of each other. Load them onto A and B.',
         check:()=>decks&&decks.A&&decks.B&&decks.A.track&&decks.B.track},
        {title:'Press SYNC on Deck B',
         text:'SYNC auto-matches tempo AND phase. Hit it — then scroll back and read "· phase-locked" in the toast.',
         highlight:'.util-btn.sync[data-deck="B"]',
         check:()=>decks&&decks.B&&decks.B.sync===true},
        {title:'Try manual nudge',
         text:'Drag the TEMPO slider on Deck B by a few percent. Even with SYNC on, small nudges keep you in control.',
         hint:'Touch the pitch fader, not the playback rate.',
         check:()=>decks&&decks.B&&Math.abs(decks.B.tempo||0)>0.1},
      ]},
    { id:'l05', level:'intermediate', title:'🔥 Hot cues',
      blurb:'Mark favourite moments in a track and jump to them instantly.',
      xp:100,
      steps:[
        {title:'Press pad 1 on Deck A while playing',
         text:'The 8 pads under the jog wheel are your hot cues. With Deck A playing, click pad 1 to drop a marker.',
         highlight:'.hot-cues[data-deck="A"] .cue-btn[data-cue="1"]',
         check:()=>decks&&decks.A&&decks.A.hotCues&&decks.A.hotCues[1]!=null},
        {title:'Play for a few seconds, then hit pad 1 again',
         text:'You should jump right back to the moment you marked. Magic, right?',
         check:()=>decks&&decks.A&&decks.A.hotCues&&decks.A.hotCues[1]!=null}
      ]},
    { id:'l06', level:'intermediate', title:'🔁 Loops',
      blurb:"Capture a killer 4-bar section and let it ride.",
      xp:100,
      steps:[
        {title:'With Deck A playing, press LOOP IN',
         text:'LOOP IN marks the start of a loop at wherever the track is right now.',
         highlight:'.loop-btn[data-action="loopIn"][data-deck="A"]',
         check:()=>decks&&decks.A&&decks.A.loop&&decks.A.loop.loopInSet},
        {title:'A few seconds later, press LOOP OUT',
         text:'LOOP OUT marks the end. The loop activates immediately — you\'ll hear the section repeat.',
         highlight:'.loop-btn[data-action="loopOut"][data-deck="A"]',
         check:()=>decks&&decks.A&&decks.A.loop&&decks.A.loop.active},
        {title:'Press RELOOP to toggle it off',
         text:'RELOOP disables the loop without erasing it. Press it again to bring the loop back — useful for surprise reveals.',
         check:()=>decks&&decks.A&&decks.A.loop&&!decks.A.loop.active}
      ]},
    { id:'l07', level:'intermediate', title:'💿 Filters + FX',
      blurb:'Sweep a filter and you\'ve just made the crowd raise their hands.',
      xp:100,
      steps:[
        {title:'Turn the COLOR FX knob for Channel A',
         text:'The small knob at the top of the channel — it\'s a real-time filter. Roll it up: high-pass filter (bass drops out). Down: low-pass.',
         check:()=>mixerState&&mixerState.colorFx&&Math.abs(mixerState.colorFx.A||0)>0.1},
      ]},
    { id:'l08', level:'advanced', title:'🎯 Key-matched mixing',
      blurb:'Mixing in the same musical key = no clashing notes.',
      xp:150,
      steps:[
        {title:'Open the LIBRARY and sort by KEY',
         text:'Click the KEY column header — tracks now group by musical key. Pick two tracks in neighbouring Camelot codes (e.g. 8A + 9A).',
         check:()=>true},
        {title:'Load them onto A and B',
         text:'Now when you mix, the keys won\'t fight each other.',
         check:()=>decks&&decks.A&&decks.B&&decks.A.track&&decks.B.track},
      ]},
    { id:'l09', level:'advanced', title:'🎛 The SOUND mastering tab',
      blurb:'Every broadcaster runs a limiter + compressor. Here\'s how.',
      xp:120,
      steps:[
        {title:'Open the SOUND tab',
         text:'Top navigation — SOUND. That\'s your mastering chain: EQ, compressor, limiter, the VU meters, LUFS readout.',
         highlight:'.tab-btn[data-tab="studio"]',
         check:()=>document.getElementById('tab-studio')?.classList.contains('active')},
        {title:'Pick the CLUB target loudness',
         text:'Below the room presets there\'s a TARGET LOUDNESS row. Click CLUB (-8 LUFS). The history graph shows a green target line — aim to sit on it.',
         check:()=>studioState&&studioState.targetLufs===-8},
      ]},
    { id:'l10', level:'advanced', title:'🎙 Record your set',
      blurb:'Turn what you just did into an MP3 you can share.',
      xp:100,
      steps:[
        {title:'Press REC in the header',
         text:'Top-right corner — the red REC pill. Click it and TITAN starts capturing the master bus.',
         highlight:'#recBtn',
         check:()=>mixerState&&mixerState.isRecording===true},
        {title:'Press STOP when you\'re done',
         text:'The button is now STOP. Click it — a .webm file downloads. That\'s your first DJ set on disk.',
         check:()=>mixerState&&mixerState.isRecording===false}
      ]},
    { id:'l11', level:'beginner', title:'🎧 Cue with headphones',
      blurb:'Pre-listen to the next track silently. The single biggest unlock for blind beatmatching.',
      xp:75,
      steps:[
        {title:'Send Deck A to your headphones',
         text:'In the HEADPHONES section of the mixer toolbar, click "DECK A". The cue light turns on — Deck A is now flowing into your cans, but not the master.',
         hint:'Look for the row of DECK A/B/C/D buttons under the CUE MIX knob.',
         highlight:'#hpCue-A',
         check:()=>mixerState&&mixerState.hpCue&&mixerState.hpCue.A===true},
        {title:'Crank HP VOL',
         text:'The HP VOL knob is your headphone amp. Turn it up so you can actually hear the cue over a loud room.',
         highlight:'.knob[data-knob="hpVol"]',
         check:()=>{const k=document.querySelector('.knob[data-knob="hpVol"]');return k&&Math.abs(k._rot||0)>30;}},
        {title:'Set the CUE / MASTER blend',
         text:'CUE MIX bleeds master back into your headphones. Move it off the extremes — pros sit around 50/50 so they hear both sides.',
         highlight:'.knob[data-knob="hpMix"]',
         check:()=>{const k=document.querySelector('.knob[data-knob="hpMix"]');return k&&Math.abs(k._rot||0)>20;}}
      ]},
    { id:'l12', level:'beginner', title:'🎚 Trim — your gain stage',
      blurb:'Two tracks rarely arrive at the same loudness. TRIM evens them out before the fader.',
      xp:60,
      steps:[
        {title:'Turn Deck A\'s TRIM knob',
         text:'TRIM lives at the very top of the channel strip — above the EQ. Adjust it until the channel meter lives in the green/amber, never red.',
         hint:'A safe target is the channel meter peaking around -6 dB.',
         highlight:'.knob[data-knob="trim-A"]',
         check:()=>{const k=document.querySelector('.knob[data-knob="trim-A"]');return k&&Math.abs(k._rot||0)>30;}},
        {title:'Push the channel fader to ~75 %',
         text:'TRIM handles loudness; the channel fader is for performance moves. Push it up — that\'s your "voice" in the mix.',
         check:()=>decks&&decks.A&&decks.A.volume>0.6}
      ]},
    { id:'l13', level:'beginner', title:'🎯 Bank three hot cues',
      blurb:'Skip drag-scrubbing forever. Mark intro, drop and breakdown — jump there in one tap.',
      xp:80,
      steps:[
        {title:'Play Deck A, then hit pad 1 at the intro',
         text:'Pad 1 saves where the track is right now. You\'ll use it to start fresh whenever you want.',
         highlight:'.hot-cues[data-deck="A"] .cue-btn[data-cue="1"]',
         check:()=>decks&&decks.A&&decks.A.hotCues&&decks.A.hotCues[1]!=null},
        {title:'Let it play to the drop, then hit pad 2',
         text:'Pad 2 is your "drop" marker. Mash it whenever the crowd needs the kick back.',
         highlight:'.hot-cues[data-deck="A"] .cue-btn[data-cue="2"]',
         check:()=>decks&&decks.A&&decks.A.hotCues&&decks.A.hotCues[2]!=null},
        {title:'Save a third cue at the breakdown',
         text:'Three cues is the magic number — intro, drop, breakdown. Drop pad 3 wherever the track strips back.',
         highlight:'.hot-cues[data-deck="A"] .cue-btn[data-cue="3"]',
         check:()=>decks&&decks.A&&decks.A.hotCues&&decks.A.hotCues[3]!=null}
      ]},
    { id:'l14', level:'intermediate', title:'🔇 The bass swap',
      blurb:'Two basses fighting = mud. Pros never let both decks hit the bass at once.',
      xp:150,
      steps:[
        {title:'Have both decks playing',
         text:'Load tracks onto Deck A and Deck B and start them. They don\'t have to be in sync yet.',
         check:()=>decks&&decks.A&&decks.B&&decks.A.track&&decks.B.track&&decks.A.playing&&decks.B.playing},
        {title:'Roll Deck B\'s LOW knob hard down',
         text:'Cut the bass on the *incoming* deck. You can now blend without two kicks colliding.',
         hint:'Drag the LOW knob all the way down — past -40 dB.',
         highlight:'.knob[data-knob="low-B"]',
         check:()=>decks&&decks.B&&decks.B.eq&&decks.B.eq.low<-0.7},
        {title:'Move the crossfader to the centre',
         text:'Both decks are mixing — but Deck B has no bass, so there\'s no clash.',
         check:()=>mixerState&&Math.abs(mixerState.crossfader-0.5)<0.2},
        {title:'Now swap: bring B\'s LOW back, kill A\'s LOW',
         text:'On the next downbeat, restore B\'s bass and pull A\'s. The kick stays continuous; only the source changed.',
         hint:'Aim for B\'s LOW back near zero and A\'s LOW past -40 dB.',
         check:()=>decks&&decks.A&&decks.B&&decks.A.eq.low<-0.7&&decks.B.eq.low>-0.3}
      ]},
    { id:'l15', level:'intermediate', title:'🔑 KEYLOCK — pitch without warble',
      blurb:'Speed a track up 5 % without it sounding like the Chipmunks.',
      xp:110,
      steps:[
        {title:'Press KEY on Deck A',
         text:'KEY engages the pitch-preserving algorithm. You\'ll hear the difference once you nudge tempo.',
         highlight:'.util-btn.keylock[data-deck="A"]',
         check:()=>decks&&decks.A&&decks.A.keylock===true},
        {title:'Push tempo by more than 3 %',
         text:'Use the TEMPO slider on Deck A. With KEY on, the music speeds up but stays in its original key.',
         hint:'Tempo lives on the right edge of the deck.',
         check:()=>decks&&decks.A&&Math.abs(decks.A.tempo||0)>3}
      ]},
    { id:'l16', level:'intermediate', title:'📐 QUANTIZE — perfect cue drops',
      blurb:'Even sloppy fingers land on the beat when QUANT is on.',
      xp:100,
      steps:[
        {title:'Engage QUANT on Deck A',
         text:'Light the QUANT button. Every cue and loop trigger now snaps to the next beat instead of firing instantly.',
         highlight:'.util-btn.quantize[data-deck="A"]',
         check:()=>decks&&decks.A&&decks.A.quantize===true},
        {title:'With Deck A playing, hit pad 4 anywhere',
         text:'Save a hot cue. Notice it lands cleanly on the next beat — no off-grid wobble.',
         highlight:'.hot-cues[data-deck="A"] .cue-btn[data-cue="4"]',
         check:()=>decks&&decks.A&&decks.A.hotCues&&decks.A.hotCues[4]!=null}
      ]},
    { id:'l17', level:'intermediate', title:'🌀 SLIP MODE — return to the future',
      blurb:'Mash any cue or loop, then jump back to where the song would have been if you hadn\'t.',
      xp:110,
      steps:[
        {title:'Enable SLIP on Deck A',
         text:'SLIP keeps a "ghost" playhead running in the background. Pads and loops only affect the audible stream.',
         highlight:'.util-btn.slip[data-deck="A"]',
         check:()=>decks&&decks.A&&decks.A.slip===true},
        {title:'With Deck A playing, mash pad 5',
         text:'Punch pad 5 to fire a cue. Release — the track snaps back to where it would have been. Pure magic.',
         highlight:'.hot-cues[data-deck="A"] .cue-btn[data-cue="5"]',
         check:()=>decks&&decks.A&&decks.A.hotCues&&decks.A.hotCues[5]!=null}
      ]},
    { id:'l18', level:'intermediate', title:'◀ REVERSE moment',
      blurb:'A 1-bar reverse before the drop is the oldest trick in the DJ book — and still kills.',
      xp:80,
      steps:[
        {title:'Tap REV on Deck A',
         text:'With the deck playing, hit REV. The track plays backwards in real time.',
         highlight:'.util-btn.reverse[data-deck="A"]',
         check:()=>decks&&decks.A&&decks.A.reverse===true},
        {title:'Tap REV again to return to forward play',
         text:'Toggle off — the track resumes forward, ideally on the next downbeat for the cleanest land.',
         check:()=>decks&&decks.A&&decks.A.reverse===false}
      ]},
    { id:'l19', level:'intermediate', title:'⏰ TAP the BPM by ear',
      blurb:'Numbers wrong? Beatgrid drifting? Tap-tempo is your manual override.',
      xp:90,
      steps:[
        {title:'Play a track on Deck A',
         text:'Anything will do. Listen to the kick.',
         check:()=>decks&&decks.A&&decks.A.playing},
        {title:'Tap the TAP button in time, 4+ times',
         text:'Hit TAP on every downbeat. After a few taps the master BPM updates to your taps.',
         hint:'TAP lives in the BEAT FX panel.',
         highlight:'#tapBtn',
         check:()=>mixerState&&typeof mixerState.tapBpm==='number'&&mixerState.tapBpm>0}
      ]},
    { id:'l20', level:'intermediate', title:'💥 BEAT FX — your first echo',
      blurb:'A tempo-locked echo on the last beat before a drop is pure ear candy.',
      xp:130,
      steps:[
        {title:'Turn FX LEVEL up',
         text:'Without level there\'s no FX, no matter how hard you press. Find the LEVEL knob in the BEAT FX panel.',
         highlight:'.knob[data-knob="fxLevel"]',
         check:()=>{const k=document.querySelector('.knob[data-knob="fxLevel"]');return k&&Math.abs(k._rot||0)>20;}},
        {title:'Switch beat division to 1/4',
         text:'BEAT FX is tempo-synced. 1/4 = quarter-note feedback. Click the 1/4 button.',
         highlight:'.beat-btn[data-beat="0.25"]',
         check:()=>mixerState&&mixerState.fx&&Math.abs((mixerState.fx.beat||0)-0.25)<0.001},
        {title:'Engage FX ON / OFF',
         text:'Press the big ON/OFF — the effect is now live on the master bus.',
         highlight:'#fxOnOff',
         check:()=>mixerState&&mixerState.fx&&mixerState.fx.on===true}
      ]},
    { id:'l21', level:'advanced', title:'🎬 SCENE FX X-PAD',
      blurb:'A 2-D pad that drives two FX parameters at once. Where DJs feel like keyboardists.',
      xp:140,
      steps:[
        {title:'Pick the SWEEP scene',
         text:'In the SCENE FX panel, click SWEEP. The X-PAD now drives a noise-sweep + gain.',
         highlight:'.scene-btn[data-scene="sweep"]',
         check:()=>mixerState&&mixerState.sceneFx&&mixerState.sceneFx.type==='sweep'},
        {title:'Drag inside the X-PAD',
         text:'Touch and drag the pad. Release = the FX disengages instantly. That\'s the entire trick.',
         highlight:'#xPad',
         check:()=>mixerState&&mixerState.sceneFx&&mixerState.sceneFx.xpadActive===true}
      ]},
    { id:'l22', level:'advanced', title:'📣 MIC announcement',
      blurb:'Drop a "Make some NOISE!" at the right moment.',
      xp:100,
      steps:[
        {title:'Press MIC ON',
         text:'In the MIC section of the mixer toolbar, hit ON. Your browser will ask for microphone permission — accept.',
         highlight:'#micOnBtn',
         check:()=>mixerState&&mixerState.micOn===true},
        {title:'Push MIC VOL above zero',
         text:'Turn the VOL knob until the mic peaks show life when you speak.',
         highlight:'.knob[data-knob="micVol"]',
         check:()=>{const k=document.querySelector('.knob[data-knob="micVol"]');return k&&Math.abs(k._rot||0)>10;}},
        {title:'Toggle MIC OFF when you\'re done',
         text:'Don\'t leave a hot mic open. Press ON again to disengage.',
         highlight:'#micOnBtn',
         check:()=>mixerState&&mixerState.micOn===false}
      ]},
    { id:'l23', level:'advanced', title:'🤖 AUTO-MIX takes the wheel',
      blurb:'Long bathroom break? Let TITAN swap decks for you, on grid, in key.',
      xp:130,
      steps:[
        {title:'Load tracks on Deck A and Deck B',
         text:'AUTO-MIX needs an outgoing deck and an incoming target.',
         check:()=>decks&&decks.A&&decks.B&&decks.A.track&&decks.B.track},
        {title:'Run a SMOOTH transition',
         text:'In the AUTO-MIX panel of the mixer toolbar, click SMOOTH. The button starts pulsing and the crossfader animates itself.',
         highlight:'.automix-btn[data-mix="smooth"]',
         check:()=>window.automix&&window.automix.phase&&window.automix.phase!=='idle'}
      ]},
    { id:'l24', level:'advanced', title:'💿 Vinyl mode',
      blurb:'Same engine — but now with platters, tone-arms and the satisfaction of physical scratch.',
      xp:90,
      steps:[
        {title:'Open the VINYL tab',
         text:'Top navigation — VINYL. Two turntables appear, wired to Decks A and B.',
         highlight:'.tab-btn[data-tab="vinyl"]',
         check:()=>document.getElementById('tab-vinyl')?.classList.contains('active')}
      ]},
    { id:'l25', level:'advanced', title:'🎯 Loudness target = pro masters',
      blurb:'Streaming, club and radio expect different loudness. Let the limiter do the heavy lifting.',
      xp:120,
      steps:[
        {title:'Open the SOUND tab',
         text:'Top navigation — SOUND. The mastering chain (EQ + comp + limiter + LUFS meter) lives here.',
         highlight:'.tab-btn[data-tab="studio"]',
         check:()=>document.getElementById('tab-studio')?.classList.contains('active')},
        {title:'Pick the STREAMING -14 LUFS target',
         text:'Spotify, Apple Music and Tidal all normalise to about -14 LUFS. Click STREAMING and watch the LUFS history aim for that line.',
         highlight:'.studio-target-btn[data-target="streaming"]',
         check:()=>studioState&&studioState.targetLufs===-14}
      ]},
  ];

  /* ─── Rendering the lesson grid ─── */
  function totalXp(){return LESSONS.reduce((a,l)=>a+(l.xp||0),0);}
  function render(){
    const grid=document.getElementById('learnLessonGrid');
    if(!grid)return;
    const activeLevel=document.querySelector('.learn-level-btn.active')?.dataset.level||'all';
    const filtered=LESSONS.filter(l=>activeLevel==='all'||l.level===activeLevel);
    const done=LESSONS.filter(l=>progress.completed[l.id]).length;
    const pct=Math.round(done/LESSONS.length*100);
    document.getElementById('learnPctDone').textContent=pct;
    document.getElementById('learnProgressBar').style.width=pct+'%';
    document.getElementById('learnCompleted').textContent=done;
    document.getElementById('learnTotal').textContent=LESSONS.length;
    document.getElementById('learnXp').textContent=progress.xp||0;
    grid.innerHTML=filtered.map(l=>{
      const complete=!!progress.completed[l.id];
      const levelColor=l.level==='beginner'?'#5cf0a0':l.level==='intermediate'?'#ffaa5a':'#ff90a0';
      return `<div class="learn-card" data-lesson-id="${l.id}" style="background:${complete?'linear-gradient(135deg,#0a1a12,#061812)':'linear-gradient(180deg,#1a1a1e,#0a0a0c)'};border:1px solid ${complete?'rgba(92,240,160,.4)':'#2a2a2e'};border-radius:10px;padding:16px;cursor:pointer;transition:transform .15s,box-shadow .15s;position:relative;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <span style="font-family:'Orbitron',sans-serif;font-size:9px;letter-spacing:2px;color:${levelColor};font-weight:700">${l.level.toUpperCase()}</span>
          ${complete?'<span style="color:#5cf0a0;font-size:14px">✓ DONE</span>':''}
        </div>
        <div style="font-family:'Orbitron',sans-serif;font-size:15px;font-weight:800;color:#fff;margin-bottom:6px;letter-spacing:.5px">${l.title}</div>
        <div style="font-size:12px;line-height:1.5;color:#9a9a9e;margin-bottom:10px">${l.blurb}</div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-family:'Share Tech Mono',monospace;font-size:10px;color:#7a7a80">${l.steps.length} step${l.steps.length!==1?'s':''} · +${l.xp} XP</span>
          <button class="tool-btn" data-start-lesson="${l.id}" style="padding:5px 14px;font-size:10px;color:${complete?'#7a7a80':'#5cf0a0'};border-color:${complete?'#333':'#5cf0a0'};font-weight:700">${complete?'REPLAY':'START ▸'}</button>
        </div>
      </div>`;
    }).join('');
    grid.querySelectorAll('[data-start-lesson]').forEach(b=>{
      b.addEventListener('click',e=>{e.stopPropagation();startLesson(b.dataset.startLesson);});
    });
    grid.querySelectorAll('.learn-card').forEach(c=>{
      c.addEventListener('click',()=>startLesson(c.dataset.lessonId));
      c.addEventListener('mouseenter',()=>{c.style.transform='translateY(-2px)';c.style.boxShadow='0 8px 20px rgba(0,0,0,.6)';});
      c.addEventListener('mouseleave',()=>{c.style.transform='';c.style.boxShadow='';});
    });
  }

  /* ─── Lesson runner ─── */
  let active=null,pollTimer=null,hintTimer=null,highlightEl=null,highlightRetryTimer=null;
  // Per-lesson default tab — keeps users from getting stuck if they wandered off.
  // Steps can override with their own `tab` field.
  const LESSON_TABS={l09:'studio',l24:'vinyl',l25:'studio'};
  function startLesson(id){
    const lesson=LESSONS.find(l=>l.id===id);if(!lesson)return;
    active={lesson,stepIdx:0,startedAt:Date.now()};
    // Hop to the tab the lesson lives on (defaults to DECKS).
    const targetTab=LESSON_TABS[id]||'deck';
    document.querySelector(`.tab-btn[data-tab="${targetTab}"]`)?.click();
    setTimeout(showStep,200);
  }
  function applyHighlight(selector){
    clearHighlight();
    if(!selector)return;
    let tries=0;
    const tryFind=()=>{
      const el=document.querySelector(selector);
      if(el){highlightEl=el;el.classList.add('titan-learn-highlight');try{el.scrollIntoView({behavior:'smooth',block:'center'});}catch(_){}return;}
      if(++tries<10)highlightRetryTimer=setTimeout(tryFind,200);
    };
    tryFind();
  }
  function showStep(){
    if(!active)return;
    const {lesson,stepIdx}=active;
    const step=lesson.steps[stepIdx];
    // Auto-jump to the step's preferred tab if it differs from the active one.
    const stepTab=step.tab||LESSON_TABS[lesson.id]||'deck';
    const currentTab=document.querySelector('.tab-btn.active')?.dataset.tab;
    if(stepTab&&currentTab!==stepTab)document.querySelector(`.tab-btn[data-tab="${stepTab}"]`)?.click();
    const panel=document.getElementById('learnActiveLesson');
    panel.style.display='block';
    document.getElementById('learnStepN').textContent=stepIdx+1;
    document.getElementById('learnStepTotal').textContent=lesson.steps.length;
    document.getElementById('learnActiveTitle').textContent=step.title;
    document.getElementById('learnActiveInstruction').textContent=step.text;
    document.getElementById('learnActiveHint').textContent='';
    const back=document.getElementById('learnBackBtn');
    if(back)back.disabled=stepIdx===0;
    if(hintTimer)clearTimeout(hintTimer);
    if(step.hint)hintTimer=setTimeout(()=>{
      const el=document.getElementById('learnActiveHint');if(el)el.textContent='💡 '+step.hint;
    },6000);
    // Highlight (with retry — element may not be mounted yet after a tab switch)
    applyHighlight(step.highlight);
    // Poll for completion
    if(pollTimer)clearInterval(pollTimer);
    pollTimer=setInterval(()=>{
      try{if(step.check&&step.check()){markStepDone();}}catch(_){}
    },300);
  }
  function clearHighlight(){
    if(highlightRetryTimer){clearTimeout(highlightRetryTimer);highlightRetryTimer=null;}
    if(highlightEl){highlightEl.classList.remove('titan-learn-highlight');highlightEl=null;}
  }
  function markStepDone(){
    if(!active)return;
    if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
    const next=document.getElementById('learnNextBtn');
    if(next){next.textContent='✓ GREAT! NEXT ▸';next.style.background='linear-gradient(180deg,#5cf0a0,#00a858)';next.style.color='#000';}
  }
  function nextStep(){
    if(!active)return;
    active.stepIdx++;
    const next=document.getElementById('learnNextBtn');
    if(next){next.textContent='NEXT ▸';next.style.background='';next.style.color='#5cf0a0';}
    if(active.stepIdx>=active.lesson.steps.length){
      finishLesson();return;
    }
    showStep();
  }
  function prevStep(){
    if(!active||active.stepIdx<=0)return;
    active.stepIdx--;
    const next=document.getElementById('learnNextBtn');
    if(next){next.textContent='NEXT ▸';next.style.background='';next.style.color='#5cf0a0';}
    showStep();
  }
  function finishLesson(){
    const {lesson}=active||{};
    clearHighlight();
    if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
    if(hintTimer){clearTimeout(hintTimer);hintTimer=null;}
    if(lesson&&!progress.completed[lesson.id]){
      progress.completed[lesson.id]=Date.now();
      progress.xp=(progress.xp||0)+(lesson.xp||0);
      save();
    }
    document.getElementById('learnActiveLesson').style.display='none';
    active=null;
    if(lesson){
      toast&&toast(`🎉 Lesson complete! +${lesson.xp} XP`,'success');
    }
    render();
  }
  function closeLesson(){
    clearHighlight();
    if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
    if(hintTimer){clearTimeout(hintTimer);hintTimer=null;}
    document.getElementById('learnActiveLesson').style.display='none';
    active=null;
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
    // Inject the highlight CSS (tolerant to existing styles — uses animation)
    if(!document.getElementById('titanLearnCss')){
      const s=document.createElement('style');s.id='titanLearnCss';
      s.textContent=`
        @keyframes titanLearnPulse{0%,100%{box-shadow:0 0 0 0 rgba(92,240,160,0)}50%{box-shadow:0 0 0 8px rgba(92,240,160,.4),0 0 18px rgba(92,240,160,.6)}}
        .titan-learn-highlight{animation:titanLearnPulse 1.4s ease-in-out infinite;border-radius:6px;position:relative;z-index:50}
        .learn-card:hover{border-color:rgba(92,240,160,.7) !important}
        .learn-level-btn:hover{transform:translateY(-1px)}
      `;
      document.head.appendChild(s);
    }
    document.querySelectorAll('.learn-level-btn').forEach(b=>{
      b.addEventListener('click',()=>{
        document.querySelectorAll('.learn-level-btn').forEach(x=>{
          x.classList.remove('active');
          x.style.background=x.dataset.level==='beginner'?'#0a1a12':x.dataset.level==='intermediate'?'#141418':x.dataset.level==='advanced'?'#141418':'#0a1a12';
          x.style.color=x.dataset.level==='beginner'?'#9ad8b0':x.dataset.level==='intermediate'?'#ffd28a':x.dataset.level==='advanced'?'#ff90a0':'#9ad8b0';
        });
        b.classList.add('active');
        b.style.background='linear-gradient(180deg,#5cf0a0,#00a858)';
        b.style.color='#000';
        render();
      });
    });
    document.getElementById('learnNextBtn')?.addEventListener('click',nextStep);
    document.getElementById('learnSkipBtn')?.addEventListener('click',nextStep);
    document.getElementById('learnBackBtn')?.addEventListener('click',prevStep);
    document.getElementById('learnCloseBtn')?.addEventListener('click',closeLesson);
    document.getElementById('learnResetBtn')?.addEventListener('click',()=>{
      if(!confirm('Reset all lesson progress and XP? This cannot be undone.'))return;
      progress={completed:{},xp:0};save();render();
      toast&&toast('Progress reset','success');
    });
    // Live filter for the BUTTON REFERENCE list
    const refSearch=document.getElementById('learnRefSearch');
    if(refSearch){
      refSearch.addEventListener('input',()=>{
        const q=refSearch.value.trim().toLowerCase();
        document.querySelectorAll('#learnRefGrid .learn-ref-card').forEach(card=>{
          let any=false;
          card.querySelectorAll('li').forEach(li=>{
            const match=!q||li.textContent.toLowerCase().includes(q);
            li.style.display=match?'':'none';
            if(match)any=true;
          });
          card.style.display=any?'':'none';
          if(q&&any&&!card.open)card.open=true;
        });
      });
    }
    render();
    // First-run nudge: if a brand-new user lands on the LEARN tab and hasn't
    // completed anything yet, gently auto-start lesson 1 so onboarding never
    // stalls on a blank screen.
    try{
      const ONBOARD_KEY='titan_learn_onboarded_v1';
      if(!localStorage.getItem(ONBOARD_KEY)&&!Object.keys(progress.completed||{}).length){
        const learnTabBtn=document.querySelector('.tab-btn[data-tab="learn"]');
        const onLearn=()=>{
          if(document.getElementById('tab-learn')?.classList.contains('active')){
            localStorage.setItem(ONBOARD_KEY,'1');
            setTimeout(()=>{if(!active)startLesson('l01');},900);
          }
        };
        learnTabBtn?.addEventListener('click',onLearn,{once:true});
        // If they're already on the LEARN tab right now, fire immediately.
        onLearn();
      }
    }catch(_){}
  },600));
})();

/* ═══════════════════════════════════════════════════════════════════
   TITAN · PERF WATCHDOG
   Central visibility gate + timer telemetry. When the browser tab
   goes into the background we mark the audio context for low-power
   mode so every rAF-driven meter / waveform / canvas skips its work
   (the individual loops already check `document.hidden`).  On
   return to foreground we kick all the gated loops so the UI
   repaints immediately instead of waiting for the next rAF edge.
   ═══════════════════════════════════════════════════════════════════ */
(function titanPerfWatchdog(){
  let lastHiddenAt=0,lastVisibleAt=performance.now();
  function onVis(){
    if(document.hidden){
      lastHiddenAt=performance.now();
      // Optional: suspend audioCtx on long-hidden sessions to stop CPU
      // entirely. Don't do it immediately — users Alt-Tab for seconds
      // at a time mid-mix. Schedule a 60 s timer to suspend only on
      // real inactivity.
      if(window._titanSuspendTimer)clearTimeout(window._titanSuspendTimer);
      window._titanSuspendTimer=setTimeout(()=>{
        if(document.hidden&&typeof audioCtx!=='undefined'&&audioCtx&&audioCtx.state==='running'){
          // Check that nothing is actively playing before we suspend
          const anyDeckPlaying=['A','B','C','D'].some(id=>decks?.[id]?.playing);
          const recActive=mixerState?.isRecording;
          if(!anyDeckPlaying&&!recActive){
            try{audioCtx.suspend();}catch(_){}
          }
        }
      },60_000);
    }else{
      lastVisibleAt=performance.now();
      if(window._titanSuspendTimer){clearTimeout(window._titanSuspendTimer);window._titanSuspendTimer=null;}
      // Resume audio if we suspended it during the hidden interval
      try{
        if(typeof audioCtx!=='undefined'&&audioCtx&&audioCtx.state==='suspended'){
          audioCtx.resume();
        }
      }catch(_){}
    }
  }
  document.addEventListener('visibilitychange',onVis);
})();

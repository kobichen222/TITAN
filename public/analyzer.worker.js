/* Pioneer DJ Pro MAX — Audio Analysis Worker
   Runs BPM + energy + simple key estimate off the main thread.
   Input message: { type:'analyze', id, sampleRate, channelData } (Float32Array, transferred)
   Output message: { type:'result', id, bpm, energy, key } */

const KRUMHANSL_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const KRUMHANSL_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const PITCH_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function detectBPM(data, sr){
  let peaks = [], lastPeak = -Infinity;
  const minGap = sr * 0.25;
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += Math.abs(data[i]);
  const avg = sum / data.length;
  const thr = Math.max(0.4, avg * 4);
  for (let i = 0; i < data.length; i++){
    if (Math.abs(data[i]) > thr && i - lastPeak > minGap){
      peaks.push(i); lastPeak = i;
    }
  }
  if (peaks.length < 4) return 120;
  const ints = {};
  for (let i = 1; i < peaks.length; i++){
    const sec = (peaks[i] - peaks[i-1]) / sr;
    let bpm = Math.round(60 / sec);
    while (bpm < 70) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    bpm = Math.round(bpm);
    ints[bpm] = (ints[bpm] || 0) + 1;
  }
  let best = 120, bc = 0;
  for (const [k,v] of Object.entries(ints)){
    if (v > bc){ bc = v; best = Number(k); }
  }
  return best;
}

function computeEnergy(data){
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  const rms = Math.sqrt(sum / data.length);
  return Math.min(10, Math.round(rms * 30));
}

function computeChroma(data, sr){
  const fftSize = 4096;
  const chroma = new Array(12).fill(0);
  const refFreq = 440, refMidi = 69;
  const win = Math.min(data.length, sr * 30);
  const step = Math.floor(win / 64);
  for (let pos = 0; pos + fftSize < win; pos += step){
    for (let bin = 1; bin < fftSize / 2; bin++){
      const freq = bin * sr / fftSize;
      if (freq < 80 || freq > 5000) continue;
      const midi = 12 * Math.log2(freq / refFreq) + refMidi;
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      let re = 0, im = 0;
      for (let n = 0; n < 256; n++){
        const s = data[pos + n] || 0;
        const phase = -2 * Math.PI * bin * n / fftSize;
        re += s * Math.cos(phase);
        im += s * Math.sin(phase);
      }
      chroma[pc] += Math.sqrt(re*re + im*im);
    }
  }
  const max = Math.max(...chroma) || 1;
  return chroma.map(v => v / max);
}

function detectKey(data, sr){
  const chroma = computeChroma(data, sr);
  let bestScore = -Infinity, bestKey = 'C', bestMode = 'maj';
  for (let i = 0; i < 12; i++){
    let majScore = 0, minScore = 0;
    for (let j = 0; j < 12; j++){
      majScore += chroma[(i + j) % 12] * KRUMHANSL_MAJOR[j];
      minScore += chroma[(i + j) % 12] * KRUMHANSL_MINOR[j];
    }
    if (majScore > bestScore){ bestScore = majScore; bestKey = PITCH_NAMES[i]; bestMode = 'maj'; }
    if (minScore > bestScore){ bestScore = minScore; bestKey = PITCH_NAMES[i]; bestMode = 'min'; }
  }
  return bestMode === 'min' ? bestKey + 'm' : bestKey;
}

self.onmessage = (e) => {
  const { type, id, sampleRate, channelData } = e.data || {};
  if (type !== 'analyze') return;
  try {
    const data = new Float32Array(channelData);
    const bpm = detectBPM(data, sampleRate);
    const energy = computeEnergy(data);
    let key = '--';
    try { key = detectKey(data.subarray(0, Math.min(data.length, sampleRate * 30)), sampleRate); } catch (_) {}
    self.postMessage({ type:'result', id, bpm, energy, key });
  } catch (err) {
    self.postMessage({ type:'result', id, bpm: 120, energy: 5, key: '--', error: String(err) });
  }
};

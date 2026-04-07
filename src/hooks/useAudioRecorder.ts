import { useState, useRef, useCallback } from 'react';
import type { TrackFXSettings } from '@/components/TrackEffects';
import { defaultFX } from '@/components/TrackEffects';

export interface AudioTrack {
  id: string;
  name: string;
  blob: Blob;
  url: string;
  duration: number;
  createdAt: Date;
  waveformData: number[];
}

export type AudioInputSource = 'microphone' | 'line';

export interface PlaybackEQ {
  bass: number;
  mid: number;
  treble: number;
  volume: number;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [analyserData, setAnalyserData] = useState<number[]>(new Array(128).fill(0));
  const [inputLevel, setInputLevel] = useState(0);
  const [inputSource, setInputSource] = useState<AudioInputSource>('microphone');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [noiseReduction, setNoiseReduction] = useState(true);
  const [playbackAnalyser, setPlaybackAnalyser] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackEQRef = useRef<{ bass: BiquadFilterNode; mid: BiquadFilterNode; treble: BiquadFilterNode; gain: GainNode } | null>(null);
  const playbackFXRef = useRef<{
    reverbGain: GainNode; dryGain: GainNode; convolver: ConvolverNode;
    delay: DelayNode; delayFeedback: GainNode; delayMix: GainNode; delayDry: GainNode;
    compressor: DynamicsCompressorNode;
    chorusDelay: DelayNode; chorusLFO: OscillatorNode; chorusDepth: GainNode; chorusMix: GainNode; chorusDry: GainNode;
    deEsser: BiquadFilterNode; deEsserComp: DynamicsCompressorNode;
    presence: BiquadFilterNode; warmth: BiquadFilterNode;
    breathFilter: BiquadFilterNode; breathComp: DynamicsCompressorNode;
  } | null>(null);

  const generateWaveformData = useCallback(async (blob: Blob): Promise<number[]> => {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    const samples = 200;
    const blockSize = Math.floor(channelData.length / samples);
    const waveform: number[] = [];
    for (let i = 0; i < samples; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(channelData[i * blockSize + j]);
      }
      waveform.push(sum / blockSize);
    }
    const max = Math.max(...waveform);
    audioContext.close();
    return waveform.map(v => v / (max || 1));
  }, []);

  const updateAnalyser = useCallback(() => {
    if (!analyserRef.current) return;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    const normalized = Array.from(data).map(v => v / 255);
    setAnalyserData(normalized);
    const rms = Math.sqrt(normalized.reduce((sum, v) => sum + v * v, 0) / normalized.length);
    setInputLevel(rms);
    animFrameRef.current = requestAnimationFrame(updateAnalyser);
  }, []);

  const buildNoiseReductionChain = useCallback((ctx: AudioContext, source: MediaStreamAudioSourceNode) => {
    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 80;
    highPass.Q.value = 0.7;

    const lowPass = ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 16000;
    lowPass.Q.value = 0.7;

    const noiseGate = ctx.createDynamicsCompressor();
    noiseGate.threshold.value = -50;
    noiseGate.knee.value = 5;
    noiseGate.ratio.value = 12;
    noiseGate.attack.value = 0.003;
    noiseGate.release.value = 0.1;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 10;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.25;

    const notch50 = ctx.createBiquadFilter();
    notch50.type = 'notch';
    notch50.frequency.value = 50;
    notch50.Q.value = 30;

    const notch60 = ctx.createBiquadFilter();
    notch60.type = 'notch';
    notch60.frequency.value = 60;
    notch60.Q.value = 30;

    source.connect(highPass);
    highPass.connect(notch50);
    notch50.connect(notch60);
    notch60.connect(lowPass);
    lowPass.connect(noiseGate);
    noiseGate.connect(compressor);

    return compressor;
  }, []);

  const createReverbImpulse = useCallback((ctx: AudioContext, decay: number): AudioBuffer => {
    const rate = ctx.sampleRate;
    const length = rate * decay;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
      }
    }
    return impulse;
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 48000 });
      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      let lastNode: AudioNode;
      if (noiseReduction) {
        lastNode = buildNoiseReductionChain(audioContext, source);
      } else {
        lastNode = source;
      }

      lastNode.connect(analyser);

      const recordingDest = audioContext.createMediaStreamDestination();
      lastNode.connect(recordingDest);

      const monitorGain = audioContext.createGain();
      monitorGain.gain.value = isMonitoring ? 1 : 0;
      lastNode.connect(monitorGain);
      monitorGain.connect(audioContext.destination);
      monitorGainRef.current = monitorGain;

      const mediaRecorder = new MediaRecorder(recordingDest.stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const waveformData = await generateWaveformData(blob);
        
        const audio = new Audio(url);
        await new Promise<void>(resolve => {
          audio.onloadedmetadata = () => resolve();
        });

        const newTrack: AudioTrack = {
          id: crypto.randomUUID(),
          name: `Faixa ${tracks.length + 1}`,
          blob,
          url,
          duration: audio.duration,
          createdAt: new Date(),
          waveformData,
        };
        setTracks(prev => [...prev, newTrack]);
        setCurrentTrackIndex(tracks.length);
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 0.1);
      }, 100);

      updateAnalyser();
    } catch (err) {
      console.error('Erro ao acessar dispositivo de áudio:', err);
    }
  }, [tracks.length, generateWaveformData, updateAnalyser, noiseReduction, isMonitoring, buildNoiseReductionChain]);

  const toggleMonitoring = useCallback((enabled: boolean) => {
    setIsMonitoring(enabled);
    if (monitorGainRef.current) {
      monitorGainRef.current.gain.setValueAtTime(enabled ? 1 : 0, audioContextRef.current?.currentTime ?? 0);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioContextRef.current?.close();
      monitorGainRef.current = null;
      sourceNodeRef.current = null;
      setIsRecording(false);
      setIsPaused(false);
      setAnalyserData(new Array(128).fill(0));
      setInputLevel(0);
    }
  }, [isRecording]);

  const buildFXChain = useCallback((ctx: AudioContext, inputNode: AudioNode, fx: TrackFXSettings): AudioNode => {
    // === Compressor ===
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = fx.compThreshold;
    compressor.knee.value = 10;
    compressor.ratio.value = fx.compRatio;
    compressor.attack.value = fx.compAttack;
    compressor.release.value = fx.compRelease;

    // === Voice: Warmth (low shelf boost) ===
    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowshelf';
    warmth.frequency.value = 300;
    warmth.gain.value = fx.warmth;

    // === Voice: Presence (high-mid boost) ===
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = 3500;
    presence.Q.value = 1.5;
    presence.gain.value = fx.presence;

    // === De-Esser (sibilance reduction) ===
    const deEsserFilter = ctx.createBiquadFilter();
    deEsserFilter.type = 'peaking';
    deEsserFilter.frequency.value = 6500;
    deEsserFilter.Q.value = 2;
    deEsserFilter.gain.value = -(fx.deEsser / 100) * 12;

    const deEsserComp = ctx.createDynamicsCompressor();
    deEsserComp.threshold.value = -30 + (1 - fx.deEsser / 100) * 30;
    deEsserComp.ratio.value = fx.deEsser > 0 ? 8 : 1;
    deEsserComp.attack.value = 0.001;
    deEsserComp.release.value = 0.05;

    // === Breath control (reduce breath sounds) ===
    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = 'highpass';
    breathFilter.frequency.value = 200 + (fx.breathControl / 100) * 600;
    breathFilter.Q.value = 0.5;

    const breathComp = ctx.createDynamicsCompressor();
    breathComp.threshold.value = -40 + (fx.breathControl / 100) * 20;
    breathComp.ratio.value = fx.breathControl > 0 ? 4 : 1;
    breathComp.attack.value = 0.01;
    breathComp.release.value = 0.1;

    // Main chain: input -> compressor -> warmth -> presence -> de-esser
    inputNode.connect(compressor);
    compressor.connect(warmth);
    warmth.connect(presence);
    presence.connect(deEsserFilter);
    deEsserFilter.connect(deEsserComp);
    deEsserComp.connect(breathFilter);
    breathFilter.connect(breathComp);

    // Final merge node
    const mergeGain = ctx.createGain();
    mergeGain.gain.value = 1;

    // === Reverb (parallel) ===
    const convolver = ctx.createConvolver();
    convolver.buffer = createReverbImpulse(ctx, fx.reverbDecay);
    const reverbGain = ctx.createGain();
    reverbGain.gain.value = fx.reverbMix / 100;
    const dryGainReverb = ctx.createGain();
    dryGainReverb.gain.value = 1;

    breathComp.connect(dryGainReverb);
    dryGainReverb.connect(mergeGain);
    breathComp.connect(convolver);
    convolver.connect(reverbGain);
    reverbGain.connect(mergeGain);

    // === Delay (parallel from merge) ===
    const delayNode = ctx.createDelay(2);
    delayNode.delayTime.value = fx.delayTime;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = fx.delayFeedback / 100;
    const delayMix = ctx.createGain();
    delayMix.gain.value = fx.delayMix / 100;

    const postDelay = ctx.createGain();
    postDelay.gain.value = 1;

    mergeGain.connect(postDelay); // dry
    mergeGain.connect(delayNode);
    delayNode.connect(delayFeedback);
    delayFeedback.connect(delayNode);
    delayNode.connect(delayMix);
    delayMix.connect(postDelay);

    // === Chorus (parallel from postDelay) ===
    if (fx.chorusMix > 0) {
      const chorusDelay = ctx.createDelay(0.1);
      chorusDelay.delayTime.value = 0.005;
      const chorusLFO = ctx.createOscillator();
      chorusLFO.type = 'sine';
      chorusLFO.frequency.value = fx.chorusRate;
      const chorusDepthGain = ctx.createGain();
      chorusDepthGain.gain.value = (fx.chorusDepth / 1000);
      chorusLFO.connect(chorusDepthGain);
      chorusDepthGain.connect(chorusDelay.delayTime);
      chorusLFO.start();

      const chorusMixGain = ctx.createGain();
      chorusMixGain.gain.value = fx.chorusMix / 100;
      const chorusDryGain = ctx.createGain();
      chorusDryGain.gain.value = 1;

      const finalOut = ctx.createGain();
      finalOut.gain.value = 1;

      postDelay.connect(chorusDryGain);
      chorusDryGain.connect(finalOut);
      postDelay.connect(chorusDelay);
      chorusDelay.connect(chorusMixGain);
      chorusMixGain.connect(finalOut);

      // Store references for live updates
      playbackFXRef.current = {
        reverbGain, dryGain: dryGainReverb, convolver,
        delay: delayNode, delayFeedback, delayMix, delayDry: postDelay,
        compressor,
        chorusDelay, chorusLFO, chorusDepth: chorusDepthGain, chorusMix: chorusMixGain, chorusDry: chorusDryGain,
        deEsser: deEsserFilter, deEsserComp,
        presence, warmth,
        breathFilter, breathComp,
      };

      return finalOut;
    }

    // No chorus
    playbackFXRef.current = {
      reverbGain, dryGain: dryGainReverb, convolver,
      delay: delayNode, delayFeedback, delayMix, delayDry: postDelay,
      compressor,
      chorusDelay: ctx.createDelay(), chorusLFO: ctx.createOscillator(), chorusDepth: ctx.createGain(), chorusMix: ctx.createGain(), chorusDry: ctx.createGain(),
      deEsser: deEsserFilter, deEsserComp,
      presence, warmth,
      breathFilter, breathComp,
    };

    return postDelay;
  }, [createReverbImpulse]);

  const playTrack = useCallback((index?: number, eq?: PlaybackEQ, fx?: TrackFXSettings) => {
    const idx = index ?? currentTrackIndex;
    if (idx === null || !tracks[idx]) return;
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
      playbackEQRef.current = null;
      playbackFXRef.current = null;
    }

    const audio = new Audio(tracks[idx].url);
    audio.crossOrigin = 'anonymous';
    audioElementRef.current = audio;
    setCurrentTrackIndex(idx);
    setIsPlaying(true);
    setPlaybackTime(0);

    const ctx = new AudioContext();
    playbackCtxRef.current = ctx;
    const source = ctx.createMediaElementSource(audio);

    // EQ chain
    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = eq?.bass ?? 0;

    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;
    midFilter.gain.value = eq?.mid ?? 0;

    const trebleFilter = ctx.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 4000;
    trebleFilter.gain.value = eq?.treble ?? 0;

    const gainNode = ctx.createGain();
    gainNode.gain.value = Math.pow(10, (eq?.volume ?? 0) / 20);

    source.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(gainNode);

    playbackEQRef.current = { bass: bassFilter, mid: midFilter, treble: trebleFilter, gain: gainNode };

    // FX chain
    const fxSettings = fx ?? defaultFX;
    const fxOutput = buildFXChain(ctx, gainNode, fxSettings);

    // Analyser for spectrum
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    fxOutput.connect(analyser);
    analyser.connect(ctx.destination);
    setPlaybackAnalyser(analyser);

    playbackTimerRef.current = window.setInterval(() => {
      setPlaybackTime(audio.currentTime);
    }, 50);

    audio.onended = () => {
      setIsPlaying(false);
      setPlaybackAnalyser(null);
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };

    audio.play();
  }, [currentTrackIndex, tracks, buildFXChain]);

  const updatePlaybackEQ = useCallback((eq: PlaybackEQ) => {
    if (!playbackEQRef.current) return;
    const { bass, mid, treble, gain } = playbackEQRef.current;
    bass.gain.value = eq.bass;
    mid.gain.value = eq.mid;
    treble.gain.value = eq.treble;
    gain.gain.value = Math.pow(10, eq.volume / 20);
  }, []);

  const updatePlaybackFX = useCallback((fx: TrackFXSettings) => {
    if (!playbackFXRef.current || !playbackCtxRef.current) return;
    const r = playbackFXRef.current;
    r.reverbGain.gain.value = fx.reverbMix / 100;
    r.compressor.threshold.value = fx.compThreshold;
    r.compressor.ratio.value = fx.compRatio;
    r.compressor.attack.value = fx.compAttack;
    r.compressor.release.value = fx.compRelease;
    r.delay.delayTime.value = fx.delayTime;
    r.delayFeedback.gain.value = fx.delayFeedback / 100;
    r.delayMix.gain.value = fx.delayMix / 100;
    r.presence.gain.value = fx.presence;
    r.warmth.gain.value = fx.warmth;
    r.deEsser.gain.value = -(fx.deEsser / 100) * 12;
  }, []);

  const pausePlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
      setIsPlaying(false);
      setPlaybackTime(0);
      setPlaybackAnalyser(null);
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
  }, []);

  const deleteTrack = useCallback((id: string) => {
    setTracks(prev => prev.filter(t => t.id !== id));
    setCurrentTrackIndex(null);
  }, []);

  const renameTrack = useCallback((id: string, name: string) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  }, []);

  const downloadTrack = useCallback((id: string) => {
    const track = tracks.find(t => t.id === id);
    if (!track) return;
    const a = document.createElement('a');
    a.href = track.url;
    a.download = `${track.name}.webm`;
    a.click();
  }, [tracks]);

  const importAudioFile = useCallback(async (file: File) => {
    try {
      const blob = new Blob([await file.arrayBuffer()], { type: file.type });
      const url = URL.createObjectURL(blob);
      const waveformData = await generateWaveformData(blob);

      const audio = new Audio(url);
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject(new Error('Formato não suportado'));
      });

      const name = file.name.replace(/\.[^/.]+$/, '');
      const newTrack: AudioTrack = {
        id: crypto.randomUUID(),
        name,
        blob,
        url,
        duration: audio.duration,
        createdAt: new Date(),
        waveformData,
      };
      setTracks(prev => [...prev, newTrack]);
      setCurrentTrackIndex(tracks.length);
    } catch (err) {
      console.error('Erro ao importar arquivo:', err);
    }
  }, [tracks.length, generateWaveformData]);

  const addTrack = useCallback((track: AudioTrack) => {
    setTracks(prev => [...prev, track]);
    setCurrentTrackIndex(tracks.length);
  }, [tracks.length]);

  return {
    isRecording,
    isPaused,
    recordingTime,
    tracks,
    currentTrackIndex,
    isPlaying,
    playbackTime,
    analyserData,
    inputLevel,
    inputSource,
    isMonitoring,
    noiseReduction,
    playbackAnalyser,
    startRecording,
    stopRecording,
    playTrack,
    pausePlayback,
    stopPlayback,
    deleteTrack,
    renameTrack,
    downloadTrack,
    importAudioFile,
    setCurrentTrackIndex,
    addTrack,
    setInputSource,
    toggleMonitoring,
    setNoiseReduction,
    updatePlaybackEQ,
    updatePlaybackFX,
  };
}

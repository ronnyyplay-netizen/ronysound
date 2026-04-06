import { useState, useRef, useCallback } from 'react';

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
    // High-pass filter to remove low-frequency rumble (wind, AC, traffic)
    const highPass = ctx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 80;
    highPass.Q.value = 0.7;

    // Low-pass to remove very high frequency hiss
    const lowPass = ctx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 16000;
    lowPass.Q.value = 0.7;

    // Noise gate via compressor with high threshold
    const noiseGate = ctx.createDynamicsCompressor();
    noiseGate.threshold.value = -50;
    noiseGate.knee.value = 5;
    noiseGate.ratio.value = 12;
    noiseGate.attack.value = 0.003;
    noiseGate.release.value = 0.1;

    // Gentle compression for consistent levels
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 10;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.25;

    // Notch filters for common interference frequencies (50/60Hz hum)
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

  const startRecording = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2, // Stereo
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

      // Build processing chain
      let lastNode: AudioNode;
      if (noiseReduction) {
        lastNode = buildNoiseReductionChain(audioContext, source);
      } else {
        lastNode = source;
      }

      lastNode.connect(analyser);

      // Create a destination for recording the processed audio
      const recordingDest = audioContext.createMediaStreamDestination();
      lastNode.connect(recordingDest);

      // Monitor output (real-time listening)
      const monitorGain = audioContext.createGain();
      monitorGain.gain.value = isMonitoring ? 1 : 0;
      lastNode.connect(monitorGain);
      monitorGain.connect(audioContext.destination);
      monitorGainRef.current = monitorGain;

      // Record from processed stream
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

  const playTrack = useCallback((index?: number) => {
    const idx = index ?? currentTrackIndex;
    if (idx === null || !tracks[idx]) return;
    
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }

    const audio = new Audio(tracks[idx].url);
    audioElementRef.current = audio;
    setCurrentTrackIndex(idx);
    setIsPlaying(true);
    setPlaybackTime(0);

    playbackTimerRef.current = window.setInterval(() => {
      setPlaybackTime(audio.currentTime);
    }, 50);

    audio.onended = () => {
      setIsPlaying(false);
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };

    audio.play();
  }, [currentTrackIndex, tracks]);

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
  };
}

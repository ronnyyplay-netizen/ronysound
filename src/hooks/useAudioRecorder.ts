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

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: false, 
          noiseSuppression: false, 
          autoGainControl: false 
        } 
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
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
      console.error('Erro ao acessar microfone:', err);
    }
  }, [tracks.length, generateWaveformData, updateAnalyser]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioContextRef.current?.close();
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
    setTracks(prev => {
      const filtered = prev.filter(t => t.id !== id);
      return filtered;
    });
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
  };
}

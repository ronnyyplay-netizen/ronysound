import { useState, useRef, useCallback } from 'react';
import type { AudioTrack } from './useAudioRecorder';

export interface StemType {
  id: string;
  label: string;
  icon: string;
  filters: FilterConfig[];
}

interface FilterConfig {
  type: BiquadFilterType;
  frequency: number;
  Q?: number;
  gain?: number;
}

export const STEM_TYPES: StemType[] = [
  {
    id: 'vocals',
    label: 'Vocal',
    icon: '🎤',
    filters: [
      { type: 'highpass', frequency: 200, Q: 0.7 },
      { type: 'lowpass', frequency: 5000, Q: 0.7 },
      { type: 'peaking', frequency: 2500, Q: 1.5, gain: 6 },
    ],
  },
  {
    id: 'bass',
    label: 'Baixo',
    icon: '🎸',
    filters: [
      { type: 'lowpass', frequency: 300, Q: 1 },
      { type: 'peaking', frequency: 80, Q: 1, gain: 4 },
    ],
  },
  {
    id: 'drums',
    label: 'Bateria',
    icon: '🥁',
    filters: [
      { type: 'peaking', frequency: 100, Q: 2, gain: 6 },
      { type: 'peaking', frequency: 4000, Q: 1, gain: 5 },
      { type: 'notch', frequency: 1000, Q: 2 },
    ],
  },
  {
    id: 'other',
    label: 'Outros',
    icon: '🎹',
    filters: [
      { type: 'highpass', frequency: 300, Q: 0.7 },
      { type: 'lowpass', frequency: 8000, Q: 0.7 },
      { type: 'peaking', frequency: 1500, Q: 1, gain: 3 },
    ],
  },
];

export interface StemResult {
  stemId: string;
  label: string;
  blob: Blob;
  url: string;
  duration: number;
  waveformData: number[];
}

export function useStemSeparator() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stems, setStems] = useState<StemResult[]>([]);
  const [previewStemId, setPreviewStemId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const separateStems = useCallback(async (track: AudioTrack, selectedStems: string[]) => {
    setIsProcessing(true);
    setProgress(0);
    setStems([]);

    try {
      const arrayBuffer = await track.blob.arrayBuffer();
      const results: StemResult[] = [];

      for (let i = 0; i < selectedStems.length; i++) {
        const stemId = selectedStems[i];
        const stemType = STEM_TYPES.find(s => s.id === stemId);
        if (!stemType) continue;

        setProgress(Math.round(((i) / selectedStems.length) * 100));

        // Decode fresh for each stem
        const ctx = new OfflineAudioContext(2, 1, 44100);
        const tempBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

        const offlineCtx = new OfflineAudioContext(
          tempBuffer.numberOfChannels,
          tempBuffer.length,
          tempBuffer.sampleRate
        );

        const source = offlineCtx.createBufferSource();
        source.buffer = tempBuffer;

        // Build filter chain
        let lastNode: AudioNode = source;
        for (const fc of stemType.filters) {
          const filter = offlineCtx.createBiquadFilter();
          filter.type = fc.type;
          filter.frequency.value = fc.frequency;
          if (fc.Q !== undefined) filter.Q.value = fc.Q;
          if (fc.gain !== undefined) filter.gain.value = fc.gain;
          lastNode.connect(filter);
          lastNode = filter;
        }
        lastNode.connect(offlineCtx.destination);
        source.start(0);

        const rendered = await offlineCtx.startRendering();

        // Convert to WAV blob
        const wavBlob = audioBufferToWav(rendered);
        const url = URL.createObjectURL(wavBlob);

        // Generate waveform
        const waveformData = generateWaveform(rendered, 200);

        results.push({
          stemId,
          label: stemType.label,
          blob: wavBlob,
          url,
          duration: rendered.duration,
          waveformData,
        });
      }

      setStems(results);
      setProgress(100);
    } catch (err) {
      console.error('Stem separation failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const previewStem = useCallback((stemId: string) => {
    const stem = stems.find(s => s.stemId === stemId);
    if (!stem) return;

    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (previewStemId === stemId) {
      setPreviewStemId(null);
      return;
    }

    const audio = new Audio(stem.url);
    audio.play();
    audio.onended = () => setPreviewStemId(null);
    audioRef.current = audio;
    setPreviewStemId(stemId);
  }, [stems, previewStemId]);

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewStemId(null);
  }, []);

  const exportStemAsTrack = useCallback((stem: StemResult, originalName: string): AudioTrack => {
    return {
      id: `stem-${stem.stemId}-${Date.now()}`,
      name: `${originalName} - ${stem.label}`,
      blob: stem.blob,
      url: stem.url,
      duration: stem.duration,
      createdAt: new Date(),
      waveformData: stem.waveformData,
    };
  }, []);

  const reset = useCallback(() => {
    stopPreview();
    stems.forEach(s => URL.revokeObjectURL(s.url));
    setStems([]);
    setProgress(0);
  }, [stems, stopPreview]);

  return {
    isProcessing,
    progress,
    stems,
    previewStemId,
    separateStems,
    previewStem,
    stopPreview,
    exportStemAsTrack,
    reset,
  };
}

function generateWaveform(buffer: AudioBuffer, samples: number): number[] {
  const data = buffer.getChannelData(0);
  const blockSize = Math.floor(data.length / samples);
  const waveform: number[] = [];
  for (let i = 0; i < samples; i++) {
    let sum = 0;
    for (let j = 0; j < blockSize; j++) {
      sum += Math.abs(data[i * blockSize + j]);
    }
    waveform.push(sum / blockSize);
  }
  const max = Math.max(...waveform, 0.01);
  return waveform.map(v => v / max);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

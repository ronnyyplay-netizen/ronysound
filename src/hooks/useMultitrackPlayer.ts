import { useState, useRef, useCallback, useEffect } from 'react';
import type { AudioTrack } from './useAudioRecorder';
import type { TrackEQSettings } from '@/components/TrackList';

export interface TimelineTrack {
  trackId: string;
  startTime: number; // offset in seconds from timeline start
  muted: boolean;
  solo: boolean;
}

interface TrackAudioNodes {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  bassFilter: BiquadFilterNode;
  midFilter: BiquadFilterNode;
  trebleFilter: BiquadFilterNode;
}

export function useMultitrackPlayer() {
  const [isTimelinePlaying, setIsTimelinePlaying] = useState(false);
  const [timelinePosition, setTimelinePosition] = useState(0);
  const [timelineDuration, setTimelineDuration] = useState(0);
  const [timelineTracks, setTimelineTracks] = useState<TimelineTrack[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<Map<string, TrackAudioNodes>>(new Map());
  const decodedBuffersRef = useRef<Map<string, AudioBuffer>>(new Map());
  const playbackStartTimeRef = useRef(0);
  const playbackOffsetRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);

  const addToTimeline = useCallback((track: AudioTrack) => {
    setTimelineTracks(prev => {
      if (prev.find(t => t.trackId === track.id)) return prev;
      return [...prev, { trackId: track.id, startTime: 0, muted: false, solo: false }];
    });
  }, []);

  const removeFromTimeline = useCallback((trackId: string) => {
    setTimelineTracks(prev => prev.filter(t => t.trackId !== trackId));
  }, []);

  const updateTimelineTrack = useCallback((trackId: string, updates: Partial<TimelineTrack>) => {
    setTimelineTracks(prev => prev.map(t => t.trackId === trackId ? { ...t, ...updates } : t));
  }, []);

  const toggleMute = useCallback((trackId: string) => {
    setTimelineTracks(prev => prev.map(t => t.trackId === trackId ? { ...t, muted: !t.muted } : t));
  }, []);

  const toggleSolo = useCallback((trackId: string) => {
    setTimelineTracks(prev => prev.map(t => t.trackId === trackId ? { ...t, solo: !t.solo } : t));
  }, []);

  // Decode audio buffers
  const decodeTrack = useCallback(async (track: AudioTrack) => {
    if (decodedBuffersRef.current.has(track.id)) return;
    const ctx = new AudioContext();
    const arrayBuffer = await track.blob.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    decodedBuffersRef.current.set(track.id, audioBuffer);
    ctx.close();
  }, []);

  // Calculate total timeline duration
  useEffect(() => {
    let maxEnd = 0;
    timelineTracks.forEach(tt => {
      const buf = decodedBuffersRef.current.get(tt.trackId);
      if (buf) {
        maxEnd = Math.max(maxEnd, tt.startTime + buf.duration);
      }
    });
    setTimelineDuration(maxEnd);
  }, [timelineTracks]);

  const applyEQToNodes = useCallback((trackId: string, eq: TrackEQSettings) => {
    const nodes = activeNodesRef.current.get(trackId);
    if (!nodes) return;
    nodes.bassFilter.gain.value = eq.bass;
    nodes.midFilter.gain.value = eq.mid;
    nodes.trebleFilter.gain.value = eq.treble;
    nodes.gainNode.gain.value = Math.pow(10, eq.volume / 20);
  }, []);

  const updatePositionLoop = useCallback(() => {
    if (!audioContextRef.current) return;
    const elapsed = audioContextRef.current.currentTime - playbackStartTimeRef.current + playbackOffsetRef.current;
    setTimelinePosition(elapsed);
    if (elapsed < timelineDuration) {
      animFrameRef.current = requestAnimationFrame(updatePositionLoop);
    } else {
      setIsTimelinePlaying(false);
      setTimelinePosition(0);
    }
  }, [timelineDuration]);

  const playTimeline = useCallback(async (
    tracks: AudioTrack[],
    trackEQs: Record<string, TrackEQSettings>,
    fromPosition = 0
  ) => {
    stopTimeline();

    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const hasSolo = timelineTracks.some(t => t.solo);

    for (const tt of timelineTracks) {
      const track = tracks.find(t => t.id === tt.trackId);
      if (!track) continue;

      // Decode if needed
      if (!decodedBuffersRef.current.has(tt.trackId)) {
        await decodeTrack(track);
      }
      const buffer = decodedBuffersRef.current.get(tt.trackId);
      if (!buffer) continue;

      const shouldPlay = hasSolo ? tt.solo : !tt.muted;
      if (!shouldPlay) continue;

      // Calculate offset within this track
      const trackOffset = Math.max(0, fromPosition - tt.startTime);
      if (trackOffset >= buffer.duration) continue;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = 200;

      const midFilter = ctx.createBiquadFilter();
      midFilter.type = 'peaking';
      midFilter.frequency.value = 1000;
      midFilter.Q.value = 1;

      const trebleFilter = ctx.createBiquadFilter();
      trebleFilter.type = 'highshelf';
      trebleFilter.frequency.value = 4000;

      const gainNode = ctx.createGain();

      // Apply EQ
      const eq = trackEQs[tt.trackId] ?? { bass: 0, mid: 0, treble: 0, volume: 0 };
      bassFilter.gain.value = eq.bass;
      midFilter.gain.value = eq.mid;
      trebleFilter.gain.value = eq.treble;
      gainNode.gain.value = Math.pow(10, eq.volume / 20);

      source.connect(bassFilter);
      bassFilter.connect(midFilter);
      midFilter.connect(trebleFilter);
      trebleFilter.connect(gainNode);
      gainNode.connect(ctx.destination);

      activeNodesRef.current.set(tt.trackId, { source, gainNode, bassFilter, midFilter, trebleFilter });

      const delay = Math.max(0, tt.startTime - fromPosition);
      source.start(ctx.currentTime + delay, trackOffset);
    }

    playbackStartTimeRef.current = ctx.currentTime;
    playbackOffsetRef.current = fromPosition;
    setIsTimelinePlaying(true);
    setTimelinePosition(fromPosition);
    animFrameRef.current = requestAnimationFrame(updatePositionLoop);
  }, [timelineTracks, decodeTrack, updatePositionLoop]);

  const stopTimeline = useCallback(() => {
    activeNodesRef.current.forEach(nodes => {
      try { nodes.source.stop(); } catch {}
    });
    activeNodesRef.current.clear();
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setIsTimelinePlaying(false);
  }, []);

  const seekTimeline = useCallback((position: number) => {
    setTimelinePosition(position);
  }, []);

  return {
    isTimelinePlaying,
    timelinePosition,
    timelineDuration,
    timelineTracks,
    addToTimeline,
    removeFromTimeline,
    updateTimelineTrack,
    toggleMute,
    toggleSolo,
    playTimeline,
    stopTimeline,
    seekTimeline,
    applyEQToNodes,
    decodeTrack,
  };
}

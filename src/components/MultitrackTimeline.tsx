import { useRef, useEffect, useCallback } from 'react';
import { Play, Square, Volume2, VolumeX, Star, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import type { AudioTrack } from '@/hooks/useAudioRecorder';
import type { TimelineTrack } from '@/hooks/useMultitrackPlayer';
import type { TrackEQSettings } from '@/components/TrackList';

interface MultitrackTimelineProps {
  tracks: AudioTrack[];
  timelineTracks: TimelineTrack[];
  trackEQs: Record<string, TrackEQSettings>;
  isPlaying: boolean;
  position: number;
  duration: number;
  onPlay: () => void;
  onStop: () => void;
  onSeek: (pos: number) => void;
  onAddTrack: (track: AudioTrack) => void;
  onRemoveTrack: (trackId: string) => void;
  onToggleMute: (trackId: string) => void;
  onToggleSolo: (trackId: string) => void;
  onUpdateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  onEQChange: (trackId: string, eq: TrackEQSettings) => void;
}

const TRACK_HEIGHT = 56;
const PIXELS_PER_SECOND = 80;
const HEADER_WIDTH = 160;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${String(secs).padStart(2, '0')}.${ms}`;
}

const MultitrackTimeline = ({
  tracks,
  timelineTracks,
  trackEQs,
  isPlaying,
  position,
  duration,
  onPlay,
  onStop,
  onSeek,
  onAddTrack,
  onRemoveTrack,
  onToggleMute,
  onToggleSolo,
  onUpdateTrack,
  onEQChange,
}: MultitrackTimelineProps) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const availableTracks = tracks.filter(t => !timelineTracks.find(tt => tt.trackId === t.id));
  const totalWidth = Math.max(duration * PIXELS_PER_SECOND, 800);

  // Draw timeline ruler and waveforms
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Background
    ctx.fillStyle = 'hsl(220, 15%, 8%)';
    ctx.fillRect(0, 0, w, h);

    // Time ruler
    ctx.fillStyle = 'hsl(220, 15%, 14%)';
    ctx.fillRect(0, 0, w, 24);

    ctx.strokeStyle = 'hsl(220, 15%, 25%)';
    ctx.fillStyle = 'hsl(215, 15%, 50%)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';

    const totalSeconds = Math.ceil(w / PIXELS_PER_SECOND) + 1;
    for (let s = 0; s <= totalSeconds; s++) {
      const x = s * PIXELS_PER_SECOND;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 24);
      ctx.stroke();

      ctx.fillText(formatTime(s), x, 16);

      // Sub-divisions
      for (let sub = 1; sub < 4; sub++) {
        const sx = x + (sub * PIXELS_PER_SECOND / 4);
        ctx.beginPath();
        ctx.moveTo(sx, 16);
        ctx.lineTo(sx, 24);
        ctx.stroke();
      }
    }

    // Track lanes
    timelineTracks.forEach((tt, idx) => {
      const y = 24 + idx * TRACK_HEIGHT;
      const track = tracks.find(t => t.id === tt.trackId);
      if (!track) return;

      // Lane background
      ctx.fillStyle = idx % 2 === 0 ? 'hsl(220, 15%, 10%)' : 'hsl(220, 15%, 9%)';
      ctx.fillRect(0, y, w, TRACK_HEIGHT);

      // Lane border
      ctx.strokeStyle = 'hsl(220, 15%, 16%)';
      ctx.beginPath();
      ctx.moveTo(0, y + TRACK_HEIGHT);
      ctx.lineTo(w, y + TRACK_HEIGHT);
      ctx.stroke();

      // Waveform block
      const blockX = tt.startTime * PIXELS_PER_SECOND;
      const blockW = track.duration * PIXELS_PER_SECOND;
      const blockY = y + 4;
      const blockH = TRACK_HEIGHT - 8;

      // Block background
      const alpha = tt.muted ? 0.2 : 0.4;
      ctx.fillStyle = `hsla(185, 80%, 50%, ${alpha})`;
      ctx.roundRect(blockX, blockY, blockW, blockH, 4);
      ctx.fill();

      // Block border
      ctx.strokeStyle = tt.muted ? 'hsl(185, 60%, 30%)' : 'hsl(185, 80%, 50%)';
      ctx.lineWidth = 1;
      ctx.roundRect(blockX, blockY, blockW, blockH, 4);
      ctx.stroke();

      // Mini waveform
      if (track.waveformData.length > 0) {
        const centerY = blockY + blockH / 2;
        const maxBarH = blockH * 0.7;
        const barW = blockW / track.waveformData.length;

        ctx.fillStyle = tt.muted ? 'hsl(185, 40%, 30%)' : 'hsl(185, 80%, 55%)';
        track.waveformData.forEach((v, i) => {
          const bx = blockX + i * barW;
          const bh = v * maxBarH;
          ctx.fillRect(bx, centerY - bh / 2, Math.max(barW - 0.5, 0.5), bh || 0.5);
        });
      }
    });

    // Playhead
    if (position > 0 || isPlaying) {
      const px = position * PIXELS_PER_SECOND;
      ctx.strokeStyle = 'hsl(0, 80%, 55%)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'hsl(0, 80%, 55%)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Playhead triangle
      ctx.fillStyle = 'hsl(0, 80%, 55%)';
      ctx.beginPath();
      ctx.moveTo(px - 5, 0);
      ctx.lineTo(px + 5, 0);
      ctx.lineTo(px, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [tracks, timelineTracks, position, isPlaying, duration]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const newPos = x / PIXELS_PER_SECOND;
    onSeek(Math.max(0, Math.min(newPos, duration)));
  }, [duration, onSeek]);

  const defaultEQ: TrackEQSettings = { bass: 0, mid: 0, treble: 0, volume: 0 };

  return (
    <div className="border-t border-border bg-card flex flex-col">
      {/* Timeline toolbar */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Timeline Multipista
          </h2>
          <span className="text-xs text-muted-foreground font-mono">
            {timelineTracks.length} faixa{timelineTracks.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground tabular-nums">
            {formatTime(position)} / {formatTime(duration)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={isPlaying ? onStop : onPlay}
            disabled={timelineTracks.length === 0}
            className="gap-1.5 h-7"
          >
            {isPlaying ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
            {isPlaying ? 'Parar' : 'Tocar Tudo'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ height: Math.max(24 + timelineTracks.length * TRACK_HEIGHT + 40, 140) }}>
        {/* Track headers */}
        <div className="flex-shrink-0 border-r border-border bg-card" style={{ width: HEADER_WIDTH }}>
          <div className="h-6 border-b border-border bg-secondary/30" />
          {timelineTracks.map((tt) => {
            const track = tracks.find(t => t.id === tt.trackId);
            if (!track) return null;
            const eq = trackEQs[tt.trackId] ?? defaultEQ;
            return (
              <div
                key={tt.trackId}
                className="border-b border-border px-2 py-1 flex flex-col justify-center"
                style={{ height: TRACK_HEIGHT }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground truncate flex-1">{track.name}</span>
                  <button onClick={() => onRemoveTrack(tt.trackId)} className="p-0.5 text-muted-foreground hover:text-recording transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <button
                    onClick={() => onToggleMute(tt.trackId)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      tt.muted ? 'bg-destructive/20 text-destructive' : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    M
                  </button>
                  <button
                    onClick={() => onToggleSolo(tt.trackId)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      tt.solo ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    S
                  </button>
                  <div className="flex items-center gap-1 flex-1 ml-1">
                    <VolumeX className="w-2.5 h-2.5 text-muted-foreground" />
                    <Slider
                      value={[eq.volume]}
                      onValueChange={([v]) => onEQChange(tt.trackId, { ...eq, volume: v })}
                      min={-30}
                      max={6}
                      step={0.5}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {/* Add track button */}
          {availableTracks.length > 0 && (
            <div className="px-2 py-2">
              <select
                onChange={(e) => {
                  const track = tracks.find(t => t.id === e.target.value);
                  if (track) onAddTrack(track);
                  e.target.value = '';
                }}
                className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs text-muted-foreground cursor-pointer"
                defaultValue=""
              >
                <option value="" disabled>+ Adicionar faixa</option>
                {availableTracks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Timeline canvas */}
        <div className="flex-1 overflow-x-auto scrollbar-thin" ref={timelineRef}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="cursor-crosshair"
            style={{
              width: totalWidth,
              height: 24 + timelineTracks.length * TRACK_HEIGHT,
              minHeight: 100,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default MultitrackTimeline;

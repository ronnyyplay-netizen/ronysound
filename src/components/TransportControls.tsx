import { Play, Pause, Square, Circle, SkipBack, SkipForward, Download } from 'lucide-react';
import { motion } from 'framer-motion';

interface TransportControlsProps {
  isRecording: boolean;
  isPlaying: boolean;
  recordingTime: number;
  playbackTime: number;
  currentTrackDuration: number | null;
  hasTrack: boolean;
  onRecord: () => void;
  onStop: () => void;
  onPlay: () => void;
  onPause: () => void;
  onStopPlayback: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
}

const TransportControls = ({
  isRecording,
  isPlaying,
  recordingTime,
  playbackTime,
  currentTrackDuration,
  hasTrack,
  onRecord,
  onStop,
  onPlay,
  onPause,
  onStopPlayback,
}: TransportControlsProps) => {
  const displayTime = isRecording ? recordingTime : playbackTime;
  const totalTime = isRecording ? recordingTime : (currentTrackDuration ?? 0);

  return (
    <div className="flex-1 py-2">
      <div className="flex items-center justify-between">
        {/* Timecode */}
        <div className="font-mono text-2xl font-semibold tracking-wider text-foreground tabular-nums min-w-[160px]">
          {formatTime(displayTime)}
          <span className="text-muted-foreground text-sm ml-2">
            / {formatTime(totalTime)}
          </span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onStopPlayback}
            disabled={!isPlaying && !isRecording}
            className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-30"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          <button
            onClick={isRecording ? onStop : onStopPlayback}
            disabled={!isPlaying && !isRecording}
            className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-30"
          >
            <Square className="w-4 h-4" />
          </button>

          {isPlaying ? (
            <button
              onClick={onPause}
              className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground glow-primary transition-all hover:scale-105"
            >
              <Pause className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={onPlay}
              disabled={!hasTrack || isRecording}
              className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground glow-primary transition-all hover:scale-105 disabled:opacity-30 disabled:shadow-none"
            >
              <Play className="w-5 h-5 ml-0.5" />
            </button>
          )}

          {/* Record button */}
          <motion.button
            onClick={isRecording ? onStop : onRecord}
            animate={isRecording ? { scale: [1, 1.05, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all hover:scale-105 ${
              isRecording
                ? 'bg-recording glow-recording'
                : 'bg-secondary hover:bg-recording/20'
            }`}
          >
            <Circle className={`w-5 h-5 ${isRecording ? 'text-foreground fill-current animate-pulse-recording' : 'text-recording'}`} />
          </motion.button>

          <button
            disabled
            className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-30"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Status */}
        <div className="min-w-[160px] text-right">
          {isRecording && (
            <div className="flex items-center gap-2 justify-end">
              <span className="w-2 h-2 rounded-full bg-recording animate-pulse-recording" />
              <span className="text-sm font-medium text-recording">GRAVANDO</span>
            </div>
          )}
          {isPlaying && (
            <div className="flex items-center gap-2 justify-end">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm font-medium text-primary">TOCANDO</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransportControls;

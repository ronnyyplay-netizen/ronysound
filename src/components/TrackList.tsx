import { Play, Trash2, Download, Edit2, Check, Undo2, Redo2 } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AudioTrack } from '@/hooks/useAudioRecorder';
import TrackEQ from './TrackEQ';
import TrackEffects, { defaultFX } from './TrackEffects';
import type { TrackFXSettings } from './TrackEffects';

export interface TrackEQSettings {
  bass: number;
  mid: number;
  treble: number;
  volume: number;
}

interface TrackListProps {
  tracks: AudioTrack[];
  currentTrackIndex: number | null;
  isPlaying: boolean;
  trackEQs: Record<string, TrackEQSettings>;
  trackFXs: Record<string, TrackFXSettings>;
  onPlay: (index: number) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDownload: (id: string) => void;
  onSelect: (index: number) => void;
  onEQChange: (trackId: string, eq: TrackEQSettings) => void;
  onFXChange: (trackId: string, fx: TrackFXSettings) => void;
  onApplyPreset?: (trackId: string, preset: import('./TrackEffects').VoicePreset) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

const TrackList = ({ tracks, currentTrackIndex, isPlaying, trackEQs, trackFXs, onPlay, onDelete, onRename, onDownload, onSelect, onEQChange, onFXChange, onApplyPreset, canUndo, canRedo, onUndo, onRedo }: TrackListProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const startEdit = (track: AudioTrack) => {
    setEditingId(track.id);
    setEditName(track.name);
  };

  const confirmEdit = (id: string) => {
    if (editName.trim()) onRename(id, editName.trim());
    setEditingId(null);
  };

  const defaultEQ: TrackEQSettings = { bass: 0, mid: 0, treble: 0, volume: 0 };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Faixas Gravadas
        </h2>
        <span className="text-xs text-muted-foreground font-mono">{tracks.length} faixa{tracks.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {tracks.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Nenhuma gravação ainda. Clique em gravar para começar.
          </div>
        ) : (
          <AnimatePresence>
            {tracks.map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div
                  onClick={() => onSelect(index)}
                  className={`flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors ${
                    currentTrackIndex === index
                      ? 'bg-primary/10 border-l-2 border-l-primary'
                      : 'hover:bg-secondary/50'
                  }`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); onPlay(index); }}
                    className="w-7 h-7 rounded-md bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors flex-shrink-0"
                  >
                    <Play className="w-3 h-3 ml-0.5" />
                  </button>

                  <div className="flex-1 min-w-0">
                    {editingId === track.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && confirmEdit(track.id)}
                          className="bg-secondary border border-border rounded px-2 py-0.5 text-sm text-foreground outline-none focus:border-primary w-full"
                          autoFocus
                        />
                        <button onClick={() => confirmEdit(track.id)} className="text-primary">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm font-medium text-foreground truncate block">{track.name}</span>
                    )}
                  </div>

                  <span className="text-xs font-mono text-muted-foreground tabular-nums flex-shrink-0">
                    {formatDuration(track.duration)}
                  </span>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={(e) => { e.stopPropagation(); startEdit(track); }} className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDownload(track.id); }} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                      <Download className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(track.id); }} className="p-1 text-muted-foreground hover:text-recording transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {currentTrackIndex === index && (
                  <>
                    <TrackEQ
                      trackId={track.id}
                      eq={trackEQs[track.id] ?? defaultEQ}
                      onChange={onEQChange}
                    />
                    <TrackEffects
                      trackId={track.id}
                      fx={trackFXs[track.id] ?? defaultFX}
                      onChange={onFXChange}
                    />
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default TrackList;

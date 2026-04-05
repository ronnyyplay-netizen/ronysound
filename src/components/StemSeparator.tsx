import { useState } from 'react';
import { Play, Pause, Download, PlusCircle, Loader2, Scissors } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import type { AudioTrack } from '@/hooks/useAudioRecorder';
import { useStemSeparator, STEM_TYPES, type StemResult } from '@/hooks/useStemSeparator';

interface StemSeparatorProps {
  track: AudioTrack | null;
  onAddStemAsTrack: (track: AudioTrack) => void;
}

const StemSeparator = ({ track, onAddStemAsTrack }: StemSeparatorProps) => {
  const {
    isProcessing,
    progress,
    stems,
    previewStemId,
    separateStems,
    previewStem,
    exportStemAsTrack,
    reset,
  } = useStemSeparator();

  const [selectedStems, setSelectedStems] = useState<string[]>(STEM_TYPES.map(s => s.id));

  const toggleStem = (id: string) => {
    setSelectedStems(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSeparate = () => {
    if (!track) return;
    reset();
    separateStems(track, selectedStems);
  };

  const handleAddToTracks = (stem: StemResult) => {
    if (!track) return;
    const newTrack = exportStemAsTrack(stem, track.name);
    onAddStemAsTrack(newTrack);
  };

  const handleDownload = (stem: StemResult) => {
    const a = document.createElement('a');
    a.href = stem.url;
    a.download = `${track?.name ?? 'stem'} - ${stem.label}.wav`;
    a.click();
  };

  if (!track) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-8">
        Selecione uma faixa para separar instrumentos e vocal.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground">
          Separar: <span className="text-primary">{track.name}</span>
        </h3>
      </div>

      {/* Stem selection */}
      <div className="flex flex-wrap gap-3">
        {STEM_TYPES.map(stem => (
          <label
            key={stem.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
              selectedStems.includes(stem.id)
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border bg-secondary/30 text-muted-foreground'
            }`}
          >
            <Checkbox
              checked={selectedStems.includes(stem.id)}
              onCheckedChange={() => toggleStem(stem.id)}
            />
            <span className="text-base">{stem.icon}</span>
            <span className="text-sm font-medium">{stem.label}</span>
          </label>
        ))}
      </div>

      <Button
        onClick={handleSeparate}
        disabled={isProcessing || selectedStems.length === 0}
        className="gap-2"
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Scissors className="w-4 h-4" />
        )}
        {isProcessing ? 'Processando...' : 'Separar Faixas'}
      </Button>

      {/* Progress */}
      {isProcessing && (
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground">{progress}% processado</p>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {stems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Faixas Separadas
            </h4>
            {stems.map(stem => {
              const stemType = STEM_TYPES.find(s => s.id === stem.stemId);
              return (
                <motion.div
                  key={stem.stemId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/40 border border-border"
                >
                  <span className="text-lg">{stemType?.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{stem.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {stem.duration.toFixed(1)}s
                    </p>
                  </div>

                  {/* Mini waveform */}
                  <div className="w-24 h-8 flex items-end gap-px flex-shrink-0">
                    {stem.waveformData.filter((_, i) => i % 4 === 0).map((v, i) => (
                      <div
                        key={i}
                        className="flex-1 bg-primary/60 rounded-t-sm min-h-[1px]"
                        style={{ height: `${v * 100}%` }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => previewStem(stem.stemId)}
                    >
                      {previewStemId === stem.stemId ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDownload(stem)}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-primary"
                      onClick={() => handleAddToTracks(stem)}
                      title="Adicionar como faixa"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {stems.length > 0 && (
        <p className="text-xs text-muted-foreground italic">
          💡 A separação usa filtros de frequência. Para separação profissional com IA, considere serviços como LALAL.AI ou Moises.ai.
        </p>
      )}
    </div>
  );
};

export default StemSeparator;

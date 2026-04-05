import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface TrackEQProps {
  trackId: string;
  eq: { bass: number; mid: number; treble: number; volume: number };
  onChange: (trackId: string, eq: { bass: number; mid: number; treble: number; volume: number }) => void;
}

import { forwardRef } from 'react';

const EQSlider = forwardRef<HTMLDivElement, {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string;
}>(({ label, value, onChange, min = -12, max = 12, unit = 'dB' }, ref) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-muted-foreground w-14 text-right font-mono">{label}</span>
    <Slider
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      min={min}
      max={max}
      step={0.5}
      className="flex-1"
    />
    <span className="text-xs font-mono text-foreground w-16 tabular-nums">
      {value > 0 ? '+' : ''}{value.toFixed(1)} {unit}
    </span>
  </div>
));
EQSlider.displayName = 'EQSlider';

const TrackEQ = ({ trackId, eq, onChange }: TrackEQProps) => {
  const [expanded, setExpanded] = useState(false);

  const update = (key: keyof typeof eq, value: number) => {
    onChange(trackId, { ...eq, [key]: value });
  };

  return (
    <div className="border-t border-border/50 bg-secondary/30">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="font-medium uppercase tracking-wider">EQ & Volume</span>
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          <EQSlider label="Volume" value={eq.volume} onChange={(v) => update('volume', v)} min={-30} max={6} unit="dB" />
          <EQSlider label="Grave" value={eq.bass} onChange={(v) => update('bass', v)} />
          <EQSlider label="Médio" value={eq.mid} onChange={(v) => update('mid', v)} />
          <EQSlider label="Agudo" value={eq.treble} onChange={(v) => update('treble', v)} />
        </div>
      )}
    </div>
  );
};

export default TrackEQ;

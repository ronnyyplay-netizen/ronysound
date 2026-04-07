import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface TrackFXSettings {
  // Reverb
  reverbMix: number; // 0-100%
  reverbDecay: number; // 0.1-5s
  // Delay
  delayTime: number; // 0-1s
  delayFeedback: number; // 0-90%
  delayMix: number; // 0-100%
  // Compressor
  compThreshold: number; // -60 to 0 dB
  compRatio: number; // 1-20
  compAttack: number; // 0-1s
  compRelease: number; // 0.01-1s
  // Chorus
  chorusRate: number; // 0.1-8 Hz
  chorusDepth: number; // 0-20ms
  chorusMix: number; // 0-100%
  // Voice Enhancement
  deEsser: number; // 0-100%
  presence: number; // -12 to +12 dB
  warmth: number; // -12 to +12 dB
  breathControl: number; // 0-100%
}

export const defaultFX: TrackFXSettings = {
  reverbMix: 0,
  reverbDecay: 1.5,
  delayTime: 0,
  delayFeedback: 30,
  delayMix: 0,
  compThreshold: -24,
  compRatio: 3,
  compAttack: 0.01,
  compRelease: 0.25,
  chorusRate: 1.5,
  chorusDepth: 5,
  chorusMix: 0,
  deEsser: 0,
  presence: 0,
  warmth: 0,
  breathControl: 0,
};

interface TrackEffectsProps {
  trackId: string;
  fx: TrackFXSettings;
  onChange: (trackId: string, fx: TrackFXSettings) => void;
}

const FXSlider = ({ label, value, onChange, min, max, step = 0.1, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string;
}) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] text-muted-foreground w-20 text-right font-mono truncate">{label}</span>
    <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} className="flex-1" />
    <span className="text-[10px] font-mono text-foreground w-14 tabular-nums text-right">
      {value.toFixed(step >= 1 ? 0 : step >= 0.1 ? 1 : 2)}{unit}
    </span>
  </div>
);

const TrackEffects = ({ trackId, fx, onChange }: TrackEffectsProps) => {
  const [section, setSection] = useState<string | null>(null);

  const update = (key: keyof TrackFXSettings, value: number) => {
    onChange(trackId, { ...fx, [key]: value });
  };

  const toggle = (name: string) => setSection(section === name ? null : name);

  const sections = [
    {
      id: 'reverb', label: '🔊 Reverb',
      content: (
        <>
          <FXSlider label="Mix" value={fx.reverbMix} onChange={v => update('reverbMix', v)} min={0} max={100} step={1} unit="%" />
          <FXSlider label="Decay" value={fx.reverbDecay} onChange={v => update('reverbDecay', v)} min={0.1} max={5} step={0.1} unit="s" />
        </>
      ),
    },
    {
      id: 'delay', label: '⏱️ Delay',
      content: (
        <>
          <FXSlider label="Tempo" value={fx.delayTime} onChange={v => update('delayTime', v)} min={0} max={1} step={0.01} unit="s" />
          <FXSlider label="Feedback" value={fx.delayFeedback} onChange={v => update('delayFeedback', v)} min={0} max={90} step={1} unit="%" />
          <FXSlider label="Mix" value={fx.delayMix} onChange={v => update('delayMix', v)} min={0} max={100} step={1} unit="%" />
        </>
      ),
    },
    {
      id: 'compressor', label: '📊 Compressor',
      content: (
        <>
          <FXSlider label="Threshold" value={fx.compThreshold} onChange={v => update('compThreshold', v)} min={-60} max={0} step={1} unit="dB" />
          <FXSlider label="Ratio" value={fx.compRatio} onChange={v => update('compRatio', v)} min={1} max={20} step={0.5} unit=":1" />
          <FXSlider label="Attack" value={fx.compAttack} onChange={v => update('compAttack', v)} min={0} max={1} step={0.001} unit="s" />
          <FXSlider label="Release" value={fx.compRelease} onChange={v => update('compRelease', v)} min={0.01} max={1} step={0.01} unit="s" />
        </>
      ),
    },
    {
      id: 'chorus', label: '🎵 Chorus',
      content: (
        <>
          <FXSlider label="Rate" value={fx.chorusRate} onChange={v => update('chorusRate', v)} min={0.1} max={8} step={0.1} unit="Hz" />
          <FXSlider label="Depth" value={fx.chorusDepth} onChange={v => update('chorusDepth', v)} min={0} max={20} step={0.5} unit="ms" />
          <FXSlider label="Mix" value={fx.chorusMix} onChange={v => update('chorusMix', v)} min={0} max={100} step={1} unit="%" />
        </>
      ),
    },
    {
      id: 'voice', label: '🎤 Voz',
      content: (
        <>
          <FXSlider label="De-Esser" value={fx.deEsser} onChange={v => update('deEsser', v)} min={0} max={100} step={1} unit="%" />
          <FXSlider label="Presença" value={fx.presence} onChange={v => update('presence', v)} min={-12} max={12} step={0.5} unit="dB" />
          <FXSlider label="Calor" value={fx.warmth} onChange={v => update('warmth', v)} min={-12} max={12} step={0.5} unit="dB" />
          <FXSlider label="Respiração" value={fx.breathControl} onChange={v => update('breathControl', v)} min={0} max={100} step={1} unit="%" />
        </>
      ),
    },
  ];

  return (
    <div className="border-t border-border/50 bg-secondary/20">
      <div className="flex flex-wrap gap-1 px-4 py-1.5">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => toggle(s.id)}
            className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${
              section === s.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {section && (
        <div className="px-4 pb-2 space-y-1.5">
          {sections.find(s => s.id === section)?.content}
        </div>
      )}
    </div>
  );
};

export default TrackEffects;

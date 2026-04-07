import { useState } from 'react';
import { Slider } from '@/components/ui/slider';

export interface TrackFXSettings {
  reverbMix: number;
  reverbDecay: number;
  delayTime: number;
  delayFeedback: number;
  delayMix: number;
  compThreshold: number;
  compRatio: number;
  compAttack: number;
  compRelease: number;
  chorusRate: number;
  chorusDepth: number;
  chorusMix: number;
  deEsser: number;
  presence: number;
  warmth: number;
  breathControl: number;
}

export const defaultFX: TrackFXSettings = {
  reverbMix: 0, reverbDecay: 1.5,
  delayTime: 0, delayFeedback: 30, delayMix: 0,
  compThreshold: -24, compRatio: 3, compAttack: 0.01, compRelease: 0.25,
  chorusRate: 1.5, chorusDepth: 5, chorusMix: 0,
  deEsser: 0, presence: 0, warmth: 0, breathControl: 0,
};

export interface VoicePreset {
  name: string;
  emoji: string;
  fx: Partial<TrackFXSettings>;
  eq: { bass: number; mid: number; treble: number; volume: number };
}

export const voicePresets: VoicePreset[] = [
  {
    name: 'Voz Pop',
    emoji: '🎶',
    fx: { compThreshold: -20, compRatio: 4, compAttack: 0.005, compRelease: 0.15, presence: 4, warmth: 2, deEsser: 45, breathControl: 30, reverbMix: 18, reverbDecay: 1.2, chorusMix: 8, chorusRate: 1.2, chorusDepth: 4 },
    eq: { bass: 1, mid: 2, treble: 3, volume: 0 },
  },
  {
    name: 'Voz Rock',
    emoji: '🎸',
    fx: { compThreshold: -18, compRatio: 6, compAttack: 0.003, compRelease: 0.1, presence: 6, warmth: 5, deEsser: 30, breathControl: 20, reverbMix: 12, reverbDecay: 0.8, delayMix: 8, delayTime: 0.12, delayFeedback: 20 },
    eq: { bass: 3, mid: 4, treble: 2, volume: 1 },
  },
  {
    name: 'Podcast',
    emoji: '🎙️',
    fx: { compThreshold: -22, compRatio: 5, compAttack: 0.008, compRelease: 0.2, presence: 3, warmth: 4, deEsser: 60, breathControl: 55, reverbMix: 0, chorusMix: 0, delayMix: 0 },
    eq: { bass: -2, mid: 3, treble: 1, volume: 2 },
  },
  {
    name: 'Rádio',
    emoji: '📻',
    fx: { compThreshold: -16, compRatio: 8, compAttack: 0.002, compRelease: 0.08, presence: 5, warmth: 3, deEsser: 50, breathControl: 40, reverbMix: 5, reverbDecay: 0.5 },
    eq: { bass: -3, mid: 5, treble: 4, volume: 3 },
  },
  {
    name: 'Balada',
    emoji: '🌙',
    fx: { compThreshold: -26, compRatio: 3, compAttack: 0.015, compRelease: 0.3, presence: 2, warmth: 6, deEsser: 35, breathControl: 15, reverbMix: 35, reverbDecay: 2.5, delayMix: 12, delayTime: 0.25, delayFeedback: 25, chorusMix: 15, chorusRate: 0.8, chorusDepth: 6 },
    eq: { bass: 2, mid: 1, treble: 2, volume: -1 },
  },
  {
    name: 'Gospel',
    emoji: '✝️',
    fx: { compThreshold: -22, compRatio: 4, compAttack: 0.01, compRelease: 0.2, presence: 5, warmth: 3, deEsser: 40, breathControl: 25, reverbMix: 30, reverbDecay: 2.0, delayMix: 5, delayTime: 0.18, delayFeedback: 15 },
    eq: { bass: 1, mid: 3, treble: 3, volume: 0 },
  },
];

interface TrackEffectsProps {
  trackId: string;
  fx: TrackFXSettings;
  onChange: (trackId: string, fx: TrackFXSettings) => void;
  onApplyPreset?: (trackId: string, preset: VoicePreset) => void;
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

const TrackEffects = ({ trackId, fx, onChange, onApplyPreset }: TrackEffectsProps) => {
  const [section, setSection] = useState<string | null>(null);

  const update = (key: keyof TrackFXSettings, value: number) => {
    onChange(trackId, { ...fx, [key]: value });
  };

  const toggle = (name: string) => setSection(section === name ? null : name);

  const sections = [
    {
      id: 'presets', label: '⭐ Presets',
      content: (
        <div className="flex flex-wrap gap-1.5">
          {voicePresets.map(p => (
            <button
              key={p.name}
              onClick={() => onApplyPreset?.(trackId, p)}
              className="text-[10px] px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors border border-primary/20"
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>
      ),
    },
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

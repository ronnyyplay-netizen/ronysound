import { Mic, Cable, Headphones, ShieldCheck, ShieldOff } from 'lucide-react';
import type { AudioInputSource } from '@/hooks/useAudioRecorder';

interface RecordingSettingsProps {
  inputSource: AudioInputSource;
  isMonitoring: boolean;
  noiseReduction: boolean;
  isRecording: boolean;
  onInputSourceChange: (source: AudioInputSource) => void;
  onMonitoringChange: (enabled: boolean) => void;
  onNoiseReductionChange: (enabled: boolean) => void;
}

const RecordingSettings = ({
  inputSource,
  isMonitoring,
  noiseReduction,
  isRecording,
  onInputSourceChange,
  onMonitoringChange,
  onNoiseReductionChange,
}: RecordingSettingsProps) => {
  return (
    <div className="flex items-center gap-2">
      {/* Input source toggle */}
      <div className="flex items-center bg-secondary rounded-md overflow-hidden">
        <button
          onClick={() => onInputSourceChange('microphone')}
          disabled={isRecording}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
            inputSource === 'microphone'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          } disabled:opacity-50`}
          title="Microfone"
        >
          <Mic className="w-3.5 h-3.5" />
          MIC
        </button>
        <button
          onClick={() => onInputSourceChange('line')}
          disabled={isRecording}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${
            inputSource === 'line'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          } disabled:opacity-50`}
          title="Entrada Line"
        >
          <Cable className="w-3.5 h-3.5" />
          LINE
        </button>
      </div>

      {/* Monitoring toggle */}
      <button
        onClick={() => onMonitoringChange(!isMonitoring)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
          isMonitoring
            ? 'bg-accent text-accent-foreground'
            : 'bg-secondary text-muted-foreground hover:text-foreground'
        }`}
        title="Monitoramento em tempo real"
      >
        <Headphones className="w-3.5 h-3.5" />
        MON
      </button>

      {/* Noise reduction toggle */}
      <button
        onClick={() => onNoiseReductionChange(!noiseReduction)}
        disabled={isRecording}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
          noiseReduction
            ? 'bg-green-600/20 text-green-400'
            : 'bg-secondary text-muted-foreground hover:text-foreground'
        } disabled:opacity-50`}
        title="Redução de ruído (anti-ruído ambiente, vento, vozes externas)"
      >
        {noiseReduction ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
        NR
      </button>

      {/* Format indicator */}
      <div className="text-xs text-muted-foreground font-mono ml-1">
        STEREO · 48kHz
      </div>
    </div>
  );
};

export default RecordingSettings;

interface InputMeterProps {
  level: number; // 0-1
  isRecording: boolean;
}

const InputMeter = ({ level, isRecording }: InputMeterProps) => {
  const dbLevel = level > 0 ? Math.max(-60, 20 * Math.log10(level)) : -60;
  const normalizedDb = (dbLevel + 60) / 60; // 0-1

  return (
    <div className="w-16 border-l border-border bg-card p-3 flex flex-col items-center gap-2">
      <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest" style={{ writingMode: 'vertical-rl' }}>
        Input
      </span>
      
      <div className="flex-1 w-3 rounded-full bg-muted overflow-hidden flex flex-col-reverse">
        <div
          className="w-full transition-all duration-75 rounded-full"
          style={{
            height: `${normalizedDb * 100}%`,
            background: normalizedDb > 0.85
              ? 'hsl(0, 80%, 55%)'
              : normalizedDb > 0.6
              ? 'hsl(45, 90%, 55%)'
              : 'hsl(140, 70%, 45%)',
          }}
        />
      </div>

      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
        {dbLevel > -60 ? `${dbLevel.toFixed(0)}` : '-∞'}
      </span>
      <span className="text-[10px] font-mono text-muted-foreground">dB</span>

      {isRecording && (
        <div className="w-2 h-2 rounded-full bg-recording animate-pulse-recording" />
      )}
    </div>
  );
};

export default InputMeter;

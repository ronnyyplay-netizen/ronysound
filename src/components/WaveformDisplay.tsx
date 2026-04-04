import { useRef, useEffect } from 'react';

interface WaveformDisplayProps {
  waveformData: number[];
  isRecording: boolean;
  analyserData: number[];
  playbackProgress: number; // 0-1
}

const WaveformDisplay = ({ waveformData, isRecording, analyserData, playbackProgress }: WaveformDisplayProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    const centerY = h / 2;

    // Background
    ctx.fillStyle = 'hsl(220, 15%, 8%)';
    ctx.fillRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = 'hsl(220, 15%, 14%)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < w; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, h);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();

    const data = isRecording ? analyserData : waveformData;
    if (!data.length) return;

    const barWidth = w / data.length;

    // Draw waveform
    data.forEach((value, i) => {
      const x = i * barWidth;
      const barH = value * (h * 0.8);
      const progress = i / data.length;

      if (!isRecording && playbackProgress > 0 && progress <= playbackProgress) {
        ctx.fillStyle = 'hsl(185, 80%, 50%)';
      } else if (isRecording) {
        const hue = 185 - value * 40;
        ctx.fillStyle = `hsl(${hue}, 80%, ${45 + value * 20}%)`;
      } else {
        ctx.fillStyle = 'hsl(185, 60%, 30%)';
      }

      ctx.fillRect(x, centerY - barH / 2, Math.max(barWidth - 1, 1), barH || 1);
    });

    // Playback cursor
    if (!isRecording && playbackProgress > 0) {
      const cursorX = playbackProgress * w;
      ctx.strokeStyle = 'hsl(185, 80%, 60%)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'hsl(185, 80%, 50%)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(cursorX, 0);
      ctx.lineTo(cursorX, h);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [waveformData, isRecording, analyserData, playbackProgress]);

  return (
    <div className="flex-1 p-4">
      <div className="h-full rounded-lg border border-border overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          style={{ minHeight: '200px' }}
        />
      </div>
    </div>
  );
};

export default WaveformDisplay;

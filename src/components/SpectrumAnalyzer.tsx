import { useRef, useEffect } from 'react';

interface SpectrumAnalyzerProps {
  analyserNode: AnalyserNode | null;
  isActive: boolean;
}

const SpectrumAnalyzer = ({ analyserNode, isActive }: SpectrumAnalyzerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyserNode || !isActive) {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          const rect = canvas.getBoundingClientRect();
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          ctx.scale(dpr, dpr);
          ctx.fillStyle = 'hsl(220, 15%, 8%)';
          ctx.fillRect(0, 0, rect.width, rect.height);
          ctx.fillStyle = 'hsl(220, 10%, 25%)';
          ctx.font = '11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('Espectro — reproduza uma faixa', rect.width / 2, rect.height / 2);
        }
      }
      return;
    }

    analyserNode.fftSize = 2048;
    analyserNode.smoothingTimeConstant = 0.8;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
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

      analyserNode.getByteFrequencyData(dataArray);

      // Draw frequency bars (logarithmic scale)
      const barCount = 64;
      const barWidth = (w / barCount) - 1;
      const sampleRate = analyserNode.context.sampleRate;

      for (let i = 0; i < barCount; i++) {
        // Logarithmic mapping
        const lowFreq = 20 * Math.pow(20000 / 20, i / barCount);
        const highFreq = 20 * Math.pow(20000 / 20, (i + 1) / barCount);
        const lowBin = Math.floor(lowFreq * bufferLength / (sampleRate / 2));
        const highBin = Math.min(Math.ceil(highFreq * bufferLength / (sampleRate / 2)), bufferLength - 1);

        let sum = 0;
        let count = 0;
        for (let j = lowBin; j <= highBin; j++) {
          sum += dataArray[j];
          count++;
        }
        const avg = count > 0 ? sum / count : 0;
        const normalized = avg / 255;

        const barH = normalized * h * 0.9;
        const x = i * (barWidth + 1);

        // Color gradient based on frequency
        const hue = 185 - (i / barCount) * 60;
        const lightness = 40 + normalized * 25;
        ctx.fillStyle = `hsl(${hue}, 75%, ${lightness}%)`;
        ctx.fillRect(x, h - barH, barWidth, barH);

        // Glow effect on peaks
        if (normalized > 0.7) {
          ctx.shadowColor = `hsl(${hue}, 80%, 50%)`;
          ctx.shadowBlur = 6;
          ctx.fillRect(x, h - barH, barWidth, 2);
          ctx.shadowBlur = 0;
        }
      }

      // Frequency labels
      ctx.fillStyle = 'hsl(220, 10%, 35%)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      const freqs = [50, 100, 200, 500, '1k', '2k', '5k', '10k', '20k'];
      const freqValues = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
      freqValues.forEach((f, i) => {
        const pos = Math.log(f / 20) / Math.log(20000 / 20);
        const x = pos * w;
        ctx.fillText(String(freqs[i]), x, h - 2);
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [analyserNode, isActive]);

  return (
    <div className="w-48 border-l border-border flex flex-col">
      <div className="px-2 py-1 border-b border-border">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Espectro</span>
      </div>
      <canvas ref={canvasRef} className="flex-1 w-full" />
    </div>
  );
};

export default SpectrumAnalyzer;

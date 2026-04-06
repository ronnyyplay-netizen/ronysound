import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Disc3 } from 'lucide-react';
import type { AudioTrack } from '@/hooks/useAudioRecorder';
import type { TrackEQSettings } from '@/components/TrackList';

interface MixExportDialogProps {
  tracks: AudioTrack[];
  trackEQs: Record<string, TrackEQSettings>;
}

type ExportFormat = 'wav' | 'mp3';

const defaultEQ: TrackEQSettings = { bass: 0, mid: 0, treble: 0, volume: 0 };

async function mixAndExport(
  tracks: AudioTrack[],
  trackEQs: Record<string, TrackEQSettings>,
  format: ExportFormat
): Promise<Blob> {
  // Decode all tracks
  const tempCtx = new AudioContext();
  const buffers: { buffer: AudioBuffer; eq: TrackEQSettings }[] = [];

  for (const track of tracks) {
    const arrayBuffer = await track.blob.arrayBuffer();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    buffers.push({ buffer: audioBuffer, eq: trackEQs[track.id] ?? defaultEQ });
  }
  tempCtx.close();

  // Find max length and common sample rate
  const sampleRate = buffers[0].buffer.sampleRate;
  const maxLength = Math.max(...buffers.map(b => b.buffer.length));
  const numChannels = Math.max(...buffers.map(b => b.buffer.numberOfChannels));

  // Render each track with EQ using OfflineAudioContext, then mix
  const renderedBuffers: AudioBuffer[] = [];

  for (const { buffer, eq } of buffers) {
    const offlineCtx = new OfflineAudioContext(numChannels, maxLength, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    const bassFilter = offlineCtx.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 200;
    bassFilter.gain.value = eq.bass;

    const midFilter = offlineCtx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;
    midFilter.gain.value = eq.mid;

    const trebleFilter = offlineCtx.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 4000;
    trebleFilter.gain.value = eq.treble;

    const gainNode = offlineCtx.createGain();
    gainNode.gain.value = Math.pow(10, eq.volume / 20);

    source.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(trebleFilter);
    trebleFilter.connect(gainNode);
    gainNode.connect(offlineCtx.destination);

    source.start(0);
    renderedBuffers.push(await offlineCtx.startRendering());
  }

  // Sum all rendered buffers
  const mixCtx = new OfflineAudioContext(numChannels, maxLength, sampleRate);
  for (const buf of renderedBuffers) {
    const src = mixCtx.createBufferSource();
    src.buffer = buf;
    src.connect(mixCtx.destination);
    src.start(0);
  }
  const mixedBuffer = await mixCtx.startRendering();

  if (format === 'wav') {
    return audioBufferToWav(mixedBuffer);
  } else {
    return audioBufferToMp3(mixedBuffer);
  }
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const totalLength = 44 + dataLength;
  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) channels.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function audioBufferToMp3(buffer: AudioBuffer): Promise<Blob> {
  const lamejs = await import('lamejs');
  const mp3encoder = new lamejs.Mp3Encoder(buffer.numberOfChannels, buffer.sampleRate, 192);

  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;

  const sampleBlockSize = 1152;
  const mp3Data: ArrayBuffer[] = [];

  const leftInt = new Int16Array(left.length);
  const rightInt = new Int16Array(right.length);

  for (let i = 0; i < left.length; i++) {
    leftInt[i] = Math.max(-32768, Math.min(32767, Math.round(left[i] * 32767)));
    rightInt[i] = Math.max(-32768, Math.min(32767, Math.round(right[i] * 32767)));
  }

  for (let i = 0; i < leftInt.length; i += sampleBlockSize) {
    const leftChunk = leftInt.subarray(i, i + sampleBlockSize);
    const rightChunk = rightInt.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf).buffer as ArrayBuffer);
  }

  const end = mp3encoder.flush();
  if (end.length > 0) mp3Data.push(new Uint8Array(end).buffer as ArrayBuffer);

  return new Blob(mp3Data, { type: 'audio/mp3' });
}

const MixExportDialog = ({ tracks, trackEQs }: MixExportDialogProps) => {
  const [format, setFormat] = useState<ExportFormat>('wav');
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleExport = async () => {
    if (tracks.length === 0) return;
    setExporting(true);
    try {
      const blob = await mixAndExport(tracks, trackEQs, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mixagem.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch (err) {
      console.error('Erro ao exportar mixagem:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={tracks.length < 2} className="gap-2">
          <Disc3 className="w-3.5 h-3.5" />
          Exportar Mix
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar Mixagem Completa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Todas as <span className="text-foreground font-medium">{tracks.length} faixas</span> serão mixadas com a equalização aplicada.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setFormat('wav')}
              className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${
                format === 'wav'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              WAV
              <span className="block text-xs mt-1 opacity-60">Sem perda de qualidade</span>
            </button>
            <button
              onClick={() => setFormat('mp3')}
              className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${
                format === 'mp3'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              MP3
              <span className="block text-xs mt-1 opacity-60">Menor tamanho (192kbps)</span>
            </button>
          </div>
          <Button onClick={handleExport} disabled={exporting} className="w-full">
            {exporting ? 'Exportando mixagem...' : `Exportar Mix como ${format.toUpperCase()}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MixExportDialog;

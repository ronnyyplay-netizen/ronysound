import { Mic, Music, Upload } from 'lucide-react';
import { useRef } from 'react';

interface HeaderProps {
  onImport?: (file: File) => void;
}

const Header = ({ onImport }: HeaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImport) onImport(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center justify-between px-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-primary/20 flex items-center justify-center glow-primary">
          <Music className="w-4 h-4 text-primary" />
        </div>
        <h1 className="text-lg font-bold tracking-wider text-foreground">
          RONY <span className="text-primary">SOUND</span>
        </h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Importar Áudio
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/mp3,audio/wav,audio/mpeg,audio/wave,.mp3,.wav"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Mic className="w-3.5 h-3.5" />
          <span>48kHz / 24bit</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
import { Mic, Music } from 'lucide-react';

const Header = () => {
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
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
          <Mic className="w-3.5 h-3.5" />
          <span>48kHz / 24bit</span>
        </div>
      </div>
    </header>
  );
};

export default Header;

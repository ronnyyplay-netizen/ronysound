import { useState } from 'react';
import { Save, Trash2, FolderOpen } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useUserPresets, type UserPreset } from '@/hooks/useUserPresets';
import type { TrackEQSettings } from '@/components/TrackList';
import type { TrackFXSettings } from '@/components/TrackEffects';
import { toast } from 'sonner';

interface SavePresetButtonProps {
  trackId: string;
  currentEQ: TrackEQSettings;
  currentFX: TrackFXSettings;
  onLoadPreset: (trackId: string, eq: TrackEQSettings, fx: TrackFXSettings) => void;
}

const SavePresetButton = ({ trackId, currentEQ, currentFX, onLoadPreset }: SavePresetButtonProps) => {
  const { user } = useAuth();
  const { presets, savePreset, deletePreset } = useUserPresets();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleSave = () => {
    if (!name.trim()) return toast.error('Digite um nome');
    savePreset(name.trim(), currentEQ, currentFX);
    setName('');
  };

  const handleLoad = (p: UserPreset) => {
    onLoadPreset(trackId, p.eq_settings, p.fx_settings);
    toast.success(`Preset "${p.name}" carregado`);
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-[10px] px-2.5 py-1 rounded-md bg-accent/20 text-accent-foreground hover:bg-accent/30 font-medium transition-colors border border-accent/30 flex items-center gap-1">
          <FolderOpen className="w-3 h-3" />
          Meus Presets
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">💾 Salvar Preset Atual</p>
        <div className="flex gap-1">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do preset" className="text-xs h-7 flex-1" onKeyDown={e => e.key === 'Enter' && handleSave()} />
          <Button size="sm" className="h-7 px-2" onClick={handleSave}><Save className="w-3 h-3" /></Button>
        </div>
        {presets.length > 0 && (
          <>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider pt-1">Seus Presets</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {presets.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-1 px-2 py-1 rounded bg-secondary/40 hover:bg-secondary/60 transition-colors">
                  <button onClick={() => handleLoad(p)} className="text-[10px] text-foreground font-medium truncate flex-1 text-left">{p.name}</button>
                  <button onClick={() => deletePreset(p.id)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5"><Trash2 className="w-2.5 h-2.5" /></button>
                </div>
              ))}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default SavePresetButton;

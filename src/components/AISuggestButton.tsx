import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import type { TrackEQSettings } from '@/components/TrackList';
import type { TrackFXSettings } from '@/components/TrackEffects';

interface AISuggestButtonProps {
  trackId: string;
  currentEQ: TrackEQSettings;
  currentFX: TrackFXSettings;
  onApply: (trackId: string, eq: TrackEQSettings, fx: TrackFXSettings) => void;
}

const SUGGEST_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-eq-suggest`;

const AISuggestButton = ({ trackId, currentEQ, currentFX, onApply }: AISuggestButtonProps) => {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [tip, setTip] = useState('');

  const handleSuggest = async () => {
    if (!desc.trim()) return;
    setLoading(true);
    setTip('');
    try {
      const res = await fetch(SUGGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ description: desc, currentEQ, currentFX }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro');
      }
      const data = await res.json();
      onApply(trackId, data.eq, { ...currentFX, ...data.fx });
      if (data.tips) setTip(data.tips);
      toast.success('Configurações de IA aplicadas!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao consultar IA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="text-[10px] px-2.5 py-1 rounded-md bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 hover:from-purple-500/30 hover:to-pink-500/30 font-medium transition-colors border border-purple-500/30 flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          IA
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 space-y-2">
        <p className="text-xs font-medium text-foreground">🤖 Sugestão de IA</p>
        <p className="text-[10px] text-muted-foreground">Descreva o estilo (ex: "voz feminina pop suave", "rap agressivo")</p>
        <Input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Descreva o estilo..."
          className="text-xs h-8"
          onKeyDown={e => e.key === 'Enter' && handleSuggest()}
        />
        <Button size="sm" className="w-full gap-1.5 h-7 text-xs" onClick={handleSuggest} disabled={loading || !desc.trim()}>
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          {loading ? 'Processando...' : 'Gerar Configurações'}
        </Button>
        {tip && <p className="text-[10px] text-muted-foreground bg-secondary/50 rounded p-2">💡 {tip}</p>}
      </PopoverContent>
    </Popover>
  );
};

export default AISuggestButton;

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import type { TrackEQSettings } from '@/components/TrackList';
import type { TrackFXSettings } from '@/components/TrackEffects';
import { toast } from 'sonner';

export interface UserPreset {
  id: string;
  name: string;
  eq_settings: TrackEQSettings;
  fx_settings: TrackFXSettings;
}

export function useUserPresets() {
  const { user } = useAuth();
  const [presets, setPresets] = useState<UserPreset[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPresets = useCallback(async () => {
    if (!user) { setPresets([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('user_presets')
      .select('id, name, eq_settings, fx_settings')
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) { console.error(error); return; }
    setPresets((data || []).map(d => ({
      id: d.id,
      name: d.name,
      eq_settings: d.eq_settings as unknown as TrackEQSettings,
      fx_settings: d.fx_settings as unknown as TrackFXSettings,
    })));
  }, [user]);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const savePreset = useCallback(async (name: string, eq: TrackEQSettings, fx: TrackFXSettings) => {
    if (!user) { toast.error('Faça login para salvar presets'); return; }
    const { error } = await supabase.from('user_presets').insert({
      user_id: user.id,
      name,
      eq_settings: eq as any,
      fx_settings: fx as any,
    });
    if (error) { toast.error('Erro ao salvar preset'); console.error(error); return; }
    toast.success(`Preset "${name}" salvo!`);
    fetchPresets();
  }, [user, fetchPresets]);

  const deletePreset = useCallback(async (id: string) => {
    const { error } = await supabase.from('user_presets').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir preset'); return; }
    setPresets(p => p.filter(x => x.id !== id));
    toast.success('Preset excluído');
  }, []);

  return { presets, loading, savePreset, deletePreset, refetch: fetchPresets };
}

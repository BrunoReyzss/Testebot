'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth-context';
import { addLog, getSettings, updateSettings } from './api';
import type { Settings } from './types';

export function useSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const s = await getSettings(user.id);
    setSettings(s);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleBot = useCallback(async (): Promise<boolean> => {
    if (!user || !settings) return false;
    const newRunning = !settings.bot_running;
    const updated = await updateSettings(user.id, { bot_running: newRunning });
    setSettings(updated);
    await addLog(
      user.id,
      newRunning ? 'success' : 'warn',
      'system',
      newRunning ? 'Bot iniciado' : 'Bot parado'
    );
    return newRunning;
  }, [user, settings]);

  const saveSettings = useCallback(
    async (updates: Partial<Settings>): Promise<void> => {
      if (!user) return;
      const updated = await updateSettings(user.id, updates);
      setSettings(updated);
    },
    [user]
  );

  return { settings, loading, toggleBot, saveSettings, reload: load };
}

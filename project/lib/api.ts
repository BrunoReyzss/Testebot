'use client';

import { supabase } from './supabase';
import type { Settings, Stats, LogLevel, LogCategory } from './types';

export async function getSettings(userId: string): Promise<Settings | null> {
  const { data } = await supabase
    .from('settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data as Settings | null;
}

export async function updateSettings(
  userId: string,
  updates: Partial<Settings>
): Promise<Settings | null> {
  const { data, error } = await supabase
    .from('settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  return data as Settings | null;
}

export async function getStats(userId: string): Promise<Stats | null> {
  const { data } = await supabase
    .from('stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  return data as Stats | null;
}

export async function addLog(
  userId: string,
  level: LogLevel,
  category: LogCategory,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string
): Promise<void> {
  await supabase.from('logs').insert({
    user_id: userId,
    level,
    category,
    message,
    details: details ?? null,
    request_id: requestId ?? null,
  });
}

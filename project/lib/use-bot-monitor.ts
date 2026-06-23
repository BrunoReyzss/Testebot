'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from './auth-context';
import { useSettings } from './use-settings';
import { supabase } from './supabase';
import { addLog } from './api';

// Simulates Eldorado.gg request detection when the bot is running.
// In production, this would poll the Eldorado API or listen to notifications.
// For now, it generates realistic sample requests to demonstrate the full pipeline.

const sampleServices = ['boost', 'coaching', 'leveling', 'account'];
const sampleRegions = ['BR', 'NA', 'EU', 'AS'];
const sampleCategories = ['ranked', 'normal', 'placement', 'tournament'];
const sampleDescriptions = [
  'Preciso de boost de Gold para Platinum',
  'Coaching para melhorar no ranked',
  'Leveling de conta nova até nível 50',
  'Boost de placement para Diamond',
  'Procuro booster para torneio neste fim de semana',
  'Conta nova precisa subir para nível 30',
  'Boost de Silver para Gold rápido',
  'Coaching individual para melhorar gameplay',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function useBotMonitor() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || !settings) return;

    const isRunning = settings.bot_running;
    const interval = settings.monitor_interval_ms || 5000;

    if (isRunning) {
      // Log bot start
      addLog(user.id, 'info', 'monitor', `Monitoramento ativo (intervalo: ${interval}ms)`);

      const runCycle = async () => {
        try {
          // Simulate detecting a new request (30% chance per cycle)
          if (Math.random() < 0.3) {
            const service = randomItem(sampleServices);
            const region = randomItem(sampleRegions);
            const category = randomItem(sampleCategories);
            const description = randomItem(sampleDescriptions);
            const budget = Math.floor(Math.random() * 100) + 10;
            const externalId = `ELD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

            // Send to edge function for processing
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            if (!supabaseUrl || !anonKey) return;

            const response = await fetch(`${supabaseUrl}/functions/v1/monitor-requests`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${anonKey}`,
                apikey: anonKey,
              },
              body: JSON.stringify({
                user_id: user.id,
                requests: [{
                  external_id: externalId,
                  service_type: service,
                  region,
                  category,
                  description,
                  budget,
                }],
              }),
            });

            if (!response.ok) {
              await addLog(user.id, 'error', 'monitor', `Erro ao processar solicitação: ${response.status}`);
            }
          }
        } catch (err) {
          console.error('Monitor cycle error:', err);
        }
      };

      // Run immediately, then on interval
      runCycle();
      intervalRef.current = setInterval(runCycle, Math.max(interval, 3000));
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, settings?.bot_running, settings?.monitor_interval_ms]);
}

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/use-settings';
import { useBotMonitor } from '@/lib/use-bot-monitor';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Zap, LayoutDashboard, Radar, DollarSign, Bot, Bell, Settings as SettingsIcon, ScrollText, LogOut, Loader as Loader2, Circle, Key } from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/monitoring', label: 'Monitoramento', icon: Radar },
  { href: '/dashboard/pricing', label: 'Precificação', icon: DollarSign },
  { href: '/dashboard/automation', label: 'Automação', icon: Bot },
  { href: '/dashboard/discord', label: 'Discord', icon: Bell },
  { href: '/dashboard/credentials', label: 'Credenciais', icon: Key },
  { href: '/dashboard/logs', label: 'Logs', icon: ScrollText },
  { href: '/dashboard/settings', label: 'Configurações', icon: SettingsIcon },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const { settings, toggleBot } = useSettings();
  const useBotMonitorHook = useBotMonitor;
  useBotMonitorHook();
  const router = useRouter();
  const pathname = usePathname();
  const [botStarting, setBotStarting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/');
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const isRunning = settings?.bot_running ?? false;

  const handleToggleBot = async () => {
    setBotStarting(true);
    await toggleBot();
    setBotStarting(false);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border bg-card/30">
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">Eldorado Bot</span>
            <span className="text-[10px] text-muted-foreground">v1.0.0</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-thin">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bot status + user */}
        <div className="border-t border-border p-3 space-y-3">
          <div className="rounded-lg border border-border bg-secondary/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Status do Bot</span>
              <div className="flex items-center gap-1.5">
                <Circle
                  className={cn(
                    'h-2 w-2 fill-current',
                    isRunning ? 'text-primary animate-pulse-dot' : 'text-muted-foreground'
                  )}
                />
                <span className={cn('text-xs font-semibold', isRunning ? 'text-primary' : 'text-muted-foreground')}>
                  {isRunning ? 'Ativo' : 'Parado'}
                </span>
              </div>
            </div>
            <Button
              onClick={handleToggleBot}
              disabled={botStarting}
              size="sm"
              className={cn(
                'w-full',
                isRunning
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              {botStarting ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : isRunning ? (
                <Circle className="mr-2 h-3 w-3 fill-current" />
              ) : (
                <Zap className="mr-2 h-3.5 w-3.5" />
              )}
              {isRunning ? 'Parar Bot' : 'Iniciar Bot'}
            </Button>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              {(profile?.username ?? user.email ?? '?')[0].toUpperCase()}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-xs font-medium">
                {profile?.username ?? 'Usuário'}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-7 w-7">
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto scrollbar-thin">{children}</main>
    </div>
  );
}

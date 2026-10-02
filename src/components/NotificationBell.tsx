import { Bell, Package, MessageCircle, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications, type AppNotification } from '@/hooks/useNotifications';

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function NotifIcon({ type }: { type: AppNotification['type'] }) {
  if (type === 'pedido') return <Package className="h-3.5 w-3.5 text-primary" />;
  return <MessageCircle className="h-3.5 w-3.5 text-green-500" />;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAllRead } = useNotifications();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <p className="text-sm font-medium">Notificaciones</p>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2"
              onClick={markAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar leídas
            </Button>
          )}
        </div>

        <div className="max-h-[340px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-20" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex gap-3 border-b border-border/40 px-4 py-3 last:border-0 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
              >
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <NotifIcon type={n.type} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${!n.read ? 'font-medium' : ''}`}>{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{n.body}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground/60 mt-0.5">
                  {timeAgo(n.timestamp)}
                </span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

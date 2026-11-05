import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getPedidosStats, getOutboundOrderWhatsAppMessages, getAlertaEsencias } from '@/integrations/api';

export type AppNotification = {
  id: string;
  type: 'pedido' | 'whatsapp' | 'esencia';
  title: string;
  body: string;
  timestamp: Date;
  read: boolean;
};

const STORAGE_PEDIDOS = 'mirra_notif_pedidos_total';
const STORAGE_WA = 'mirra_notif_wa_count';
const POLL_MS = 30_000;
const STORAGE_ESENCIAS = 'mirra_notif_esencias_dia';


export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const lastPedidos = useRef<number>(-1);
  const lastWa = useRef<number>(-1);
  const ready = useRef(false);

  const push = useCallback((notif: Omit<AppNotification, 'id' | 'read'>) => {
    const entry: AppNotification = { ...notif, id: `${Date.now()}-${Math.random()}`, read: false };
    setNotifications((prev) => [entry, ...prev].slice(0, 40));
    toast(notif.title, { description: notif.body });
  }, []);

  const pollPedidos = useCallback(async () => {
    try {
      const res = await getPedidosStats();
      const total = Number(res?.Total ?? res?.todos ?? 0);
      if (!Number.isFinite(total)) return;
      const prev = lastPedidos.current;
      if (prev >= 0 && total > prev) {
        const diff = total - prev;
        push({
          type: 'pedido',
          title: `${diff} nuevo${diff > 1 ? 's' : ''} pedido${diff > 1 ? 's' : ''}`,
          body: `Tienes ${diff} pedido${diff > 1 ? 's' : ''} nuevo${diff > 1 ? 's' : ''} esperando revisión`,
          timestamp: new Date(),
        });
      }
      lastPedidos.current = total;
      try { localStorage.setItem(STORAGE_PEDIDOS, String(total)); } catch (_) {}
    } catch (_) {}
  }, [push]);

  const pollWa = useCallback(async () => {
    try {
      const msgs = await getOutboundOrderWhatsAppMessages();
      const count = Array.isArray(msgs) ? msgs.length : 0;
      const prev = lastWa.current;
      if (prev >= 0 && count > prev) {
        const diff = count - prev;
        push({
          type: 'whatsapp',
          title: `${diff} mensaje${diff > 1 ? 's' : ''} nuevo${diff > 1 ? 's' : ''} de WhatsApp`,
          body: 'Nuevos mensajes en el canal de pedidos por WhatsApp',
          timestamp: new Date(),
        });
      }
      lastWa.current = count;
      try { localStorage.setItem(STORAGE_WA, String(count)); } catch (_) {}
    } catch (_) {}
  }, [push]);

  useEffect(() => {
    // Baseline inicial: guardar conteos sin disparar notificaciones
    const init = async () => {
      try {
        const res = await getPedidosStats();
        const total = Number(res?.Total ?? res?.todos ?? 0);
        if (Number.isFinite(total)) lastPedidos.current = total;
      } catch (_) {}
      try {
        const msgs = await getOutboundOrderWhatsAppMessages();
        lastWa.current = Array.isArray(msgs) ? msgs.length : 0;
      } catch (_) {}
      ready.current = true;

      // Esencias de alta rotación por acabarse: un aviso al día (no en cada recarga)
      try {
        const hoy = new Date().toISOString().slice(0, 10);
        let yaAvisado = false;
        try { yaAvisado = localStorage.getItem(STORAGE_ESENCIAS) === hoy; } catch (_) {}
        if (!yaAvisado) {
          const alertas = await getAlertaEsencias();
          const urgentes = (alertas?.esencias || []).filter((e) => e.rotacion === 'alta');
          if (urgentes.length > 0) {
            push({
              type: 'esencia',
              title: `${urgentes.length} esencia${urgentes.length > 1 ? 's' : ''} de alta rotación por acabarse`,
              body: 'Revisa "Esencias por acabarse" en el Dashboard y repón pronto.',
              timestamp: new Date(),
            });
          }
          try { localStorage.setItem(STORAGE_ESENCIAS, hoy); } catch (_) {}
        }
      } catch (_) {}
    };

    init();

    const interval = setInterval(() => {
      if (!ready.current) return;
      pollPedidos();
      pollWa();
    }, POLL_MS);

    return () => clearInterval(interval);
  }, [pollPedidos, pollWa]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, markAllRead };
}

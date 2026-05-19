import { useCallback, useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getWhatsAppSessionStatus,
  getOutboundOrderWhatsAppMessages,
  sendWahaTextMessage,
} from '@/integrations/api';

export default function WhatsappAdmin() {
  const [sessionName, setSessionName] = useState('default');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<any>(null);

  const [orderMessages, setOrderMessages] = useState<any[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    let nextError = '';

    try {
      const statusData = await getWhatsAppSessionStatus(sessionName);
      setConnectionStatus(statusData || null);
    } catch (err: any) {
      nextError = `Estado: ${err?.message || 'sin respuesta'}`;
      setConnectionStatus(null);
    }

    try {
      const orderData = await getOutboundOrderWhatsAppMessages();
      setOrderMessages(Array.isArray(orderData) ? orderData : []);
    } catch (err: any) {
      nextError = nextError
        ? `${nextError} | Pedidos: ${err?.message || 'sin respuesta'}`
        : `Pedidos: ${err?.message || 'sin respuesta'}`;
      setOrderMessages([]);
    }

    if (nextError) {
      setError(nextError);
    }
    setLoading(false);
  }, [sessionName]);

  const isConnected =
    connectionStatus?.ready ||
    connectionStatus?.statusCode === 'working' ||
    String(connectionStatus?.statusMessage || '').toLowerCase().includes('working');

  const handleSend = useCallback(async () => {
    try {
      if (!to.trim() || !text.trim()) {
        setError('Debes llenar destino y mensaje');
        return;
      }
      setSending(true);
      setError(null);
      await sendWahaTextMessage(sessionName, to, text);
      setText('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }, [loadData, sessionName, text, to]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [loadData]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">WhatsApp (WAHA)</h2>
          <p className="text-muted-foreground">Centro de mensajeria, contactos y seguimiento de pedidos.</p>
        </div>

        <Card>
          <CardHeader className="border-b bg-muted/30">
            <CardTitle>Estado de conexion</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 pt-4 text-sm md:grid-cols-5">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Estado</p>
              <p className={`font-semibold ${isConnected ? 'text-green-600' : 'text-amber-600'}`}>
                {isConnected ? 'Conectado' : 'No conectado'}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Sesion</p>
              <p className="font-semibold">{sessionName || 'default'}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Detalle</p>
              <p className="font-semibold">{connectionStatus?.statusMessage || 'Sin informacion'}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Numero</p>
              <p className="font-semibold">{connectionStatus?.device?.phone || 'N/D'}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Cuenta</p>
              <p className="font-semibold">{connectionStatus?.device?.pushname || 'N/D'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-muted/30">
            <CardTitle>Envio manual</CardTitle>
            <CardDescription>
              La conexion/sesion se gestiona en el dashboard de WAHA. Aqui solo operas mensajes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-12">
              <label className="text-sm">Session:</label>
              <input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="h-9 rounded border px-2 text-sm md:col-span-2"
                placeholder="default"
              />
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9 rounded border px-2 text-sm md:col-span-3"
                placeholder="Telefono o chatId"
              />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-20 rounded border px-2 py-2 text-sm md:col-span-4"
                placeholder="Escribe el mensaje"
              />
              <Button className="md:col-span-1" onClick={handleSend} disabled={sending}>
                {sending ? 'Enviando...' : 'Enviar'}
              </Button>
              <Button className="md:col-span-1" variant="outline" onClick={loadData} disabled={loading}>
                {loading ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b bg-muted/30">
            <CardTitle>Mensajes enviados por pedidos</CardTitle>
            <CardDescription>Registro interno de los envios automáticos del backend.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[360px] space-y-2 overflow-auto pt-4">
            {orderMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aun no hay mensajes de pedidos registrados.</p>
            ) : (
              orderMessages.slice(0, 30).map((item, index) => (
                <div key={index} className="rounded-lg border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">Fecha: {item?.createdAt || 'N/D'}</p>
                  <p>
                    <span className="font-medium">Tipo:</span> {item?.meta?.type || 'N/D'} |{' '}
                    <span className="font-medium">Pedido:</span> {item?.meta?.orderId || 'N/D'}
                  </p>
                  <p>
                    <span className="font-medium">Destino:</span> {item?.to || item?.chatId || 'N/D'}
                  </p>
                  <p className="mt-1">{item?.text || 'N/D'}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

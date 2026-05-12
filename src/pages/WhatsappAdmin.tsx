import { useCallback, useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { disconnectWhatsAppSession, getWhatsAppSessionStatus } from '@/integrations/api';

type SessionStatus = {
  ready?: boolean;
  hasQr?: boolean;
  qrImage?: string | null;
};

export default function WhatsappAdmin() {
  const [status, setStatus] = useState<SessionStatus>({});
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await getWhatsAppSessionStatus();
      setStatus(data || {});
    } catch (err: any) {
      setError(err?.message || 'Error consultando estado de WhatsApp');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      setDisconnecting(true);
      setError(null);
      await disconnectWhatsAppSession();
      await loadStatus();
    } catch (err: any) {
      setError(err?.message || 'No se pudo desconectar WhatsApp');
    } finally {
      setDisconnecting(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 5000);
    return () => clearInterval(interval);
  }, [loadStatus]);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin WhatsApp</h2>
          <p className="text-muted-foreground">
            Escanea este QR con el telefono que enviara notificaciones de pedidos.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Estado de sesion</CardTitle>
              <CardDescription>Actualizacion automatica cada 5 segundos.</CardDescription>
            </div>
            <Badge variant={status.ready ? 'default' : 'secondary'}>
              {status.ready ? 'Conectado' : 'Pendiente de vinculacion'}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Button onClick={loadStatus} disabled={loading}>
                {loading ? 'Consultando...' : 'Actualizar ahora'}
              </Button>
              <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Desconectando...' : 'Desconectar telefono'}
              </Button>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>

            {status.ready ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                WhatsApp ya esta conectado. Este numero ya puede enviar mensajes.
              </div>
            ) : status.hasQr && status.qrImage ? (
              <div className="space-y-3">
                <div className="inline-flex rounded-md border bg-white p-3">
                  <img
                    src={status.qrImage}
                    alt="QR de WhatsApp"
                    className="h-72 w-72 max-w-full"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Abre WhatsApp en tu telefono, entra a Dispositivos vinculados y escanea el QR.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aun no hay QR disponible. Espera unos segundos o reinicia el microservicio de WhatsApp.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

import { useState } from 'react';
import { BadgePercent, Check, Pencil, Plus, Power, TicketPercent, Users, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type Influencer = { id: number; nombre: string; email: string; cuenta: string; comision: number };
type Coupon = { id: number; codigo: string; descuento: number; influencerId: number; usos: number; limite: number | null; activo: boolean };

const initialInfluencers: Influencer[] = [
  { id: 12, nombre: 'Valeria V.', email: 'valeria@example.test', cuenta: 'Valeria V. · valeria@example.test', comision: 10 },
  { id: 18, nombre: 'Daniela R.', email: 'daniela@example.test', cuenta: 'Daniela R. · daniela@example.test', comision: 12 },
];
const initialCoupons: Coupon[] = [
  { id: 1, codigo: 'VALERIA10', descuento: 10, influencerId: 12, usos: 70, limite: 70, activo: false },
  { id: 2, codigo: 'VALERIA15', descuento: 15, influencerId: 12, usos: 8, limite: 70, activo: true },
  { id: 3, codigo: 'DANIELA12', descuento: 12, influencerId: 18, usos: 21, limite: 70, activo: true },
];
const inputClass = 'w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function MarketingInfluencersPreview() {
  const [tab, setTab] = useState<'cupones' | 'influencers'>('cupones');
  const [influencers, setInfluencers] = useState(initialInfluencers);
  const [coupons, setCoupons] = useState(initialCoupons);
  const [influencerId, setInfluencerId] = useState(12);
  const [code, setCode] = useState('');
  const [discount, setDiscount] = useState('10');
  const [limit, setLimit] = useState('70');
  const [account, setAccount] = useState(initialInfluencers[0].cuenta);
  const [commission, setCommission] = useState('10');
  const [message, setMessage] = useState('');
  const selectedInfluencer = influencers.find((item) => item.id === influencerId);

  const createCode = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!code.trim()) return;
    setCoupons((items) => [{ id: Date.now(), codigo: code.trim().toUpperCase(), descuento: Number(discount), influencerId, usos: 0, limite: limit ? Number(limit) : null, activo: true }, ...items]);
    setMessage(`${code.trim().toUpperCase()} quedó asociado a ${selectedInfluencer?.nombre}.`);
    setCode('');
  };

  const saveProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInfluencers((items) => items.map((item) => item.id === influencerId ? { ...item, cuenta: account, comision: Number(commission) } : item));
    setMessage('Cuenta y comisión actualizadas. Los códigos continúan asociados a este perfil.');
  };

  return (
    <main className="min-h-screen bg-muted/30 text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-foreground font-serif text-lg font-semibold text-background">M</div><div><p className="font-serif text-xl font-semibold tracking-wide">Mirra</p><p className="text-xs text-muted-foreground">Marketing · Cupones e influencers</p></div></div>
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">Vista previa local</Badge>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="font-serif text-3xl font-semibold">Cupones e influencers</h1><p className="mt-1 text-sm text-muted-foreground">Administra códigos, cuentas y comisiones.</p></div><div className="flex gap-2 text-sm"><span className="rounded-md border bg-card px-3 py-2">{influencers.length} perfiles</span><span className="rounded-md border bg-card px-3 py-2">{coupons.length} códigos</span></div></header>
        <nav className="flex gap-1 border-b" aria-label="Secciones de marketing">
          <button type="button" onClick={() => { setTab('cupones'); setMessage(''); }} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium ${tab === 'cupones' ? 'border-amber-700 text-amber-950' : 'border-transparent text-muted-foreground'}`}><TicketPercent className="h-4 w-4" /> Cupones <span className="tabular-nums">{coupons.length}</span></button>
          <button type="button" onClick={() => { setTab('influencers'); setMessage(''); }} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium ${tab === 'influencers' ? 'border-amber-700 text-amber-950' : 'border-transparent text-muted-foreground'}`}><Users className="h-4 w-4" /> Influencers <span className="tabular-nums">{influencers.length}</span></button>
        </nav>
        {message && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</p>}
        {tab === 'cupones' ? (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(310px,0.8fr)_minmax(0,1.2fr)]">
            <Card><CardHeader><CardTitle className="font-serif text-xl">Crear código promocional</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={createCode}>
              <label className="block space-y-1.5"><span className="text-sm font-medium">Código</span><Input required maxLength={40} className="uppercase" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="VALERIA20" /></label>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block space-y-1.5"><span className="text-sm font-medium">Descuento para el cliente (%)</span><Input required type="number" min="0.01" max="100" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} /></label><label className="block space-y-1.5"><span className="text-sm font-medium">Límite de usos</span><Input type="number" min="1" step="1" value={limit} onChange={(event) => setLimit(event.target.value)} placeholder="Ilimitado" /></label></div>
              <label className="block space-y-1.5"><span className="text-sm font-medium">Asociar al perfil influencer</span><select className={inputClass} value={influencerId} onChange={(event) => setInfluencerId(Number(event.target.value))}>{influencers.map((item) => <option key={item.id} value={item.id}>{item.nombre} · comisión {item.comision}%</option>)}</select></label>
              <div className="rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-950"><p className="font-medium">Comisión del influencer</p><p className="mt-1">{selectedInfluencer?.comision ?? 0}% de la base imponible. Es independiente del descuento al cliente.</p></div>
              <Button type="submit" className="w-full"><Plus className="mr-2 h-4 w-4" /> Crear código</Button>
            </form></CardContent></Card>
            <section className="space-y-3" aria-label="Códigos promocionales"><div className="flex items-center justify-between"><h2 className="font-serif text-xl font-semibold">Códigos</h2><span className="text-sm text-muted-foreground">Asociación y estado</span></div>
              {coupons.map((coupon) => { const influencer = influencers.find((item) => item.id === coupon.influencerId); return <Card key={coupon.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><code className="rounded bg-muted px-2 py-1 font-semibold tracking-wide">{coupon.codigo}</code><Badge className={coupon.activo ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-muted text-muted-foreground'}>{coupon.activo ? 'Activo' : 'Agotado / inactivo'}</Badge></div><p className="text-sm text-muted-foreground">{influencer?.nombre || 'Sin influencer'} · Descuento cliente {coupon.descuento}% · Comisión influencer {influencer?.comision || 0}%</p><p className="text-xs text-muted-foreground">Usos: {coupon.usos}{coupon.limite ? ` / ${coupon.limite}` : ' / Ilimitados'}</p></div><Button type="button" variant="outline" onClick={() => setCoupons((items) => items.map((item) => item.id === coupon.id ? { ...item, activo: !item.activo } : item))}><Power className="mr-2 h-4 w-4" />{coupon.activo ? 'Desactivar' : 'Reactivar'}</Button></CardContent></Card>; })}
            </section>
          </div>
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(310px,0.8fr)_minmax(0,1.2fr)]">
            <Card><CardHeader><CardTitle className="font-serif text-xl">Perfil de influencer</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={saveProfile}>
              <label className="block space-y-1.5"><span className="text-sm font-medium">Seleccionar influencer</span><select className={inputClass} value={influencerId} onChange={(event) => { const id = Number(event.target.value); setInfluencerId(id); const next = influencers.find((item) => item.id === id); if (next) { setAccount(next.cuenta); setCommission(String(next.comision)); } }}>{influencers.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}</select></label>
              <label className="block space-y-1.5"><span className="text-sm font-medium">Usuario vinculado</span><select className={inputClass} value={account} onChange={(event) => setAccount(event.target.value)}>{influencers.map((item) => <option key={item.id} value={item.cuenta}>{item.cuenta}</option>)}</select></label>
              <label className="block space-y-1.5"><span className="text-sm font-medium">Comisión por pedido (%)</span><Input required type="number" min="0" max="100" step="0.01" value={commission} onChange={(event) => setCommission(event.target.value)} /></label>
              <Button type="submit" className="w-full"><Check className="mr-2 h-4 w-4" /> Guardar perfil</Button>
            </form></CardContent></Card>
            <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-serif text-xl font-semibold">Perfiles</h2><span className="text-sm text-muted-foreground">Usuario y comisión</span></div>{influencers.map((item) => <Card key={item.id}><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{item.nombre}</p><p className="text-sm text-muted-foreground">{item.cuenta}</p></div><div className="flex items-center gap-3"><span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950"><Wallet className="h-4 w-4" /> {item.comision}%</span><Button size="icon" variant="outline" title="Editar perfil" aria-label={`Editar ${item.nombre}`} onClick={() => { setInfluencerId(item.id); setAccount(item.cuenta); setCommission(String(item.comision)); }}><Pencil className="h-4 w-4" /></Button></div></CardContent></Card>)}</section>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Preview de desarrollo con datos ficticios. Los cambios permanecen en memoria y no llaman al backend.</p>
      </div>
    </main>
  );
}

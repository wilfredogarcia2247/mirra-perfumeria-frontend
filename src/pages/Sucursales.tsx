import { FormEvent, useCallback, useEffect, useState } from 'react';
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  createSucursal,
  deleteSucursal,
  getSucursales,
  Sucursal,
  updateSucursal,
} from '@/integrations/api';

export default function Sucursales() {
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [editando, setEditando] = useState<Sucursal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargarSucursales = useCallback(async () => {
    setCargando(true);
    try {
      setSucursales(await getSucursales());
    } catch (error) {
      console.error('Error cargando sucursales:', error);
      toast.error('No se pudieron cargar las sucursales');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargarSucursales();
  }, [cargarSucursales]);

  const limpiarFormulario = () => {
    setNombre('');
    setDireccion('');
    setEditando(null);
  };

  const guardarSucursal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuardando(true);
    try {
      if (editando) {
        await updateSucursal(editando.id, {
          nombre: nombre.trim(),
          direccion: direccion.trim(),
          activa: editando.activa !== false,
        });
        toast.success('Sucursal actualizada');
      } else {
        await createSucursal({ nombre: nombre.trim(), direccion: direccion.trim() });
        toast.success('Sucursal agregada');
      }
      limpiarFormulario();
      await cargarSucursales();
    } catch (error) {
      console.error('Error guardando sucursal:', error);
      toast.error('No se pudo guardar la sucursal');
    } finally {
      setGuardando(false);
    }
  };

  const cambiarEstado = async (sucursal: Sucursal) => {
    try {
      await updateSucursal(sucursal.id, {
        nombre: sucursal.nombre,
        direccion: sucursal.direccion,
        activa: sucursal.activa === false,
      });
      await cargarSucursales();
    } catch (error) {
      console.error('Error cambiando estado de sucursal:', error);
      toast.error('No se pudo cambiar el estado de la sucursal');
    }
  };

  const quitarSucursal = async (sucursal: Sucursal) => {
    if (!window.confirm(`¿Quieres quitar la sucursal "${sucursal.nombre}"?`)) return;
    try {
      await deleteSucursal(sucursal.id);
      if (editando?.id === sucursal.id) limpiarFormulario();
      toast.success('Sucursal eliminada');
      await cargarSucursales();
    } catch (error) {
      console.error('Error eliminando sucursal:', error);
      toast.error('No se pudo eliminar la sucursal');
    }
  };

  const comenzarEdicion = (sucursal: Sucursal) => {
    setEditando(sucursal);
    setNombre(sucursal.nombre);
    setDireccion(sucursal.direccion);
  };

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="font-serif text-3xl font-semibold">Sucursales</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Administra las tiendas que los clientes pueden elegir para retirar sus pedidos.
        </p>
      </header>

      <form onSubmit={guardarSucursal} className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-semibold">{editando ? 'Editar sucursal' : 'Agregar sucursal'}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            Nombre de la sucursal
            <input
              required
              maxLength={160}
              value={nombre}
              onChange={(event) => setNombre(event.target.value)}
              placeholder="Ej.: Mirra Las Mercedes"
              className="block w-full rounded-md border bg-background px-3 py-2 font-normal"
            />
          </label>
          <label className="space-y-1 text-sm font-medium">
            Dirección
            <input
              required
              maxLength={500}
              value={direccion}
              onChange={(event) => setDireccion(event.target.value)}
              placeholder="Dirección de la tienda"
              className="block w-full rounded-md border bg-background px-3 py-2 font-normal"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {editando ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar sucursal'}
          </button>
          {editando && (
            <button
              type="button"
              onClick={limpiarFormulario}
              className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
            >
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
        </div>
      </form>

      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold">Sucursales configuradas</h2>
        </div>
        {cargando ? (
          <p className="p-5 text-sm text-muted-foreground">Cargando sucursales...</p>
        ) : sucursales.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">Aún no hay sucursales. Agrega la primera arriba.</p>
        ) : (
          <ul className="divide-y">
            {sucursales.map((sucursal) => (
              <li key={sucursal.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    <span className="font-medium">{sucursal.nombre}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${sucursal.activa === false ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-800'}`}>
                      {sucursal.activa === false ? 'Inactiva' : 'Activa'}
                    </span>
                  </div>
                  <p className="mt-1 pl-6 text-sm text-muted-foreground">{sucursal.direccion}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void cambiarEstado(sucursal)}
                    className="rounded-md border px-3 py-1.5 text-sm"
                  >
                    {sucursal.activa === false ? 'Activar' : 'Desactivar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => comenzarEdicion(sucursal)}
                    className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm"
                  >
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void quitarSucursal(sucursal)}
                    className="inline-flex items-center gap-1 rounded-md border border-destructive/30 px-3 py-1.5 text-sm text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

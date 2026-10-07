import React, { useEffect, useState } from 'react';
import { TableSkeleton } from '@/components/admin-skeletons';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableCell, TableHead } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/integrations/api';
import { useAuth } from '@/hooks/use-auth';
import { Plus, Loader2 } from 'lucide-react';

// Página básica para CRUD de usuarios y gestión de permisos por módulo.
export default function Usuarios() {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [permisos, setPermisos] = useState<any | null>(null);
  const [permLoading, setPermLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [userForm, setUserForm] = useState<{ nombre?: string; email?: string; password?: string; rol?: string }>({});
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [permisosModalOpen, setPermisosModalOpen] = useState(false);
  const [availableModules, setAvailableModules] = useState<Array<string | { key: string; label?: string }>>([]);

  const { token } = useAuth();

  // Determine if user is admin
  let isAdmin = false;
  try {
    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        const role = payload?.rol ?? payload?.role ?? payload?.role_name ?? payload?.roles ?? null;
        if (typeof role === 'string') {
          isAdmin = role.toLowerCase() === 'admin';
        } else if (Array.isArray(role)) {
          isAdmin = role.map((r: any) => String(r).toLowerCase()).includes('admin');
        }
      }
    }
  } catch (e) {
    isAdmin = false;
  }


  useEffect(() => {
    loadUsers();
    loadAvailableModules();
  }, []);

  async function loadAvailableModules() {
    try {
      const res = await apiFetch('/users/available-modulos');
      // backend may return array of strings or objects
      if (Array.isArray(res)) {
        setAvailableModules(res as any);
      } else if (res && Array.isArray(res.data)) {
        setAvailableModules(res.data as any);
      } else {
        setAvailableModules([]);
      }
    } catch (e) {
      console.debug('Could not load available modules', e);
      setAvailableModules([]);
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      // Usar apiFetch para respetar API_URL y Authorization
      try {
        const data = await apiFetch('/users');
        setUsers(Array.isArray(data) ? data : (data?.data || []));
      } catch (e) {
        // Si el backend no expone /users, dejar la lista vacía
        setUsers([]);
      }
    } catch (e) {
      console.debug(e);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  function openCreateUser() {
    setIsCreating(true);
    setEditingUser(null);
    setUserForm({ nombre: '', email: '', password: '', rol: 'user' });
    setUserModalOpen(true);
  }

  function openEditUser(u: any) {
    setEditingUser(u);
    setIsCreating(false);
    setUserForm({ nombre: u.nombre || '', email: u.email || '', password: '', rol: u.rol || 'user' });
    setUserModalOpen(true);
  }

  function closeUserForm() {
    setEditingUser(null);
    setIsCreating(false);
    setUserForm({});
  }

  function validateEmail(email: string) {
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  }

  async function submitCreateUser() {
    const { nombre, email, password, rol } = userForm as any;
    if (!nombre || !email || !password) return alert('Nombre, email y password son requeridos');
    if (!validateEmail(email)) return alert('Email inválido');
    if (String(password).length < 8) return alert('Password mínimo 8 caracteres');
    try {
      await apiFetch('/users', { method: 'POST', body: JSON.stringify({ nombre, email, password, rol }) });
      alert('Usuario creado');
      closeUserForm();
      loadUsers();
    } catch (e: any) {
      console.error(e);
      alert('Error creando usuario: ' + (e?.message || e));
    }
  }

  async function submitUpdateUser() {
    if (!editingUser) return;
    const { nombre, email, password, rol } = userForm as any;
    if (!nombre || !email) return alert('Nombre y email son requeridos');
    if (!validateEmail(email)) return alert('Email inválido');
    if (password && String(password).length > 0 && String(password).length < 8) return alert('Password mínimo 8 caracteres');
    try {
      const payload: any = { nombre, email };
      if (password) payload.password = password;
      if (rol) payload.rol = rol;
      await apiFetch(`/users/${editingUser.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      alert('Usuario actualizado');
      closeUserForm();
      loadUsers();
    } catch (e: any) {
      console.error(e);
      alert('Error actualizando usuario: ' + (e?.message || e));
    }
  }

  async function deleteUser(u: any) {
    if (!u?.id) return;
    if (!confirm(`Eliminar usuario ${u.email || u.nombre || u.id}? Esta acción es irreversible.`)) return;
    try {
      await apiFetch(`/users/${u.id}`, { method: 'DELETE' });
      alert('Usuario eliminado');
      // limpiar si era el seleccionado
      if (selectedUser?.id === u.id) {
        setSelectedUser(null);
        setPermisos(null);
      }
      loadUsers();
    } catch (e: any) {
      console.error(e);
      alert('Error eliminando usuario: ' + (e?.message || e));
    }
  }

  function resolveUserId(u: any): number | null {
    if (!u) return null;
    try {
      if (typeof u === 'number') return Number(u);
      if (typeof u === 'string') {
        const n = Number(u);
        return Number.isFinite(n) ? n : null;
      }
      const cand = u.id ?? u.usuario_id ?? u.user_id ?? u.sub ?? null;
      const n = cand !== null && cand !== undefined ? Number(cand) : null;
      return Number.isFinite(n) ? n : null;
    } catch (e) {
      return null;
    }
  }

  async function loadPermisosFor(user: any) {
    const uid = resolveUserId(user);
    if (!uid) {
      alert('ID de usuario inválido para cargar permisos');
      return;
    }
    setPermLoading(true);
    try {
      // GET /api/users/:id/modulos (según documentación)
      const data = await apiFetch(`/users/${uid}/modulos`);
      // API puede devolver { modulos: {...}, available_modulos: [...] }
      if (data && typeof data === 'object' && data.modulos) {
        let p = data.modulos || {};
        if (Array.isArray(p)) {
          const map: any = {};
          for (const k of p) map[k] = true;
          p = map;
        }
        setPermisos(p);
        if (Array.isArray(data.available_modulos) && data.available_modulos.length > 0) setAvailableModules(data.available_modulos as any);
      } else {
        let p = data || {};
        if (Array.isArray(p)) {
          const map: any = {};
          for (const k of p) map[k] = true;
          p = map;
        }
        setPermisos(p);
      }
      // keep selectedUser as the original object for display but store resolved id where needed
      setSelectedUser({ ...(user || {}), id: uid });
      setPermisosModalOpen(true);
    } catch (e: any) {
      console.error('Error cargando permisos', e);
      // Si no existe fila de permisos (404), abrir modal con permisos vacíos para crear
      if ((e as any)?.status === 404) {
        // intentar parsear available_modulos desde el body del error si viene en JSON
        try {
          const parsed = JSON.parse(String(e.message || '{}'));
          if (parsed && Array.isArray(parsed.available_modulos)) setAvailableModules(parsed.available_modulos);
        } catch (pe) {
          // ignore
        }
        setPermisos({});
        setSelectedUser({ ...(user || {}), id: uid });
        setPermisosModalOpen(true);
      } else if ((e as any)?.status === 401 || (e as any)?.status === 403) {
        alert('No autorizado para ver/editar permisos. Revisa tus credenciales.');
      } else {
        alert('No se pudo cargar permisos: ' + (e?.message || e));
      }
    } finally {
      setPermLoading(false);
    }
  }

  async function savePermisos() {
    if (!selectedUser) return;
    try {
      const payload = { ...permisos };
      const endpoints = [`/users/${selectedUser.id}/modulos`, `/users/${selectedUser.id}/modules`];

      // Prefer PUT (upsert) as recommended by backend docs, fallback to POST if PUT not supported.
      let saved: any = null;
      let lastError: any = null;
      for (const ep of endpoints) {
        try {
          // Try PUT first
          saved = await apiFetch(ep, { method: 'PUT', body: JSON.stringify(payload) });
          break;
        } catch (errPut: any) {
          lastError = errPut;
          // If PUT failed with 405 Method Not Allowed or 404, try POST
          try {
            saved = await apiFetch(ep, { method: 'POST', body: JSON.stringify(payload) });
            break;
          } catch (errPost: any) {
            lastError = errPost;
            // continue to next endpoint
          }
        }
      }

      if (!saved) {
        if (lastError && (lastError as any).status === 403) {
          alert('No autorizado: necesitas permisos de administrador para asignar módulos.');
          return;
        }
        throw lastError || new Error('No se pudo guardar permisos');
      }

      // Response puede venir como { modulos: {...}, available_modulos: [...] } o directamente el objeto de modulos
      let newPerms = (saved && saved.modulos) ? saved.modulos : saved;
      if (Array.isArray(newPerms)) {
        const map: any = {};
        for (const k of newPerms) map[k] = true;
        newPerms = map;
      }
      setPermisos(newPerms || {});
      try { localStorage.setItem('user_permissions', JSON.stringify(newPerms || {})); } catch (e) { /* noop */ }
      alert('Permisos guardados');
      setPermisosModalOpen(false);
      return;
    } catch (e: any) {
      console.error(e);
      alert('Error guardando permisos: ' + (e?.message || e));
    }
  }

  async function deletePermisos() {
    if (!selectedUser) return;
    if (!confirm(`Eliminar permisos del usuario ${selectedUser.email || selectedUser.nombre || selectedUser.id}?`)) return;
    try {
      await apiFetch(`/users/${selectedUser.id}/modulos`, { method: 'DELETE' });
      alert('Permisos eliminados');
      setPermisos(null);
      setPermisosModalOpen(false);
    } catch (e: any) {
      console.error('Error eliminando permisos', e);
      if ((e as any)?.status === 403) alert('No autorizado para eliminar permisos.');
      else alert('Error eliminando permisos: ' + (e?.message || e));
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Usuarios</h2>
            <p className="text-sm text-muted-foreground">Gestión de usuarios y permisos</p>
          </div>
          <Button className="gap-2 h-11 px-4" onClick={openCreateUser}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Crear usuario</span>
            <span className="sm:hidden">Nuevo</span>
          </Button>
        </div>

        {loading ? (
          <TableSkeleton columns={4} />
        ) : (
          <>
            {/* ── Móvil: lista de tarjetas nativas ── */}
            <div className="flex flex-col gap-3 sm:hidden">
              {users.map((u: any) => (
                <Card key={u.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{u.nombre || u.name || u.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                          {u.rol || u.role || 'user'}
                        </span>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground shrink-0">#{u.id}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      {isAdmin && (
                        <Button size="sm" variant="outline" className="flex-1 h-10" onClick={() => loadPermisosFor(u)}>
                          Permisos
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="flex-1 h-10" onClick={() => openEditUser(u)}>
                        Editar
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1 h-10" onClick={() => deleteUser(u)}>
                        Eliminar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {users.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No hay usuarios registrados.</p>
              )}
            </div>

            {/* ── Desktop: tabla ── */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">ID</TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">Nombre / Email</TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">Rol</TableHead>
                      <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u: any) => (
                      <TableRow key={u.id} className="hover:bg-muted/40 transition-colors duration-150">
                        <TableCell className="text-xs tabular-nums text-muted-foreground">#{u.id}</TableCell>
                        <TableCell className="font-medium">{u.nombre || u.name || u.email}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.rol || u.role || '—'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {isAdmin && <Button size="sm" variant="outline" onClick={() => loadPermisosFor(u)}>Permisos</Button>}
                            <Button size="sm" variant="outline" onClick={() => openEditUser(u)}>Editar</Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteUser(u)}>Eliminar</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}

        {/* Modal: Crear / Editar usuario */}
        <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
          <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-2xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>{isCreating ? 'Crear usuario' : `Editar: ${editingUser?.nombre || editingUser?.email || editingUser?.id}`}</DialogTitle>
              <DialogDescription>{isCreating ? 'Complete los datos para crear un usuario.' : 'Modifique los datos del usuario.'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nombre</label>
                <Input className="h-11 text-base" value={userForm.nombre || ''} onChange={(e) => setUserForm((s) => ({ ...s, nombre: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Email</label>
                <Input className="h-11 text-base" type="email" inputMode="email" autoComplete="email" value={userForm.email || ''} onChange={(e) => setUserForm((s) => ({ ...s, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">
                  Password{' '}
                  {editingUser && <span className="text-muted-foreground font-normal">(vacío = no cambiar)</span>}
                </label>
                <Input className="h-11 text-base" type="password" autoComplete="new-password" value={userForm.password || ''} onChange={(e) => setUserForm((s) => ({ ...s, password: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Rol</label>
                <select className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-base" value={userForm.rol || 'user'} onChange={(e) => setUserForm((s) => ({ ...s, rol: e.target.value }))}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <DialogFooter className="flex-col-reverse sm:flex-row gap-2 mt-2">
              <Button variant="outline" className="h-11 w-full sm:w-auto" onClick={() => setUserModalOpen(false)}>Cancelar</Button>
              {isCreating ? (
                <Button className="h-11 w-full sm:w-auto" onClick={submitCreateUser}>Crear</Button>
              ) : (
                <Button className="h-11 w-full sm:w-auto" onClick={submitUpdateUser}>Guardar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Permisos */}
        <Dialog open={permisosModalOpen} onOpenChange={setPermisosModalOpen}>
          <DialogContent className="max-w-md w-[calc(100%-2rem)] rounded-2xl sm:rounded-lg">
            <DialogHeader>
              <DialogTitle>Permisos — {selectedUser?.nombre || selectedUser?.email || selectedUser?.id}</DialogTitle>
              <DialogDescription>Asignar permisos por módulo al usuario.</DialogDescription>
            </DialogHeader>
            <div className="space-y-1 mt-2 max-h-72 overflow-y-auto pr-1">
              {(availableModules && availableModules.length > 0 ? availableModules : ['dashboard', 'tasas_cambio', 'bancos', 'marcas', 'categorias', 'almacenes', 'productos', 'formulas', 'pedidos', 'usuarios']).map((m) => {
                const key = typeof m === 'string' ? m : (m as any).key;
                const label = typeof m === 'string' ? (m as string).replace('_', ' ') : ((m as any).label || (m as any).key.replace('_', ' '));
                return (
                  <label key={String(key)} className="flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-muted/50 cursor-pointer min-h-[44px]">
                    <span className="capitalize text-sm">{label}</span>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded accent-primary"
                      checked={!!permisos?.[key]}
                      onChange={(e) => setPermisos((p: any) => ({ ...(p || {}), [key]: e.target.checked }))}
                    />
                  </label>
                );
              })}
            </div>
            <DialogFooter className="flex-col gap-2 mt-4 sm:flex-row">
              <Button className="h-11 w-full sm:w-auto" onClick={savePermisos} disabled={permLoading}>
                {permLoading ? 'Guardando...' : 'Guardar permisos'}
              </Button>
              <Button className="h-11 w-full sm:w-auto" variant="destructive" onClick={deletePermisos}>Eliminar permisos</Button>
              <Button className="h-11 w-full sm:w-auto" variant="outline" onClick={() => setPermisosModalOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

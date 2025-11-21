import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { apiFetch } from '@/integrations/api';

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

  async function loadPermisosFor(user: any) {
    if (!user?.id) return;
    setPermLoading(true);
    try {
      // GET /api/users/:id/modulos (según documentación)
      const data = await apiFetch(`/users/${user.id}/modulos`);
      // API puede devolver { modulos: {...}, available_modulos: [...] }
      if (data && typeof data === 'object' && data.modulos) {
        setPermisos(data.modulos || {});
        if (Array.isArray(data.available_modulos) && data.available_modulos.length > 0) setAvailableModules(data.available_modulos as any);
      } else {
        setPermisos(data || {});
      }
      setSelectedUser(user);
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
        setSelectedUser(user);
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
      try {
        const res = await apiFetch(`/users/${selectedUser.id}/modulos`, { method: 'POST', body: JSON.stringify(payload) });
        if (res) setPermisos(res as any);
        alert('Permisos guardados');
        setPermisosModalOpen(false);
        return;
      } catch (e: any) {
        if ((e as any)?.status === 403) {
          alert('No autorizado: necesitas permisos de administrador para asignar módulos.');
          return;
        }
        // Fallback a PUT por compatibilidad
        const res2 = await apiFetch(`/users/${selectedUser.id}/modulos`, { method: 'PUT', body: JSON.stringify(payload) });
        if (res2) setPermisos(res2 as any);
        alert('Permisos actualizados');
        setPermisosModalOpen(false);
        return;
      }
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
      <div className="p-4">
        <h1 className="text-2xl font-semibold mb-4">Usuarios</h1>
        <div className="mb-4">
          <Button onClick={loadUsers}>Recargar lista</Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="bg-white border rounded p-4">
              <div className="font-medium mb-2">Listado</div>
              <div className="mb-2 flex items-center justify-between">
                <div />
                <div>
                  <Button size="sm" onClick={openCreateUser} className="mr-2">Crear usuario</Button>
                  <Button size="sm" onClick={loadUsers}>Recargar</Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <tr>
                    <th>Id</th>
                    <th>Nombre / Email</th>
                    <th>Rol</th>
                    <th>Acciones</th>
                  </tr>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell>...</TableCell></TableRow>
                  ) : (
                    users.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell>{u.id}</TableCell>
                        <TableCell>{u.nombre || u.name || u.email}</TableCell>
                        <TableCell>{u.rol || u.role || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => loadPermisosFor(u)}>Permisos</Button>
                            <Button size="sm" variant="outline" onClick={() => openEditUser(u)}>Editar</Button>
                            <Button size="sm" variant="destructive" onClick={() => deleteUser(u)}>Eliminar</Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div>
            <div className="bg-white border rounded p-4">
              <div className="font-medium mb-2">Acciones</div>
              <div className="text-sm text-muted-foreground">Usa los botones de la lista para abrir los modales de editar usuario o editar permisos.</div>
              <div className="mt-4">
                {selectedUser && <div className="text-sm">Usuario seleccionado: {selectedUser.nombre || selectedUser.email || selectedUser.id}</div>}
              </div>
            </div>
          </div>
        </div>
        {/* Modal: Crear / Editar usuario */}
        <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isCreating ? 'Crear usuario' : `Editar usuario: ${editingUser?.email || editingUser?.nombre || editingUser?.id}`}</DialogTitle>
              <DialogDescription>{isCreating ? 'Complete los datos para crear un usuario.' : 'Modifique los datos del usuario.'}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <label className="block text-sm">Nombre</label>
                <input className="w-full border rounded p-1" value={userForm.nombre || ''} onChange={(e) => setUserForm((s) => ({ ...s, nombre: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm">Email</label>
                <input className="w-full border rounded p-1" value={userForm.email || ''} onChange={(e) => setUserForm((s) => ({ ...s, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm">Password {editingUser ? '(dejar vacío para no cambiar)' : ''}</label>
                <input type="password" className="w-full border rounded p-1" value={userForm.password || ''} onChange={(e) => setUserForm((s) => ({ ...s, password: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm">Rol</label>
                <select className="w-full border rounded p-1" value={userForm.rol || 'user'} onChange={(e) => setUserForm((s) => ({ ...s, rol: e.target.value }))}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <div className="flex gap-2">
                {isCreating ? (
                  <Button onClick={submitCreateUser}>Crear</Button>
                ) : (
                  <Button onClick={submitUpdateUser}>Guardar</Button>
                )}
                <Button variant="outline" onClick={() => setUserModalOpen(false)}>Cancelar</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal: Permisos */}
        <Dialog open={permisosModalOpen} onOpenChange={setPermisosModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Permisos — {selectedUser?.nombre || selectedUser?.email || selectedUser?.id}</DialogTitle>
              <DialogDescription>Asignar permisos por módulo al usuario.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {(availableModules && availableModules.length > 0 ? availableModules : ['dashboard','tasas_cambio','bancos','marcas','categorias','almacenes','productos','formulas','pedidos']).map((m) => {
                const key = typeof m === 'string' ? m : (m as any).key;
                const label = typeof m === 'string' ? (m as string).replace('_', ' ') : ((m as any).label || (m as any).key.replace('_', ' '));
                return (
                  <div key={String(key)} className="flex items-center justify-between">
                    <div className="capitalize text-sm">{label}</div>
                    <input type="checkbox" checked={!!permisos?.[key]} onChange={(e) => setPermisos((p:any)=>({...(p||{}),[key]: e.target.checked}))} />
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <div className="flex gap-2 mt-4">
                <Button onClick={savePermisos} disabled={permLoading}>{permLoading ? 'Guardando...' : 'Guardar permisos'}</Button>
                <Button variant="destructive" onClick={deletePermisos}>Eliminar permisos</Button>
                <Button variant="outline" onClick={() => setPermisosModalOpen(false)}>Cerrar</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { getProveedores, createProveedor, updateProveedor, deleteProveedor } from "@/integrations/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Form, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Plus, Edit, Trash2, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export default function Proveedores() {
  const [searchTerm, setSearchTerm] = useState("");
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      nombre: "",
      telefono: "",
      email: "",
      direccion: "",
    },
  });

  useEffect(() => {
    setLoading(true);
    getProveedores()
      .then((data) => setProveedores(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Error al cargar proveedores"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = proveedores.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      (p.nombre || "").toLowerCase().includes(term) ||
      (p.telefono || "").toLowerCase().includes(term) ||
      (p.email || "").toLowerCase().includes(term)
    );
  });

  async function onSubmit(values: any) {
    try {
      const payload = {
        nombre: (values.nombre || "").toString(),
        telefono: (values.telefono || "").toString(),
        email: (values.email || "").toString(),
        direccion: (values.direccion || "").toString(),
      };

      if (editing) {
        const updated = await updateProveedor(editing.id, payload);
        setProveedores((prev) => prev.map((p) => (p.id === editing.id ? updated : p)));
        toast.success("Proveedor actualizado");
        setEditing(null);
      } else {
        const created = await createProveedor(payload);
        setProveedores((prev) => [created, ...prev]);
        toast.success("Proveedor creado");
      }
      form.reset();
      setIsOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Error al guardar proveedor");
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Proveedores</h2>
            <p className="text-muted-foreground">Gestión de proveedores</p>
          </div>

          <div>
            <Button className="gap-2" onClick={() => { setEditing(null); form.reset(); setIsOpen(true); }}>
              <Plus className="h-4 w-4" />
              Nuevo Proveedor
            </Button>
          </div>

          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Editar Proveedor" : "Nuevo Proveedor"}</DialogTitle>
                <DialogDescription>Rellena los datos del proveedor</DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...form.register("nombre", { required: true })} />
                    </FormControl>
                  </FormItem>

                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input {...form.register("telefono")} />
                    </FormControl>
                  </FormItem>

                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...form.register("email")} />
                    </FormControl>
                  </FormItem>

                  <FormItem>
                    <FormLabel>Dirección</FormLabel>
                    <FormControl>
                      <Input {...form.register("direccion")} />
                    </FormControl>
                  </FormItem>

                  <DialogFooter>
                    <Button variant="outline" type="button" onClick={() => { setIsOpen(false); setEditing(null); form.reset(); }}>Cancelar</Button>
                    <Button type="submit">{editing ? "Actualizar" : "Crear"}</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Listado de Proveedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="pt-2 pb-4 flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar por nombre, teléfono o email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Button variant="outline">Filtros</Button>
            </div>

            {loading ? (
              <div>Cargando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p: any) => (
                    <TableRow key={p.id} className="hover:bg-muted/50 transition-smooth">
                      <TableCell className="font-mono text-sm">{p.id}</TableCell>
                      <TableCell className="font-medium">{p.nombre}</TableCell>
                      <TableCell>{p.telefono ?? "-"}</TableCell>
                      <TableCell>{p.email ?? "-"}</TableCell>
                      <TableCell>{p.direccion ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => {
                            setEditing(p);
                            form.reset({ nombre: p.nombre, telefono: p.telefono, email: p.email, direccion: p.direccion });
                            setIsOpen(true);
                          }}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(p); setAlertOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
              <AlertDialogDescription>¿Eliminar proveedor {deleteTarget?.nombre}? Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel onClick={() => setAlertOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteProveedor(deleteTarget.id);
                  setProveedores((prev) => prev.filter((x) => x.id !== deleteTarget.id));
                  toast.success("Proveedor eliminado");
                } catch (err) {
                  console.error(err);
                  toast.error("Error al eliminar proveedor");
                } finally {
                  setDeleteTarget(null);
                  setAlertOpen(false);
                }
              }}>Eliminar</AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}

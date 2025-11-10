import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { getProductos, deleteProducto } from "@/integrations/api";
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
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Edit, Trash2, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { createProducto, updateProducto } from "@/integrations/api";
import ImageUpload from "@/components/ImageUpload";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

// Los productos se obtienen desde la API en `useEffect` usando getProductos()

export default function Productos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [productos, setProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const form = useForm({
    defaultValues: {
      nombre: "",
      tipo: "MateriaPrima",
      unidad: "unidad",
      stock: 0,
      costo: 0,
      precio_venta: 0,
      proveedor_id: null,
    },
  });

  useEffect(() => {
    getProductos()
      .then(setProductos)
      .catch(() => toast.error("Error al cargar productos"))
      .finally(() => setLoading(false));
  }, []);

  // Initialize image state when dialog opens (create/edit)
  useEffect(() => {
    if (isOpen) {
      setImageUrl(editingProduct?.image_url || null);
    }
  }, [isOpen, editingProduct]);

  const filteredProducts = productos.filter((product) => {
    const term = searchTerm.toLowerCase();
    return (
      (product.nombre || "").toLowerCase().includes(term) ||
      (product.tipo || "").toLowerCase().includes(term)
    );
  });

  async function onSubmit(values: any) {
    try {
      // Normalizar 'tipo' a los valores que suele aceptar la API
      let tipo = (values.tipo || "").toString().trim();
      if (/materia/i.test(tipo)) tipo = "MateriaPrima";
      else if (/producto/i.test(tipo)) tipo = "ProductoTerminado";

      const stock = Number(values.stock);
      const costo = values.costo !== undefined && values.costo !== null && values.costo !== "" ? Number(values.costo) : null;
      const precio_venta = values.precio_venta !== undefined && values.precio_venta !== null && values.precio_venta !== "" ? Number(values.precio_venta) : null;
      const proveedor_id = values.proveedor_id !== undefined && values.proveedor_id !== null && values.proveedor_id !== "" ? Number(values.proveedor_id) : null;

      const payload = {
        nombre: (values.nombre || "").toString(),
        tipo,
        unidad: (values.unidad || "").toString(),
        stock: Number.isNaN(stock) ? 0 : stock,
        costo: Number.isNaN(costo) ? null : costo,
        precio_venta: Number.isNaN(precio_venta) ? null : precio_venta,
        proveedor_id: Number.isNaN(proveedor_id) ? null : proveedor_id,
        imagen_url: imageUrl || null, // Changed from image_url to imagen_url to match your API
      };
      console.log("Creando/actualizando producto, payload:", payload);
      if (editingProduct) {
        const updated = await updateProducto(editingProduct.id, payload);
        setProductos((prev) => prev.map((p) => (p.id === editingProduct.id ? updated : p)));
        toast.success("Producto actualizado");
        setEditingProduct(null);
      } else {
        const newProd = await createProducto(payload);
        setProductos((prev) => [newProd, ...prev]);
        toast.success("Producto creado");
      }
      setIsOpen(false);
      form.reset();
    } catch (err) {
      console.error(err);
      // Intentar mostrar mensaje de error del backend si viene en formato JSON
      let message = "Error al crear producto";
      try {
        if (err instanceof Error) {
          const parsed = JSON.parse(err.message);
          if (parsed && parsed.error) message = parsed.error;
          else if (parsed && parsed.message) message = parsed.message;
        }
      } catch (e) {
        // no-op
      }
      toast.error(message);
    }
  }

  // Handle image upload from the ImageUpload component
  const handleImageUpload = (url: string) => {
    setImageUrl(url);
  };

  return (
    <Layout>
      <div className="space-y-6">
          <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Productos</h2>
            <p className="text-muted-foreground">Gestión completa del catálogo de productos</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nuevo Producto
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{editingProduct ? 'Editar' : 'Nuevo'} Producto</DialogTitle>
                <DialogDescription>Completa los datos del producto</DialogDescription>
              </DialogHeader>

              <div className="py-2">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Columna Izquierda */}
                      <div className="space-y-4">
                        <FormItem>
                          <FormLabel>Nombre del Producto</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ej: Jabón de Lavanda" 
                              {...form.register("nombre", { required: true })} 
                            />
                          </FormControl>
                        </FormItem>

                        <div className="grid grid-cols-2 gap-4">
                          <FormItem>
                            <FormLabel>Tipo</FormLabel>
                            <FormControl>
                              <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                {...form.register("tipo", { required: true })}
                              >
                                <option value="MateriaPrima">Materia Prima</option>
                                <option value="ProductoTerminado">Producto Terminado</option>
                              </select>
                            </FormControl>
                          </FormItem>

                          <FormItem>
                            <FormLabel>Unidad</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Ej: unidad, kg, litro" 
                                {...form.register("unidad", { required: true })} 
                              />
                            </FormControl>
                          </FormItem>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <FormItem>
                            <FormLabel>Stock</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0"
                                {...form.register("stock", { valueAsNumber: true })} 
                              />
                            </FormControl>
                          </FormItem>

                          <FormItem>
                            <FormLabel>Costo</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0"
                                placeholder="0.00"
                                {...form.register("costo", { valueAsNumber: true })} 
                              />
                            </FormControl>
                          </FormItem>

                          <FormItem>
                            <FormLabel>Precio Venta</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                step="0.01" 
                                min="0"
                                placeholder="0.00"
                                {...form.register("precio_venta", { valueAsNumber: true })} 
                              />
                            </FormControl>
                          </FormItem>
                        </div>

                        <FormItem>
                          <FormLabel>Proveedor ID</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Opcional"
                              {...form.register("proveedor_id", { valueAsNumber: true })} 
                            />
                          </FormControl>
                        </FormItem>
                      </div>

                      {/* Columna Derecha - Imagen */}
                      <div className="space-y-4">
                        <FormItem className="col-span-2">
                          <FormLabel>Imagen del Producto</FormLabel>
                          <ImageUpload 
                            onImageUpload={handleImageUpload}
                            existingImageUrl={editingProduct?.imagen_url}
                          />
                        </FormItem>
                      </div>
                    </div>

                    <DialogFooter className="border-t pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => {
                          setIsOpen(false);
                          setImageUrl(null);
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">
                        {editingProduct ? 'Actualizar' : 'Crear'} Producto
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o código..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">Filtros</Button>
            </div>
          </CardContent>
        </Card>

        {/* Products Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Listado de Productos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Cargando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Costo</TableHead>
                    <TableHead>Precio Venta</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product: any) => (
                    <TableRow key={product.id} className="hover:bg-muted/50 transition-smooth">
                      <TableCell className="font-mono text-sm">{product.id}</TableCell>
                      <TableCell className="font-medium">{product.nombre}</TableCell>
                      <TableCell>{product.tipo}</TableCell>
                      <TableCell>{product.unidad}</TableCell>
                      <TableCell>
                        <span className={product.stock && product.stock < 20 ? "text-destructive font-semibold" : ""}>
                          {product.stock}
                        </span>
                      </TableCell>
                      <TableCell>{product.costo ?? "-"}</TableCell>
                      <TableCell>{product.precio_venta ?? "-"}</TableCell>
                      <TableCell>{product.proveedor_id ?? "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                         
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              // abrir modal en modo edición
                              setEditingProduct(product);
                              form.reset({
                                nombre: product.nombre,
                                tipo: product.tipo,
                                unidad: product.unidad,
                                stock: product.stock,
                                costo: product.costo,
                                precio_venta: product.precio_venta,
                                proveedor_id: product.proveedor_id,
                              });
                              setIsOpen(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeleteTarget(product);
                              setAlertOpen(true);
                            }}
                          >
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
        {/* Confirmación de borrado */}
        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro que quieres eliminar el producto {deleteTarget?.nombre} ? Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel onClick={() => setAlertOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (!deleteTarget) return;
                  try {
                    await deleteProducto(deleteTarget.id);
                    setProductos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
                    toast.success("Producto eliminado");
                  } catch (err) {
                    console.error(err);
                    toast.error("Error al eliminar producto");
                  } finally {
                    setDeleteTarget(null);
                    setAlertOpen(false);
                  }
                }}
              >
                Eliminar
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}

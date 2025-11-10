import React, { useEffect, useState } from "react";
import { getImageUrl } from '@/lib/utils';
import { Layout } from "@/components/Layout";
import { getProductos, deleteProducto, getProducto, adjustInventario, getAlmacenes, addProductoAlmacen } from "@/integrations/api";
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
import { Search, Plus, Edit, Trash2, Package, Warehouse } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { parseApiError } from '@/lib/utils';
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
  const [productDetalle, setProductDetalle] = useState<any | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [viewStockOpen, setViewStockOpen] = useState(false);
  const [viewStockProduct, setViewStockProduct] = useState<any | null>(null);
  const [viewStockDetalle, setViewStockDetalle] = useState<any | null>(null);
  const [viewStockLoading, setViewStockLoading] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<any | null>(null);
  const [adjustCantidad, setAdjustCantidad] = useState<number>(0);
  const [adjustMotivo, setAdjustMotivo] = useState<string>("");
  const [adjustReferencia, setAdjustReferencia] = useState<string>("");
  const [adjustLoading, setAdjustLoading] = useState(false);
  // Estados para asignar/añadir un almacén con existencia al producto
  const [assignOpen, setAssignOpen] = useState(false);
  const [almacenes, setAlmacenes] = useState<any[]>([]);
  const [selectedAlmacenId, setSelectedAlmacenId] = useState<number | null>(null);
  const [assignCantidad, setAssignCantidad] = useState<number>(0);
  const [assignMotivo, setAssignMotivo] = useState<string>("");
  const [assignReferencia, setAssignReferencia] = useState<string>("");
  const [assignLoading, setAssignLoading] = useState(false);
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
      // Inicializar la URL de imagen con la existente del producto (si la tiene).
      // Soportar ambas propiedades por si la API usa `image_url` o `imagen_url`.
      setImageUrl(editingProduct?.imagen_url ?? editingProduct?.image_url ?? null);
    }
  }, [isOpen, editingProduct]);

  // Imagen que debe mostrarse en la UI: priorizar la que está en el estado (nueva subida)
  // y luego la que viene en el objeto del producto (normalizada con getImageUrl).
  const currentImage = imageUrl ?? (editingProduct ? getImageUrl(editingProduct) ?? null : null);

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

      // El campo 'stock' no es editable desde el formulario. Para ediciones usamos el stock actual del producto
      // derivado del inventario por almacén (productDetalle) si está disponible, o del campo editingProduct.stock.
      let stock: number;
      if (editingProduct) {
        const inv = (productDetalle?.inventario) || (editingProduct as any).inventario || [];
        if (Array.isArray(inv) && inv.length > 0) {
          stock = inv.reduce((s: number, it: any) => s + (Number(it.stock_disponible || 0)), 0);
        } else {
          stock = Number(editingProduct.stock ?? 0);
        }
      } else {
        // Al crear un producto nuevo iniciamos stock en 0 (se manejará por inventarios desde backend/almacenes)
        stock = 0;
      }

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
      // Mostrar mensaje legible del backend cuando sea posible
      const message = parseApiError(err) || 'Error al crear producto';
      toast.error(message);
    }
  }

  // Handle image upload from the ImageUpload component
  const handleImageUpload = async (url: string) => {
    setImageUrl(url);

    // Si estamos en modo edición, construimos el mismo payload que onSubmit
    // para llamar al endpoint de edición exactamente igual que al pulsar "Actualizar".
    if (editingProduct && editingProduct.id) {
      try {
        const values = form.getValues();

        // Reconstruir payload siguiendo la lógica de onSubmit
        let tipo = (values.tipo ?? editingProduct.tipo ?? '').toString().trim();
        if (/materia/i.test(tipo)) tipo = 'MateriaPrima';
        else if (/producto/i.test(tipo)) tipo = 'ProductoTerminado';

        // El campo stock no es editable: usar stock derivado de productDetalle/inventario o editingProduct.stock
        let stock: number;
        const inv = (productDetalle?.inventario) || (editingProduct as any).inventario || [];
        if (Array.isArray(inv) && inv.length > 0) {
          stock = inv.reduce((s: number, it: any) => s + (Number(it.stock_disponible || 0)), 0);
        } else {
          stock = Number(editingProduct.stock ?? 0);
        }

        const costoRaw = values.costo !== undefined && values.costo !== null && values.costo !== '' ? values.costo : (editingProduct.costo ?? null);
        const costo = costoRaw !== null ? Number(costoRaw) : null;

        const precioRaw = values.precio_venta !== undefined && values.precio_venta !== null && values.precio_venta !== '' ? values.precio_venta : (editingProduct.precio_venta ?? null);
        const precio_venta = precioRaw !== null ? Number(precioRaw) : null;

        const proveedorRaw = values.proveedor_id !== undefined && values.proveedor_id !== null && values.proveedor_id !== '' ? values.proveedor_id : (editingProduct.proveedor_id ?? null);
        const proveedor_id = proveedorRaw !== null ? Number(proveedorRaw) : null;

        const payload = {
          nombre: (values.nombre ?? editingProduct.nombre ?? '').toString(),
          tipo,
          unidad: (values.unidad ?? editingProduct.unidad ?? '').toString(),
          stock: Number.isNaN(stock) ? 0 : stock,
          costo: Number.isNaN(costo as number) ? null : costo,
          precio_venta: Number.isNaN(precio_venta as number) ? null : precio_venta,
          proveedor_id: Number.isNaN(proveedor_id as number) ? null : proveedor_id,
          imagen_url: url,
        };

        const updated = await updateProducto(editingProduct.id, payload);
        // Actualizar la lista local y el producto en edición
        setProductos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        setEditingProduct(updated);
        toast.success('Imagen guardada en el servidor');
          // actualizar detalle de inventario si está presente
          setProductDetalle(updated);
      } catch (err) {
        console.error('Error guardando la imagen en el backend', err);
        const message = parseApiError(err) || 'No se pudo guardar la imagen en el servidor';
        toast.error(message);
      }
    }
  };

  // Manejar ajuste de inventario (llamada al endpoint POST /api/inventario/ajustar)
  async function handleAdjustSubmit() {
    if (!adjustTarget) return;
    const productId = (viewStockDetalle?.id) || (viewStockProduct?.id) || (editingProduct?.id);
    if (!productId) {
      toast.error('Producto no disponible para ajustar');
      return;
    }

    const cantidad = Number(adjustCantidad || 0);
    if (Number.isNaN(cantidad) || cantidad === 0) {
      toast.error('Ingrese una cantidad distinta de 0');
      return;
    }

    if (cantidad < 0 && (!adjustMotivo || adjustMotivo.trim().length === 0)) {
      toast.error('Motivo requerido para ajustes negativos');
      return;
    }

    const currentFisico = Number(adjustTarget.stock_fisico || 0);
    const newStock = currentFisico + cantidad;
    if (newStock < 0) {
      toast.error('No se permite dejar stock negativo');
      return;
    }

    setAdjustLoading(true);
    try {
      await adjustInventario({ producto_id: productId, almacen_id: adjustTarget.almacen_id, cantidad, motivo: adjustMotivo || undefined, referencia: adjustReferencia || undefined });

      // Refrescar detalle de producto y vista de inventario
      const updated = await getProducto(productId);
      setViewStockDetalle(updated);
      // Actualizar lista principal si el producto está presente
      setProductos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      toast.success('Ajuste aplicado');
      setAdjustOpen(false);
      setAdjustTarget(null);
    } catch (err) {
      console.error('Error ajustando inventario', err);
      const msg = parseApiError(err) || 'Error ajustando inventario';
      toast.error(msg);
    } finally {
      setAdjustLoading(false);
    }
  }

  // Abrir modal de asignar almacén: cargar almacenes si es necesario
  async function openAssignModal() {
    setAssignOpen(true);
    setAlmacenes([]);
    try {
      const lista = await getAlmacenes();
      setAlmacenes(Array.isArray(lista) ? lista : []);
    } catch (err) {
      console.error('No se pudieron cargar los almacenes', err);
      const msg = parseApiError(err) || 'No se pudieron cargar los almacenes';
      toast.error(msg);
    }
  }

  async function handleAssignSubmit() {
    const productId = (viewStockDetalle?.id) || (viewStockProduct?.id) || (editingProduct?.id);
    if (!productId) {
      toast.error('Producto no seleccionado');
      return;
    }
    if (!selectedAlmacenId) {
      toast.error('Seleccione un almacén');
      return;
    }
    const cantidad = Number(assignCantidad || 0);
    if (Number.isNaN(cantidad) || cantidad < 0) {
      toast.error('Ingrese una cantidad válida (>= 0)');
      return;
    }

    setAssignLoading(true);
    try {
      const payload: any = { almacen_id: selectedAlmacenId, cantidad };
      if (assignMotivo) payload.motivo = assignMotivo;
      if (assignReferencia) payload.referencia = assignReferencia;

      const resp = await addProductoAlmacen(productId, payload);

      // Refrescar producto y listas
      const updated = await getProducto(productId);
      setViewStockDetalle(updated);
      setProductos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

      toast.success('Almacén asignado / existencia actualizada');
      setAssignOpen(false);
      setSelectedAlmacenId(null);
      setAssignCantidad(0);
      setAssignMotivo('');
      setAssignReferencia('');
    } catch (err) {
      console.error('Error asignando almacén', err);
      const msg = parseApiError(err) || 'Error al asignar almacén';
      toast.error(msg);
    } finally {
      setAssignLoading(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
          <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Productos</h2>
            <p className="text-muted-foreground">Gestión completa del catálogo de productos</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/docs/inventario-produccion.txt" target="_blank" rel="noreferrer" className="text-sm text-muted-foreground underline">Docs: Inventario/Producción</a>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" variant="default">
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
                          <div>
                            <FormItem>
                              <FormLabel>Stock</FormLabel>
                                <FormControl>
                                  <Input readOnly value={
                                  // mostrar stock total calculado desde productDetalle si existe, si no usar editingProduct.stock o 0
                                  (() => {
                                    const inv = (productDetalle?.inventario) || (editingProduct as any)?.inventario;
                                    if (Array.isArray(inv) && inv.length > 0) {
                                      return inv.reduce((s: number, it: any) => s + (Number(it.stock_disponible || 0)), 0).toLocaleString('es-AR');
                                    }
                                    return Number(editingProduct?.stock ?? 0).toLocaleString('es-AR');
                                  })()
                                  } className="w-full" />
                                </FormControl>
                            </FormItem>
                          </div>

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
                        
                        

                        {/* Contenedor de subida separado y más claro */}
                        <FormItem className="col-span-2">
                          <FormLabel>Subir nueva imagen (opcional)</FormLabel>
                          <div className="mt-2 p-3 border rounded-md bg-background">
                            <ImageUpload 
                              onImageUpload={handleImageUpload}
                              // Pasar la imagen que viene de la base de datos o la última subida
                              // (imageUrl) para que el uploader muestre la preview anterior/alterna al editar.
                              existingImageUrl={imageUrl ?? getImageUrl(editingProduct) ?? null}
                              originalImageUrl={getImageUrl(editingProduct) ?? null}
                            />
                          </div>
                        </FormItem>
                        {/* Inventario por almacén (solo en modo edición) */}
                        {editingProduct && (
                          <div className="col-span-2 mt-4">
                            <h4 className="text-sm font-semibold mb-2">Inventario por almacén</h4>
                            {loadingDetalle ? (
                              <div className="text-sm text-copper-600">Cargando inventario...</div>
                            ) : (
                              (() => {
                                const inv = (productDetalle?.inventario) || (editingProduct as any).inventario || [];
                                if (!Array.isArray(inv) || inv.length === 0) {
                                  return <div className="text-sm text-copper-600">No hay información de inventario por almacén.</div>;
                                }
                                return (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                      <thead>
                                        <tr className="text-copper-700">
                                          <th className="px-2 py-2">Almacén</th>
                                          <th className="px-2 py-2">Tipo</th>
                                          <th className="px-2 py-2">Ubicación</th>
                                          <th className="px-2 py-2">Stock físico</th>
                                          <th className="px-2 py-2">Stock comprometido</th>
                                          <th className="px-2 py-2">Disponible</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {inv.map((it: any) => (
                                          <tr key={it.id} className="border-t">
                                            <td className="px-2 py-2">{it.almacen_nombre || `#${it.almacen_id}`}</td>
                                            <td className="px-2 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${it.almacen_tipo === 'Venta' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{it.almacen_tipo}</span></td>
                                            <td className="px-2 py-2">{it.almacen_ubicacion || '-'}</td>
                                            <td className="px-2 py-2">{Number(it.stock_fisico || 0).toLocaleString('es-AR')}</td>
                                            <td className="px-2 py-2">{Number(it.stock_comprometido || 0).toLocaleString('es-AR')}</td>
                                            <td className="px-2 py-2 font-semibold">{Number(it.stock_disponible || 0).toLocaleString('es-AR')}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                );
                              })()
                            )}
                          </div>
                        )}
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
                      <Button type="submit">
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
                    <TableHead>Imagen</TableHead>
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
                      <TableCell>
                        <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                          <img
                            src={getImageUrl(product) ?? ''}
                            alt={product.nombre ?? 'imagen producto'}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/placeholder.png'; }}
                          />
                        </div>
                      </TableCell>
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
                                // stock no se setea porque no es editable en el formulario
                                costo: product.costo,
                                precio_venta: product.precio_venta,
                                proveedor_id: product.proveedor_id,
                              });
                              setIsOpen(true);
                              // cargar detalle completo (incluye inventario por almacén)
                              setLoadingDetalle(true);
                              setProductDetalle(null);
                              getProducto(product.id)
                                .then((d) => setProductDetalle(d))
                                .catch((e) => { console.error('Error cargando detalle producto:', e); toast.error('No se pudo cargar inventario'); })
                                .finally(() => setLoadingDetalle(false));
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Ver existencias por almacén"
                            onClick={() => {
                              setViewStockProduct(product);
                              setViewStockOpen(true);
                              setViewStockLoading(true);
                              setViewStockDetalle(null);
                              getProducto(product.id)
                                .then((d) => setViewStockDetalle(d))
                                .catch((e) => { console.error('Error cargando existencias:', e); toast.error('No se pudo cargar existencias'); })
                                .finally(() => setViewStockLoading(false));
                            }}
                          >
                            <Warehouse className="h-4 w-4" />
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
        {/* Modal de existencias por almacén (solo lectura) */}
        <Dialog open={viewStockOpen} onOpenChange={setViewStockOpen}>
          <DialogContent className="max-w-4xl w-[95vw] lg:w-3/4 max-h-[80vh] overflow-auto">
            <DialogHeader className="sticky top-0 bg-white/80 backdrop-blur-sm z-10">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <DialogTitle className="text-lg">Existencias</DialogTitle>
                  <DialogDescription className="text-sm">Inventario por almacén (solo lectura)</DialogDescription>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Producto</div>
                  <div className="text-xl font-semibold">{viewStockProduct?.nombre ?? viewStockDetalle?.nombre ?? ''}</div>
                </div>
              </div>
            </DialogHeader>

            <div className="p-2 flex justify-end">
              <Button size="sm" variant="outline" onClick={openAssignModal}>Asignar/Agregar almacén</Button>
            </div>

            <div className="p-4">
              {viewStockLoading ? (
                <div className="text-sm text-copper-600">Cargando...</div>
              ) : (() => {
                const inv = (viewStockDetalle?.inventario) || (viewStockProduct as any)?.inventario || [];
                if (!Array.isArray(inv) || inv.length === 0) {
                  return <div className="text-sm text-copper-600">No hay información de inventario por almacén.</div>;
                }

                const totalDisponible = inv.reduce((s: number, it: any) => s + (Number(it.stock_disponible || 0)), 0);

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Total disponible</div>
                        <div className="text-3xl font-bold text-copper-800">{totalDisponible.toLocaleString('es-AR')}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">Detalles</div>
                        <div className="text-sm text-muted-foreground">Última actualización: —</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {inv.map((it: any) => (
                        <div key={it.id} className="p-4 bg-white rounded-lg shadow-sm border flex flex-col justify-between min-h-[140px]">
                          <div>
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-semibold text-copper-800">{it.almacen_nombre || `#${it.almacen_id}`}</div>
                                <div className="text-xs text-muted-foreground">{it.almacen_ubicacion || 'Sin ubicación'}</div>
                              </div>
                              <Badge className="text-xs" variant={it.almacen_tipo === 'Venta' ? 'secondary' : 'outline'}>{it.almacen_tipo}</Badge>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                              <div className="text-muted-foreground">Físico</div>
                              <div className="font-medium text-right">{Number(it.stock_fisico || 0).toLocaleString('es-AR')}</div>

                              <div className="text-muted-foreground">Comprometido</div>
                              <div className="font-medium text-right">{Number(it.stock_comprometido || 0).toLocaleString('es-AR')}</div>

                              <div className="text-muted-foreground">Disponible</div>
                              <div className="font-bold text-copper-800 text-right">{Number(it.stock_disponible || 0).toLocaleString('es-AR')}</div>
                            </div>
                          </div>
                          <div className="mt-3 text-right flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setAdjustTarget(it);
                                setAdjustCantidad(0);
                                setAdjustMotivo("");
                                setAdjustReferencia("");
                                setAdjustOpen(true);
                              }}
                            >
                              Ajustar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            <DialogFooter>
              <Button onClick={() => setViewStockOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Modal para asignar/crear fila de inventario en un almacén */}
        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Asignar almacén y colocar existencia</DialogTitle>
              <DialogDescription>Crear la fila de inventario o incrementar existencia en el almacén seleccionado.</DialogDescription>
            </DialogHeader>

            <div className="p-2 space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Producto</div>
                <div className="font-semibold">{viewStockProduct?.nombre ?? viewStockDetalle?.nombre ?? editingProduct?.nombre ?? ''}</div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="text-sm">Almacén</label>
                  <select value={selectedAlmacenId ?? ''} onChange={(e) => setSelectedAlmacenId(e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-md border px-2 py-2">
                    <option value="">-- Seleccione un almacén --</option>
                    {almacenes.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.nombre || `#${a.id}`}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm">Cantidad (&gt;= 0)</label>
                  <Input type="number" min={0} value={assignCantidad} onChange={(e) => setAssignCantidad(Number(e.target.value))} />
                </div>

                <div>
                  <label className="text-sm">Motivo (opcional)</label>
                  <Input value={assignMotivo} onChange={(e) => setAssignMotivo(e.target.value)} />
                </div>

                <div>
                  <label className="text-sm">Referencia (opcional)</label>
                  <Input value={assignReferencia} onChange={(e) => setAssignReferencia(e.target.value)} />
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Stock actual</div>
                  <div className="font-medium">{(() => {
                    const inv = (viewStockDetalle?.inventario) || (viewStockProduct as any)?.inventario || (productDetalle as any)?.inventario || [];
                    const existing = inv.find((x: any) => Number(x.almacen_id) === Number(selectedAlmacenId));
                    return Number(existing?.stock_fisico || 0).toLocaleString('es-AR');
                  })()}</div>

                  <div className="text-sm text-muted-foreground mt-2">Stock resultante (actual + cantidad)</div>
                  <div className="font-semibold">{(() => {
                    const inv = (viewStockDetalle?.inventario) || (viewStockProduct as any)?.inventario || (productDetalle as any)?.inventario || [];
                    const existing = inv.find((x: any) => Number(x.almacen_id) === Number(selectedAlmacenId));
                    const actual = Number(existing?.stock_fisico || 0);
                    const cantidad = Number(assignCantidad || 0);
                    return (actual + cantidad).toLocaleString('es-AR');
                  })()}</div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
              <Button disabled={assignLoading} onClick={handleAssignSubmit}>{assignLoading ? 'Aplicando...' : 'Asignar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Modal para ajustar existencias por almacén */}
        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Ajustar existencia</DialogTitle>
              <DialogDescription>Modificar la cantidad física en el almacén. Use valor positivo para sumar y negativo para restar.</DialogDescription>
            </DialogHeader>

            <div className="p-2 space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Almacén</div>
                <div className="font-semibold">{adjustTarget?.almacen_nombre || `#${adjustTarget?.almacen_id || ''}`}</div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <div>
                  <div className="text-sm text-muted-foreground">Stock actual</div>
                  <div className="font-medium">{Number(adjustTarget?.stock_fisico || 0).toLocaleString('es-AR')}</div>
                </div>

                <div>
                  <label className="text-sm">Cantidad (usar negativo para restar)</label>
                  <Input type="number" value={adjustCantidad} onChange={(e) => setAdjustCantidad(Number(e.target.value))} />
                </div>

                <div>
                  <label className="text-sm">Motivo {adjustCantidad < 0 ? <span className="text-destructive">(requerido para negativos)</span> : '(opcional)'}</label>
                  <Input value={adjustMotivo} onChange={(e) => setAdjustMotivo(e.target.value)} />
                </div>

                <div>
                  <label className="text-sm">Referencia (opcional)</label>
                  <Input value={adjustReferencia} onChange={(e) => setAdjustReferencia(e.target.value)} />
                </div>

                <div>
                  <div className="text-sm text-muted-foreground">Stock resultante</div>
                  <div className="font-semibold">{Number((adjustTarget?.stock_fisico || 0) + Number(adjustCantidad || 0)).toLocaleString('es-AR')}</div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setAdjustOpen(false); setAdjustTarget(null); }}>Cancelar</Button>
              <Button disabled={adjustLoading} onClick={handleAdjustSubmit}>{adjustLoading ? 'Aplicando...' : 'Confirmar ajuste'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

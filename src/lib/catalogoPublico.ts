import { Product } from '@/lib/types';

// Conversión del catálogo público (/api/productos/catalogo) al Product que usa la tienda.
// La usan la página principal (Hero) y la página "Set toda ocasión".

export function slugifyCategory(name: string) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Nombres de todas las categorías del producto (la API envía `categorias`; `categoria` es la antigua única)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function categoryNames(item: any): string[] {
  const list = Array.isArray(item?.categorias) ? item.categorias : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const names = list.map((c: any) => String(c?.nombre ?? c?.name ?? '')).filter(Boolean);
  if (names.length > 0) return names;
  const single = (item?.categoria && (item.categoria.nombre ?? item.categoria.name)) ?? item?.categoria_nombre ?? item?.category ?? '';
  return single ? [String(single)] : [];
}

// Texto que ve el cliente: si es de Hombre y de Mujer se muestra "Unisex"
export function categoryLabel(names: string[]) {
  const slugs = names.map(slugifyCategory);
  if (slugs.includes('hombre') && slugs.includes('mujer')) return 'Unisex';
  return names.join(', ');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function productoDesdeCatalogo(item: any): Product {
  return {
    id: item.id ?? item.producto_id ?? 0,
    name: item.nombre ?? item.name ?? '',
    image_url: item.image_url ?? item.imagen ?? item.image ?? undefined,
    featured: Boolean(item.destacado ?? item.featured ?? false),
    agotado: Boolean(item.agotado),
    mas_pedido: Boolean(item.mas_pedido),
    brand: (item.marca && (item.marca.nombre ?? item.marca.name)) ?? item.marca_nombre ?? item.marca ?? item.brand ?? '',
    categories: categoryNames(item),
    category: categoryLabel(categoryNames(item)),
    description: item.descripcion ?? item.description ?? '',
    price: Number(item.precio_venta ?? item.price ?? 0) || 0,
    precio_venta: item.precio_venta ?? null,
    // Attach formulas and tamanos array from catalog (variants). `formulas` is used by the new API
    formulas: Array.isArray(item.formulas) ? item.formulas : (item.formulas || []),
    // Prefer explicit `tamanos` when present, otherwise fall back to `formulas` or `sizes`.
    tamanos: Array.isArray(item.tamanos) ? item.tamanos : (Array.isArray(item.formulas) ? item.formulas : (item.sizes || [])),
    stock: Number(item.stock ?? item.stock_disponible ?? 0) || 0,
    // attach raw inventory and full objects for detail views
    inventario: item.inventario ?? item.inventario_detalle ?? item.inventory ?? undefined,
    categoria_obj: item.categoria ?? null,
    ficha: item.ficha ?? null,
    marca_obj: item.marca ?? null,
  } as Product;
}

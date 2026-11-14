export interface Product {
  id: number;
  name: string;
  image_url?: string;
  featured?: boolean;
  // Sin esencia suficiente: se muestra con el cartel AGOTADO y no se puede pedir
  agotado?: boolean;
  // Entre los más pedidos recientemente: etiqueta "🔥 Más pedido"
  mas_pedido?: boolean;
  brand?: string;
  category?: string;
  // Todas las categorías del perfume (Hombre y Mujer a la vez = unisex)
  categories?: string[];
  description?: string;
  price?: number;
  precio_venta?: number;
  price_venta?: number;
  stock?: number;
  tamanos?: Array<any>;
  formulas?: Array<any>;
  inventario?: Array<any>;
  categoria_obj?: any;
  marca_obj?: any;
  // Ficha del perfume (notas, para quién...), solo si está revisada
  ficha?: import('./fichaPerfume').FichaPerfume | null;
  // En el carrito: vino del Set toda ocasión para ella ('mujer') o para él ('hombre')
  set_etiqueta?: 'mujer' | 'hombre';
  // Cuántos perfumes tenía ese set al agregarlo (si quita uno, deja de mostrarse como set)
  set_total?: number;
  // Precio del tamaño elegido al agregarlo al carrito
  precio_snapshot?: number;
}

export type ProductListResponse =
  | Product[]
  | { data: Product[]; total?: number; page?: number; per_page?: number };

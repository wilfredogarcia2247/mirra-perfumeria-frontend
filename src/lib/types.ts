export interface Product {
  id: number;
  name: string;
  image_url?: string;
  featured?: boolean;
  // Sin esencia suficiente: se muestra con el cartel AGOTADO y no se puede pedir
  agotado?: boolean;
  brand?: string;
  category?: string;
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
}

export type ProductListResponse =
  | Product[]
  | { data: Product[]; total?: number; page?: number; per_page?: number };

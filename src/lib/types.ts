export interface Product {
  id: number;
  name: string;
  image_url?: string;
  featured?: boolean;
  brand?: string;
  category?: string;
  description?: string;
  price?: number;
  precio_venta?: number;
  price_venta?: number;
  stock?: number;
  tamanos?: Array<any>;
}

export type ProductListResponse =
  | Product[]
  | { data: Product[]; total?: number; page?: number; per_page?: number };

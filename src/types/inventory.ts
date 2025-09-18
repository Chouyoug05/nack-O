export interface ProductDoc {
  name: string;
  category: string;
  price: number;
  quantity: number;
  cost: number;
  description?: string;
  icon?: string;
  imageUrl?: string;
  imagePublicId?: string;
  imageDeleteToken?: string;
  formula?: {
    units: number;
    price: number;
  };
  createdAt: number;
  updatedAt: number;
}

export interface LossDoc {
  productId: string;
  productName: string;
  quantity: number;
  reason: string;
  date: string; // ISO yyyy-mm-dd
  cost: number;
  createdAt: number;
}

export type PaymentMethod = 'card' | 'cash' | 'mobile';

export interface SaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  isFormula?: boolean;
}

export interface SaleDoc {
  items: SaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
  createdAt: number;
} 
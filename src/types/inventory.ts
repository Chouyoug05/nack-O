export interface RawMaterial {
  name: string;
  unitCost: number;
}

export interface ProductionCost {
  type: string; // main d'œuvre, gaz, eau, condiments, etc.
  amount: number;
}

export interface FoodCost {
  rawMaterials: RawMaterial[];
  productionCosts: ProductionCost[];
}

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
  foodCost?: FoodCost; // Module Food Cost pour produits alimentaires
  /** Si true, le produit apparaît sur le menu digital (menu du jour). Si aucun produit n'est coché, tous sont visibles. */
  showOnMenuDigital?: boolean;
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
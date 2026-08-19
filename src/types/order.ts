export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  image?: string;
  imageUrl?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export type OrderStatus = 'pending' | 'sent' | 'cancelled' | 'confirmed' | 'served';
export type KitchenStatus = 'en-attente' | 'en-preparation' | 'pret' | 'termine';
export type PaymentStatus = 'unpaid' | 'paid';

export interface Order {
  id: string;
  orderNumber: number | string;
  tableNumber: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  paymentStatus?: PaymentStatus;
  kitchenStatus?: KitchenStatus;
  source?: 'qr' | 'internal';
  createdAt: Date;
  agentCode: string;
  agentName?: string;
}
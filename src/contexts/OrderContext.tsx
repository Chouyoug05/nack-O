import { createContext, useContext, useState, ReactNode } from "react";
import { Order, OrderStatus, CartItem } from "@/types/order";

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  getOrdersByStatus: (status: OrderStatus) => Order[];
  getOrdersByAgent: (agentCode: string) => Order[];
  orderCounter: number;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

export const OrderProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderCounter, setOrderCounter] = useState(1);

  const addOrder = (orderData: Omit<Order, 'id' | 'createdAt'>) => {
    const newOrder: Order = {
      ...orderData,
      id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date()
    };
    
    setOrders(prev => [newOrder, ...prev]);
    setOrderCounter(prev => prev + 1);
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    setOrders(prev => prev.map(order => 
      order.id === orderId ? { ...order, status } : order
    ));
  };

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter(order => order.status === status);
  };

  const getOrdersByAgent = (agentCode: string) => {
    return orders.filter(order => order.agentCode === agentCode);
  };

  return (
    <OrderContext.Provider value={{
      orders,
      addOrder,
      updateOrderStatus,
      getOrdersByStatus,
      getOrdersByAgent,
      orderCounter
    }}>
      {children}
    </OrderContext.Provider>
  );
};
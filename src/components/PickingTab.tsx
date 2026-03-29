import React, { useState, useMemo } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { Order, Product, Customer } from '../types';
import { Package, Check, AlertCircle } from 'lucide-react';

interface PickingTabProps {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  products: Product[];
  customers: Customer[];
}

export default function PickingTab({ orders, setOrders, products, customers }: PickingTabProps) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  // Group orders by product
  const pickingList = useMemo(() => {
    const groups: Record<string, { product: Product; orders: Order[]; totalRequested: number; totalAllocated: number }> = {};
    
    orders.forEach(order => {
      if (order.requestedQuantity === 0) return; // Skip empty orders
      
      const product = products.find(p => p.id === order.productId);
      if (!product) return;

      if (!groups[product.id]) {
        groups[product.id] = { product, orders: [], totalRequested: 0, totalAllocated: 0 };
      }
      
      groups[product.id].orders.push(order);
      groups[product.id].totalRequested += order.requestedQuantity;
      groups[product.id].totalAllocated += order.allocatedQuantity;
    });

    return Object.values(groups);
  }, [orders, products]);

  const handleAllocate = (orderId: string, allocatedQty: number) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, allocatedQuantity: allocatedQty, updatedAt: Date.now() } : o
    ));
  };

  const handleAutoAllocateProduct = (productId: string) => {
    const group = pickingList.find(g => g.product.id === productId);
    if (!group) return;

    setOrders(prev => {
      const newOrders = [...prev];
      let remainingStock = group.product.purchaseQuantity || 0;
      
      // Sort orders: Urgent first, then by creation date (oldest first)
      const productOrders = newOrders
        .filter(o => o.productId === productId && o.requestedQuantity > 0)
        .sort((a, b) => {
          if (a.isUrgent && !b.isUrgent) return -1;
          if (!a.isUrgent && b.isUrgent) return 1;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });

      for (const order of productOrders) {
        const orderIndex = newOrders.findIndex(o => o.id === order.id);
        if (orderIndex !== -1) {
          const toAllocate = Math.min(newOrders[orderIndex].requestedQuantity, remainingStock);
          newOrders[orderIndex] = { ...newOrders[orderIndex], allocatedQuantity: toAllocate, updatedAt: Date.now() };
          remainingStock -= toAllocate;
        }
      }
      return newOrders;
    });
  };

  const handleClearAllocations = (productId?: string) => {
    setOrders(prev => prev.map(o => {
      if (!productId || o.productId === productId) {
        return { ...o, allocatedQuantity: 0, updatedAt: Date.now() };
      }
      return o;
    }));
  };

  const handleAutoAllocateAll = () => {
    setOrders(prev => {
      const newOrders = [...prev];
      
      pickingList.forEach(group => {
        let remainingStock = group.product.purchaseQuantity || 0;
        
        // Sort orders for this product: Urgent first, then by creation date (oldest first)
        const productOrders = newOrders
          .filter(o => o.productId === group.product.id && o.requestedQuantity > 0)
          .sort((a, b) => {
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;
            return (a.createdAt || 0) - (b.createdAt || 0);
          });

        for (const order of productOrders) {
          const orderIndex = newOrders.findIndex(o => o.id === order.id);
          if (orderIndex !== -1) {
            const toAllocate = Math.min(newOrders[orderIndex].requestedQuantity, remainingStock);
            newOrders[orderIndex] = { ...newOrders[orderIndex], allocatedQuantity: toAllocate, updatedAt: Date.now() };
            remainingStock -= toAllocate;
          }
        }
      });
      
      return newOrders;
    });
  };

  if (pickingList.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-[var(--color-border)]">
        <Package className="mx-auto h-12 w-12 text-gray-300 mb-3" />
        <h3 className="text-lg font-medium text-gray-900">目前沒有需要配貨的商品</h3>
        <p className="text-gray-500">當顧客有喊單數量時，這裡會顯示配貨清單。</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h2 className="text-xl font-bold text-[var(--color-text)]">配貨與揀貨</h2>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => handleClearAllocations()}
            className="flex-1 sm:flex-none px-4 py-2 bg-gray-200 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-300 transition-colors"
          >
            清除全部配貨
          </button>
          <button 
            onClick={handleAutoAllocateAll}
            className="flex-1 sm:flex-none px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            全部自動配貨
          </button>
        </div>
      </div>

      {pickingList.map(group => {
        const isExpanded = expandedProductId === group.product.id;
        const isFullyAllocated = group.totalAllocated === group.totalRequested;
        const stockShortage = group.totalRequested > (group.product.purchaseQuantity || 0);

        return (
          <div key={group.product.id} className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
            {/* Product Header */}
            <div 
              className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? 'border-b border-gray-100' : ''}`}
              onClick={() => setExpandedProductId(isExpanded ? null : group.product.id)}
            >
              <div className="flex items-center gap-3 mb-3 sm:mb-0">
                <div className={`p-2 rounded-lg ${isFullyAllocated ? 'bg-green-100 text-green-600' : stockShortage ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                  {isFullyAllocated ? <Check size={20} /> : stockShortage ? <AlertCircle size={20} /> : <Package size={20} />}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{group.product.name}</h3>
                  <p className="text-sm text-gray-500">
                    {group.product.variant || '無規格'} | 
                    進貨: {group.product.purchaseQuantity || 0} | 
                    剩餘: {(group.product.purchaseQuantity || 0) - group.totalAllocated}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                <div className="text-center px-3 py-1 bg-gray-50 rounded-lg">
                  <span className="block text-xs text-gray-500">總喊單</span>
                  <span className="font-bold text-lg">{group.totalRequested}</span>
                </div>
                <div className="text-center px-3 py-1 bg-gray-50 rounded-lg">
                  <span className="block text-xs text-gray-500">已配貨</span>
                  <span className={`font-bold text-lg ${group.totalAllocated < group.totalRequested ? 'text-orange-500' : 'text-green-600'}`}>
                    {group.totalAllocated}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-3 sm:mt-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleClearAllocations(group.product.id); }}
                    className="px-3 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition-colors whitespace-nowrap"
                  >
                    清除配貨
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleAutoAllocateProduct(group.product.id); }}
                    className="px-3 py-2 bg-[var(--color-primary)] text-white text-sm rounded-lg hover:bg-opacity-90 transition-colors whitespace-nowrap"
                  >
                    自動配貨
                  </button>
                </div>
              </div>
            </div>

            {/* Orders List (Expanded) */}
            {isExpanded && (
              <div className="p-4 bg-gray-50">
                <div className="space-y-3">
                  {group.orders.map(order => {
                    const customer = customers.find(c => c.id === order.customerId);
                    return (
                      <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3 rounded-lg border border-gray-200 gap-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm shrink-0">
                            {customer?.name.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{customer?.name || '未知顧客'}</p>
                              {order.isUrgent && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded uppercase">緊急</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{formatInTimeZone(new Date(order.createdAt), 'Asia/Taipei', 'yyyyMMddHHmm')}</span>
                              {order.note && <span>| 備註: {order.note}</span>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4 self-end sm:self-auto">
                          <div className="text-sm">
                            <span className="text-gray-500 mr-2">喊單:</span>
                            <span className="font-bold">{order.requestedQuantity}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">配貨:</span>
                            <input 
                              type="number" 
                              min="0"
                              max={order.requestedQuantity}
                              value={order.allocatedQuantity}
                              onChange={(e) => handleAllocate(order.id, Math.max(0, parseInt(e.target.value) || 0))}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

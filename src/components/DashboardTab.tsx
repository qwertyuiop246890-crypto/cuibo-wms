import React, { useState, useMemo } from 'react';
import { Product, Customer, Order } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { DollarSign, Package, TrendingUp, Users, ShoppingCart } from 'lucide-react';

interface DashboardTabProps {
  products: Product[];
  customers: Customer[];
  orders: Order[];
}

export default function DashboardTab({ products, customers, orders }: DashboardTabProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const filteredOrders = useMemo(() => {
    if (!startDate && !endDate) return orders;

    return orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
      const end = endDate ? endOfDay(parseISO(endDate)) : new Date(8640000000000000);
      return isWithinInterval(orderDate, { start, end });
    });
  }, [orders, startDate, endDate]);

  const totalRevenue = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + order.subtotal, 0);
  }, [filteredOrders]);

  const totalInventoryValue = useMemo(() => {
    return products.reduce((sum, product) => {
      const productOrders = orders.filter(o => o.productId === product.id);
      const totalAllocated = productOrders.reduce((acc, o) => acc + o.allocatedQuantity, 0);
      const remainingStock = Math.max(0, (product.purchaseQuantity || 0) - (product.lossQuantity || 0) - totalAllocated);
      return sum + (remainingStock * product.price);
    }, 0);
  }, [products, orders]);

  const customerRanking = useMemo(() => {
    const spendingMap = new Map<string, number>();
    
    filteredOrders.forEach(order => {
      const current = spendingMap.get(order.customerId) || 0;
      spendingMap.set(order.customerId, current + order.subtotal);
    });

    return Array.from(spendingMap.entries())
      .map(([customerId, amount]) => {
        const customer = customers.find(c => c.id === customerId);
        return {
          id: customerId,
          name: customer?.name || '未知顧客',
          amount
        };
      })
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10); // Top 10
  }, [filteredOrders, customers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-[var(--color-text)]">儀表板</h2>
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-[var(--color-border)]">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="p-1 text-sm border-none focus:ring-0 text-[var(--color-text)] bg-transparent"
          />
          <span className="text-gray-400">-</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="p-1 text-sm border-none focus:ring-0 text-[var(--color-text)] bg-transparent"
          />
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs text-red-500 hover:text-red-700 px-2"
            >
              清除
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[var(--color-text)] opacity-80">
            <DollarSign size={20} />
            <h3 className="font-medium">營業總額 (篩選區間)</h3>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text)]">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>

        <div className="card p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[var(--color-text)] opacity-80">
            <Package size={20} />
            <h3 className="font-medium">總庫存價值 (現有)</h3>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text)]">
            ${totalInventoryValue.toLocaleString()}
          </p>
        </div>
        
        <div className="card p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[var(--color-text)] opacity-80">
            <ShoppingCart size={20} />
            <h3 className="font-medium">訂單數量 (篩選區間)</h3>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text)]">
            {filteredOrders.length}
          </p>
        </div>

        <div className="card p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[var(--color-text)] opacity-80">
            <Users size={20} />
            <h3 className="font-medium">消費顧客數 (篩選區間)</h3>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text)]">
            {new Set(filteredOrders.map(o => o.customerId)).size}
          </p>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4 text-[var(--color-text)]">
          <TrendingUp size={24} />
          <h3 className="text-xl font-bold">顧客消費金額排行 (Top 10)</h3>
        </div>
        
        {customerRanking.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-text)] opacity-70">
                  <th className="p-3 font-medium">排名</th>
                  <th className="p-3 font-medium">顧客名稱</th>
                  <th className="p-3 font-medium text-right">消費金額</th>
                </tr>
              </thead>
              <tbody>
                {customerRanking.map((customer, index) => (
                  <tr key={customer.id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-gray-50/50">
                    <td className="p-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-200 text-gray-700' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {index + 1}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-[var(--color-text)]">{customer.name}</td>
                    <td className="p-3 text-right font-bold text-[var(--color-text)]">
                      ${customer.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            在選定的日期區間內沒有消費紀錄
          </div>
        )}
      </div>
    </div>
  );
}

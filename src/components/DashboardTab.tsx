import React, { useState, useMemo } from 'react';
import { Product, Customer, Order } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, parseISO, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { DollarSign, Package, TrendingUp, Users, ShoppingCart, Filter } from 'lucide-react';

interface DashboardTabProps {
  products: Product[];
  customers: Customer[];
  orders: Order[];
}

export default function DashboardTab({ products, customers, orders }: DashboardTabProps) {
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [orderStatus, setOrderStatus] = useState<'all' | 'unpaid' | 'paid' | 'unshipped' | 'shipped'>('all');

  const handleDatePreset = (preset: 'today' | 'last7days' | 'thisMonth' | 'lastMonth' | 'all') => {
    const today = new Date();
    if (preset === 'today') {
      setStartDate(format(today, 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'last7days') {
      setStartDate(format(subDays(today, 6), 'yyyy-MM-dd'));
      setEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'thisMonth') {
      setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
    } else if (preset === 'lastMonth') {
      const lastMonth = subMonths(today, 1);
      setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
      setEndDate(format(endOfMonth(lastMonth), 'yyyy-MM-dd'));
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (startDate || endDate) {
      result = result.filter(order => {
        const orderDate = new Date(order.createdAt);
        const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
        const end = endDate ? endOfDay(parseISO(endDate)) : new Date(8640000000000000);
        return isWithinInterval(orderDate, { start, end });
      });
    }

    if (orderStatus !== 'all') {
      result = result.filter(order => {
        if (orderStatus === 'unpaid') return !order.isPaid;
        if (orderStatus === 'paid') return order.isPaid;
        if (orderStatus === 'unshipped') return !order.isShipped;
        if (orderStatus === 'shipped') return order.isShipped;
        return true;
      });
    }

    return result;
  }, [orders, startDate, endDate, orderStatus]);

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
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <h2 className="text-2xl font-bold text-[var(--color-text)] shrink-0">儀表板</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-[var(--color-border)]">
            <Filter size={16} className="text-gray-400 ml-1" />
            <select
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value as any)}
              className="p-1 text-sm border-none focus:ring-0 text-[var(--color-text)] bg-transparent outline-none"
            >
              <option value="all">所有訂單</option>
              <option value="unpaid">未收款</option>
              <option value="paid">已收款</option>
              <option value="unshipped">未出貨</option>
              <option value="shipped">已出貨</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl shadow-sm border border-[var(--color-border)]">
            <button onClick={() => handleDatePreset('today')} className="px-2 py-1 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors">今日</button>
            <button onClick={() => handleDatePreset('last7days')} className="px-2 py-1 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors">近7天</button>
            <button onClick={() => handleDatePreset('thisMonth')} className="px-2 py-1 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors">本月</button>
            <button onClick={() => handleDatePreset('lastMonth')} className="px-2 py-1 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors">上月</button>
            <button onClick={() => handleDatePreset('all')} className="px-2 py-1 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors">全部</button>
          </div>

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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[var(--color-text)] opacity-80">
            <DollarSign size={20} />
            <h3 className="font-medium">銷售額 (篩選區間)</h3>
          </div>
          <p className="text-3xl font-bold text-[var(--color-text)]">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>
        
        <div className="card p-6 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[var(--color-text)] opacity-80">
            <Package size={20} />
            <h3 className="font-medium">庫存商品總價值</h3>
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
        
        <div className="space-y-4">
          {customerRanking.map((customer, index) => (
            <div key={customer.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-200 text-gray-700' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-blue-50 text-blue-600'
                }`}>
                  {index + 1}
                </div>
                <span className="font-bold text-[var(--color-text)]">{customer.name}</span>
              </div>
              <span className="font-mono font-bold text-[var(--color-text)]">
                ${customer.amount.toLocaleString()}
              </span>
            </div>
          ))}
          {customerRanking.length === 0 && (
            <div className="text-center text-gray-500 py-4">
              您選取的篩選條件內，目前尚無排名資料
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useRef, useState } from 'react';
import { Printer, Download, Search, CheckCircle, Truck, PackageCheck, Scissors } from 'lucide-react';
import html2canvas from 'html2canvas';
import { formatInTimeZone } from 'date-fns-tz';
import { v4 as uuidv4 } from 'uuid';
import { Order, Product, Customer } from '../types';
import { useDialog } from '../hooks/useDialog';
import { calculateSubtotal } from '../lib/priceUtils';

interface Props {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  products: Product[];
  customers: Customer[];
  notificationTemplate: string;
}

export default function ReceiptsTab({ orders, setOrders, products, customers, notificationTemplate }: Props) {
  const { showAlert, showConfirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [showShipped, setShowShipped] = useState(false);
  const receiptRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Group orders by customer
  const ordersByCustomer = orders.reduce((acc, order) => {
    if (!showShipped && order.isShipped) return acc;
    if (!acc[order.customerId]) {
      acc[order.customerId] = [];
    }
    acc[order.customerId].push(order);
    return acc;
  }, {} as Record<string, Order[]>);

  const filteredCustomers = customers.filter(c => 
    c.name.replace(/\s+/g, '').toLowerCase().includes(searchTerm.replace(/\s+/g, '').toLowerCase()) && 
    ordersByCustomer[c.id] && 
    ordersByCustomer[c.id].length > 0
  );

  const handlePrint = () => {
    window.print();
  };

  const handleExportImage = async (customerId: string, customerName: string) => {
    const element = receiptRefs.current[customerId];
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2, // Higher resolution
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `收據_${customerName}_${formatInTimeZone(new Date(), 'Asia/Taipei', 'yyyyMMdd')}.png`;
      link.click();
    } catch (error) {
      console.error("Failed to export image", error);
      showAlert("錯誤", "圖片產生失敗，請再試一次。");
    }
  };

  const handleToggleShipped = (customerId: string, customerName: string) => {
    const customerOrders = orders.filter(o => o.customerId === customerId);
    if (customerOrders.length === 0) return;

    const isAllShipped = customerOrders.every(o => o.isShipped);

    if (isAllShipped) {
      showConfirm("取消出貨", `確定要取消 ${customerName} 的出貨狀態嗎？`, () => {
        setOrders(prev => prev.map(o => 
          o.customerId === customerId ? { ...o, isShipped: false, updatedAt: Date.now() } : o
        ));
        showAlert("成功", `已取消 ${customerName} 的出貨狀態`);
      });
    } else {
      const hasIncompleteOrders = customerOrders.some(o => 
        o.requestedQuantity > o.allocatedQuantity || o.requestedQuantity > (o.arrivedQuantity || 0)
      );

      const confirmMessage = hasIncompleteOrders 
        ? `⚠️ 注意：${customerName} 還有部分商品尚未完全配單或到貨！\n\n確定要強制將所有訂單標記為已出貨嗎？`
        : `確定要將 ${customerName} 的所有訂單標記為已出貨嗎？這將會把這些訂單從配單與買到管理中隱藏。`;

      showConfirm("確認出貨", confirmMessage, () => {
        setOrders(prev => prev.map(o => 
          o.customerId === customerId ? { ...o, isShipped: true, updatedAt: Date.now() } : o
        ));
        showAlert("成功", `已將 ${customerName} 的訂單標記為已出貨`);
      });
    }
  };

  const handleSplitShip = (customerId: string, customerName: string) => {
    showConfirm("拆單寄出", `確定要將 ${customerName} 已配貨的商品拆單寄出嗎？\n\n未配貨的商品將會保留在原來的訂單中等待下次出貨。`, () => {
      setOrders(prev => {
        const newOrders = [...prev];
        const customerOrders = newOrders.filter(o => o.customerId === customerId && !o.isShipped);
        
        customerOrders.forEach(order => {
          if (order.allocatedQuantity === 0) {
            // Do nothing, remains unshipped
            return;
          }
          
          if (order.allocatedQuantity === order.requestedQuantity) {
            // Fully allocated, just mark as shipped
            const index = newOrders.findIndex(o => o.id === order.id);
            if (index !== -1) {
              newOrders[index] = { ...newOrders[index], isShipped: true, updatedAt: Date.now() };
            }
          } else if (order.allocatedQuantity > 0 && order.allocatedQuantity < order.requestedQuantity) {
            // Partially allocated, split the order
            const index = newOrders.findIndex(o => o.id === order.id);
            if (index !== -1) {
              const originalOrder = newOrders[index];
              const remainingQuantity = originalOrder.requestedQuantity - originalOrder.allocatedQuantity;
              const arrivedQty = originalOrder.arrivedQuantity || 0;
              
              // The shipped part
              newOrders[index] = {
                ...originalOrder,
                requestedQuantity: originalOrder.allocatedQuantity,
                allocatedQuantity: originalOrder.allocatedQuantity,
                arrivedQuantity: Math.min(arrivedQty, originalOrder.allocatedQuantity),
                isShipped: true,
                updatedAt: Date.now()
              };
              
              // The remaining part
              const newOrder: Order = {
                ...originalOrder,
                id: uuidv4(),
                requestedQuantity: remainingQuantity,
                allocatedQuantity: 0,
                arrivedQuantity: Math.max(0, arrivedQty - originalOrder.allocatedQuantity),
                isShipped: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
              };
              newOrders.push(newOrder);
            }
          }
        });
        
        return newOrders;
      });
      showAlert("成功", `已將 ${customerName} 的訂單拆單寄出`);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <h2 className="text-2xl font-bold">收據與列印</h2>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text)] px-2 bg-white rounded-xl shadow-sm border border-[var(--color-border)]">
            <input 
              type="checkbox" 
              checked={showShipped} 
              onChange={(e) => setShowShipped(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            顯示已出貨
          </label>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
            <Printer size={18} /> 列印全部 (A4)
          </button>
        </div>
      </div>

      <div className="relative no-print">
        <input 
          type="text" 
          placeholder="搜尋顧客收據..." 
          className="input-field"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-10 opacity-60 no-print">
          找不到收據。請先建立訂單以產生收據。
        </div>
      )}

      {/* Print Container */}
      <div className="receipt-container">
        {filteredCustomers.map(customer => {
          const customerOrders = ordersByCustomer[customer.id] || [];
          const allCustomerOrders = orders.filter(o => o.customerId === customer.id);
          const isAllShipped = allCustomerOrders.length > 0 && allCustomerOrders.every(o => o.isShipped);
          
          // Calculate subtotals for each order based on allocated quantity and product discount
          const ordersWithRecalculatedSubtotal = customerOrders.map(order => {
            const product = products.find(p => p.id === order.productId);
            if (!product) return { ...order, recalculatedSubtotal: 0 };
            return { 
              ...order, 
              recalculatedSubtotal: calculateSubtotal(product, order.allocatedQuantity) 
            };
          });

          const totalAmount = ordersWithRecalculatedSubtotal.reduce((sum, order) => sum + order.recalculatedSubtotal, 0);
          const totalItems = customerOrders.reduce((sum, order) => sum + order.allocatedQuantity, 0);

          const hasIncompleteOrders = customerOrders.some(o => 
            o.requestedQuantity > o.allocatedQuantity || o.requestedQuantity > (o.arrivedQuantity || 0)
          );
          const hasAllocatedItems = customerOrders.some(o => o.allocatedQuantity > 0);
          const canSplitShip = hasIncompleteOrders && hasAllocatedItems && !isAllShipped;

          return (
            <div 
              key={customer.id} 
              className="receipt-item card p-6 mb-6 relative bg-white"
              ref={el => receiptRefs.current[customer.id] = el}
            >
              <div className="absolute top-4 right-4 flex gap-2 no-print">
                {canSplitShip && (
                  <button 
                    onClick={() => handleSplitShip(customer.id, customer.name)}
                    className="p-2 rounded-full transition-colors flex items-center gap-1 text-sm font-bold text-orange-600 bg-orange-50 hover:bg-orange-100"
                    title="拆單寄出 (僅出貨已配貨商品)"
                  >
                    <Scissors size={18} />
                    <span className="hidden sm:inline">拆單寄出</span>
                  </button>
                )}
                <button 
                  onClick={() => handleToggleShipped(customer.id, customer.name)}
                  className={`p-2 rounded-full transition-colors flex items-center gap-1 text-sm font-bold ${isAllShipped ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                  title={isAllShipped ? "取消出貨" : "標記為已出貨"}
                >
                  {isAllShipped ? <PackageCheck size={18} /> : <Truck size={18} />}
                  <span className="hidden sm:inline">{isAllShipped ? '已出貨' : '出貨'}</span>
                </button>
                <button 
                  onClick={() => handleExportImage(customer.id, customer.name)}
                  className="p-2 text-[var(--color-text)] opacity-50 hover:opacity-100 hover:bg-[var(--color-bg)] rounded-full transition-colors"
                  title="匯出為圖片"
                >
                  <Download size={18} />
                </button>
              </div>

              {/* Receipt Items */}
              <table className="w-full text-left border-collapse mb-4 print:mb-6 print:table table-fixed">
                <thead className="print:table-header-group">
                  {/* Receipt Header (Inside thead so it repeats on page break) */}
                  <tr>
                    <th colSpan={6} className="font-normal pb-4">
                      <div className="text-center mb-2 print:break-inside-avoid">
                        <p className="text-xs print:text-sm text-gray-500 mb-2">Cuibo 倉管系統</p>
                        <h3 className="text-2xl print:text-3xl font-bold text-[#8B7355] mb-6">{customer.name} 顧客訂單明細</h3>
                        
                        <div className="flex justify-between text-xs print:text-sm text-gray-400 mb-2 px-2">
                          <span>列印日期：{formatInTimeZone(new Date(), 'Asia/Taipei', 'yyyy/MM/dd')}</span>
                          <span>顧客：{customer.name}</span>
                        </div>
                        <div className="border-b-2 border-[#8B7355]"></div>
                      </div>
                    </th>
                  </tr>
                  <tr className="border-b border-gray-200 text-sm print:text-base text-gray-800 font-bold">
                    <th className="w-12 print:w-16 py-3 text-center"></th>
                    <th className="w-[30%] py-3">商品名稱</th>
                    <th className="w-[20%] py-3">款式</th>
                    <th className="w-[15%] py-3">單價</th>
                    <th className="w-[10%] py-3 text-center">數量</th>
                    <th className="w-[15%] py-3 text-right">小計</th>
                  </tr>
                </thead>
                <tbody className="print:table-row-group">
                  {ordersWithRecalculatedSubtotal.map(order => {
                    const product = products.find(p => p.id === order.productId);
                    if (!product || order.allocatedQuantity === 0) return null;

                    const unitPrice = order.recalculatedSubtotal / order.allocatedQuantity;
                    const orderDate = formatInTimeZone(order.createdAt || Date.now(), 'Asia/Taipei', 'M/dd HH:mm');

                    return (
                      <tr key={order.id} className="border-b border-gray-100 last:border-0 print:break-inside-avoid">
                        <td className="py-4 align-middle text-center">
                          <div className="inline-block w-5 h-5 border-2 border-gray-800 rounded-md print:w-6 print:h-6 print:border-2"></div>
                        </td>
                        <td className="py-4 pr-2 align-middle">
                          <div className="font-medium text-gray-800 text-sm print:text-base">{product.name}</div>
                          <div className="text-xs text-gray-400 mt-1">{orderDate}</div>
                        </td>
                        <td className="py-4 text-gray-600 pr-2 align-middle text-sm print:text-base">
                          {product.variant || '-'}
                        </td>
                        <td className="py-4 text-gray-800 align-middle text-sm print:text-base">
                          NT${unitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-4 text-center text-gray-800 align-middle text-sm print:text-base">
                          {order.allocatedQuantity}
                        </td>
                        <td className="py-4 text-right font-bold text-gray-800 align-middle text-sm print:text-base">
                          NT${order.recalculatedSubtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Receipt Footer */}
              <div className="flex justify-end items-center text-sm print:text-base font-bold text-gray-800 mb-8 print:break-inside-avoid">
                <span className="mr-4">總計金額：</span>
                <span className="text-xl print:text-2xl text-[#8B7355]">NT${totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </div>

              <div className="border-b border-dashed border-gray-300 my-8 print:my-12"></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

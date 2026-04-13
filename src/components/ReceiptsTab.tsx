import React, { useRef, useState } from 'react';
import { Printer, Download, Search, CheckCircle, Truck, PackageCheck } from 'lucide-react';
import html2canvas from 'html2canvas';
import { formatInTimeZone } from 'date-fns-tz';
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

          return (
            <div 
              key={customer.id} 
              className="receipt-item card p-6 mb-6 relative bg-white"
              ref={el => receiptRefs.current[customer.id] = el}
            >
              <div className="absolute top-4 right-4 flex gap-2 no-print">
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

              {/* Receipt Header */}
              <div className="text-center mb-6 border-b-2 border-dashed border-[var(--color-border)] pb-4">
                <h3 className="text-2xl print:text-5xl font-bold text-[var(--color-text)] mb-2 print:mb-4">Cuibo 倉管系統</h3>
                <p className="text-sm print:text-2xl opacity-70">訂單明細</p>
                <div className="mt-4 print:mt-8 text-left flex justify-between text-sm print:text-2xl">
                  <div>
                    <p className="font-bold text-[var(--color-text)]">顧客： {customer.name}</p>
                    <p className="opacity-70 print:mt-2">日期： {formatInTimeZone(new Date(), 'Asia/Taipei', 'yyyyMMddHHmm')}</p>
                  </div>
                  <div className="text-right">
                    <p className="opacity-70">件數： {totalItems}</p>
                  </div>
                </div>
              </div>

              {/* Receipt Items */}
              <table className="w-full text-left border-collapse mb-6 print:mb-10 print:text-3xl print:table table-fixed">
                <thead className="print:table-header-group">
                  <tr className="border-b border-dashed border-[var(--color-border)] text-sm print:text-2xl opacity-70">
                    <th className="w-8 print:w-16 py-2 print:py-6"></th>
                    <th className="w-[35%] py-2 print:py-6">商品名稱</th>
                    <th className="w-[20%] py-2 print:py-6">規格</th>
                    <th className="w-[15%] py-2 print:py-6 text-center">數量</th>
                    <th className="w-[15%] py-2 print:py-6 text-right">單價</th>
                    <th className="w-[15%] py-2 print:py-6 text-right">總金額</th>
                  </tr>
                </thead>
                <tbody className="print:table-row-group">
                  {ordersWithRecalculatedSubtotal.map(order => {
                    const product = products.find(p => p.id === order.productId);
                    if (!product || order.allocatedQuantity === 0) return null;

                    const unitPrice = order.recalculatedSubtotal / order.allocatedQuantity;

                    return (
                      <tr key={order.id} className="border-b border-dashed border-gray-200 last:border-0">
                        <td className="py-3 print:py-6 align-middle">
                          <div className="w-5 h-5 border-2 border-[var(--color-text)] rounded-sm print:w-10 print:h-10 print:border-4"></div>
                        </td>
                        <td className="py-3 print:py-6 pr-2 align-middle">
                          <div 
                            className={`font-medium text-[var(--color-text)] break-words leading-tight ${
                              product.name.length > 15 ? 'text-xs print:text-xl' : 
                              product.name.length > 8 ? 'text-sm print:text-2xl' : 
                              'text-base print:text-3xl'
                            }`}
                          >
                            {product.name}
                          </div>
                        </td>
                        <td className="py-3 print:py-6 text-[var(--color-text)] opacity-80 pr-2 align-middle break-words">
                          <div className={product.variant && product.variant.length > 10 ? 'text-xs print:text-xl' : 'text-sm print:text-2xl'}>
                            {product.variant || '-'}
                          </div>
                        </td>
                        <td className="py-3 print:py-6 text-center text-[var(--color-text)] align-middle text-sm print:text-2xl">{order.allocatedQuantity}</td>
                        <td className="py-3 print:py-6 text-right text-[var(--color-text)] opacity-80 align-middle text-sm print:text-2xl">
                          ${unitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 print:py-6 text-right font-medium text-[var(--color-text)] align-middle text-sm print:text-2xl">
                          ${order.recalculatedSubtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Receipt Footer */}
              <div className="border-t-2 border-dashed border-[var(--color-border)] pt-4 print:pt-8">
                <div className="flex justify-between items-center text-lg print:text-4xl font-bold text-[var(--color-text)]">
                  <span>總計</span>
                  <span>${totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="text-left text-xs print:text-2xl opacity-80 mt-6 print:mt-12 whitespace-pre-wrap leading-relaxed">
                  {notificationTemplate}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

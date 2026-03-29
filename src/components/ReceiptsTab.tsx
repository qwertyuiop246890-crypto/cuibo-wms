import React, { useRef, useState } from 'react';
import { Printer, Download, Search } from 'lucide-react';
import html2canvas from 'html2canvas';
import { formatInTimeZone } from 'date-fns-tz';
import { Order, Product, Customer } from '../types';
import { useDialog } from '../hooks/useDialog';
import { calculateSubtotal } from '../lib/priceUtils';

interface Props {
  orders: Order[];
  products: Product[];
  customers: Customer[];
}

export default function ReceiptsTab({ orders, products, customers }: Props) {
  const { showAlert } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const receiptRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Group orders by customer
  const ordersByCustomer = orders.reduce((acc, order) => {
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <h2 className="text-2xl font-bold">收據與列印</h2>
        <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
          <Printer size={18} /> 列印全部 (A4)
        </button>
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
              {/* Export Button (Hidden in print) */}
              <button 
                onClick={() => handleExportImage(customer.id, customer.name)}
                className="absolute top-4 right-4 p-2 text-[var(--color-text)] opacity-50 hover:opacity-100 hover:bg-[var(--color-bg)] rounded-full transition-colors no-print"
                title="匯出為圖片"
              >
                <Download size={18} />
              </button>

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
              <table className="w-full text-left border-collapse mb-6 print:mb-10 print:text-3xl print:table">
                <thead className="print:table-header-group">
                  <tr className="border-b border-dashed border-[var(--color-border)] text-sm print:text-2xl opacity-70">
                    <th className="w-10 print:w-16 py-2 print:py-6"></th>
                    <th className="py-2 print:py-6">商品名稱</th>
                    <th className="py-2 print:py-6">規格</th>
                    <th className="py-2 print:py-6 text-center">數量</th>
                    <th className="py-2 print:py-6 text-right">總金額</th>
                  </tr>
                </thead>
                <tbody className="print:table-row-group">
                  {ordersWithRecalculatedSubtotal.map(order => {
                    const product = products.find(p => p.id === order.productId);
                    if (!product || order.allocatedQuantity === 0) return null;

                    return (
                      <tr key={order.id} className="border-b border-dashed border-gray-200 last:border-0">
                        <td className="py-3 print:py-6">
                          <div className="w-5 h-5 border-2 border-[var(--color-text)] rounded-sm print:w-10 print:h-10 print:border-4"></div>
                        </td>
                        <td className="py-3 print:py-6 font-medium text-[var(--color-text)] pr-2">{product.name}</td>
                        <td className="py-3 print:py-6 text-[var(--color-text)] opacity-80 pr-2">{product.variant || '-'}</td>
                        <td className="py-3 print:py-6 text-center text-[var(--color-text)]">{order.allocatedQuantity}</td>
                        <td className="py-3 print:py-6 text-right font-medium text-[var(--color-text)]">
                          ${order.recalculatedSubtotal.toFixed(2)}
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
                  <span>${totalAmount.toFixed(2)}</span>
                </div>
                <p className="text-center text-xs print:text-2xl opacity-60 mt-6 print:mt-12">
                  感謝您的購買！
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import React, { useMemo, useRef, useState } from 'react';
import { Printer, Download, Truck, PackageCheck, Scissors } from 'lucide-react';
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

type ReceiptFilter = 'unshipped' | 'ready' | 'shipped' | 'all';

function isReadyToShip(orders: Order[]) {
  const activeOrders = orders.filter(order => !order.isShipped);
  return activeOrders.length > 0 && activeOrders.every(order => {
    const allocated = order.allocatedQuantity || 0;
    const arrived = order.arrivedQuantity || 0;
    return allocated >= order.requestedQuantity && arrived >= order.requestedQuantity;
  });
}

function getShippableQuantity(order: Order) {
  return Math.min(order.requestedQuantity, order.allocatedQuantity || 0, order.arrivedQuantity || 0);
}

export default function ReceiptsTab({ orders, setOrders, products, customers }: Props) {
  const { showAlert, showConfirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [receiptFilter, setReceiptFilter] = useState<ReceiptFilter>('unshipped');
  const receiptRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const customerReceiptRows = useMemo(() => {
    const normalizedSearch = searchTerm.replace(/\s+/g, '').toLowerCase();

    return customers
      .map(customer => {
        const customerOrders = orders.filter(order => order.customerId === customer.id);
        const unshippedOrders = customerOrders.filter(order => !order.isShipped);
        const shippedOrders = customerOrders.filter(order => order.isShipped);
        const ready = isReadyToShip(customerOrders);
        const allShipped = customerOrders.length > 0 && customerOrders.every(order => order.isShipped);

        let visibleOrders = unshippedOrders;
        if (receiptFilter === 'ready') visibleOrders = ready ? unshippedOrders : [];
        if (receiptFilter === 'shipped') visibleOrders = shippedOrders;
        if (receiptFilter === 'all') visibleOrders = customerOrders;

        return {
          customer,
          allOrders: customerOrders,
          visibleOrders,
          ready,
          allShipped,
        };
      })
      .filter(row => {
        const matchesSearch = row.customer.name.replace(/\s+/g, '').toLowerCase().includes(normalizedSearch);
        return matchesSearch && row.visibleOrders.length > 0;
      });
  }, [customers, orders, receiptFilter, searchTerm]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportImage = async (customerId: string, customerName: string) => {
    const element = receiptRefs.current[customerId];
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `receipt_${customerName}_${formatInTimeZone(new Date(), 'Asia/Taipei', 'yyyyMMdd')}.png`;
      link.click();
    } catch (error) {
      console.error('Failed to export image', error);
      showAlert('Export failed', 'Unable to export this receipt image. Please try printing instead.');
    }
  };

  const handleToggleShipped = (customerId: string, customerName: string) => {
    const customerOrders = orders.filter(order => order.customerId === customerId);
    if (customerOrders.length === 0) return;

    const isAllShipped = customerOrders.every(order => order.isShipped);
    if (isAllShipped) {
      showConfirm('Undo shipped status', `Mark all orders for ${customerName} as not shipped?`, () => {
        setOrders(prev => prev.map(order =>
          order.customerId === customerId ? { ...order, isShipped: false, updatedAt: Date.now() } : order
        ));
      });
      return;
    }

    const activeOrders = customerOrders.filter(order => !order.isShipped);
    const canShipWholeCustomer = activeOrders.every(order =>
      order.allocatedQuantity >= order.requestedQuantity && (order.arrivedQuantity || 0) >= order.requestedQuantity
    );

    if (!canShipWholeCustomer) {
      showAlert('Not ready to ship', 'This customer still has unallocated or not-yet-arrived items. Use split shipping for partial shipments.');
      return;
    }

    showConfirm('Mark shipped', `Mark all ready orders for ${customerName} as shipped?`, () => {
      setOrders(prev => prev.map(order =>
        order.customerId === customerId && !order.isShipped ? { ...order, isShipped: true, updatedAt: Date.now() } : order
      ));
    });
  };

  const handleSplitShip = (customerId: string, customerName: string) => {
    const activeOrders = orders.filter(order => order.customerId === customerId && !order.isShipped);
    const hasShippableItems = activeOrders.some(order => getShippableQuantity(order) > 0);

    if (!hasShippableItems) {
      showAlert('No shippable items', 'There are no allocated and arrived quantities available to ship.');
      return;
    }

    showConfirm('Split shipment', `Ship only the allocated and arrived quantities for ${customerName}? Remaining quantities will stay open.`, () => {
      setOrders(prev => {
        const next = [...prev];

        activeOrders.forEach(order => {
          const shipQty = getShippableQuantity(order);
          if (shipQty <= 0) return;

          const index = next.findIndex(item => item.id === order.id);
          if (index === -1) return;

          if (shipQty >= order.requestedQuantity) {
            next[index] = {
              ...next[index],
              allocatedQuantity: order.requestedQuantity,
              arrivedQuantity: order.requestedQuantity,
              isShipped: true,
              updatedAt: Date.now(),
            };
            return;
          }

          const remainingQuantity = order.requestedQuantity - shipQty;
          next[index] = {
            ...order,
            requestedQuantity: shipQty,
            allocatedQuantity: shipQty,
            arrivedQuantity: shipQty,
            isShipped: true,
            updatedAt: Date.now(),
          };

          next.push({
            ...order,
            id: uuidv4(),
            requestedQuantity: remainingQuantity,
            allocatedQuantity: Math.max(0, order.allocatedQuantity - shipQty),
            arrivedQuantity: Math.max(0, (order.arrivedQuantity || 0) - shipQty),
            isShipped: false,
            isPaid: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        });

        return next;
      });
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <h2 className="text-2xl font-bold">收據 / 出貨</h2>
        <div className="flex flex-wrap gap-2">
          <select
            value={receiptFilter}
            onChange={event => setReceiptFilter(event.target.value as ReceiptFilter)}
            className="px-3 py-2 bg-white rounded-xl shadow-sm border border-[var(--color-border)] text-sm font-medium"
          >
            <option value="unshipped">未寄出</option>
            <option value="ready">可出貨</option>
            <option value="shipped">已寄出</option>
            <option value="all">全部</option>
          </select>
          <button onClick={handlePrint} className="btn-primary flex items-center gap-2">
            <Printer size={18} /> 列印目前清單
          </button>
        </div>
      </div>

      <div className="relative no-print">
        <input
          type="text"
          placeholder="搜尋顧客..."
          className="input-field"
          value={searchTerm}
          onChange={event => setSearchTerm(event.target.value)}
        />
      </div>

      {customerReceiptRows.length === 0 && (
        <div className="text-center py-10 opacity-60 no-print">
          目前沒有符合條件的收據。
        </div>
      )}

      <div className="receipt-container">
        {customerReceiptRows.map(({ customer, allOrders, visibleOrders, ready, allShipped }) => {
          const receiptOrders = visibleOrders.map(order => {
            const product = products.find(item => item.id === order.productId);
            const receiptQuantity = receiptFilter === 'shipped' || order.isShipped
              ? order.allocatedQuantity
              : getShippableQuantity(order);

            return {
              ...order,
              product,
              receiptQuantity,
              recalculatedSubtotal: product ? calculateSubtotal(product, receiptQuantity) : 0,
            };
          }).filter(order => order.product && order.receiptQuantity > 0);

          const totalAmount = receiptOrders.reduce((sum, order) => sum + order.recalculatedSubtotal, 0);
          const canSplitShip = allOrders.some(order => !order.isShipped && getShippableQuantity(order) > 0 && getShippableQuantity(order) < order.requestedQuantity);

          return (
            <div
              key={customer.id}
              className="receipt-item card p-6 mb-6 relative bg-white"
              ref={element => receiptRefs.current[customer.id] = element}
            >
              <div className="absolute top-4 right-4 flex flex-wrap justify-end gap-2 no-print">
                {ready && <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 text-xs font-bold">可出貨</span>}
                {allShipped && <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">已寄出</span>}
                {canSplitShip && (
                  <button
                    onClick={() => handleSplitShip(customer.id, customer.name)}
                    className="p-2 rounded-full transition-colors flex items-center gap-1 text-sm font-bold text-orange-600 bg-orange-50 hover:bg-orange-100"
                    title="部分出貨"
                  >
                    <Scissors size={18} />
                    <span className="hidden sm:inline">部分出貨</span>
                  </button>
                )}
                <button
                  onClick={() => handleToggleShipped(customer.id, customer.name)}
                  className={`p-2 rounded-full transition-colors flex items-center gap-1 text-sm font-bold ${allShipped ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                  title={allShipped ? '取消寄出' : '標記寄出'}
                >
                  {allShipped ? <PackageCheck size={18} /> : <Truck size={18} />}
                  <span className="hidden sm:inline">{allShipped ? '取消寄出' : '寄出'}</span>
                </button>
                <button
                  onClick={() => handleExportImage(customer.id, customer.name)}
                  className="p-2 text-[var(--color-text)] opacity-50 hover:opacity-100 hover:bg-[var(--color-bg)] rounded-full transition-colors"
                  title="匯出圖片"
                >
                  <Download size={18} />
                </button>
              </div>

              <table className="w-full text-left border-collapse mb-4 print:mb-6 print:table table-fixed">
                <thead className="print:table-header-group">
                  <tr>
                    <th colSpan={6} className="font-normal pb-4">
                      <div className="text-center mb-2 print:break-inside-avoid">
                        <p className="text-xs print:text-sm text-gray-500 mb-2">Cuibo WMS</p>
                        <h3 className="text-2xl print:text-3xl font-bold text-[#8B7355] mb-6">{customer.name} 出貨收據</h3>
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
                    <th className="w-[30%] py-3">商品</th>
                    <th className="w-[20%] py-3">規格</th>
                    <th className="w-[15%] py-3">單價</th>
                    <th className="w-[10%] py-3 text-center">數量</th>
                    <th className="w-[15%] py-3 text-right">小計</th>
                  </tr>
                </thead>
                <tbody className="print:table-row-group">
                  {receiptOrders.map(order => {
                    const unitPrice = order.recalculatedSubtotal / order.receiptQuantity;
                    const orderDate = formatInTimeZone(order.createdAt || Date.now(), 'Asia/Taipei', 'M/dd HH:mm');

                    return (
                      <tr key={order.id} className="border-b border-gray-100 last:border-0 print:break-inside-avoid">
                        <td className="py-4 align-middle text-center">
                          <div className="inline-block w-5 h-5 border-2 border-gray-800 rounded-md print:w-6 print:h-6 print:border-2"></div>
                        </td>
                        <td className="py-4 pr-2 align-middle">
                          <div className="font-medium text-gray-800 text-sm print:text-base">{order.product?.name}</div>
                          <div className="text-xs text-gray-400 mt-1">{orderDate}</div>
                        </td>
                        <td className="py-4 text-gray-600 pr-2 align-middle text-sm print:text-base">
                          {order.product?.variant || '-'}
                        </td>
                        <td className="py-4 text-gray-800 align-middle text-sm print:text-base">
                          NT${unitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-4 text-center text-gray-800 align-middle text-sm print:text-base">
                          {order.receiptQuantity}
                        </td>
                        <td className="py-4 text-right font-bold text-gray-800 align-middle text-sm print:text-base">
                          NT${order.recalculatedSubtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="flex justify-end items-center text-sm print:text-base font-bold text-gray-800 mb-8 print:break-inside-avoid">
                <span className="mr-4">總計：</span>
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

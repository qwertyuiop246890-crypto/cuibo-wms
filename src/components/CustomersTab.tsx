import React, { useState, useMemo, useRef } from 'react';
import { Plus, Edit2, Trash2, Search, ExternalLink, Copy, CheckCircle, PackageCheck, BadgeDollarSign, Truck, Printer, Download } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { v4 as uuidv4 } from 'uuid';
import html2canvas from 'html2canvas';
import { Customer, Order, Product } from '../types';
import { useDialog } from '../hooks/useDialog';
import CustomerDetailModal from './CustomerDetailModal';
import { calculateSubtotal } from '../lib/priceUtils';

interface Props {
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  notificationTemplate: string;
}

export default function CustomersTab({ customers, setCustomers, orders, setOrders, products, setProducts, notificationTemplate }: Props) {
  const { showAlert, showConfirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'amount' | 'name'>('amount');
  const [filterStatus, setFilterStatus] = useState<'all' | 'partially_allocated' | 'all_allocated' | 'arrived'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [totalSpent, setTotalSpent] = useState(0);

  const receiptRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const getCustomerStatus = (customerId: string) => {
    const customerOrders = orders.filter(o => o.customerId === customerId);
    if (customerOrders.length === 0) return { someAllocated: false, allAllocated: false, allArrived: false, isAllShipped: false };

    const someAllocated = customerOrders.some(o => o.allocatedQuantity > 0);
    const allAllocated = customerOrders.every(o => o.allocatedQuantity >= o.requestedQuantity);
    const allArrived = customerOrders.every(o => (o.arrivedQuantity ?? 0) >= o.requestedQuantity);
    const isAllShipped = customerOrders.length > 0 && customerOrders.every(o => o.isShipped);

    return { someAllocated, allAllocated, allArrived, isAllShipped };
  };

  const filteredCustomers = useMemo(() => {
    let result = customers.filter(c => 
      c.name.replace(/\s+/g, '').toLowerCase().includes(searchTerm.replace(/\s+/g, '').toLowerCase())
    );

    if (filterStatus === 'partially_allocated') {
      result = result.filter(c => {
        const status = getCustomerStatus(c.id);
        return status.someAllocated && !status.allAllocated && !status.isAllShipped;
      });
    } else if (filterStatus === 'all_allocated') {
      result = result.filter(c => {
        const status = getCustomerStatus(c.id);
        return status.allAllocated && !status.allArrived && !status.isAllShipped;
      });
    } else if (filterStatus === 'arrived') {
      result = result.filter(c => {
        const status = getCustomerStatus(c.id);
        return status.allArrived && !status.isAllShipped;
      });
    }

    if (sortBy === 'amount') {
      result.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (sortBy === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));
    }

    return result;
  }, [customers, searchTerm, sortBy, filterStatus, orders]);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setName(customer.name);
      setTotalSpent(customer.totalSpent);
    } else {
      setEditingCustomer(null);
      setName('');
      setTotalSpent(0);
    }
    setIsModalOpen(true);
  };

  const handleOpenDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      showAlert("提示", "請輸入顧客姓名");
      return;
    }

    if (editingCustomer) {
      setCustomers(customers.map(c => 
        c.id === editingCustomer.id 
          ? { ...c, name: name.trim(), totalSpent, updatedAt: Date.now() }
          : c
      ));
      showAlert("成功", "已更新顧客資料");
    } else {
      const newCustomer: Customer = {
        id: uuidv4(),
        name: name.trim(),
        totalSpent,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setCustomers([newCustomer, ...customers]);
      showAlert("成功", "已新增顧客");
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    showConfirm("確認刪除", `確定要刪除顧客 "${name}" 嗎？\n這將會同時刪除該顧客的所有訂單資料。`, () => {
      setCustomers(customers.filter(c => c.id !== id));
      setOrders(orders.filter(o => o.customerId !== id));
      showAlert("成功", "已刪除顧客及其訂單資料");
    });
  };

  const generateNotification = (customer: Customer) => {
    const customerOrders = orders.filter(o => o.customerId === customer.id && !o.isShipped);
    if (customerOrders.length === 0) return '';

    let text = notificationTemplate.replace('{{name}}', customer.name);
    
    let orderDetailsList = customerOrders.map((order, index) => {
      const product = products.find(p => p.id === order.productId);
      const productName = product ? product.name : '未知商品';
      const variant = product?.variant ? ` - ${product.variant}` : '';
      const orderSubtotal = product ? calculateSubtotal(product, order.allocatedQuantity) : 0;
      
      return `${index + 1}. ${productName}${variant}\n   數量: ${order.allocatedQuantity}\n   金額: $${orderSubtotal}`;
    }).join('\n\n');

    const totalAmount = customerOrders.reduce((sum, order) => {
      const product = products.find(p => p.id === order.productId);
      return sum + (product ? calculateSubtotal(product, order.allocatedQuantity) : 0);
    }, 0);

    const unpaidOnly = customerOrders.filter(o => !o.isPaid);
    const unpaidAmount = unpaidOnly.reduce((sum, order) => {
      const product = products.find(p => p.id === order.productId);
      return sum + (product ? calculateSubtotal(product, order.allocatedQuantity) : 0);
    }, 0);

    text = text.replace('{{orderDetails}}', orderDetailsList);
    text = text.replace('{{totalAmount}}', totalAmount.toString());
    text = text.replace('{{unpaidAmount}}', unpaidAmount.toString());

    return text;
  };

  const handleCopyNotification = async (customer: Customer) => {
    const text = generateNotification(customer);
    if (!text) {
      showAlert("提示", "此顧客目前沒有未出貨的訂單");
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showAlert("成功", "已複製通知訊息，可以貼上傳送給顧客了！");
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            showAlert("成功", "已複製通知訊息，可以貼上傳送給顧客了！");
          } else {
            showAlert("錯誤", "複製失敗，請嘗試手動選取文字複製。");
          }
        } catch (err) {
          showAlert("錯誤", "您的裝置不支援自動複製功能。");
        }
        
        document.body.removeChild(textArea);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
      showAlert("錯誤", "自動複製失敗，請檢查瀏覽器權限設定。");
    }
  };

  const handleToggleShipped = (customerId: string, customerName: string) => {
    const customerOrders = orders.filter(o => o.customerId === customerId && !o.isShipped);
    const isAllShipped = customerOrders.length === 0 && orders.some(o => o.customerId === customerId && o.isShipped);

    if (isAllShipped) {
      // Unship all
      showConfirm("取消出貨", `確定要「取消標記」 ${customerName} 的所有訂單出貨狀態嗎？\n這會將他們重新顯示在未出貨列表。`, () => {
        setOrders(prev => prev.map(o => 
          o.customerId === customerId ? { ...o, isShipped: false, updatedAt: Date.now() } : o
        ));
        showAlert("成功", `已取消 ${customerName} 的訂單出貨狀態`);
      });
    } else {
      if (customerOrders.length === 0) {
        showAlert("提示", "此顧客目前沒有未出貨的訂單");
        return;
      }

      const hasIncompleteOrders = customerOrders.some(o => 
        o.allocatedQuantity < o.requestedQuantity || 
        (o.arrivedQuantity ?? 0) < o.requestedQuantity
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

  const [selectedCustomerIds, setSelectedCustomerIds] = useState<Set<string>>(new Set());

  const toggleCustomerSelection = (customerId: string) => {
    const newSelected = new Set(selectedCustomerIds);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomerIds(newSelected);
  };

  const handleBulkAction = (action: 'ship' | 'bill' | 'pay' | 'delete') => {
    if (selectedCustomerIds.size === 0) {
      showAlert("提示", "請先選擇顧客");
      return;
    }

    const actionNames = { ship: '寄出', bill: '結單', pay: '收款', delete: '刪除' };
    showConfirm(`確認${actionNames[action]}`, `確定要對選取的 ${selectedCustomerIds.size} 位顧客執行${actionNames[action]}嗎？`, () => {
      if (action === 'delete') {
        setCustomers(customers.filter(c => !selectedCustomerIds.has(c.id)));
        setOrders(orders.filter(o => !selectedCustomerIds.has(o.customerId)));
      } else {
        const updates: Partial<Order> = {};
        if (action === 'ship') updates.isShipped = true;
        if (action === 'bill') updates.isBilled = true;
        if (action === 'pay') updates.isPaid = true;
        
        setOrders(orders.map(o => selectedCustomerIds.has(o.customerId) ? { ...o, ...updates, updatedAt: Date.now() } : o));
      }
      setSelectedCustomerIds(new Set());
      showAlert("成功", `已執行${actionNames[action]}`);
    });
  };

  const handlePrintSelected = () => {
    const hasOrders = Array.from(selectedCustomerIds).some(id => 
      orders.some(o => o.customerId === id && !o.isShipped)
    );
    if (!hasOrders) {
      showAlert('無法列印', '選取的顧客沒有未出貨的訂單。\n\n提示：只有未出貨訂單會顯示在出貨單中。');
      return;
    }
    try {
      setTimeout(() => window.print(), 300);
    } catch (error) {
      showAlert('列印錯誤', '無法執行列印，請在新分頁中開啟應用程式後再試。');
    }
  };

  const handleExportImages = async () => {
    const idArray = Array.from(selectedCustomerIds);
    const validIds = idArray.filter(id => orders.some(o => o.customerId === id && !o.isShipped));
    
    if (validIds.length === 0) {
      showAlert('無法匯出', '選取的顧客沒有未出貨的訂單。\n\n提示：只有未出貨訂單會顯示在出貨單中。');
      return;
    }

    try {
      for (const id of validIds) {
        const element = receiptRefs.current[id];
        if (!element) continue;

        const customer = customers.find(c => c.id === id);
        if (!customer) continue;

        const originalDisplay = element.style.display;
        element.style.display = 'block';

        const canvas = await html2canvas(element, {
          scale: 2,
          backgroundColor: '#ffffff',
          logging: false,
        });

        element.style.display = originalDisplay;
        
        const image = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = image;
        link.download = `出貨單_${customer.name}_${formatInTimeZone(new Date(), 'Asia/Taipei', 'yyyyMMdd')}.png`;
        link.click();
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      showAlert("成功", `已下載 ${validIds.length} 張出貨單圖片`);
    } catch (error) {
      console.error("Failed to export images", error);
      showAlert("錯誤", "匯出圖片失敗");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center no-print">
        <h2 className="text-2xl font-bold">顧客管理</h2>
        <div className="flex gap-2">
          {selectedCustomerIds.size > 0 && (
            <div className="flex gap-2 mr-4 flex-wrap">
              <button onClick={() => handleBulkAction('bill')} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors">結單</button>
              <button onClick={() => handleBulkAction('pay')} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-bold hover:bg-green-100 transition-colors">收款</button>
              <button onClick={() => handleBulkAction('ship')} className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-sm font-bold hover:bg-orange-100 transition-colors">寄出</button>
              <button onClick={() => handlePrintSelected()} className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors flex items-center gap-1"><Printer size={16}/>列印出貨單</button>
              <button onClick={() => handleExportImages()} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm font-bold hover:bg-purple-100 transition-colors flex items-center gap-1"><Download size={16}/>匯出圖片</button>
              <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors">刪除</button>
            </div>
          )}
          <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> 新增顧客
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 no-print">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="搜尋顧客..." 
            className="input-field"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-[var(--color-border)]">
          <span className="text-sm text-gray-500 pl-2">狀態：</span>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'partially_allocated' | 'all_allocated' | 'arrived')}
            className="p-1 text-sm border-none focus:ring-0 text-[var(--color-text)] bg-transparent outline-none"
          >
            <option value="all">全部</option>
            <option value="partially_allocated">部分已配單</option>
            <option value="all_allocated">全部已配單</option>
            <option value="arrived">可出貨</option>
          </select>
        </div>
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-[var(--color-border)]">
          <span className="text-sm text-gray-500 pl-2">排序：</span>
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as 'amount' | 'name')}
            className="p-1 text-sm border-none focus:ring-0 text-[var(--color-text)] bg-transparent outline-none"
          >
            <option value="amount">消費金額 (高至低)</option>
            <option value="name">名稱筆畫</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden no-print">
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-gray-50/50 text-[var(--color-text)] text-[11px] font-bold uppercase letter-spacing-0.05em border-b border-[var(--color-border)] opacity-50">
                <th className="p-3 w-10 text-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-gray-300" 
                    checked={filteredCustomers.length > 0 && filteredCustomers.every(c => selectedCustomerIds.has(c.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCustomerIds(new Set(filteredCustomers.map(c => c.id)));
                      } else {
                        setSelectedCustomerIds(new Set());
                      }
                    }}
                  />
                </th>
                <th className="p-3 w-[25%]">姓名</th>
                <th className="p-3 w-[15%] text-right">總消費額</th>
                <th className="p-3 w-[15%] text-right">未收金額</th>
                <th className="p-3 w-[20%] text-center">狀態</th>
                <th className="p-3 w-[25%] text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    尚無顧客資料
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(customer => {
                  const { allAllocated, allArrived, isAllShipped } = getCustomerStatus(customer.id);
                  const customerOrders = orders.filter(o => o.customerId === customer.id);
                  const unpaidAmount = customerOrders
                    .filter(o => !o.isPaid)
                    .reduce((sum, order) => {
                      const product = products.find(p => p.id === order.productId);
                      return sum + (product ? calculateSubtotal(product, order.allocatedQuantity) : 0);
                    }, 0);

                return (
                  <tr 
                    key={customer.id} 
                    className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                    onClick={() => handleOpenDetail(customer)}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded border-gray-300" 
                        checked={selectedCustomerIds.has(customer.id)}
                        onChange={() => toggleCustomerSelection(customer.id)}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold">
                          {customer.name[0]}
                        </div>
                        <span className="font-bold text-gray-900 truncate">{customer.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono text-sm text-gray-600">
                      ${customer.totalSpent.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-mono text-sm font-bold text-red-500">
                      ${unpaidAmount.toLocaleString()}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap justify-center gap-1">
                        {allArrived && !isAllShipped && customerOrders.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[9px] font-bold rounded uppercase flex items-center gap-1">
                            <PackageCheck size={10} /> 可出貨
                          </span>
                        )}
                        {!allArrived && allAllocated && !isAllShipped && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-bold rounded uppercase flex items-center gap-1">
                            <CheckCircle size={10} /> 全部已配單
                          </span>
                        )}
                        {!allArrived && !allAllocated && customerOrders.some(o => o.allocatedQuantity > 0) && !isAllShipped && (
                          <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded uppercase flex items-center gap-1">
                            <CheckCircle size={10} /> 部分已配單
                          </span>
                        )}
                        {isAllShipped && customerOrders.length > 0 && (
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[9px] font-bold rounded uppercase flex items-center gap-1">
                            <Truck size={10} /> 已出貨
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                        <button 
                          onClick={() => handleToggleShipped(customer.id, customer.name)}
                          className={`p-1.5 rounded-lg transition-colors ${isAllShipped ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
                          title={isAllShipped ? "取消出貨" : "標記為已出貨"}
                        >
                          {isAllShipped ? <PackageCheck size={16} /> : <Truck size={16} />}
                        </button>
                        <button 
                          onClick={() => handleCopyNotification(customer)} 
                          className="p-1.5 text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                          title="複製到貨通知"
                        >
                          <Copy size={16} />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(customer)} 
                          className="p-1.5 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => handleDelete(customer.id, customer.name)} 
                          className="p-1.5 text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile List View */}
        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              尚無顧客資料
            </div>
          ) : (
            filteredCustomers.map(customer => {
              const { allAllocated, allArrived, isAllShipped } = getCustomerStatus(customer.id);
              const customerOrders = orders.filter(o => o.customerId === customer.id);
              const unpaidAmount = customerOrders
                .filter(o => !o.isPaid)
                .reduce((sum, order) => {
                  const product = products.find(p => p.id === order.productId);
                  return sum + (product ? calculateSubtotal(product, order.allocatedQuantity) : 0);
                }, 0);

              return (
                <div key={customer.id} className="p-4 relative overflow-hidden" onClick={() => handleOpenDetail(customer)}>
                  {/* Status Indicator Tabs */}
                  {allArrived && !isAllShipped && customerOrders.length > 0 && (
                    <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1">
                      <PackageCheck size={12} /> 可出貨
                    </div>
                  )}
                  {!allArrived && allAllocated && !isAllShipped && (
                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1">
                      <CheckCircle size={12} /> 全部已配單
                    </div>
                  )}
                  {!allArrived && !allAllocated && customerOrders.some(o => o.allocatedQuantity > 0) && !isAllShipped && (
                    <div className="absolute top-0 right-0 bg-yellow-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1">
                      <CheckCircle size={12} /> 部分已配單
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div onClick={e => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300" 
                          checked={selectedCustomerIds.has(customer.id)}
                          onChange={() => toggleCustomerSelection(customer.id)}
                        />
                      </div>
                      <h3 className="font-bold text-lg text-[var(--color-text)]">
                        {customer.name}
                      </h3>
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <button 
                        onClick={() => handleToggleShipped(customer.id, customer.name)}
                        className={`p-2 rounded-lg ${isAllShipped ? 'text-green-600 bg-green-50' : 'text-blue-600 bg-blue-50'}`}
                      >
                        {isAllShipped ? <PackageCheck size={16} /> : <Truck size={16} />}
                      </button>
                      <button onClick={() => handleCopyNotification(customer)} className="p-2 text-green-600 bg-green-50 rounded-lg">
                        <Copy size={16} />
                      </button>
                      <button onClick={() => handleOpenModal(customer)} className="p-2 text-blue-600 bg-blue-50 rounded-lg">
                        <Edit2 size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-50 p-2 rounded flex flex-col">
                      <span className="text-gray-500 text-xs mb-1">總消費額</span>
                      <span className="font-mono font-bold">${customer.totalSpent.toLocaleString()}</span>
                    </div>
                    <div className="bg-red-50 p-2 rounded flex flex-col">
                      <span className="text-gray-500 text-xs mb-1">未收金額</span>
                      <span className="font-mono font-bold text-red-500">${unpaidAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Print Only Container for Selected Customers */}
      <div className="hidden print:block receipt-container">
        {customers
          .filter(c => selectedCustomerIds.has(c.id))
          .map(customer => {
            const customerOrders = orders.filter(o => o.customerId === customer.id && !o.isShipped);
            if (customerOrders.length === 0) return null;
            
            const ordersWithRecalculatedSubtotal = customerOrders.map(order => {
              const product = products.find(p => p.id === order.productId);
              if (!product) return { ...order, recalculatedSubtotal: 0 };
              return { 
                ...order, 
                recalculatedSubtotal: calculateSubtotal(product, order.allocatedQuantity) 
              };
            });

            const totalAmount = ordersWithRecalculatedSubtotal.reduce((sum, order) => sum + order.recalculatedSubtotal, 0);

            return (
              <div 
                key={customer.id} 
                className="receipt-item p-6 mb-6 bg-white shrink-0 page-break-after-always" 
                style={{ pageBreakAfter: 'always' }}
                ref={el => receiptRefs.current[customer.id] = el}
              >
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr>
                      <th colSpan={6} className="font-normal pb-4">
                        <div className="text-center mb-2">
                          <p className="text-sm text-gray-500 mb-2">Cuibo 倉管系統</p>
                          <h3 className="text-3xl font-bold text-[#8B7355] mb-6">{customer.name} 顧客訂單明細</h3>
                          <div className="flex justify-between text-sm text-gray-400 mb-2 px-2">
                            <span>列印日期：{formatInTimeZone(new Date(), 'Asia/Taipei', 'yyyy/MM/dd')}</span>
                            <span>顧客：{customer.name}</span>
                          </div>
                          <div className="border-b-2 border-solid border-[#8B7355]"></div>
                        </div>
                      </th>
                    </tr>
                    <tr className="border-b border-solid border-gray-200 text-base text-gray-800 font-bold">
                      <th className="w-16 py-3 text-center"></th>
                      <th className="w-[30%] py-3">商品名稱</th>
                      <th className="w-[20%] py-3">款式</th>
                      <th className="w-[15%] py-3">單價</th>
                      <th className="w-[10%] py-3 text-center">數量</th>
                      <th className="w-[15%] py-3 text-right">小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersWithRecalculatedSubtotal.map(order => {
                      const product = products.find(p => p.id === order.productId);
                      if (!product || order.allocatedQuantity === 0) return null;

                      const unitPrice = order.recalculatedSubtotal / order.allocatedQuantity;
                      const orderDate = formatInTimeZone(order.createdAt || Date.now(), 'Asia/Taipei', 'M/dd HH:mm');

                      return (
                        <tr key={order.id} className="border-b border-solid border-gray-100 last:border-0 border-b-solid">
                          <td className="py-4 align-middle text-center">
                            <div className="inline-block w-6 h-6 border-2 border-solid border-gray-800 rounded-md"></div>
                          </td>
                          <td className="py-4 pr-2 align-middle">
                            <div className="font-medium text-gray-800 text-base">{product.name}</div>
                            <div className="text-xs text-gray-400 mt-1">{orderDate}</div>
                          </td>
                          <td className="py-4 text-gray-600 pr-2 align-middle text-base">
                            {product.variant || '-'}
                          </td>
                          <td className="py-4 text-gray-800 align-middle text-base">
                            NT${unitPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-4 text-center text-gray-800 align-middle text-base">
                            {order.allocatedQuantity}
                          </td>
                          <td className="py-4 text-right font-bold text-gray-800 align-middle text-base">
                            NT${order.recalculatedSubtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex justify-end items-center text-base font-bold text-gray-800 mt-4 mb-8">
                  <span className="mr-4">總計金額：</span>
                  <span className="text-2xl text-[#8B7355]">NT${totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold mb-6 text-[var(--color-text)]">
              {editingCustomer ? '編輯顧客' : '新增顧客'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">顧客姓名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  placeholder="請輸入顧客姓名或暱稱"
                  autoFocus
                />
              </div>
              
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary">取消</button>
              <button onClick={handleSave} className="btn-primary">儲存</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {isDetailOpen && selectedCustomer && (
        <CustomerDetailModal 
          customer={selectedCustomer}
          orders={orders}
          setOrders={setOrders}
          products={products}
          setProducts={setProducts}
          notificationTemplate={notificationTemplate}
          onClose={() => setIsDetailOpen(false)}
          onUpdateCustomerName={(newName) => {
            const updatedCustomer = { ...selectedCustomer, name: newName, updatedAt: Date.now() };
            setCustomers(customers.map(c => c.id === selectedCustomer.id ? updatedCustomer : c));
            setSelectedCustomer(updatedCustomer);
          }}
        />
      )}
    </div>
  );
}
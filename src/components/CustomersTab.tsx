import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, ExternalLink, Copy, CheckCircle, PackageCheck, BadgeDollarSign, Truck, Printer } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { v4 as uuidv4 } from 'uuid';
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
  }, [customers, orders, searchTerm, sortBy, filterStatus]);

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
    const sanitizedName = name.replace(/\s+/g, '');
    if (!sanitizedName) return showAlert("提示", "請輸入顧客姓名");

    // Check if customer with same name already exists
    const existingCustomer = customers.find(c => c.name.replace(/\s+/g, '') === sanitizedName && c.id !== editingCustomer?.id);
    if (existingCustomer) {
      return showAlert("提示", "此顧客名稱已存在");
    }

    const newCustomer: Customer = {
      id: editingCustomer ? editingCustomer.id : uuidv4(),
      name: sanitizedName,
      totalSpent,
      updatedAt: Date.now()
    };

    if (editingCustomer) {
      setCustomers(customers.map(c => c.id === editingCustomer.id ? newCustomer : c));
    } else {
      setCustomers([...customers, newCustomer]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    showConfirm("確認刪除", "確定要刪除此顧客嗎？連同該顧客的所有訂單也會一併刪除！", () => {
      setCustomers(customers.filter(c => c.id !== id));
      setOrders(orders.filter(o => o.customerId !== id));
    });
  };

  const handleCopyNotification = (customer: Customer) => {
    const customerOrders = orders.filter(o => o.customerId === customer.id);
    const totalAmount = customerOrders.reduce((sum, o) => sum + o.subtotal, 0);
    
    const orderItemsText = customerOrders.map(o => {
      const product = products.find(p => p.id === o.productId);
      return `${product?.name || '未知商品'} ${product?.variant ? `(${product.variant})` : ''} x ${o.requestedQuantity} $${product?.price || 0}`;
    }).join('\n');

    const text = `親愛的 ${customer.name}您好，
您本次的連線購物明細如下：

${orderItemsText}
----------------
消費總額：${totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}

${notificationTemplate}`;

    navigator.clipboard.writeText(text).then(() => {
      showAlert('成功', '通知文案已複製到剪貼簿');
    });
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
    window.print();
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
              <button onClick={() => handlePrintSelected()} className="px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-sm font-bold hover:bg-purple-100 transition-colors flex items-center gap-1"><Printer size={16}/>列印出貨單</button>
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
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'allocated' | 'arrived')}
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
              {filteredCustomers.map(customer => {
                const { allAllocated, allArrived, isAllShipped } = getCustomerStatus(customer.id);
                const customerOrders = orders.filter(o => o.customerId === customer.id);
                const unpaidAmount = customerOrders
                  .filter(o => !o.isPaid)
                  .reduce((sum, order) => sum + order.subtotal, 0);

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
                    <td className="p-3 text-center">
                      <div className="flex flex-wrap justify-center gap-1">
                        {allArrived && !isAllShipped && (
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
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center gap-1">
                        <button 
                          onClick={() => handleToggleShipped(customer.id, customer.name)}
                          className={`p-1.5 rounded transition-colors ${isAllShipped ? 'text-green-600 bg-green-50' : 'text-blue-600 hover:bg-blue-50'}`}
                          title={isAllShipped ? "取消出貨" : "標記為已出貨"}
                        >
                          {isAllShipped ? <PackageCheck size={14} /> : <Truck size={14} />}
                        </button>
                        <button onClick={() => handleCopyNotification(customer)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors" title="複製通知文案">
                          <Copy size={14} />
                        </button>
                        <button onClick={() => handleOpenModal(customer)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDelete(customer.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-gray-400 text-sm">
                    尚無顧客記錄
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {filteredCustomers.map(customer => {
            const { allAllocated, allArrived, isAllShipped } = getCustomerStatus(customer.id);
            const customerOrders = orders.filter(o => o.customerId === customer.id);
            const unpaidAmount = customerOrders
              .filter(o => !o.isPaid)
              .reduce((sum, order) => sum + order.subtotal, 0);

            return (
              <div 
                key={customer.id} 
                className="p-4 space-y-3 cursor-pointer hover:bg-gray-50 transition-colors relative overflow-hidden"
                onClick={() => handleOpenDetail(customer)}
              >
                {allArrived && !isAllShipped && (
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
                    <button onClick={() => handleOpenModal(customer)} className="p-2 text-[var(--color-primary)] bg-blue-50 rounded-lg">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(customer.id)} className="p-2 text-red-500 bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <div>
                    <span className="block text-xs text-gray-500">總消費額</span>
                    <span className="font-bold">${customer.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-gray-500">未收金額</span>
                    <span className="font-bold text-red-500">${unpaidAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredCustomers.length === 0 && (
            <div className="p-8 text-center opacity-60">
              找不到顧客。
            </div>
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
              <div key={customer.id} className="receipt-item p-6 mb-6 bg-white shrink-0 page-break-after-always" style={{ pageBreakAfter: 'always' }}>
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
          <div className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{editingCustomer ? '編輯顧客' : '新增顧客'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">顧客姓名</label>
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">總消費額</label>
                <input type="number" className="input-field" value={Number.isNaN(totalSpent) ? '' : totalSpent} onChange={e => setTotalSpent(Number(e.target.value) || 0)} />
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

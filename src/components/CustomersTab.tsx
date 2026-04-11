import React, { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, ExternalLink, Copy, CheckCircle, PackageCheck, BadgeDollarSign, Truck } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { v4 as uuidv4 } from 'uuid';
import { Customer, Order, Product } from '../types';
import { useDialog } from '../hooks/useDialog';
import CustomerDetailModal from './CustomerDetailModal';

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'allocated' | 'arrived'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [totalSpent, setTotalSpent] = useState(0);

  const getCustomerStatus = (customerId: string) => {
    const customerOrders = orders.filter(o => o.customerId === customerId);
    if (customerOrders.length === 0) return { allAllocated: false, allArrived: false, isAllShipped: false };

    const allAllocated = customerOrders.every(o => o.allocatedQuantity >= o.requestedQuantity);
    const hasAllocated = customerOrders.some(o => o.allocatedQuantity > 0);
    const allArrived = hasAllocated && customerOrders.every(o => {
      if (o.allocatedQuantity === 0) return true;
      return (o.arrivedQuantity ?? (o.isArrived ? o.allocatedQuantity : 0)) >= o.allocatedQuantity;
    });
    const isAllShipped = customerOrders.every(o => o.isShipped);

    return { allAllocated, allArrived, isAllShipped };
  };

  const filteredCustomers = useMemo(() => {
    let result = customers.filter(c => 
      c.name.replace(/\s+/g, '').toLowerCase().includes(searchTerm.replace(/\s+/g, '').toLowerCase())
    );

    if (filterStatus === 'allocated') {
      result = result.filter(c => {
        const status = getCustomerStatus(c.id);
        return status.allAllocated && !status.allArrived;
      });
    } else if (filterStatus === 'arrived') {
      result = result.filter(c => getCustomerStatus(c.id).allArrived);
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

  const handleTogglePaid = (customer: Customer) => {
    const updatedCustomer = { ...customer, isPaid: !customer.isPaid, updatedAt: Date.now() };
    setCustomers(customers.map(c => c.id === customer.id ? updatedCustomer : c));
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
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">顧客管理</h2>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> 新增顧客
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
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
            <option value="allocated">全部已配單</option>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(customer => {
          const { allAllocated, allArrived, isAllShipped } = getCustomerStatus(customer.id);
          return (
          <div key={customer.id} className="card p-5 flex flex-col justify-between hover:border-blue-300 transition-colors group relative overflow-hidden">
            {allArrived && (
              <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1">
                <PackageCheck size={12} /> 可出貨
              </div>
            )}
            {!allArrived && allAllocated && (
              <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg flex items-center gap-1">
                <CheckCircle size={12} /> 全部已配單
              </div>
            )}
            <div onClick={() => handleOpenDetail(customer)} className="cursor-pointer mt-2">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg group-hover:text-blue-600 transition-colors flex items-center gap-2">
                  {customer.name}
                  <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
              </div>
              <div className="space-y-1 text-sm opacity-80 mb-4">
                <p>總消費額： <span className="font-bold">${customer.totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></p>
                <p className="text-[10px] text-gray-400 mt-2">最後更新： {formatInTimeZone(new Date(customer.updatedAt), 'Asia/Taipei', 'yyyyMMddHHmm')}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
              <button 
                onClick={() => handleToggleShipped(customer.id, customer.name)}
                className={`p-2 rounded-full transition-colors flex items-center gap-1 text-sm font-medium ${isAllShipped ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-blue-600 hover:bg-blue-50'}`}
                title={isAllShipped ? "取消出貨" : "標記為已出貨"}
              >
                {isAllShipped ? <PackageCheck size={16} /> : <Truck size={16} />}
                <span className="hidden sm:inline">{isAllShipped ? '已出貨' : '出貨'}</span>
              </button>
              <button 
                onClick={() => handleTogglePaid(customer)} 
                className={`p-2 rounded-full transition-colors flex items-center gap-1 text-sm font-medium ${customer.isPaid ? 'text-green-600 bg-green-50 hover:bg-green-100' : 'text-gray-400 hover:bg-gray-100'}`} 
                title={customer.isPaid ? "標記為未收款" : "標記為已收款"}
              >
                <BadgeDollarSign size={16} />
                {customer.isPaid ? '已收款' : '未收款'}
              </button>
              <div className="flex-1"></div>
              <button onClick={() => handleCopyNotification(customer)} className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors" title="複製通知文案">
                <Copy size={16} />
              </button>
              <button onClick={() => handleOpenModal(customer)} className="p-2 text-[var(--color-primary)] hover:bg-[var(--color-bg)] rounded-full transition-colors">
                <Edit2 size={16} />
              </button>
              <button onClick={() => handleDelete(customer.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
          );
        })}
        {filteredCustomers.length === 0 && (
          <div className="col-span-full text-center py-10 opacity-60">
            找不到顧客。
          </div>
        )}
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
                <input type="number" className="input-field" value={totalSpent} onChange={e => setTotalSpent(Number(e.target.value))} />
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
        />
      )}
    </div>
  );
}

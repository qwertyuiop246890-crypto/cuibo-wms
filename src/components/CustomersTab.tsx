import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search, ExternalLink, Copy } from 'lucide-react';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [totalSpent, setTotalSpent] = useState(0);

  const filteredCustomers = customers.filter(c => 
    c.name.replace(/\s+/g, '').toLowerCase().includes(searchTerm.replace(/\s+/g, '').toLowerCase())
  );

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
    showConfirm("確認刪除", "確定要刪除此顧客嗎？", () => {
      setCustomers(customers.filter(c => c.id !== id));
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
消費總額：${totalAmount.toFixed(0)}

${notificationTemplate}`;

    navigator.clipboard.writeText(text).then(() => {
      showAlert('成功', '通知文案已複製到剪貼簿');
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">顧客管理</h2>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> 新增顧客
        </button>
      </div>

      <div className="relative">
        <input 
          type="text" 
          placeholder="搜尋顧客..." 
          className="input-field"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(customer => (
          <div key={customer.id} className="card p-5 flex flex-col justify-between hover:border-blue-300 transition-colors group">
            <div onClick={() => handleOpenDetail(customer)} className="cursor-pointer">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg group-hover:text-blue-600 transition-colors flex items-center gap-2">
                  {customer.name}
                  <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
              </div>
              <div className="space-y-1 text-sm opacity-80 mb-4">
                <p>總消費額： <span className="font-bold">${customer.totalSpent.toFixed(0)}</span></p>
                <p className="text-[10px] text-gray-400 mt-2">最後更新： {formatInTimeZone(new Date(customer.updatedAt), 'Asia/Taipei', 'yyyyMMddHHmm')}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]">
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
        ))}
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

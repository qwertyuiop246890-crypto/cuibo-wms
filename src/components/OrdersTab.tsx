import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, AlertCircle, DollarSign } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfDay, endOfDay, parseISO, isWithinInterval } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { Order, Product, Customer } from '../types';
import { useDialog } from '../hooks/useDialog';
import { calculateSubtotal } from '../lib/priceUtils';

interface Props {
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
}

export default function OrdersTab({ orders, setOrders, products, setProducts, customers, setCustomers }: Props) {
  const { showAlert, showConfirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [productName, setProductName] = useState('');
  const [productVariant, setProductVariant] = useState('');
  const [productPrice, setProductPrice] = useState(0);
  const [requestedQuantity, setRequestedQuantity] = useState(1);
  const [allocatedQuantity, setAllocatedQuantity] = useState(0);
  const [note, setNote] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [createdAt, setCreatedAt] = useState(Date.now());

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const p = products.find(p => p.id === o.productId);
      const c = customers.find(c => c.id === o.customerId);
      const searchLower = searchTerm.toLowerCase();
      const searchNoSpace = searchTerm.replace(/\s+/g, '').toLowerCase();
      
      const matchesSearch = (
        (p && p.name.toLowerCase().includes(searchLower)) ||
        (c && c.name.replace(/\s+/g, '').toLowerCase().includes(searchNoSpace)) ||
        o.note.toLowerCase().includes(searchLower)
      );

      const orderDate = new Date(o.createdAt);
      const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
      const end = endDate ? endOfDay(parseISO(endDate)) : new Date(8640000000000000);
      const matchesDate = isWithinInterval(orderDate, { start, end });

      return matchesSearch && matchesDate;
    });
  }, [orders, products, customers, searchTerm, startDate, endDate]);

  const totalAmount = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + order.subtotal, 0);
  }, [filteredOrders]);

  // Auto-fill price when product name and variant match an existing product
  useEffect(() => {
    const existingProduct = products.find(p => p.name === productName.trim() && p.variant === productVariant.trim());
    if (existingProduct) {
      setProductPrice(existingProduct.price);
    }
  }, [productName, productVariant, products]);

  const handleOpenModal = (order?: Order) => {
    if (order) {
      setEditingOrder(order);
      const p = products.find(p => p.id === order.productId);
      const c = customers.find(c => c.id === order.customerId);
      setCustomerName(c?.name || '');
      setProductName(p?.name || '');
      setProductVariant(p?.variant || '');
      setProductPrice(p?.price || 0);
      setRequestedQuantity(order.requestedQuantity || 1);
      setAllocatedQuantity(order.allocatedQuantity || 0);
      setNote(order.note || '');
      setIsUrgent(order.isUrgent || false);
      setCreatedAt(order.createdAt || Date.now());
    } else {
      setEditingOrder(null);
      setCustomerName('');
      setProductName('');
      setProductVariant('');
      setProductPrice(0);
      setRequestedQuantity(1);
      setAllocatedQuantity(0);
      setNote('');
      setIsUrgent(false);
      setCreatedAt(Date.now());
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    const sanitizedCustomerName = customerName.replace(/\s+/g, '');
    if (!sanitizedCustomerName || !productName.trim()) return showAlert("提示", "請輸入顧客與商品名稱");

    let cId = '';
    const existingCustomer = customers.find(c => c.name.replace(/\s+/g, '') === sanitizedCustomerName);
    if (existingCustomer) {
      cId = existingCustomer.id;
    } else {
      cId = uuidv4();
      const newCustomer: Customer = {
        id: cId,
        name: sanitizedCustomerName,
        totalSpent: 0,
        updatedAt: Date.now()
      };
      setCustomers([...customers, newCustomer]);
    }

    let pId = '';
    let productToUse: Product;
    const existingProduct = products.find(p => p.name === productName.trim() && p.variant === productVariant.trim());
    if (existingProduct) {
      pId = existingProduct.id;
      productToUse = existingProduct;
    } else {
      pId = uuidv4();
      productToUse = {
        id: pId,
        name: productName.trim(),
        variant: productVariant.trim(),
        price: Math.max(0, productPrice || 0),
        stock: 0,
        purchaseQuantity: 0,
        updatedAt: Date.now()
      };
      setProducts([...products, productToUse]);
    }

    const qty = Math.max(1, requestedQuantity || 1);
    const subtotal = calculateSubtotal(productToUse, qty);

    const newOrder: Order = {
      id: editingOrder ? editingOrder.id : uuidv4(),
      productId: pId,
      customerId: cId,
      requestedQuantity: qty,
      allocatedQuantity,
      note,
      isUrgent,
      subtotal,
      createdAt: editingOrder ? editingOrder.createdAt : createdAt,
      updatedAt: Date.now()
    };

    if (editingOrder) {
      setOrders(orders.map(o => o.id === editingOrder.id ? newOrder : o));
    } else {
      setOrders([...orders, newOrder]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    showConfirm("確認刪除", "確定要刪除此訂單嗎？", () => {
      setOrders(orders.filter(o => o.id !== id));
    });
  };

  // Get unique product names for datalist
  const uniqueProductNames = Array.from(new Set(products.map(p => p.name)));
  // Get variants for the currently typed product name
  const availableVariants = products.filter(p => p.name === productName).map(p => p.variant);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">訂單管理</h2>
        <button 
          onClick={() => handleOpenModal()} 
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> 新增訂單
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="依商品或顧客搜尋訂單..." 
            className="input-field"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
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
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-[var(--color-border)]">
          <DollarSign size={18} className="text-[var(--color-primary)]" />
          <span className="font-bold text-[var(--color-text)]">總計: ${totalAmount.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-[var(--color-bg)] text-[var(--color-text)] text-sm border-b border-[var(--color-border)]">
                <th className="p-4 font-medium">顧客</th>
                <th className="p-4 font-medium">商品</th>
                <th className="p-4 font-medium">規格</th>
                <th className="p-4 font-medium text-center">喊單數量</th>
                <th className="p-4 font-medium text-center">配貨數量</th>
                <th className="p-4 font-medium text-right">小計</th>
                <th className="p-4 font-medium">備註</th>
                <th className="p-4 font-medium">建立日期</th>
                <th className="p-4 font-medium text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {filteredOrders.map(order => {
                const product = products.find(p => p.id === order.productId);
                const customer = customers.find(c => c.id === order.customerId);
                const isFullyAllocated = order.allocatedQuantity >= order.requestedQuantity;
                
                return (
                  <tr 
                    key={order.id} 
                    className="hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
                    onClick={() => handleOpenModal(order)}
                  >
                    <td className="p-4 font-medium text-[var(--color-text)]">
                      {customer?.name || '未知'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-[var(--color-text)]">{product?.name || '未知'}</div>
                        {order.isUrgent && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded uppercase">緊急</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm opacity-70">
                      {product?.variant || '-'}
                    </td>
                    <td className="p-4 text-center">{order.requestedQuantity}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2rem] h-8 rounded-md font-bold ${
                        isFullyAllocated ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)]'
                      }`}>
                        {order.allocatedQuantity}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-[var(--color-text)]">
                      ${order.subtotal.toFixed(2)}
                    </td>
                    <td className="p-4 text-sm opacity-80 max-w-[200px] truncate" title={order.note}>
                      {order.note || '-'}
                    </td>
                    <td className="p-4 text-sm opacity-70">
                      {formatInTimeZone(new Date(order.createdAt), 'Asia/Taipei', 'yyyy/MM/dd')}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleOpenModal(order)} className="p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-bg)] rounded transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(order.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center opacity-60">
                    找不到訂單。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {filteredOrders.map(order => {
            const product = products.find(p => p.id === order.productId);
            const customer = customers.find(c => c.id === order.customerId);
            const isFullyAllocated = order.allocatedQuantity >= order.requestedQuantity;
            
            return (
              <div 
                key={order.id} 
                className="p-4 space-y-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleOpenModal(order)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-[var(--color-text)]">{customer?.name || '未知'}</h3>
                      {order.isUrgent && (
                        <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded uppercase">緊急</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{product?.name}</p>
                    <p className="text-xs text-gray-500">規格: {product?.variant || '-'}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatInTimeZone(new Date(order.createdAt), 'Asia/Taipei', 'yyyy/MM/dd')}</p>
                  </div>
                  <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleOpenModal(order)} className="p-2 text-[var(--color-primary)] bg-blue-50 rounded-lg">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(order.id)} className="p-2 text-red-500 bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                  <div className="text-center">
                    <span className="block text-xs text-gray-500">喊單</span>
                    <span className="font-bold text-lg">{order.requestedQuantity}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-xs text-gray-500">配貨</span>
                    <span className={`font-bold text-lg ${isFullyAllocated ? 'text-green-600' : 'text-orange-500'}`}>
                      {order.allocatedQuantity}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs text-gray-500">小計</span>
                    <span className="font-bold text-lg text-[var(--color-text)]">${order.subtotal.toFixed(2)}</span>
                  </div>
                </div>
                
                {order.note && (
                  <p className="text-sm text-gray-600 bg-yellow-50 p-2 rounded border border-yellow-100">
                    備註: {order.note}
                  </p>
                )}
              </div>
            );
          })}
          {filteredOrders.length === 0 && (
            <div className="p-8 text-center opacity-60">
              找不到訂單。
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{editingOrder ? '編輯訂單' : '新增訂單'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">顧客名稱</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={customerName} 
                  onChange={e => setCustomerName(e.target.value)}
                  list="customers-list"
                  placeholder="輸入或選擇顧客"
                />
                <datalist id="customers-list">
                  {customers.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              
              <div className="p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">商品名稱</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={productName} 
                    onChange={e => setProductName(e.target.value)}
                    list="products-list"
                    placeholder="輸入或選擇商品"
                  />
                  <datalist id="products-list">
                    {uniqueProductNames.map(name => <option key={name} value={name} />)}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">款式/規格</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={productVariant} 
                    onChange={e => setProductVariant(e.target.value)}
                    list="variants-list"
                    placeholder="例如：紅色 M"
                  />
                  <datalist id="variants-list">
                    {availableVariants.map((v, i) => <option key={i} value={v} />)}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">單價</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={productPrice} 
                      onChange={e => setProductPrice(Number(e.target.value))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">喊單數量</label>
                    <input 
                      type="number" 
                      min="1" 
                      className="input-field" 
                      value={requestedQuantity} 
                      onChange={e => setRequestedQuantity(Number(e.target.value))} 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">備註</label>
                <textarea className="input-field" rows={3} value={note} onChange={e => setNote(e.target.value)}></textarea>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isUrgent" 
                  checked={isUrgent} 
                  onChange={e => setIsUrgent(e.target.checked)}
                  className="w-4 h-4 text-[var(--color-primary)] rounded focus:ring-[var(--color-primary)]"
                />
                <label htmlFor="isUrgent" className="text-sm font-medium text-red-600 flex items-center gap-1">
                  <AlertCircle size={14} /> 緊急訂單 (優先配貨)
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary">取消</button>
              <button onClick={handleSave} className="btn-primary">儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

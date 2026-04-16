import React, { useState, useMemo, useEffect } from 'react';
import { X, Copy, Check, Save, Trash2, Plus, Edit2, Truck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { formatInTimeZone } from 'date-fns-tz';
import { Customer, Order, Product } from '../types';
import { useDialog } from '../hooks/useDialog';
import { calculateSubtotal } from '../lib/priceUtils';

interface Props {
  customer: Customer;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  notificationTemplate: string;
  onClose: () => void;
  onUpdateCustomerName?: (newName: string) => void;
}

export default function CustomerDetailModal({ customer, orders, setOrders, products, setProducts, notificationTemplate, onClose, onUpdateCustomerName }: Props) {
  const { showAlert, showConfirm } = useDialog();
  const [copied, setCopied] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'pending' | 'billed'>('pending');
  
  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(customer.name);

  const handleSaveName = () => {
    const sanitizedName = editedName.replace(/\s+/g, '');
    if (!sanitizedName) {
      showAlert("提示", "請輸入顧客姓名");
      return;
    }
    if (onUpdateCustomerName) {
      onUpdateCustomerName(sanitizedName);
    }
    setIsEditingName(false);
  };
  
  // Add Order Modal State
  const [isAddOrderModalOpen, setIsAddOrderModalOpen] = useState(false);
  const [productName, setProductName] = useState('');
  const [productVariant, setProductVariant] = useState('');
  const [productPrice, setProductPrice] = useState(0);
  const [requestedQuantity, setRequestedQuantity] = useState(1);
  const [allocatedQuantity, setAllocatedQuantity] = useState(0);
  const [note, setNote] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  // Auto-fill price when product name and variant match an existing product
  useEffect(() => {
    const existingProduct = products.find(p => p.name === productName.trim() && p.variant === productVariant.trim());
    if (existingProduct) {
      setProductPrice(existingProduct.price);
    }
  }, [productName, productVariant, products]);

  const handleSaveOrder = () => {
    if (!productName.trim()) return showAlert("提示", "請輸入商品名稱");

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
      setProducts(prev => [...prev, productToUse]);
    }

    const qty = Math.max(1, requestedQuantity || 1);
    const subtotal = calculateSubtotal(productToUse, qty);

    const newOrder: Order = {
      id: uuidv4(),
      productId: pId,
      customerId: customer.id,
      requestedQuantity: qty,
      allocatedQuantity,
      arrivedQuantity: 0,
      note,
      isUrgent,
      subtotal,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setOrders(prev => [...prev, newOrder]);
    setIsAddOrderModalOpen(false);
    
    // Reset form
    setProductName('');
    setProductVariant('');
    setProductPrice(0);
    setRequestedQuantity(1);
    setAllocatedQuantity(0);
    setNote('');
    setIsUrgent(false);
  };
  
  // Local state for editing orders
  const customerOrders = useMemo(() => orders.filter(o => o.customerId === customer.id), [orders, customer.id]);
  
  const displayedOrders = useMemo(() => {
    if (activeTab === 'pending') {
      return customerOrders.filter(o => !o.isBilled);
    } else {
      return customerOrders.filter(o => o.isBilled);
    }
  }, [customerOrders, activeTab]);

  const handleUpdateOrderWithValidation = (orderId: string, updates: Partial<Order>) => {
    if (updates.allocatedQuantity !== undefined) {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const product = products.find(p => p.id === order.productId);
      const otherOrdersAllocated = orders
        .filter(o => o.productId === order.productId && o.id !== orderId)
        .reduce((sum, o) => sum + o.allocatedQuantity, 0);
      
      const totalPurchased = product?.purchaseQuantity || 0;
      const maxPossible = totalPurchased - otherOrdersAllocated;

      if (updates.allocatedQuantity > maxPossible && updates.allocatedQuantity > order.allocatedQuantity) {
        showAlert("庫存不足", `目前「${product?.name}」實際已採購數量為 ${totalPurchased}，扣除其他訂單已配貨量，此訂單最多隻能配貨 ${Math.max(0, maxPossible)} 個。`);
        return;
      }
    }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...updates, updatedAt: Date.now() } : o));
  };

  const handleUpdateProduct = (productId: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, ...updates, updatedAt: Date.now() } : p));
  };

  const handleDeleteOrder = (orderId: string) => {
    showConfirm("確認刪除", "確定要刪除此訂單嗎？", () => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    });
  };

  const totalAmount = customerOrders.reduce((sum, o) => sum + o.subtotal, 0);
  const unpaidAmount = customerOrders
    .filter(o => !o.isPaid)
    .reduce((sum, order) => sum + order.subtotal, 0);

  const totalRequested = customerOrders.reduce((sum, o) => sum + o.requestedQuantity, 0);
  const totalAllocated = customerOrders.reduce((sum, o) => sum + o.allocatedQuantity, 0);
  const totalArrived = customerOrders.reduce((sum, o) => sum + (o.arrivedQuantity ?? 0), 0);
  
  const canShip = customerOrders.length > 0 && customerOrders.every(o => (o.arrivedQuantity ?? 0) >= o.requestedQuantity);
  const isAllShipped = customerOrders.length > 0 && customerOrders.every(o => o.isShipped);

  const notificationText = useMemo(() => {
    const ordersToNotify = selectedOrders.size > 0 
      ? customerOrders.filter(o => selectedOrders.has(o.id))
      : displayedOrders;

    const notifyTotalAmount = ordersToNotify.reduce((sum, o) => sum + o.subtotal, 0);

    const orderItemsText = ordersToNotify.map(o => {
      const product = products.find(p => p.id === o.productId);
      return `${product?.name || '未知商品'} ${product?.variant ? `(${product.variant})` : ''} x ${o.requestedQuantity} $${product?.price || 0}`;
    }).join('\n');

    return `親愛的 ${customer.name} 您好，
您本次的連線購物明細如下：

${orderItemsText}
----------------
消費總額：$${notifyTotalAmount.toLocaleString()}

${notificationTemplate}`;
  }, [customer.name, customerOrders, products, notificationTemplate, selectedOrders]);

  const handleCopy = () => {
    navigator.clipboard.writeText(notificationText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedOrders.size === displayedOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(displayedOrders.map(o => o.id)));
    }
  };

  const handleToggleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleBillSelected = () => {
    if (selectedOrders.size === 0) {
      showAlert("提示", "請先選擇要結單的訂單");
      return;
    }
    showConfirm("確認結單", `確定要將選取的 ${selectedOrders.size} 筆訂單結單嗎？`, () => {
      setOrders(prev => prev.map(o => 
        selectedOrders.has(o.id) ? { ...o, isBilled: true, updatedAt: Date.now() } : o
      ));
      setSelectedOrders(new Set());
      showAlert("成功", "已結單");
    });
  };

  const handleBulkStatusUpdate = (status: 'isPaid' | 'isBilled' | 'isShipped', value: boolean) => {
    const statusNames = { isPaid: '收款', isBilled: '結單', isShipped: '寄出' };
    const valueName = value ? '已' : '未';
    showConfirm(`確認變更`, `確定要將所有訂單標記為${valueName}${statusNames[status]}嗎？`, () => {
      setOrders(prev => prev.map(o => 
        o.customerId === customer.id ? { ...o, [status]: value, updatedAt: Date.now() } : o
      ));
      showAlert("成功", "已更新狀態");
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center bg-gray-50/50 gap-4">
          <div className="w-full">
            <div className="flex justify-between w-full md:w-auto">
              {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  className="input-field py-1 px-2 text-xl font-bold w-48"
                  autoFocus
                />
                <button onClick={handleSaveName} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                  <Save size={20} />
                </button>
                <button onClick={() => { setIsEditingName(false); setEditedName(customer.name); }} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group">
                <h3 className="text-2xl font-bold text-gray-900">{customer.name} 的訂單明細</h3>
                <button onClick={() => setIsEditingName(true)} className="p-1.5 text-gray-400 md:opacity-0 md:group-hover:opacity-100 hover:bg-gray-100 rounded-lg transition-all" title="編輯顧客名稱">
                  <Edit2 size={16} />
                </button>
              </div>
            )}
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors md:hidden">
              <X size={24} />
            </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-sm text-gray-500">配貨數代表已分配給顧客的數量，到貨數代表回國清點後的數量</span>
              <div className="flex flex-wrap gap-2 ml-2">
                <span className="text-sm bg-gray-100 px-2 py-0.5 rounded-full">訂單總數: <span className="font-bold">{totalRequested}</span></span>
                <span className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">已配貨: <span className="font-bold">{totalAllocated}</span></span>
                <span className="text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded-full">已到貨: <span className="font-bold">{totalArrived}</span></span>
                <span className="text-sm bg-red-50 text-red-700 px-2 py-0.5 rounded-full">未收金額: <span className="font-bold">${unpaidAmount.toLocaleString()}</span></span>
                {canShip && !isAllShipped && (
                  <span className="text-sm bg-green-500 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Check size={14} /> 可出貨
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              <button 
                onClick={() => handleBulkStatusUpdate('isBilled', true)}
                className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors font-bold"
              >
                全部結單
              </button>
              <button 
                onClick={() => handleBulkStatusUpdate('isPaid', true)}
                className="text-[10px] px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors font-bold"
              >
                全部已收
              </button>
              <button 
                onClick={() => handleBulkStatusUpdate('isPaid', false)}
                className="text-[10px] px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors font-bold"
              >
                全部未收
              </button>
            </div>
          </div>
          <div className="flex overflow-x-auto hide-scrollbar snap-x pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:overflow-visible items-center gap-2 md:gap-4 shrink-0 w-full md:w-auto">
            <button 
              onClick={handleBillSelected} 
              disabled={selectedOrders.size === 0}
              className={`flex shrink-0 snap-start items-center gap-2 px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap ${
                selectedOrders.size > 0 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Check size={18} /> 結單 ({selectedOrders.size})
            </button>
            <button onClick={handleCopy} className="btn-secondary flex shrink-0 snap-start items-center gap-2 whitespace-nowrap">
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? '已複製' : '複製'}
            </button>
            <button onClick={() => setIsAddOrderModalOpen(true)} className="btn-primary flex shrink-0 snap-start items-center gap-2 whitespace-nowrap">
              <Plus size={18} /> 新增訂單
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors hidden md:block shrink-0">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="flex border-b border-gray-200 mb-6">
            <button 
              onClick={() => { setActiveTab('pending'); setSelectedOrders(new Set()); }}
              className={`px-6 py-2 font-bold transition-colors border-b-2 ${activeTab === 'pending' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              訂單明細 ({customerOrders.filter(o => !o.isBilled).length})
            </button>
            <button 
              onClick={() => { setActiveTab('billed'); setSelectedOrders(new Set()); }}
              className={`px-6 py-2 font-bold transition-colors border-b-2 ${activeTab === 'billed' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              結帳記錄 ({customerOrders.filter(o => o.isBilled).length})
            </button>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-gray-50/50 text-[11px] font-bold uppercase letter-spacing-0.05em text-gray-400 border-b border-gray-200">
                  <th className="p-3 w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300" 
                      checked={displayedOrders.length > 0 && selectedOrders.size === displayedOrders.length}
                      onChange={handleToggleSelectAll}
                    />
                  </th>
                  <th className="p-3 w-[30%]">商品名稱</th>
                  <th className="p-3 w-[15%] text-center">訂單總數</th>
                  <th className="p-3 w-[15%] text-right">金額</th>
                  <th className="p-3 w-16 text-center">到貨</th>
                  <th className="p-3 w-16 text-center">配貨</th>
                  <th className="p-3 w-12 text-center">結單</th>
                  <th className="p-3 w-12 text-center">收款</th>
                  <th className="p-3 w-12 text-center">寄出</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedOrders.map(order => {
                  const product = products.find(p => p.id === order.productId);
                  if (!product) return null;
                  const isArrived = (order.arrivedQuantity ?? 0) >= order.requestedQuantity && order.requestedQuantity > 0;
                  const isFullyAllocated = order.allocatedQuantity >= order.requestedQuantity;

                  return (
                    <tr key={order.id} className={`hover:bg-blue-50/30 transition-colors group ${order.isPaid ? 'opacity-70' : ''}`}>
                      <td className="p-3 text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300" 
                          checked={selectedOrders.has(order.id)}
                          onChange={() => handleToggleSelectOrder(order.id)}
                        />
                      </td>
                      <td className="p-3">
                        <div className="overflow-hidden">
                          <div className="font-medium text-sm text-gray-900 flex items-center gap-2 truncate">
                            {product.name}
                            {order.isUrgent && (
                              <span className="shrink-0 px-1 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded uppercase">緊急</span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5 truncate">{product.variant || '-'}</div>
                        </div>
                      </td>
                      <td className="p-3 text-center text-[11px] font-mono text-gray-400">
                        {order.requestedQuantity} × {product.price}
                      </td>
                      <td className="p-3 text-right font-mono text-sm font-medium text-gray-900">
                        {order.subtotal.toLocaleString()}
                      </td>
                      <td className="p-3 text-center">
                        <input 
                          type="number" 
                          min="0"
                          max={order.requestedQuantity}
                          value={order.arrivedQuantity || 0}
                          onChange={(e) => handleUpdateOrderWithValidation(order.id, { arrivedQuantity: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-12 px-1 py-0.5 border border-gray-200 rounded text-center text-[10px] focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input 
                          type="number" 
                          min="0"
                          max={order.requestedQuantity}
                          value={order.allocatedQuantity}
                          onChange={(e) => handleUpdateOrderWithValidation(order.id, { allocatedQuantity: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="w-12 px-1 py-0.5 border border-gray-200 rounded text-center text-[10px] focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => handleUpdateOrderWithValidation(order.id, { isBilled: !order.isBilled })}
                          className={`w-5 h-5 rounded-full flex items-center justify-center mx-auto transition-colors ${order.isBilled ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          <Check size={12} />
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => handleUpdateOrderWithValidation(order.id, { isPaid: !order.isPaid })}
                          className={`w-5 h-5 rounded-full flex items-center justify-center mx-auto transition-colors ${order.isPaid ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          <Check size={12} />
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button 
                          onClick={() => handleUpdateOrderWithValidation(order.id, { isShipped: !order.isShipped })}
                          className={`w-5 h-5 rounded-full flex items-center justify-center mx-auto transition-colors ${order.isShipped ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          <Truck size={12} />
                        </button>
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => handleDeleteOrder(order.id)} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {displayedOrders.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-10 text-center text-gray-400 text-sm">
                      尚無訂單記錄
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {displayedOrders.map(order => {
              const product = products.find(p => p.id === order.productId);
              if (!product) return null;
              
              return (
                <div key={order.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        className="w-5 h-5 rounded border-gray-300" 
                        checked={selectedOrders.has(order.id)}
                        onChange={() => handleToggleSelectOrder(order.id)}
                      />
                      <div>
                        <div className="font-bold text-sm text-gray-900 flex items-center gap-2">
                          {product.name}
                          {order.isUrgent && (
                            <span className="px-1 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded uppercase">緊急</span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400">{product.variant || '-'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm">${order.subtotal.toLocaleString()}</div>
                      <div className="text-[10px] text-gray-400">{order.requestedQuantity} × {product.price}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-2 rounded-lg border border-gray-100">
                      <div className="text-[10px] text-gray-400 mb-1">到貨數量</div>
                      <input 
                        type="number" 
                        min="0"
                        max={order.requestedQuantity}
                        value={order.arrivedQuantity || 0}
                        onChange={(e) => handleUpdateOrderWithValidation(order.id, { arrivedQuantity: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-center text-sm font-bold focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-gray-100">
                      <div className="text-[10px] text-gray-400 mb-1">配貨數量</div>
                      <input 
                        type="number" 
                        min="0"
                        max={order.requestedQuantity}
                        value={order.allocatedQuantity}
                        onChange={(e) => handleUpdateOrderWithValidation(order.id, { allocatedQuantity: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-center text-sm font-bold focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                    <div className="flex gap-4">
                      <button 
                        onClick={() => handleUpdateOrderWithValidation(order.id, { isBilled: !order.isBilled })}
                        className={`flex flex-col items-center gap-1 ${order.isBilled ? 'text-purple-600' : 'text-gray-300'}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${order.isBilled ? 'bg-purple-100' : 'bg-gray-100'}`}>
                          <Check size={14} />
                        </div>
                        <span className="text-[9px] font-bold">結單</span>
                      </button>
                      <button 
                        onClick={() => handleUpdateOrderWithValidation(order.id, { isPaid: !order.isPaid })}
                        className={`flex flex-col items-center gap-1 ${order.isPaid ? 'text-emerald-600' : 'text-gray-300'}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${order.isPaid ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                          <Check size={14} />
                        </div>
                        <span className="text-[9px] font-bold">收款</span>
                      </button>
                      <button 
                        onClick={() => handleUpdateOrderWithValidation(order.id, { isShipped: !order.isShipped })}
                        className={`flex flex-col items-center gap-1 ${order.isShipped ? 'text-orange-600' : 'text-gray-300'}`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${order.isShipped ? 'bg-orange-100' : 'bg-gray-100'}`}>
                          <Truck size={14} />
                        </div>
                        <span className="text-[9px] font-bold">寄出</span>
                      </button>
                    </div>
                    <button onClick={() => handleDeleteOrder(order.id)} className="p-2 text-gray-300 hover:text-red-500">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              );
            })}
            {displayedOrders.length === 0 && (
              <div className="p-10 text-center text-gray-400 text-sm">
                尚無訂單記錄
              </div>
            )}
          </div>

          <div className="mt-8 p-6 bg-blue-50 rounded-2xl border border-blue-100">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-blue-900">通知付款文案預覽</h4>
              <button 
                onClick={handleCopy}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                  copied ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? '已複製' : '複製文案'}
              </button>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans bg-white p-4 rounded-xl border border-blue-100 leading-relaxed">
              {notificationText}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-end bg-gray-50/50">
          <button onClick={onClose} className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-lg">
            關閉
          </button>
        </div>
      </div>

      {/* Add Order Modal */}
      {isAddOrderModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60] p-4">
          <div className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">新增訂單</h3>
            <div className="space-y-4">
              <div className="p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">商品名稱</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={productName} 
                    onChange={e => setProductName(e.target.value)}
                    list="modal-products-list"
                    placeholder="輸入或選擇商品"
                  />
                  <datalist id="modal-products-list">
                    {Array.from(new Set(products.map(p => p.name))).map(name => <option key={name} value={name} />)}
                  </datalist>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">款式/規格</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={productVariant} 
                    onChange={e => setProductVariant(e.target.value)}
                    list="modal-variants-list"
                    placeholder="例如：紅色 M"
                  />
                  <datalist id="modal-variants-list">
                    {products.filter(p => p.name === productName).map(p => p.variant).map((v, i) => <option key={i} value={v} />)}
                  </datalist>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">單價</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      value={Number.isNaN(productPrice) ? '' : productPrice} 
                      onChange={e => setProductPrice(Number(e.target.value) || 0)} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">喊單數量</label>
                    <input 
                      type="number" 
                      min="1" 
                      className="input-field" 
                      value={Number.isNaN(requestedQuantity) ? '' : requestedQuantity} 
                      onChange={e => setRequestedQuantity(Number(e.target.value) || 1)} 
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">已買到數量</label>
                  <input 
                    type="number" 
                    min="0" 
                    className="input-field" 
                    value={Number.isNaN(allocatedQuantity) ? '' : allocatedQuantity} 
                    onChange={e => setAllocatedQuantity(Math.max(0, Number(e.target.value) || 0))} 
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      checked={isUrgent}
                      onChange={e => setIsUrgent(e.target.checked)}
                    />
                    <span className="text-sm font-medium text-red-600">標記為緊急</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">備註 (選填)</label>
                <textarea 
                  className="input-field min-h-[80px]" 
                  value={note} 
                  onChange={e => setNote(e.target.value)}
                  placeholder="例如：客人說要送人的，請包裝好"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--color-border)]">
                <button 
                  onClick={() => setIsAddOrderModalOpen(false)} 
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveOrder} 
                  className="btn-primary"
                >
                  儲存訂單
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

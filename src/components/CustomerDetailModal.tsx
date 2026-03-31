import React, { useState, useMemo, useEffect } from 'react';
import { X, Copy, Check, Save, Trash2, Plus } from 'lucide-react';
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
}

export default function CustomerDetailModal({ customer, orders, setOrders, products, setProducts, notificationTemplate, onClose }: Props) {
  const { showAlert, showConfirm } = useDialog();
  const [copied, setCopied] = useState(false);
  
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

  const handleUpdateOrder = (orderId: string, updates: Partial<Order>) => {
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
  const totalRequested = customerOrders.reduce((sum, o) => sum + o.requestedQuantity, 0);
  const totalAllocated = customerOrders.reduce((sum, o) => sum + o.allocatedQuantity, 0);
  const totalArrived = customerOrders.reduce((sum, o) => sum + (o.arrivedQuantity ?? (o.isArrived ? o.allocatedQuantity : 0)), 0);
  
  const hasAllocated = customerOrders.some(o => o.allocatedQuantity > 0);
  const canShip = hasAllocated && customerOrders.every(o => {
    if (o.allocatedQuantity === 0) return true;
    return (o.arrivedQuantity ?? (o.isArrived ? o.allocatedQuantity : 0)) >= o.allocatedQuantity;
  });

  const notificationText = useMemo(() => {
    const orderItemsText = customerOrders.map(o => {
      const product = products.find(p => p.id === o.productId);
      return `${product?.name || '未知商品'} ${product?.variant ? `(${product.variant})` : ''} x ${o.requestedQuantity} $${product?.price || 0}`;
    }).join('\n');

    return `親愛的 ${customer.name} 您好，
您本次的連線購物明細如下：

${orderItemsText}
----------------
消費總額：$${totalAmount.toLocaleString()}

${notificationTemplate}`;
  }, [customer.name, customerOrders, products, totalAmount, notificationTemplate]);

  const handleCopy = () => {
    navigator.clipboard.writeText(notificationText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">{customer.name} 的訂單明細</h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-sm text-gray-500">配單數代表已配到幾個，欠數代表還差幾個</span>
              <div className="flex gap-2 ml-2">
                <span className="text-sm bg-gray-100 px-2 py-0.5 rounded-full">總需求: <span className="font-bold">{totalRequested}</span></span>
                <span className="text-sm bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">總配單: <span className="font-bold">{totalAllocated}</span></span>
                <span className="text-sm bg-green-50 text-green-700 px-2 py-0.5 rounded-full">總到貨: <span className="font-bold">{totalArrived}</span></span>
                {canShip && (
                  <span className="text-sm bg-green-500 text-white px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <Check size={14} /> 可出貨
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsAddOrderModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus size={18} /> 新增訂單
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-sm font-bold text-gray-600">
                  <th className="py-3 px-2">商品名稱</th>
                  <th className="py-3 px-2">規格</th>
                  <th className="py-3 px-2 w-20">需求數</th>
                  <th className="py-3 px-2 w-20">配單數</th>
                  <th className="py-3 px-2 w-20 text-red-500">欠數</th>
                  <th className="py-3 px-2 w-20 text-green-600">到貨</th>
                  <th className="py-3 px-2 w-24">單價</th>
                  <th className="py-3 px-2 w-28">總價</th>
                  <th className="py-3 px-2 w-24">建立日期</th>
                  <th className="py-3 px-2 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerOrders.map(order => {
                  const product = products.find(p => p.id === order.productId);
                  if (!product) return null;
                  const owed = Math.max(0, order.requestedQuantity - order.allocatedQuantity);

                  return (
                    <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 px-2">
                        <input 
                          type="text" 
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-1"
                          value={product.name}
                          onChange={(e) => handleUpdateProduct(product.id, { name: e.target.value })}
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input 
                          type="text" 
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-1"
                          value={product.variant}
                          onChange={(e) => handleUpdateProduct(product.id, { variant: e.target.value })}
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input 
                          type="number" 
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-1 font-medium"
                          value={order.requestedQuantity}
                          onChange={(e) => {
                            const qty = Math.max(1, Number(e.target.value) || 1);
                            const subtotal = calculateSubtotal(product, qty);
                            handleUpdateOrder(order.id, { requestedQuantity: qty, subtotal });
                          }}
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input 
                          type="number" 
                          className={`w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-1 font-bold ${
                            order.allocatedQuantity < order.requestedQuantity ? 'text-red-500' : 'text-green-600'
                          }`}
                          value={order.allocatedQuantity}
                          onChange={(e) => handleUpdateOrder(order.id, { allocatedQuantity: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td className="py-3 px-2">
                        <span className={`font-bold ${owed > 0 ? 'text-red-600' : 'text-gray-300'}`}>
                          {owed}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <input 
                          type="number" 
                          className={`w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-1 font-bold ${
                            (order.arrivedQuantity ?? (order.isArrived ? order.allocatedQuantity : 0)) < order.allocatedQuantity ? 'text-orange-500' : 'text-green-600'
                          }`}
                          value={order.arrivedQuantity ?? (order.isArrived ? order.allocatedQuantity : 0)}
                          onChange={(e) => handleUpdateOrder(order.id, { arrivedQuantity: Math.max(0, Number(e.target.value) || 0) })}
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input 
                          type="number" 
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-1"
                          value={product.price}
                          onChange={(e) => {
                            const price = Math.max(0, Number(e.target.value) || 0);
                            const updatedProduct = { ...product, price };
                            const subtotal = calculateSubtotal(updatedProduct, order.requestedQuantity);
                            handleUpdateProduct(product.id, { price });
                            handleUpdateOrder(order.id, { subtotal });
                          }}
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input 
                          type="number" 
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-1 font-bold text-blue-600"
                          value={order.subtotal}
                          onChange={(e) => handleUpdateOrder(order.id, { subtotal: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-500">
                        {formatInTimeZone(new Date(order.createdAt), 'Asia/Taipei', 'yyyy/MM/dd')}
                      </td>
                      <td className="py-3 px-2">
                        <button 
                          onClick={() => handleDeleteOrder(order.id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {customerOrders.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              目前沒有訂單
            </div>
          )}

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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">已買到數量</label>
                  <input 
                    type="number" 
                    min="0" 
                    className="input-field" 
                    value={allocatedQuantity} 
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

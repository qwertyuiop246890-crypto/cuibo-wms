import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Save, Trash2 } from 'lucide-react';
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

  const notificationText = useMemo(() => {
    const orderItemsText = customerOrders.map(o => {
      const product = products.find(p => p.id === o.productId);
      return `${product?.name || '未知商品'} ${product?.variant ? `(${product.variant})` : ''} x ${o.requestedQuantity} $${product?.price || 0}`;
    }).join('\n');

    return `親愛的 ${customer.name}您好，
您本次的連線購物明細如下：

${orderItemsText}
----------------
消費總額：${totalAmount.toFixed(0)}

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
            <p className="text-sm text-gray-500 mt-1">配單數代表已配到幾個，欠數代表還差幾個</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={24} />
          </button>
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
                  <th className="py-3 px-2 w-24">單價</th>
                  <th className="py-3 px-2 w-28">總價</th>
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
                            const qty = Number(e.target.value);
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
                          onChange={(e) => handleUpdateOrder(order.id, { allocatedQuantity: Number(e.target.value) })}
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
                          className="w-full bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none py-1"
                          value={product.price}
                          onChange={(e) => {
                            const price = Number(e.target.value);
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
    </div>
  );
}

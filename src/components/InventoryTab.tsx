import React, { useState } from 'react';
import { Search, Plus, Package, AlertCircle } from 'lucide-react';
import { Product, Order } from '../types';
import { useDialog } from '../hooks/useDialog';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
}

export default function InventoryTab({ products, setProducts, orders }: Props) {
  const { showAlert } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [procurementSearchTerm, setProcurementSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newPurchaseQty, setNewPurchaseQty] = useState(0);
  const [newLossQty, setNewLossQty] = useState(0);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.variant.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (product: Product) => {
    setSelectedProduct(product);
    setNewPurchaseQty(0);
    setNewLossQty(0);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!selectedProduct) return;
    
    const updatedProduct: Product = {
      ...selectedProduct,
      purchaseQuantity: Math.max(0, (selectedProduct.purchaseQuantity || 0) + (newPurchaseQty || 0)),
      updatedAt: Date.now()
    };

    setProducts(products.map(p => p.id === selectedProduct.id ? updatedProduct : p));
    setIsModalOpen(false);
  };

  const procurementList = products.map(product => {
    const productOrders = orders.filter(o => o.productId === product.id);
    const totalRequested = productOrders.reduce((sum, o) => sum + o.requestedQuantity, 0);
    const availableQuantity = (product.purchaseQuantity || 0);
    const needsPurchase = Math.max(0, totalRequested - availableQuantity);
    return { ...product, totalRequested, needsPurchase };
  }).filter(p => p.needsPurchase > 0);

  const filteredProcurementList = procurementList.filter(p => 
    p.name.toLowerCase().includes(procurementSearchTerm.toLowerCase()) || 
    p.variant.toLowerCase().includes(procurementSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">庫存管理</h2>
      </div>

      {/* Procurement Section */}
      {procurementList.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2 text-orange-800">
              <AlertCircle size={24} />
              <h3 className="text-xl font-bold">待採購清單</h3>
            </div>
            <div className="relative w-full sm:w-64">
              <input 
                type="text" 
                placeholder="搜尋待採購商品..." 
                className="w-full px-4 py-2 rounded-lg border border-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                value={procurementSearchTerm}
                onChange={(e) => setProcurementSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          {filteredProcurementList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProcurementList.map(item => (
                <div key={item.id} className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.variant || '預設'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-orange-600 font-bold uppercase">還有幾個沒有買</p>
                      <p className="text-2xl font-black text-orange-600">{item.needsPurchase}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedProduct(item);
                      setNewPurchaseQty(item.needsPurchase);
                      setIsModalOpen(true);
                    }}
                    className="w-full py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-bold text-sm flex justify-center items-center gap-1"
                  >
                    <Package size={16} /> 登記已採購
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-orange-600/60 font-medium">
              找不到符合的待採購商品
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <input 
          type="text" 
          placeholder="搜尋商品進行庫存管理..." 
          className="input-field"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(product => {
          const productOrders = orders.filter(o => o.productId === product.id);
          const totalRequested = productOrders.reduce((sum, o) => sum + o.requestedQuantity, 0);
          const totalAllocated = productOrders.reduce((sum, o) => sum + o.allocatedQuantity, 0);
          const availableQuantity = (product.purchaseQuantity || 0);
          const needsPurchase = Math.max(0, totalRequested - availableQuantity);

          return (
            <div 
              key={product.id} 
              className="card p-5 flex flex-col justify-between border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleOpenModal(product)}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{product.name}</h3>
                  <span className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-full border border-blue-100">
                    {product.variant || '預設'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">客人總共要幾個</p>
                    <p className="text-lg font-bold">{totalRequested}</p>
                  </div>
                  <div className="bg-purple-50 p-2 rounded">
                    <p className="text-[10px] text-purple-600 uppercase">實際上買了幾個</p>
                    <p className="text-lg font-bold text-purple-700">{product.purchaseQuantity || 0}</p>
                  </div>
                  <div className="bg-green-50 p-2 rounded">
                    <p className="text-[10px] text-green-600 uppercase">分配完還有幾個可以賣</p>
                    <p className="text-lg font-bold text-green-700">{(product.purchaseQuantity || 0) - totalAllocated}</p>
                  </div>
                  <div className={`p-2 rounded ${needsPurchase > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                    <p className="text-[10px] text-gray-500 uppercase">還有幾個沒有買</p>
                    <p className={`text-lg font-bold ${needsPurchase > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{needsPurchase}</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenModal(product);
                }}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-bold"
              >
                <Plus size={18} /> 更新庫存
              </button>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Package size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold">更新庫存</h3>
                <p className="text-sm opacity-60">{selectedProduct.name} ({selectedProduct.variant || '預設'})</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">目前實際買了幾個</p>
                  <p className="text-xl font-bold">{selectedProduct.purchaseQuantity || 0}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                  <p className="text-xs text-green-600 mb-1">更新後實際買了幾個</p>
                  <p className="text-xl font-bold text-green-700">{(selectedProduct.purchaseQuantity || 0) + newPurchaseQty}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-blue-600">本次買到的數量 (+/-)</label>
                <input 
                  type="number" 
                  className="input-field text-xl font-bold border-blue-300 focus:ring-blue-500 h-12 text-center" 
                  value={newPurchaseQty || ''} 
                  onChange={e => setNewPurchaseQty(Number(e.target.value))}
                  placeholder="0 (輸入負數表示耗損或減少)"
                />
              </div>

              <div className="p-3 bg-orange-50 rounded-lg flex gap-3 items-start">
                <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-orange-700">
                  請輸入本次實際採購到的數量。若要記錄耗損或減少庫存，請輸入負數（例如：-2）。系統會自動計算至現有數據中。
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">取消</button>
              <button onClick={handleSave} className="btn-primary flex-1">確認新增</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

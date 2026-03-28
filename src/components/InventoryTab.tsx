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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [newPurchaseQty, setNewPurchaseQty] = useState(0);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.variant.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (product: Product) => {
    setSelectedProduct(product);
    setNewPurchaseQty(0);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!selectedProduct) return;
    if (newPurchaseQty <= 0) return showAlert("提示", "請輸入有效的新增數量");

    const updatedProduct: Product = {
      ...selectedProduct,
      purchaseQuantity: (selectedProduct.purchaseQuantity || 0) + newPurchaseQty,
      updatedAt: Date.now()
    };

    setProducts(products.map(p => p.id === selectedProduct.id ? updatedProduct : p));
    setIsModalOpen(false);
  };

  const procurementList = products.map(product => {
    const productOrders = orders.filter(o => o.productId === product.id);
    const totalRequested = productOrders.reduce((sum, o) => sum + o.requestedQuantity, 0);
    const needsPurchase = Math.max(0, totalRequested - (product.purchaseQuantity || 0));
    return { ...product, totalRequested, needsPurchase };
  }).filter(p => p.needsPurchase > 0);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">庫存管理</h2>
      </div>

      {/* Procurement Section */}
      {procurementList.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4 text-orange-800">
            <AlertCircle size={24} />
            <h3 className="text-xl font-bold">待採購清單</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {procurementList.map(item => (
              <div key={item.id} className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex justify-between items-center">
                <div>
                  <p className="font-bold text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.variant || '預設'}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-orange-600 font-bold uppercase">需採購</p>
                  <p className="text-2xl font-black text-orange-600">{item.needsPurchase}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text)] opacity-50" size={20} />
        <input 
          type="text" 
          placeholder="搜尋商品進行庫存管理..." 
          className="input-field pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(product => {
          const productOrders = orders.filter(o => o.productId === product.id);
          const totalRequested = productOrders.reduce((sum, o) => sum + o.requestedQuantity, 0);
          const needsPurchase = Math.max(0, totalRequested - (product.purchaseQuantity || 0));

          return (
            <div key={product.id} className="card p-5 flex flex-col justify-between border-l-4 border-blue-500">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{product.name}</h3>
                  <span className="bg-blue-50 text-blue-600 text-xs px-2 py-1 rounded-full border border-blue-100">
                    {product.variant || '預設'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">目前進貨</p>
                    <p className="text-lg font-bold">{product.purchaseQuantity || 0}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">已配貨</p>
                    <p className="text-lg font-bold">{product.stock}</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-[10px] text-gray-500 uppercase">剩餘庫存</p>
                    <p className="text-lg font-bold text-green-600">{(product.purchaseQuantity || 0) - product.stock}</p>
                  </div>
                  <div className={`p-2 rounded ${needsPurchase > 0 ? 'bg-orange-50' : 'bg-gray-50'}`}>
                    <p className="text-[10px] text-gray-500 uppercase">待採購</p>
                    <p className={`text-lg font-bold ${needsPurchase > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{needsPurchase}</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => handleOpenModal(product)}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 font-bold"
              >
                <Plus size={18} /> 新增進貨
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
                <h3 className="text-xl font-bold">新增庫存</h3>
                <p className="text-sm opacity-60">{selectedProduct.name} ({selectedProduct.variant || '預設'})</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">目前進貨總數</p>
                  <p className="text-xl font-bold">{selectedProduct.purchaseQuantity || 0}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-lg border border-green-100">
                  <p className="text-xs text-green-600 mb-1">預計總數</p>
                  <p className="text-xl font-bold text-green-700">{(selectedProduct.purchaseQuantity || 0) + newPurchaseQty}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold mb-2 text-blue-600">本次進貨數量 (+)</label>
                <input 
                  type="number" 
                  className="input-field text-2xl font-bold border-blue-300 focus:ring-blue-500 h-14 text-center" 
                  value={newPurchaseQty || ''} 
                  onChange={e => setNewPurchaseQty(Number(e.target.value))}
                  autoFocus
                  placeholder="0"
                />
              </div>

              <div className="p-3 bg-orange-50 rounded-lg flex gap-3 items-start">
                <AlertCircle className="text-orange-500 shrink-0 mt-0.5" size={18} />
                <p className="text-xs text-orange-700">
                  請輸入本次實際採購到的數量。系統會自動將此數量累加至現有庫存中。
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

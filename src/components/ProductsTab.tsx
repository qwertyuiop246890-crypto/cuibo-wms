import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { v4 as uuidv4 } from 'uuid';
import { Product, Order } from '../types';
import { useDialog } from '../hooks/useDialog';

interface Props {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
}

export default function ProductsTab({ products, setProducts, orders }: Props) {
  const { showAlert, showConfirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [variant, setVariant] = useState('');
  const [price, setPrice] = useState(0);
  const [discountMode, setDiscountMode] = useState<'none' | 'pair' | 'bulk'>('none');
  const [discountThreshold, setDiscountThreshold] = useState(2);
  const [discountPrice, setDiscountPrice] = useState(0);

  // Auto-fill price if same product name exists
  React.useEffect(() => {
    if (!editingProduct && name.trim()) {
      const existing = products.find(p => p.name.trim() === name.trim());
      if (existing) {
        setPrice(existing.price);
      }
    }
  }, [name, products, editingProduct]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.variant.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setName(product.name);
      setVariant(product.variant);
      setPrice(product.price);
      setDiscountMode(product.discountMode || 'none');
      setDiscountThreshold(product.discountThreshold || 2);
      setDiscountPrice(product.discountPrice || 0);
    } else {
      setEditingProduct(null);
      setName('');
      setVariant('');
      setPrice(0);
      setDiscountMode('none');
      setDiscountThreshold(2);
      setDiscountPrice(0);
    }
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name) return showAlert("提示", "請輸入商品名稱");

    const newProduct: Product = {
      id: editingProduct ? editingProduct.id : uuidv4(),
      name,
      variant,
      purchaseQuantity: editingProduct ? editingProduct.purchaseQuantity : 0,
      stock: editingProduct ? editingProduct.stock : 0,
      price,
      discountMode,
      discountThreshold,
      discountPrice,
      updatedAt: Date.now()
    };

    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? newProduct : p));
    } else {
      setProducts([...products, newProduct]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    showConfirm("確認刪除", "確定要刪除此商品嗎？", () => {
      setProducts(products.filter(p => p.id !== id));
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">商品管理</h2>
        <button onClick={() => handleOpenModal()} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> 新增商品
        </button>
      </div>

      <div className="relative">
        <input 
          type="text" 
          placeholder="搜尋商品..." 
          className="input-field"
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
            <div 
              key={product.id} 
              className="card p-5 flex flex-col justify-between cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleOpenModal(product)}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg">{product.name}</h3>
                  <span className="bg-[var(--color-bg)] text-[var(--color-text)] text-xs px-2 py-1 rounded-full border border-[var(--color-border)]">
                    {product.variant || '預設'}
                  </span>
                </div>
                <div className="space-y-1 text-sm opacity-80 mb-4">
                  <p>單價： <span className="font-medium">${product.price}</span></p>
                  {product.discountMode && product.discountMode !== 'none' && (
                    <p className="text-blue-600 font-medium">
                      {product.discountMode === 'pair' ? '兩件一組' : '兩件以上'}： ${product.discountPrice}
                    </p>
                  )}
                  <p className="text-[10px] text-gray-400 mt-2">最後更新： {formatInTimeZone(new Date(product.updatedAt), 'Asia/Taipei', 'yyyyMMddHHmm')}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-[var(--color-border)]" onClick={e => e.stopPropagation()}>
                <button onClick={() => handleOpenModal(product)} className="p-2 text-[var(--color-primary)] hover:bg-[var(--color-bg)] rounded-full transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(product.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="col-span-full text-center py-10 opacity-60">
            找不到商品。
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">{editingProduct ? '編輯商品' : '新增商品'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">商品名稱</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  list="product-names-list"
                />
                <datalist id="product-names-list">
                  {Array.from(new Set(products.map(p => p.name))).map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">款式/規格</label>
                <input type="text" className="input-field" value={variant} onChange={e => setVariant(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">單價</label>
                <input type="number" className="input-field" value={price} onChange={e => setPrice(Number(e.target.value))} />
              </div>

              <div className="p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] space-y-3">
                <label className="block text-sm font-bold text-[var(--color-primary)]">優惠模式設定</label>
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={discountMode === 'none'} onChange={() => setDiscountMode('none')} />
                    <span className="text-sm">無優惠</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={discountMode === 'pair'} onChange={() => setDiscountMode('pair')} />
                    <span className="text-sm">兩件一組</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={discountMode === 'bulk'} onChange={() => setDiscountMode('bulk')} />
                    <span className="text-sm">兩件以上</span>
                  </label>
                </div>
                
                {discountMode !== 'none' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        幾件開始優惠 (例如 2)
                      </label>
                      <input 
                        type="number" 
                        className="input-field" 
                        value={discountThreshold} 
                        onChange={e => setDiscountThreshold(Number(e.target.value))} 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">
                        {discountMode === 'pair' ? '一組優惠價' : '單件優惠價'}
                      </label>
                      <input 
                        type="number" 
                        className="input-field" 
                        value={discountPrice} 
                        onChange={e => setDiscountPrice(Number(e.target.value))} 
                      />
                    </div>
                  </div>
                )}
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

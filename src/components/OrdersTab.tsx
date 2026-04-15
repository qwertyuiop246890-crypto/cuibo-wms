import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, AlertCircle, DollarSign, Package, Check, Truck, LayoutGrid, List } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState<'customer' | 'product'>('customer');
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showShipped, setShowShipped] = useState(false);
  const [arrivalInputs, setArrivalInputs] = useState<Record<string, number>>({});

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
      const matchesShipped = showShipped ? true : !o.isShipped;

      return matchesSearch && matchesDate && matchesShipped;
    }).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }, [orders, products, customers, searchTerm, startDate, endDate, showShipped]);

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

  const handleSave = (action: 'close' | 'keepCustomer' | 'keepProduct' | 'keepBoth' | 'clearAll' = 'close') => {
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
      arrivedQuantity: editingOrder ? (editingOrder.arrivedQuantity ?? 0) : 0,
      isShipped: editingOrder ? editingOrder.isShipped : false,
      isPaid: editingOrder ? editingOrder.isPaid : false,
      isBilled: editingOrder ? editingOrder.isBilled : false,
      note,
      isUrgent,
      subtotal,
      createdAt: editingOrder ? editingOrder.createdAt : createdAt,
      updatedAt: Date.now()
    };

    if (editingOrder) {
      setOrders(orders.map(o => o.id === editingOrder.id ? newOrder : o));
      setIsModalOpen(false);
    } else {
      setOrders([...orders, newOrder]);
      
      if (action === 'close') {
        setIsModalOpen(false);
      } else if (action === 'clearAll') {
        setCustomerName('');
        setProductName('');
        setProductVariant('');
        setProductPrice(0);
        setRequestedQuantity(1);
        setAllocatedQuantity(0);
        setNote('');
        setIsUrgent(false);
        setCreatedAt(Date.now());
        showAlert("成功", "已新增訂單，請繼續輸入");
      } else if (action === 'keepCustomer') {
        setProductName('');
        setProductVariant('');
        setProductPrice(0);
        setRequestedQuantity(1);
        setAllocatedQuantity(0);
        setNote('');
        setIsUrgent(false);
        setCreatedAt(Date.now());
        showAlert("成功", "已新增訂單，請繼續輸入商品");
      } else if (action === 'keepProduct') {
        setCustomerName('');
        setRequestedQuantity(1);
        setAllocatedQuantity(0);
        setNote('');
        setIsUrgent(false);
        setCreatedAt(Date.now());
        showAlert("成功", "已新增訂單，請繼續輸入顧客");
      } else if (action === 'keepBoth') {
        setRequestedQuantity(1);
        setAllocatedQuantity(0);
        setNote('');
        setIsUrgent(false);
        setCreatedAt(Date.now());
        showAlert("成功", "已新增訂單，請繼續修改");
      }
    }
  };

  const handleDelete = (id: string) => {
    showConfirm("確認刪除", "確定要刪除此訂單嗎？", () => {
      setOrders(orders.filter(o => o.id !== id));
    });
  };

  const handleCleanUnknownOrders = () => {
    const unknownOrders = orders.filter(o => !customers.some(c => c.id === o.customerId));
    if (unknownOrders.length === 0) {
      showAlert("提示", "目前沒有未知的訂單。");
      return;
    }
    showConfirm("確認清理", `確定要刪除 ${unknownOrders.length} 筆未知顧客的訂單嗎？`, () => {
      setOrders(orders.filter(o => customers.some(c => c.id === o.customerId)));
      showAlert("成功", "已成功清理未知訂單。");
    });
  };

  // Get unique product names for datalist
  const uniqueProductNames = Array.from(new Set(products.map(p => p.name)));
  // Get variants for the currently typed product name
  const availableVariants = products.filter(p => p.name === productName).map(p => p.variant);

  const groupedOrders = useMemo(() => {
    const groups: Record<string, { product: Product | undefined; orders: Order[]; totalRequested: number; totalAllocated: number; totalArrived: number; totalSubtotal: number }> = {};
    
    filteredOrders.forEach(order => {
      const pId = order.productId;
      if (!groups[pId]) {
        const product = products.find(p => p.id === pId);
        groups[pId] = { product, orders: [], totalRequested: 0, totalAllocated: 0, totalArrived: 0, totalSubtotal: 0 };
      }
      groups[pId].orders.push(order);
      groups[pId].totalRequested += order.requestedQuantity;
      groups[pId].totalAllocated += order.allocatedQuantity;
      groups[pId].totalArrived += (order.arrivedQuantity ?? 0);
      groups[pId].totalSubtotal += order.subtotal;
    });

    return Object.values(groups).sort((a, b) => {
      const nameA = a.product?.name || '';
      const nameB = b.product?.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [filteredOrders, products]);

  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const toggleProductExpand = (productId: string) => {
    const newExpanded = new Set(expandedProducts);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedProducts(newExpanded);
  };

  // Initial expand all
  useEffect(() => {
    if (groupedOrders.length > 0 && expandedProducts.size === 0) {
      setExpandedProducts(new Set(groupedOrders.map(g => g.product?.id || '')));
    }
  }, [groupedOrders.length]);

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const toggleOrderSelection = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  const toggleProductSelection = (productId: string, orderIds: string[]) => {
    const newSelected = new Set(selectedOrderIds);
    const allSelected = orderIds.every(id => newSelected.has(id));
    
    if (allSelected) {
      orderIds.forEach(id => newSelected.delete(id));
    } else {
      orderIds.forEach(id => newSelected.add(id));
    }
    setSelectedOrderIds(newSelected);
  };

  const handleBulkAction = (action: 'bill' | 'pay' | 'ship' | 'delete') => {
    if (selectedOrderIds.size === 0) {
      showAlert("提示", "請先選擇訂單");
      return;
    }

    const actionNames = { bill: '結單', pay: '收款', ship: '寄出', delete: '刪除' };
    showConfirm(`確認${actionNames[action]}`, `確定要對選取的 ${selectedOrderIds.size} 筆訂單執行${actionNames[action]}嗎？`, () => {
      if (action === 'delete') {
        setOrders(orders.filter(o => !selectedOrderIds.has(o.id)));
      } else {
        const updates: Partial<Order> = {};
        if (action === 'bill') updates.isBilled = true;
        if (action === 'pay') updates.isPaid = true;
        if (action === 'ship') updates.isShipped = true;
        
        setOrders(orders.map(o => selectedOrderIds.has(o.id) ? { ...o, ...updates, updatedAt: Date.now() } : o));
      }
      setSelectedOrderIds(new Set());
      showAlert("成功", `已執行${actionNames[action]}`);
    });
  };

  const handleAllocate = (orderId: string, allocatedQty: number) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, allocatedQuantity: allocatedQty, updatedAt: Date.now() } : o
    ));
  };

  const handleArrive = (orderId: string, arrivedQty: number) => {
    setOrders(prev => prev.map(o => 
      o.id === orderId ? { ...o, arrivedQuantity: arrivedQty, updatedAt: Date.now() } : o
    ));
  };

  const handleAutoArriveProduct = (productId: string, totalArrived: number) => {
    setOrders(prev => {
      let newOrders = prev.map(o => {
        if (o.productId === productId) {
          return { ...o, arrivedQuantity: 0, updatedAt: Date.now() };
        }
        return o;
      });
      
      let remainingArrived = totalArrived;
      
      const productOrders = newOrders
        .filter(o => o.productId === productId && o.requestedQuantity > 0)
        .sort((a, b) => {
          if (a.isUrgent && !b.isUrgent) return -1;
          if (!a.isUrgent && b.isUrgent) return 1;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });

      for (const order of productOrders) {
        const orderIndex = newOrders.findIndex(o => o.id === order.id);
        if (orderIndex !== -1) {
          const toArrive = Math.min(newOrders[orderIndex].requestedQuantity, remainingArrived);
          newOrders[orderIndex] = { ...newOrders[orderIndex], arrivedQuantity: toArrive, updatedAt: Date.now() };
          remainingArrived -= toArrive;
        }
      }
      return newOrders;
    });
    
    setArrivalInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[productId];
      return newInputs;
    });
  };

  const handleArriveAllRequested = (productId?: string) => {
    setOrders(prev => prev.map(o => {
      if (!productId || o.productId === productId) {
        return { ...o, arrivedQuantity: o.requestedQuantity, updatedAt: Date.now() };
      }
      return o;
    }));
  };

  const handleAutoAllocateProduct = (productId: string) => {
    const group = groupedOrders.find(g => g.product?.id === productId);
    if (!group) return;

    setOrders(prev => {
      const newOrders = [...prev];
      let remainingStock = group.product?.purchaseQuantity || 0;
      
      const productOrders = newOrders
        .filter(o => o.productId === productId && o.requestedQuantity > 0)
        .sort((a, b) => {
          if (a.isUrgent && !b.isUrgent) return -1;
          if (!a.isUrgent && b.isUrgent) return 1;
          return (a.createdAt || 0) - (b.createdAt || 0);
        });

      for (const order of productOrders) {
        const orderIndex = newOrders.findIndex(o => o.id === order.id);
        if (orderIndex !== -1) {
          const toAllocate = Math.min(newOrders[orderIndex].requestedQuantity, remainingStock);
          newOrders[orderIndex] = { ...newOrders[orderIndex], allocatedQuantity: toAllocate, updatedAt: Date.now() };
          remainingStock -= toAllocate;
        }
      }
      return newOrders;
    });
  };

  const handleClearAllocations = (productId?: string) => {
    setOrders(prev => prev.map(o => {
      if (!productId || o.productId === productId) {
        return { ...o, allocatedQuantity: 0, updatedAt: Date.now() };
      }
      return o;
    }));
  };

  const handleAutoAllocateAll = () => {
    setOrders(prev => {
      const newOrders = [...prev];
      
      groupedOrders.forEach(group => {
        let remainingStock = group.product?.purchaseQuantity || 0;
        
        const productOrders = newOrders
          .filter(o => o.productId === group.product?.id && o.requestedQuantity > 0)
          .sort((a, b) => {
            if (a.isUrgent && !b.isUrgent) return -1;
            if (!a.isUrgent && b.isUrgent) return 1;
            return (a.createdAt || 0) - (b.createdAt || 0);
          });

        for (const order of productOrders) {
          const orderIndex = newOrders.findIndex(o => o.id === order.id);
          if (orderIndex !== -1) {
            const toAllocate = Math.min(newOrders[orderIndex].requestedQuantity, remainingStock);
            newOrders[orderIndex] = { ...newOrders[orderIndex], allocatedQuantity: toAllocate, updatedAt: Date.now() };
            remainingStock -= toAllocate;
          }
        }
      });
      
      return newOrders;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">訂單與配貨管理</h2>
          <div className="flex gap-1 mt-2 p-1 bg-gray-100 rounded-lg w-fit">
            <button 
              onClick={() => setViewMode('customer')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'customer' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <List size={16} /> 顧客視角
            </button>
            <button 
              onClick={() => setViewMode('product')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-bold transition-all ${viewMode === 'product' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <LayoutGrid size={16} /> 配貨視角
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedOrderIds.size > 0 && (
            <div className="flex gap-2 mr-2">
              <button onClick={() => handleBulkAction('bill')} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors">結單</button>
              <button onClick={() => handleBulkAction('pay')} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-bold hover:bg-green-100 transition-colors">收款</button>
              <button onClick={() => handleBulkAction('ship')} className="px-3 py-1.5 bg-orange-50 text-orange-600 rounded-lg text-sm font-bold hover:bg-orange-100 transition-colors">寄出</button>
              <button onClick={() => handleBulkAction('delete')} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors">刪除</button>
            </div>
          )}
          {viewMode === 'product' && (
            <div className="flex gap-2 mr-2">
              <button onClick={() => handleClearAllocations()} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors">清除全部買到</button>
              <button onClick={handleAutoAllocateAll} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors shadow-sm">全部自動買到</button>
            </div>
          )}
          <button 
            onClick={handleCleanUnknownOrders} 
            className="px-4 py-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-bold text-sm flex items-center gap-2"
          >
            <Trash2 size={18} /> 清理未知
          </button>
          <button 
            onClick={() => handleOpenModal()} 
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} /> 新增訂單
          </button>
        </div>
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
        <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-[var(--color-border)]">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[var(--color-text)] px-2">
            <input 
              type="checkbox" 
              checked={showShipped} 
              onChange={(e) => setShowShipped(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            顯示已出貨
          </label>
        </div>
        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-sm border border-[var(--color-border)]">
          <DollarSign size={18} className="text-[var(--color-primary)]" />
          <span className="font-bold text-[var(--color-text)]">總計: ${totalAmount.toLocaleString()}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-gray-50/50 text-[var(--color-text)] text-[11px] font-bold uppercase letter-spacing-0.05em border-b border-[var(--color-border)] opacity-50">
                <th className="p-3 w-10 text-center"></th>
                <th className="p-3 w-[25%]">商品 / 備註</th>
                <th className="p-3 w-[15%]">顧客</th>
                <th className="p-3 w-[12%] text-center">明細</th>
                <th className="p-3 w-[12%] text-right">金額</th>
                <th className="p-3 w-12 text-center">到貨</th>
                <th className="p-3 w-12 text-center">配單</th>
                <th className="p-3 w-12 text-center">結單</th>
                <th className="p-3 w-12 text-center">收款</th>
                <th className="p-3 w-12 text-center">寄出</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {groupedOrders.map(group => {
                const productId = group.product?.id || 'unknown';
                const isExpanded = expandedProducts.has(productId);
                const orderIds = group.orders.map(o => o.id);
                const isProductSelected = orderIds.every(id => selectedOrderIds.has(id));
                
                return (
                  <React.Fragment key={productId}>
                    {/* Product Header Row */}
                    <tr className={`bg-gray-50/30 font-bold border-b border-[var(--color-border)] hover:bg-gray-50 transition-colors ${viewMode === 'product' ? 'bg-blue-50/20' : ''}`}>
                      <td className="p-3 text-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-300" 
                          checked={isProductSelected}
                          onChange={() => toggleProductSelection(productId, orderIds)}
                        />
                      </td>
                      <td className="p-3 cursor-pointer" onClick={() => toggleProductExpand(productId)}>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 text-[10px]">{isExpanded ? '▼' : '▶'}</span>
                          <span className="truncate">{group.product?.name || '未知商品'}</span>
                          <span className="text-[10px] font-normal text-gray-400 truncate">({group.product?.variant || '-'})</span>
                        </div>
                      </td>
                      <td className="p-3 text-[11px] text-gray-400 font-normal truncate">
                        {viewMode === 'product' ? (
                          <span className="text-blue-600 font-bold">進貨: {group.product?.purchaseQuantity || 0}</span>
                        ) : (
                          `共 ${group.orders.length} 筆`
                        )}
                      </td>
                      <td className="p-3 text-center text-[11px] font-mono text-gray-400">
                        {group.totalRequested}
                      </td>
                      <td className="p-3 text-right font-mono text-sm">
                        ${group.totalSubtotal.toLocaleString()}
                      </td>
                      <td className="p-3 text-center text-[11px] font-mono text-gray-400">
                        {group.totalArrived}
                      </td>
                      <td className="p-3 text-center text-[11px] font-mono text-gray-400">
                        {group.totalAllocated}
                      </td>
                      <td colSpan={3} className="p-3 text-right">
                        {viewMode === 'product' && isExpanded && (
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleClearAllocations(productId); }}
                              className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] rounded hover:bg-gray-200 transition-colors"
                            >
                              清除買到
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleAutoAllocateProduct(productId); }}
                              className="px-2 py-1 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-700 transition-colors"
                            >
                              自動買到
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Allocation Control Row (Only in Product Mode) */}
                    {viewMode === 'product' && isExpanded && (
                      <tr className="bg-blue-50/10 border-b border-blue-100">
                        <td colSpan={3} className="p-3 pl-12">
                          <div className="flex items-center gap-2 text-[11px] text-blue-800 font-medium">
                            <Truck size={14} /> 到貨分配 (僅分配給已買到)
                          </div>
                        </td>
                        <td colSpan={7} className="p-3 pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <input 
                              type="number" 
                              min="0"
                              placeholder="到貨數量"
                              className="w-24 px-2 py-1 border border-blue-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                              value={arrivalInputs[productId] === undefined ? '' : arrivalInputs[productId]}
                              onChange={e => setArrivalInputs({...arrivalInputs, [productId]: parseInt(e.target.value)})}
                              onClick={e => e.stopPropagation()}
                            />
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleAutoArriveProduct(productId, arrivalInputs[productId] || 0); }}
                              disabled={!arrivalInputs[productId] && arrivalInputs[productId] !== 0}
                              className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                              分配
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleArriveAllRequested(productId); }}
                              className="px-3 py-1 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition-colors"
                            >
                              全部到貨
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                    
                    {/* Order Rows */}
                    {isExpanded && group.orders.map(order => {
                      const customer = customers.find(c => c.id === order.customerId);
                      const isFullyAllocated = order.allocatedQuantity >= order.requestedQuantity;
                      const isArrived = (order.arrivedQuantity ?? 0) >= order.requestedQuantity && order.requestedQuantity > 0;
                      
                      return (
                        <tr 
                          key={order.id} 
                          className="hover:bg-blue-50/30 transition-colors cursor-pointer group"
                          onClick={() => handleOpenModal(order)}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-gray-300" 
                              checked={selectedOrderIds.has(order.id)}
                              onChange={() => toggleOrderSelection(order.id)}
                            />
                          </td>
                          <td className="p-3 pl-6">
                            <div className="flex items-center gap-2 overflow-hidden">
                              {order.isUrgent && (
                                <span className="shrink-0 px-1 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold rounded uppercase">緊急</span>
                              )}
                              <span className="text-xs text-gray-500 truncate group-hover:text-gray-900">{order.note || '無備註'}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-bold">
                                {customer?.name?.[0] || '?'}
                              </div>
                              <span className="text-sm font-medium text-gray-700 truncate">{customer?.name || '未知'}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center text-[11px] font-mono text-gray-400">
                            {viewMode === 'product' ? (
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-gray-900 font-bold">{order.requestedQuantity}</span>
                                <span className="text-[9px]">× {group.product?.price || 0}</span>
                              </div>
                            ) : (
                              `${order.requestedQuantity} × ${group.product?.price || 0}`
                            )}
                          </td>
                          <td className="p-3 text-right font-mono text-sm font-medium text-gray-900">
                            ${order.subtotal.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">
                            {viewMode === 'product' ? (
                              <input 
                                type="number" 
                                min="0"
                                max={order.requestedQuantity}
                                value={order.arrivedQuantity || 0}
                                onChange={(e) => handleArrive(order.id, Math.max(0, parseInt(e.target.value) || 0))}
                                onClick={e => e.stopPropagation()}
                                className="w-10 px-1 py-0.5 border border-gray-200 rounded text-center text-[10px] focus:ring-1 focus:ring-blue-500"
                              />
                            ) : (
                              isArrived ? <span className="text-green-600 text-xs">●</span> : <span className="text-gray-200 text-[10px]">○</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {viewMode === 'product' ? (
                              <input 
                                type="number" 
                                min="0"
                                max={order.requestedQuantity}
                                value={order.allocatedQuantity}
                                onChange={(e) => handleAllocate(order.id, Math.max(0, parseInt(e.target.value) || 0))}
                                onClick={e => e.stopPropagation()}
                                className="w-10 px-1 py-0.5 border border-gray-200 rounded text-center text-[10px] focus:ring-1 focus:ring-blue-500"
                              />
                            ) : (
                              isFullyAllocated ? <span className="text-blue-600 text-xs">●</span> : <span className="text-gray-200 text-[10px]">○</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {order.isBilled ? <span className="text-purple-600 text-xs">●</span> : <span className="text-gray-200 text-[10px]">○</span>}
                          </td>
                          <td className="p-3 text-center">
                            {order.isPaid ? <span className="text-emerald-600 text-xs">●</span> : <span className="text-gray-200 text-[10px]">○</span>}
                          </td>
                          <td className="p-3 text-center">
                            {order.isShipped ? <span className="text-orange-600 text-xs">●</span> : <span className="text-gray-200 text-[10px]">○</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
              {filteredOrders.length === 0 && (
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
        <div className="md:hidden divide-y divide-[var(--color-border)]">
          {groupedOrders.map(group => {
            const productId = group.product?.id || 'unknown';
            const isExpanded = expandedProducts.has(productId);
            const orderIds = group.orders.map(o => o.id);
            const isProductSelected = orderIds.every(id => selectedOrderIds.has(id));

            return (
              <div key={productId} className="border-b border-gray-100">
                {/* Product Header Mobile */}
                <div 
                  className="p-4 bg-gray-50 flex items-center justify-between cursor-pointer"
                  onClick={() => toggleProductExpand(productId)}
                >
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-gray-300" 
                      checked={isProductSelected}
                      onChange={(e) => { e.stopPropagation(); toggleProductSelection(productId, orderIds); }}
                    />
                    <div>
                      <h3 className="font-bold">{group.product?.name || '未知商品'}</h3>
                      <p className="text-xs text-gray-500">{group.product?.variant || '-'} | 共 {group.orders.length} 筆</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <div className="text-sm font-bold">${group.totalSubtotal.toLocaleString()}</div>
                    <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                  </div>
                </div>

                {/* Orders Mobile */}
                {isExpanded && group.orders.map(order => {
                  const customer = customers.find(c => c.id === order.customerId);
                  const isFullyAllocated = order.allocatedQuantity >= order.requestedQuantity;
                  const isArrived = (order.arrivedQuantity ?? 0) >= order.requestedQuantity && order.requestedQuantity > 0;
                  
                  return (
                    <div 
                      key={order.id} 
                      className="p-4 pl-8 space-y-3 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 border-l-blue-50"
                      onClick={() => handleOpenModal(order)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded border-gray-300" 
                            checked={selectedOrderIds.has(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-bold">{customer?.name || '未知'}</span>
                            {order.isUrgent && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold rounded uppercase">緊急</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{order.note || '無備註'}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-base">${order.subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          <div className="text-[10px] text-gray-500">{order.requestedQuantity} × {group.product?.price || 0}</div>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center bg-white p-2 rounded-lg text-[10px] border border-gray-100">
                        <div className="flex flex-col items-center">
                          <span className="text-gray-400">到貨</span>
                          {isArrived ? <span className="text-green-600 font-bold">✔</span> : <span className="text-gray-300">—</span>}
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-gray-400">配單</span>
                          {isFullyAllocated ? <span className="text-green-600 font-bold">✔</span> : <span className="text-gray-300">—</span>}
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-gray-400">結單</span>
                          {order.isBilled ? <span className="text-green-600 font-bold">✔</span> : <span className="text-gray-300">—</span>}
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-gray-400">收款</span>
                          {order.isPaid ? <span className="text-green-600 font-bold">✔</span> : <span className="text-gray-300">—</span>}
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-gray-400">寄出</span>
                          {order.isShipped ? <span className="text-green-600 font-bold">✔</span> : <span className="text-gray-300">—</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="card p-4 sm:p-5 w-full max-w-lg max-h-[95vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-3">{editingOrder ? '編輯訂單' : '新增訂單'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">顧客名稱</label>
                <input 
                  type="text" 
                  className="input-field py-1.5" 
                  value={customerName} 
                  onChange={e => setCustomerName(e.target.value)}
                  list="customers-list"
                  placeholder="輸入或選擇顧客"
                />
                <datalist id="customers-list">
                  {customers.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              
              <div className="p-3 bg-[var(--color-bg)] rounded-lg border border-[var(--color-border)] space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">商品名稱</label>
                    <input 
                      type="text" 
                      className="input-field py-1.5" 
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
                      className="input-field py-1.5" 
                      value={productVariant} 
                      onChange={e => setProductVariant(e.target.value)}
                      list="variants-list"
                      placeholder="例如：紅色 M"
                    />
                    <datalist id="variants-list">
                      {availableVariants.map((v, i) => <option key={i} value={v} />)}
                    </datalist>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">單價</label>
                    <input 
                      type="number" 
                      className="input-field py-1.5" 
                      value={productPrice} 
                      onChange={e => setProductPrice(Number(e.target.value))} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">喊單數量</label>
                    <input 
                      type="number" 
                      min="1" 
                      className="input-field py-1.5" 
                      value={requestedQuantity} 
                      onChange={e => setRequestedQuantity(Number(e.target.value))} 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">備註</label>
                <textarea className="input-field py-1.5" rows={2} value={note} onChange={e => setNote(e.target.value)}></textarea>
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
                  <AlertCircle size={14} /> 緊急訂單 (優先買到)
                </label>
              </div>
            </div>
            <div className="mt-4">
              {editingOrder ? (
                <div className="flex justify-end gap-3">
                  <button onClick={() => setIsModalOpen(false)} className="btn-secondary py-1.5">取消</button>
                  <button onClick={() => handleSave('close')} className="btn-primary py-1.5">儲存</button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => handleSave('keepCustomer')} 
                      className="flex flex-col items-center justify-center p-2 bg-[#ff7a00] hover:bg-[#e66e00] text-white rounded-xl shadow-sm transition-colors"
                    >
                      <span className="font-bold text-base">同客續加</span>
                      <span className="text-[10px] opacity-90">(清商品/留顧客)</span>
                    </button>
                    <button 
                      onClick={() => handleSave('keepProduct')} 
                      className="flex flex-col items-center justify-center p-2 bg-[#7a7068] hover:bg-[#665d56] text-white rounded-xl shadow-sm transition-colors"
                    >
                      <span className="font-bold text-base">同品換客</span>
                      <span className="text-[10px] opacity-90">(留商品/清顧客)</span>
                    </button>
                    <button 
                      onClick={() => handleSave('keepBoth')} 
                      className="flex flex-col items-center justify-center p-2 bg-[#00cc52] hover:bg-[#00b347] text-white rounded-xl shadow-sm transition-colors"
                    >
                      <span className="font-bold text-base">同品同客</span>
                      <span className="text-[10px] opacity-90">(全留/方便換款)</span>
                    </button>
                    <button 
                      onClick={() => handleSave('clearAll')} 
                      className="flex flex-col items-center justify-center p-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl shadow-sm transition-colors"
                    >
                      <span className="font-bold text-base">全新加單</span>
                      <span className="text-[10px] opacity-90">(清空全部)</span>
                    </button>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button onClick={() => setIsModalOpen(false)} className="btn-secondary py-1.5 text-sm">關閉視窗</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

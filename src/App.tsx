import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { Package, Users, ShoppingCart, Printer, RefreshCw, Download, Upload, Settings, LogIn, LogOut, TrendingUp } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Product, Customer, Order, AppState } from './types';
import DashboardTab from './components/DashboardTab';
import ProductsTab from './components/ProductsTab';
import InventoryTab from './components/InventoryTab';
import CustomersTab from './components/CustomersTab';
import OrdersTab from './components/OrdersTab';
import ReceiptsTab from './components/ReceiptsTab';
import SettingsTab from './components/SettingsTab';
import { useDialog } from './hooks/useDialog';
import CustomDialog from './components/CustomDialog';
import { auth, db, googleProvider, signInWithPopup, onAuthStateChanged, User, handleFirestoreError, OperationType, signInWithRedirect, getRedirectResult } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, query, orderBy, getDocs } from 'firebase/firestore';
import { calculateSubtotal } from './lib/priceUtils';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'products' | 'inventory' | 'customers' | 'orders' | 'receipts' | 'settings'>('dashboard');
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notificationTemplate, setNotificationTemplate] = useState(`可以先幫我搭波卻可
有誤的話～請趕快跟我說！
₊⊹ 若是沒有漏掉的商品 ₊⊹
₊⊹ 若是還有扭蛋 ₊⊹
請等我第二個通知
網址：
找到自己名字後完成下單就可以嚕
𐙚 收到所有連結後請盡速完成付款
 不要耽誤到最佳的賞味期限唷
💡 小小提醒：
再麻煩於 ？號前幫我完成付款，以免影響您之後的購買權益哦！
如果期間內有困難無法付款，請務必提早私訊告知我。若是無故拖延或於約定時間未付款，以後就只能「預先儲值」才能幫您代購喊單了，再請大家多多配合與體諒 ♡

⚝ p.s. 前一次連線有開箱分享的朋友~
下單後請幫我備註一下：開箱禮
𝐭𝐡𝐚𝐧𝐤 𝐲𝐨𝐮 („• ֊ •„)੭`);

  const { showAlert, dialogOptions, closeDialog } = useDialog();

  // Auth Listener
  useEffect(() => {
    // 處理重新導向回來的結果
    getRedirectResult(auth).catch((error: any) => {
      if (error.code !== 'auth/no-current-user') {
        console.error("重新導向登入失敗", error);
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      // 優先嘗試彈出視窗
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("登入失敗", error);
      
      // 如果視窗被攔截或網域有問題，嘗試使用重新導向模式
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/unauthorized-domain' || error.code === 'auth/popup-closed-by-user') {
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectError: any) {
          showAlert('登入失敗', `無法完成登入: ${redirectError.message}`);
        }
      } else {
        showAlert('登入失敗', `錯誤代碼: ${error.code}\n訊息: ${error.message}`);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("登出失敗", error);
    }
  };

  // Firestore Listeners
  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    
    // Products Listener
    const productsUnsubscribe = onSnapshot(
      collection(userRef, 'products'),
      (snapshot) => {
        if (snapshot.empty && isInitialLoad) {
          // Add defaults if everything is empty
          const defaultProducts: Product[] = [
            { id: uuidv4(), name: '經典扭蛋', variant: 'A款', purchaseQuantity: Math.floor(Math.random() * 50) + 10, lossQuantity: 0, stock: 0, price: 100, discountMode: 'none', discountThreshold: 2, discountPrice: 0, updatedAt: Date.now() },
            { id: uuidv4(), name: '經典扭蛋', variant: 'B款', purchaseQuantity: Math.floor(Math.random() * 50) + 10, lossQuantity: 0, stock: 0, price: 100, discountMode: 'none', discountThreshold: 2, discountPrice: 0, updatedAt: Date.now() },
            { id: uuidv4(), name: '限量公仔', variant: '金', purchaseQuantity: Math.floor(Math.random() * 20) + 5, lossQuantity: 0, stock: 0, price: 500, discountMode: 'none', discountThreshold: 2, discountPrice: 0, updatedAt: Date.now() },
            { id: uuidv4(), name: '限量公仔', variant: '銀', purchaseQuantity: Math.floor(Math.random() * 20) + 5, lossQuantity: 0, stock: 0, price: 450, discountMode: 'none', discountThreshold: 2, discountPrice: 0, updatedAt: Date.now() },
            { id: uuidv4(), name: '造型吊飾', variant: '隨機', purchaseQuantity: Math.floor(Math.random() * 100) + 20, lossQuantity: 0, stock: 0, price: 150, discountMode: 'none', discountThreshold: 2, discountPrice: 0, updatedAt: Date.now() },
          ];
          defaultProducts.forEach(p => saveProduct(p));
        } else {
          const data = snapshot.docs.map(doc => doc.data() as Product);
          setProducts(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        }
        setLastSynced(new Date());
        setIsInitialLoad(false);
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/products`)
    );

    // Customers Listener
    const customersUnsubscribe = onSnapshot(
      collection(userRef, 'customers'),
      (snapshot) => {
        if (snapshot.empty && isInitialLoad) {
          const defaultCustomers = [
            { id: uuidv4(), name: '王小明', totalSpent: 0, updatedAt: Date.now() },
            { id: uuidv4(), name: '李美玲', totalSpent: 0, updatedAt: Date.now() },
            { id: uuidv4(), name: '張大華', totalSpent: 0, updatedAt: Date.now() },
          ];
          defaultCustomers.forEach(c => saveCustomer(c));
        } else {
          const data = snapshot.docs.map(doc => doc.data() as Customer);
          setCustomers(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/customers`)
    );

    // Orders Listener
    const ordersUnsubscribe = onSnapshot(
      collection(userRef, 'orders'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => {
          const o = doc.data() as Order;
          if (o.arrivedQuantity === undefined) {
            o.arrivedQuantity = o.isArrived ? o.allocatedQuantity : 0;
          }
          return o;
        });
        setOrders(prev => JSON.stringify(prev) !== JSON.stringify(data) ? data : prev);
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/orders`)
    );

    // Settings Listener
    const settingsUnsubscribe = onSnapshot(
      doc(userRef, 'settings', 'general'),
      (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setNotificationTemplate(prev => prev !== data.notificationTemplate ? data.notificationTemplate : prev);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}/settings/general`)
    );

    return () => {
      productsUnsubscribe();
      customersUnsubscribe();
      ordersUnsubscribe();
      settingsUnsubscribe();
    };
  }, [user]);

  // Firestore Write Helpers
  const saveProduct = useCallback(async (product: Product) => {
    if (!user) return;
    try {
      const path = `users/${user.uid}/products/${product.id}`;
      const sanitizedProduct = {
        id: product.id,
        name: product.name,
        variant: product.variant || '',
        purchaseQuantity: product.purchaseQuantity || 0,
        lossQuantity: product.lossQuantity || 0,
        stock: product.stock || 0,
        price: Math.max(0, product.price || 0),
        discountMode: product.discountMode || 'none',
        discountThreshold: Math.max(0, product.discountThreshold || 0),
        discountPrice: Math.max(0, product.discountPrice || 0),
        updatedAt: product.updatedAt || Date.now(),
      };
      await setDoc(doc(db, path), sanitizedProduct);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/products/${product.id}`);
    }
  }, [user]);

  const saveCustomer = useCallback(async (customer: Customer) => {
    if (!user) return;
    try {
      const path = `users/${user.uid}/customers/${customer.id}`;
      const sanitizedCustomer = {
        id: customer.id,
        name: customer.name || '',
        totalSpent: Math.max(0, customer.totalSpent || 0),
        isPaid: customer.isPaid || false,
        updatedAt: customer.updatedAt || Date.now(),
      };
      await setDoc(doc(db, path), sanitizedCustomer);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/customers/${customer.id}`);
    }
  }, [user]);

  const saveOrder = useCallback(async (order: Order) => {
    if (!user) return;
    try {
      const path = `users/${user.uid}/orders/${order.id}`;
      const sanitizedOrder = {
        id: order.id,
        productId: order.productId,
        customerId: order.customerId,
        requestedQuantity: Math.max(1, order.requestedQuantity || 1),
        allocatedQuantity: Math.max(0, order.allocatedQuantity || 0),
        arrivedQuantity: Math.max(0, order.arrivedQuantity ?? 0),
        isShipped: order.isShipped || false,
        isPaid: order.isPaid || false,
        isBilled: order.isBilled || false,
        subtotal: Math.max(0, order.subtotal || 0),
        note: order.note || '',
        isUrgent: order.isUrgent || false,
        createdAt: order.createdAt || Date.now(),
        updatedAt: order.updatedAt || Date.now(),
      };
      await setDoc(doc(db, path), sanitizedOrder);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/orders/${order.id}`);
    }
  }, [user]);

  const saveSettings = useCallback(async (template: string) => {
    if (!user) return;
    try {
      const path = `users/${user.uid}/settings/general`;
      await setDoc(doc(db, path), { notificationTemplate: template });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/settings/general`);
    }
  }, [user]);

  const deleteProduct = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/products`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/products/${id}`);
    }
  }, [user]);

  const deleteCustomer = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/customers`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/customers/${id}`);
    }
  }, [user]);

  const deleteOrder = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/orders`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/orders/${id}`);
    }
  }, [user]);

  // Wrap set functions to sync with Firestore
  const setProductsWithSync = useCallback((newProducts: Product[] | ((prev: Product[]) => Product[])) => {
    setProducts(prev => {
      const next = typeof newProducts === 'function' ? newProducts(prev) : newProducts;
      // Find diff and save
      next.forEach(p => {
        const old = prev.find(o => o.id === p.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(p)) {
          saveProduct(p);
        }
      });
      // Find deleted
      prev.forEach(p => {
        if (!next.find(n => n.id === p.id)) {
          deleteProduct(p.id);
        }
      });
      return next;
    });
  }, [saveProduct, deleteProduct]);

  const setCustomersWithSync = useCallback((newCustomers: Customer[] | ((prev: Customer[]) => Customer[])) => {
    setCustomers(prev => {
      const next = typeof newCustomers === 'function' ? newCustomers(prev) : newCustomers;
      next.forEach(c => {
        const old = prev.find(o => o.id === c.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(c)) {
          saveCustomer(c);
        }
      });
      prev.forEach(c => {
        if (!next.find(n => n.id === c.id)) {
          deleteCustomer(c.id);
        }
      });
      return next;
    });
  }, [saveCustomer, deleteCustomer]);

  const setOrdersWithSync = useCallback((newOrders: Order[] | ((prev: Order[]) => Order[])) => {
    setOrders(prev => {
      const next = typeof newOrders === 'function' ? newOrders(prev) : newOrders;
      next.forEach(o => {
        const old = prev.find(oldO => oldO.id === o.id);
        if (!old || JSON.stringify(old) !== JSON.stringify(o)) {
          saveOrder(o);
        }
      });
      prev.forEach(o => {
        if (!next.find(n => n.id === o.id)) {
          deleteOrder(o.id);
        }
      });
      return next;
    });
  }, [saveOrder, deleteOrder]);

  const setNotificationTemplateWithSync = useCallback((template: string | ((prev: string) => string)) => {
    setNotificationTemplate(prev => {
      const next = typeof template === 'function' ? template(prev) : template;
      if (next !== prev) {
        saveSettings(next);
      }
      return next;
    });
  }, [saveSettings]);

  // Auto-calculate order subtotals when products change
  useEffect(() => {
    let changed = false;
    const newOrders = orders.map(o => {
      const product = products.find(p => p.id === o.productId);
      if (product) {
        const newSubtotal = calculateSubtotal(product, o.requestedQuantity);
        if (o.subtotal !== newSubtotal) {
          changed = true;
          return { ...o, subtotal: newSubtotal, updatedAt: Date.now() };
        }
      }
      return o;
    });

    if (changed) {
      setOrdersWithSync(newOrders);
    }
  }, [products, orders, setOrdersWithSync]);

  // Auto-calculate customer totalSpent based on orders
  useEffect(() => {
    let changed = false;
    const newCustomers = customers.map(c => {
      const customerOrders = orders.filter(o => o.customerId === c.id);
      const total = customerOrders.reduce((sum, o) => sum + o.subtotal, 0);
      
      if (c.totalSpent !== total) {
        changed = true;
        return { ...c, totalSpent: total, updatedAt: Date.now() };
      }
      return c;
    });

    if (changed) {
      setCustomersWithSync(newCustomers);
    }
  }, [orders, products, customers, setCustomersWithSync]);

  // Auto-calculate product stock (allocated total) based on orders
  useEffect(() => {
    let changed = false;
    const newProducts = products.map(p => {
      const productOrders = orders.filter(o => o.productId === p.id);
      const totalAllocated = productOrders.reduce((sum, o) => sum + o.allocatedQuantity, 0);
      
      if (p.stock !== totalAllocated) {
        changed = true;
        return { ...p, stock: totalAllocated, updatedAt: Date.now() };
      }
      return p;
    });

    if (changed) {
      setProductsWithSync(newProducts);
    }
  }, [orders, products, setProductsWithSync]);

  const handleExportBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ products, customers, orders }));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `cuibo_wms_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.products) setProducts(parsed.products);
        if (parsed.customers) setCustomers(parsed.customers);
        if (parsed.orders) setOrders(parsed.orders);
        showAlert('成功', '備份匯入成功！');
      } catch (error) {
        showAlert('錯誤', '無效的備份檔案');
      }
    };
    reader.readAsText(file);
  };

  const clearAllData = async () => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const batch = writeBatch(db);
      
      // Delete products
      const productsSnap = await getDocs(collection(userRef, 'products'));
      productsSnap.forEach(doc => batch.delete(doc.ref));
      
      // Delete customers
      const customersSnap = await getDocs(collection(userRef, 'customers'));
      customersSnap.forEach(doc => batch.delete(doc.ref));
      
      // Delete orders
      const ordersSnap = await getDocs(collection(userRef, 'orders'));
      ordersSnap.forEach(doc => batch.delete(doc.ref));
      
      const defaultTemplate = `可以先幫我搭波卻可
有誤的話～請趕快跟我說！
₊⊹ 若是沒有漏掉的商品 ₊⊹
₊⊹ 若是還有扭蛋 ₊⊹
請等我第二個通知
網址：
找到自己名字後完成下單就可以嚕
𐙚 收到所有連結後請盡速完成付款
 不要耽誤到最佳的賞味期限唷
💡 小小提醒：
再麻煩於 ？號前幫我完成付款，以免影響您之後的購買權益哦！
如果期間內有困難無法付款，請務必提早私訊告知我。若是無故拖延或於約定時間未付款，以後就只能「預先儲值」才能幫您代購喊單了，再請大家多多配合與體諒 ♡

⚝ p.s. 前一次連線有開箱分享的朋友~
下單後請幫我備註一下：開箱禮
𝐭𝐡𝐚𝐧𝐤 𝐲𝐨𝐮 („• ֊ •„)੭`;

      // Reset settings
      batch.set(doc(userRef, 'settings', 'general'), { notificationTemplate: defaultTemplate });
      
      await batch.commit();
      
      setProducts([]);
      setCustomers([]);
      setOrders([]);
      setNotificationTemplate(defaultTemplate);
      setLastSynced(null);
      localStorage.removeItem('cuibo_wms_state');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/clearAll`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw size={40} className="animate-spin text-[var(--color-primary)]" />
          <p className="text-[var(--color-text)] opacity-60">載入中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center text-center gap-6">
          <img src="/logo.png" alt="Cuibo Logo" className="w-24 h-24 object-contain drop-shadow-sm" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text)]">Cuibo 倉管系統</h1>
            <p className="text-[var(--color-text)] opacity-60 mt-2">請登入以同步您的資料</p>
          </div>
          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 bg-[var(--color-primary)] text-white py-3 px-6 rounded-xl font-bold hover:opacity-90 transition-opacity"
          >
            <LogIn size={20} />
            使用 Google 帳號登入
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-[var(--color-bg)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-border)] sticky top-0 z-10 no-print">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Cuibo Logo" className="w-10 h-10 object-contain shrink-0 drop-shadow-sm" />
            <div>
              <h1 className="text-lg font-bold text-[var(--color-text)] leading-tight">Cuibo 倉管系統</h1>
              <p className="text-[10px] text-[var(--color-text)] opacity-60 flex items-center gap-1">
                {isSyncing ? (
                  <><RefreshCw size={10} className="animate-spin" /> 同步中...</>
                ) : (
                  <><RefreshCw size={10} /> {lastSynced ? formatInTimeZone(lastSynced, 'Asia/Taipei', 'yyyyMMddHHmm') : '未同步'}</>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex gap-1 shrink-0">
            <button onClick={handleExportBackup} className="p-2 rounded-full hover:bg-gray-100 text-[var(--color-text)] transition-colors" title="匯出備份">
              <Download size={18} />
            </button>
            <label className="p-2 rounded-full hover:bg-gray-100 text-[var(--color-text)] transition-colors cursor-pointer" title="匯入備份">
              <Upload size={18} />
              <input type="file" accept=".json" className="hidden" onChange={handleImportBackup} />
            </label>
          </div>
        </div>
        
        {/* Desktop Navigation Tabs */}
        <div className="hidden md:flex max-w-6xl mx-auto px-4 gap-6 overflow-x-auto hide-scrollbar">
          <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={18} />} label="儀表板" />
          <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ShoppingCart size={18} />} label="訂單與配貨" />
          <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={18} />} label="庫存" />
          <TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={<Package size={18} />} label="商品" />
          <TabButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={18} />} label="顧客" />
          <TabButton active={activeTab === 'receipts'} onClick={() => setActiveTab('receipts')} icon={<Printer size={18} />} label="收據" />
          <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={18} />} label="設定" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-4 md:py-8">
        {activeTab === 'dashboard' && (
          <DashboardTab products={products} customers={customers} orders={orders} />
        )}
        {activeTab === 'products' && (
          <ProductsTab products={products} setProducts={setProductsWithSync} orders={orders} />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab products={products} setProducts={setProductsWithSync} orders={orders} />
        )}
        {activeTab === 'customers' && (
          <CustomersTab 
            customers={customers} 
            setCustomers={setCustomersWithSync} 
            orders={orders}
            setOrders={setOrdersWithSync}
            products={products}
            setProducts={setProductsWithSync}
            notificationTemplate={notificationTemplate}
          />
        )}
        {activeTab === 'orders' && (
          <OrdersTab 
            orders={orders} 
            setOrders={setOrdersWithSync} 
            products={products} 
            setProducts={setProductsWithSync}
            customers={customers} 
            setCustomers={setCustomersWithSync}
          />
        )}
        {activeTab === 'receipts' && (
          <ReceiptsTab 
            orders={orders} 
            setOrders={setOrdersWithSync}
            products={products} 
            customers={customers} 
            notificationTemplate={notificationTemplate}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab 
            notificationTemplate={notificationTemplate} setNotificationTemplate={setNotificationTemplateWithSync}
            clearAllData={clearAllData}
            user={user}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--color-border)] flex justify-around items-center py-2 px-1 z-50 no-print">
        <MobileTabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<TrendingUp size={20} />} label="儀表板" />
        <MobileTabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={<ShoppingCart size={20} />} label="訂單配貨" />
        <MobileTabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package size={20} />} label="庫存" />
        <MobileTabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={<Package size={20} />} label="商品" />
        <MobileTabButton active={activeTab === 'customers'} onClick={() => setActiveTab('customers')} icon={<Users size={20} />} label="顧客" />
        <MobileTabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings size={20} />} label="設定" />
      </nav>

      {/* Custom Dialog */}
      {dialogOptions && (
        <CustomDialog
          isOpen={!!dialogOptions}
          title={dialogOptions.title}
          message={dialogOptions.message}
          type={dialogOptions.type}
          onConfirm={dialogOptions.onConfirm || closeDialog}
          onCancel={dialogOptions.onCancel || closeDialog}
          confirmText={dialogOptions.confirmText}
          cancelText={dialogOptions.cancelText}
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 py-3 px-1 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
        active 
          ? 'border-[var(--color-primary)] text-[var(--color-text)]' 
          : 'border-transparent text-[var(--color-text)] opacity-60 hover:opacity-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileTabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-1 px-2 transition-colors ${
        active 
          ? 'text-[var(--color-primary)]' 
          : 'text-gray-400'
      }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

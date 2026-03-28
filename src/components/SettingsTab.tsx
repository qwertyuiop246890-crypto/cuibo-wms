import React from 'react';
import { CheckCircle, RefreshCw, Trash2, LogOut, User as UserIcon } from 'lucide-react';
import { useDialog } from '../hooks/useDialog';
import { User } from 'firebase/auth';

interface SettingsTabProps {
  notificationTemplate: string;
  setNotificationTemplate: (val: string) => void;
  clearAllData: () => void;
  user: User | null;
  onLogout: () => void;
}

export default function SettingsTab({
  notificationTemplate, setNotificationTemplate,
  clearAllData,
  user,
  onLogout
}: SettingsTabProps) {
  const { showAlert, showConfirm } = useDialog();

  const handleClearData = () => {
    showConfirm(
      '清除所有資料',
      '確定要清除系統內的所有資料嗎？這將會刪除所有的商品、顧客、訂單以及連線設定。此動作無法復原！',
      () => {
        clearAllData();
        showAlert('成功', '所有資料已清除完畢。');
      },
      'danger',
      '確認清除'
    );
  };

  return (
    <div className="space-y-6">
      {user && (
        <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-12 h-12 rounded-full border border-[var(--color-border)]" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                  <UserIcon size={24} />
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text)]">{user.displayName || '使用者'}</h2>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition-colors font-medium px-4 py-2 rounded-lg hover:bg-red-50"
            >
              <LogOut size={18} />
              登出
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
              <RefreshCw size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text)]">Firebase 即時同步狀態</h2>
              <p className="text-xs text-gray-500">資料已安全儲存於 Firebase Firestore，支援毫秒級即時同步。</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm font-medium border border-orange-100">
            <CheckCircle size={16} />
            已連線
          </div>
        </div>
        
        <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed">
            系統目前使用「Firebase 即時同步」方案。您的所有資料（商品、顧客、訂單）都會即時同步到 Firebase。
            您可以從任何裝置登入您的 Google 帳號，看到完全一致且即時更新的資料內容。
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6">
        <h2 className="text-xl font-bold text-[var(--color-text)] mb-6">通知文案管理</h2>
        <div className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium mb-2 text-[var(--color-text)]">預設通知文案 (下半部)</label>
            <textarea 
              value={notificationTemplate}
              onChange={(e) => setNotificationTemplate(e.target.value)}
              className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] h-64 text-sm leading-relaxed"
              placeholder="輸入通知文案的下半部內容..."
            />
            <p className="text-xs text-gray-500 mt-2">修改此處將會同步更新所有顧客的通知文案下半部。</p>
          </div>
        </div>
      </div>

      <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6">
        <h2 className="text-xl font-bold text-red-800 mb-2 flex items-center gap-2">
          <Trash2 size={24} />
          危險區域
        </h2>
        <p className="text-sm text-red-600 mb-4">
          此操作將會清除系統內的所有資料，包含商品、顧客、訂單以及 Google Sheets 連線設定。此動作無法復原，請謹慎操作。
        </p>
        <button 
          onClick={handleClearData}
          className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          <Trash2 size={18} />
          一鍵清除所有資料
        </button>
      </div>
    </div>
  );
}

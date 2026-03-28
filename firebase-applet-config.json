import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, HelpCircle, X } from 'lucide-react';

interface CustomDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'alert' | 'confirm';
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function CustomDialog({
  isOpen,
  title,
  message,
  type,
  onConfirm,
  onCancel,
  confirmText = '確定',
  cancelText = '取消'
}: CustomDialogProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={type === 'alert' ? onConfirm : onCancel}
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`p-3 rounded-full ${type === 'confirm' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'}`}>
                  {type === 'confirm' ? <HelpCircle size={24} /> : <AlertCircle size={24} />}
                </div>
                <h3 className="text-xl font-bold text-gray-900">{title}</h3>
              </div>
              <p className="text-gray-600 leading-relaxed">{message}</p>
            </div>
            
            <div className="flex border-t border-gray-100">
              {type === 'confirm' && (
                <button
                  onClick={onCancel}
                  className="flex-1 px-6 py-4 text-gray-500 font-medium hover:bg-gray-50 transition-colors border-r border-gray-100"
                >
                  {cancelText}
                </button>
              )}
              <button
                onClick={onConfirm}
                className={`flex-1 px-6 py-4 font-bold transition-colors ${
                  type === 'confirm' 
                    ? 'text-[var(--color-primary)] hover:bg-blue-50' 
                    : 'text-orange-500 hover:bg-orange-50'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

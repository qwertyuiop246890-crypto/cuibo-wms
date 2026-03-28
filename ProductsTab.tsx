import React, { createContext, useContext, useState, ReactNode } from 'react';

type DialogType = 'alert' | 'confirm';

interface DialogOptions {
  title: string;
  message: string;
  type: DialogType;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
}

interface DialogContextType {
  showAlert: (title: string, message: string, onConfirm?: () => void) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => void;
  closeDialog: () => void;
  dialogOptions: DialogOptions | null;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialogOptions, setDialogOptions] = useState<DialogOptions | null>(null);

  const showAlert = (title: string, message: string, onConfirm?: () => void) => {
    setDialogOptions({
      title,
      message,
      type: 'alert',
      onConfirm: () => {
        onConfirm?.();
        setDialogOptions(null);
      }
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
    setDialogOptions({
      title,
      message,
      type: 'confirm',
      onConfirm: () => {
        onConfirm();
        setDialogOptions(null);
      },
      onCancel: () => {
        onCancel?.();
        setDialogOptions(null);
      }
    });
  };

  const closeDialog = () => setDialogOptions(null);

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm, closeDialog, dialogOptions }}>
      {children}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

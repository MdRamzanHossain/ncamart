"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type ToastVariant = "success" | "destructive" | "warning" | "info" | "neutral";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
  undoLabel?: string;
  onUndo?: () => void;
  createdAt: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  toast: (options: Omit<ToastItem, "id" | "createdAt">) => string;
  dismissToast: (id: string) => void;
  toastError: (err: unknown, fallbackMessage?: string) => string;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      title,
      description,
      variant = "neutral",
      duration = 4500,
      undoLabel,
      onUndo,
    }: Omit<ToastItem, "id" | "createdAt">) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newItem: ToastItem = {
        id,
        title,
        description,
        variant,
        duration,
        undoLabel,
        onUndo,
        createdAt: Date.now(),
      };

      setToasts((prev) => [newItem, ...prev.slice(0, 4)]); // Max 5 toasts
      return id;
    },
    []
  );

  const toastError = useCallback(
    (err: unknown, fallbackMessage = "An unexpected error occurred. Please try again.") => {
      let message = fallbackMessage;
      let code: string | undefined;

      if (typeof err === "object" && err !== null) {
        const errorObj = err as Record<string, unknown>;
        if (errorObj.error && typeof errorObj.error === "object") {
          const innerError = errorObj.error as Record<string, unknown>;
          message = (innerError.message as string) || fallbackMessage;
          code = innerError.code as string | undefined;
        } else if (typeof errorObj.message === "string") {
          message = errorObj.message;
        }
      }

      return toast({
        title: code ? `Error (${code})` : "Error",
        description: message,
        variant: "destructive",
        duration: 6000,
      });
    },
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toasts, toast, dismissToast, toastError }}>
      {children}
      {/* Toast Viewport Container */}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          bottom: "var(--space-lg)",
          right: "var(--space-lg)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-sm)",
          maxWidth: "420px",
          width: "calc(100vw - 32px)",
          pointerEvents: "none",
        }}
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: () => void;
}) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!toast.duration) return;

    const interval = 50;
    const step = (interval / toast.duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [toast.duration, onDismiss]);

  const getBorderColor = () => {
    switch (toast.variant) {
      case "success":
        return "var(--color-success)";
      case "destructive":
        return "var(--color-destructive)";
      case "warning":
        return "var(--color-warning)";
      case "info":
        return "var(--color-info)";
      default:
        return "var(--border-default)";
    }
  };

  return (
    <div
      role="status"
      style={{
        position: "relative",
        overflow: "hidden",
        backgroundColor: "var(--bg-surface)",
        border: `1px solid ${getBorderColor()}`,
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-md) var(--space-lg)",
        boxShadow: "var(--shadow-xl)",
        pointerEvents: "auto",
        display: "flex",
        alignItems: "flex-start",
        gap: "var(--space-md)",
        animation: "slideUp 0.25s var(--ease-spring)",
      }}
    >
      <div style={{ flex: 1 }}>
        <h4
          style={{
            fontSize: "var(--font-size-sm)",
            fontWeight: "var(--font-weight-bold)",
            color: "var(--text-primary)",
          }}
        >
          {toast.title}
        </h4>
        {toast.description && (
          <p
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--text-secondary)",
              marginTop: "var(--space-2xs)",
            }}
          >
            {toast.description}
          </p>
        )}

        {toast.onUndo && (
          <button
            type="button"
            onClick={() => {
              toast.onUndo?.();
              onDismiss();
            }}
            style={{
              marginTop: "var(--space-xs)",
              color: "var(--color-brand-primary)",
              fontSize: "var(--font-size-xs)",
              fontWeight: "var(--font-weight-bold)",
              textDecoration: "underline",
            }}
          >
            {toast.undoLabel || "Undo"}
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          color: "var(--text-tertiary)",
          padding: "var(--space-2xs)",
          borderRadius: "var(--radius-xs)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Auto-Dismiss Progress Bar Indicator */}
      {Boolean(toast.duration) && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: "3px",
            width: `${progress}%`,
            backgroundColor: getBorderColor(),
            transition: "width 50ms linear",
          }}
        />
      )}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a <ToastProvider>");
  }
  return context;
}

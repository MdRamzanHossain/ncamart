"use client";

import React, { forwardRef, useState } from "react";
import { formatPaisa, bdtToPaisa } from "@/lib/money";

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  paisaValue?: number;
  onPaisaChange?: (paisa: number) => void;
  label?: string;
  error?: string;
  helperText?: string;
}

export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    {
      paisaValue = 0,
      onPaisaChange,
      label = "Amount",
      error,
      helperText,
      disabled,
      className = "",
      id,
      style,
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = useState(() =>
      paisaValue > 0 ? (paisaValue / 100).toString() : ""
    );
    const [isFocused, setIsFocused] = useState(false);

    const inputId = id || `money-input-${Math.random().toString(36).substring(2, 9)}`;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value.replace(/[^0-9.]/g, "");
      setInputValue(raw);

      const parsedBdt = parseFloat(raw);
      if (!isNaN(parsedBdt) && parsedBdt >= 0) {
        onPaisaChange?.(bdtToPaisa(parsedBdt));
      } else {
        onPaisaChange?.(0);
      }
    };

    const currentPaisa = bdtToPaisa(parseFloat(inputValue) || 0);

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2xs)",
          width: "100%",
          ...style,
        }}
        className={className}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            backgroundColor: "var(--bg-surface-elevated)",
            border: `1px solid ${error ? "var(--color-destructive)" : isFocused ? "var(--focus-ring)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-md)",
            transition: "all var(--duration-fast) var(--ease-in-out-smooth)",
            animation: error ? "shake 0.35s ease-in-out" : "none",
            boxShadow: isFocused ? "0 0 0 3px rgba(59, 130, 246, 0.2)" : "none",
            paddingLeft: "var(--space-md)",
          }}
        >
          {/* Taka Symbol Badge */}
          <span
            style={{
              fontFamily: "var(--font-family-mono)",
              fontWeight: "var(--font-weight-bold)",
              fontSize: "var(--font-size-lg)",
              color: isFocused ? "var(--color-brand-primary)" : "var(--text-secondary)",
              userSelect: "none",
            }}
          >
            ৳
          </span>

          <div style={{ position: "relative", flex: 1, height: "48px" }}>
            <input
              ref={ref}
              id={inputId}
              type="text"
              inputMode="decimal"
              value={inputValue}
              disabled={disabled}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="0.00"
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "transparent",
                border: "none",
                outline: "none",
                padding: label ? "18px var(--space-md) 4px var(--space-xs)" : "0 var(--space-md) 0 var(--space-xs)",
                color: "var(--text-primary)",
                fontSize: "var(--font-size-base)",
                fontFamily: "var(--font-family-mono)",
                fontWeight: "var(--font-weight-semibold)",
              }}
              {...props}
            />

            {label && (
              <label
                htmlFor={inputId}
                style={{
                  position: "absolute",
                  left: "var(--space-xs)",
                  top: "6px",
                  fontSize: "var(--font-size-2xs)",
                  color: error ? "var(--color-destructive)" : isFocused ? "var(--focus-ring)" : "var(--text-tertiary)",
                  fontWeight: "var(--font-weight-medium)",
                  pointerEvents: "none",
                }}
              >
                {label}
              </label>
            )}
          </div>

          {/* Formatted Preview Badge */}
          {currentPaisa > 0 && (
            <div
              style={{
                paddingRight: "var(--space-md)",
                fontSize: "var(--font-size-xs)",
                color: "var(--text-tertiary)",
                fontFamily: "var(--font-family-mono)",
              }}
            >
              {formatPaisa(currentPaisa)}
            </div>
          )}
        </div>

        {error && (
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--color-destructive)",
              fontWeight: "var(--font-weight-medium)",
              paddingLeft: "var(--space-2xs)",
            }}
          >
            {error}
          </span>
        )}

        {!error && helperText && (
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--text-tertiary)",
              paddingLeft: "var(--space-2xs)",
            }}
          >
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

MoneyInput.displayName = "MoneyInput";

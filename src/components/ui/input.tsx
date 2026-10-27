"use client";

import React, { forwardRef, useState } from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  allowClear?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      allowClear = false,
      type = "text",
      value,
      defaultValue,
      onChange,
      disabled,
      className = "",
      id,
      style,
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = useState<string>(
      String(value ?? defaultValue ?? "")
    );
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
    const effectiveValue = value !== undefined ? String(value) : inputValue;
    const isFloating = isFocused || Boolean(effectiveValue) || Boolean(props.placeholder);

    const isPassword = type === "password";
    const resolvedType = isPassword ? (showPassword ? "text" : "password") : type;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
      onChange?.(e);
    };

    const handleClear = () => {
      setInputValue("");
      if (ref && typeof ref !== "function" && ref.current) {
        ref.current.value = "";
      }
    };

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
          }}
        >
          {leftIcon && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                paddingLeft: "var(--space-md)",
                color: error ? "var(--color-destructive)" : "var(--text-tertiary)",
              }}
            >
              {leftIcon}
            </div>
          )}

          <div style={{ position: "relative", flex: 1, height: "48px" }}>
            <input
              ref={ref}
              id={inputId}
              type={resolvedType}
              value={value}
              defaultValue={defaultValue}
              disabled={disabled}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
              style={{
                width: "100%",
                height: "100%",
                backgroundColor: "transparent",
                border: "none",
                outline: "none",
                padding: label ? "18px var(--space-md) 4px" : "0 var(--space-md)",
                color: "var(--text-primary)",
                fontSize: "var(--font-size-base)",
                fontFamily: "var(--font-family-sans)",
              }}
              {...props}
            />

            {label && (
              <label
                htmlFor={inputId}
                style={{
                  position: "absolute",
                  left: "var(--space-md)",
                  top: isFloating ? "6px" : "50%",
                  transform: isFloating ? "none" : "translateY(-50%)",
                  fontSize: isFloating ? "var(--font-size-2xs)" : "var(--font-size-sm)",
                  color: error ? "var(--color-destructive)" : isFocused ? "var(--focus-ring)" : "var(--text-tertiary)",
                  fontWeight: isFloating ? "var(--font-weight-medium)" : "var(--font-weight-normal)",
                  pointerEvents: "none",
                  transition: "all var(--duration-fast) var(--ease-spring)",
                }}
              >
                {label}
              </label>
            )}
          </div>

          {/* Right Accessories: Clear & Password Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              paddingRight: "var(--space-md)",
            }}
          >
            {allowClear && Boolean(effectiveValue) && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear input"
                style={{
                  color: "var(--text-tertiary)",
                  padding: "var(--space-2xs)",
                  borderRadius: "var(--radius-xs)",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}

            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  color: "var(--text-tertiary)",
                  padding: "var(--space-2xs)",
                  borderRadius: "var(--radius-xs)",
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            )}

            {rightIcon && <div style={{ color: "var(--text-tertiary)" }}>{rightIcon}</div>}
          </div>
        </div>

        {error && (
          <span
            id={`${inputId}-error`}
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
            id={`${inputId}-helper`}
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

Input.displayName = "Input";

"use client";

import React, { forwardRef, useState } from "react";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      error,
      helperText,
      value,
      defaultValue,
      onChange,
      disabled,
      className = "",
      id,
      style,
      rows = 4,
      ...props
    },
    ref
  ) => {
    const [inputValue, setInputValue] = useState<string>(
      String(value ?? defaultValue ?? "")
    );
    const [isFocused, setIsFocused] = useState(false);

    const inputId = id || `textarea-${Math.random().toString(36).substring(2, 9)}`;
    const effectiveValue = value !== undefined ? String(value) : inputValue;
    const isFloating = isFocused || Boolean(effectiveValue) || Boolean(props.placeholder);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      onChange?.(e);
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
            flexDirection: "column",
            backgroundColor: "var(--bg-surface-elevated)",
            border: `1px solid ${error ? "var(--color-destructive)" : isFocused ? "var(--focus-ring)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-md)",
            transition: "all var(--duration-fast) var(--ease-in-out-smooth)",
            animation: error ? "shake 0.35s ease-in-out" : "none",
            boxShadow: isFocused ? "0 0 0 3px rgba(59, 130, 246, 0.2)" : "none",
          }}
        >
          {label && (
            <label
              htmlFor={inputId}
              style={{
                paddingTop: "var(--space-xs)",
                paddingLeft: "var(--space-md)",
                fontSize: isFloating ? "var(--font-size-2xs)" : "var(--font-size-sm)",
                color: error ? "var(--color-destructive)" : isFocused ? "var(--focus-ring)" : "var(--text-tertiary)",
                fontWeight: isFloating ? "var(--font-weight-medium)" : "var(--font-weight-normal)",
                transition: "all var(--duration-fast) var(--ease-spring)",
              }}
            >
              {label}
            </label>
          )}

          <textarea
            ref={ref}
            id={inputId}
            rows={rows}
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
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              padding: "var(--space-sm) var(--space-md) var(--space-md)",
              color: "var(--text-primary)",
              fontSize: "var(--font-size-base)",
              fontFamily: "var(--font-family-sans)",
              resize: "vertical",
            }}
            {...props}
          />
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

Textarea.displayName = "Textarea";

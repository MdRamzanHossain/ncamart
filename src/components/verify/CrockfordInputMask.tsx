"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export interface CrockfordInputMaskProps {
  onVerify?: (sealId: string) => void;
  initialValue?: string;
}

/**
 * Crockford Base32 Mask Formatter
 * Rules:
 * - Prefix: 'NCA-'
 * - Format: NCA-XXXX-XXXX (8 Crockford characters)
 * - Excludes I, L, O, U
 * - Permissive mapping: O -> 0, I -> 1, L -> 1
 * - Auto-inserts hyphens
 */
export function formatCrockfordInput(input: string): string {
  if (!input) return "";

  // Upper-case and strip spaces, hyphens, and optional initial "NCA"
  let cleaned = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");

  if (cleaned.startsWith("NCA")) {
    cleaned = cleaned.slice(3);
  }

  // Filter only valid Crockford Base32 characters: 0-9, A-H, J, K, M, N, P-T, V-Z (excludes U)
  const filtered = cleaned.replace(/[^0-9A-HJKMNP-TV-Z]/g, "").slice(0, 8);

  if (filtered.length === 0) return "";
  if (filtered.length <= 4) {
    return `NCA-${filtered}`;
  }
  return `NCA-${filtered.slice(0, 4)}-${filtered.slice(4)}`;
}

export function isValidCrockfordSeal(seal: string): boolean {
  return /^NCA-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(seal);
}

export function CrockfordInputMask({ onVerify, initialValue = "" }: CrockfordInputMaskProps) {
  const router = useRouter();
  const [val, setVal] = useState(formatCrockfordInput(initialValue));
  const [hasError, setHasError] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCrockfordInput(e.target.value);
    setVal(formatted);
    if (hasError) setHasError(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidCrockfordSeal(val)) {
      setHasError(true);
      return;
    }

    if (onVerify) {
      onVerify(val);
    } else {
      router.push(`/verify/${encodeURIComponent(val)}`);
    }
  };

  const handleClear = () => {
    setVal("");
    setHasError(false);
  };

  const isComplete = isValidCrockfordSeal(val);

  return (
    <form onSubmit={handleSubmit} className="crockford-form">
      <div className={`input-container ${hasError ? "has-error" : ""} ${isComplete ? "is-complete" : ""}`}>
        <div className="prefix-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        <input
          type="text"
          value={val}
          onChange={handleChange}
          placeholder="NCA-XXXX-XXXX"
          maxLength={13}
          className="seal-input"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label="Crockford Base32 Holographic Seal ID"
          id="seal-id-input"
        />

        {val && (
          <button
            type="button"
            className="clear-btn"
            onClick={handleClear}
            aria-label="Clear input"
          >
            ✕
          </button>
        )}

        <button
          type="submit"
          className="verify-submit-btn"
          disabled={!isComplete}
          aria-label="Verify Seal ID"
        >
          <span>Verify</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {hasError && (
        <p className="error-message">
          Please enter a valid 8-character Crockford Seal ID (e.g., NCA-9X4K-2M7B). Excludes I, L, O, U.
        </p>
      )}

      <style jsx>{`
        .crockford-form {
          width: 100%;
        }

        .input-container {
          display: flex;
          align-items: center;
          background: rgba(15, 23, 42, 0.85);
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          border-radius: 1rem;
          padding: 0.375rem 0.5rem 0.375rem 1rem;
          transition: all 0.2s ease;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .input-container:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25), 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .input-container.is-complete {
          border-color: #10b981;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2), 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .input-container.has-error {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.25);
        }

        .prefix-icon {
          color: #94a3b8;
          display: flex;
          align-items: center;
          margin-right: 0.75rem;
        }

        .is-complete .prefix-icon {
          color: #10b981;
        }

        .seal-input {
          flex: 1;
          background: transparent;
          border: none;
          color: #f8fafc;
          font-family: var(--font-mono, monospace);
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          outline: none;
        }

        .seal-input::placeholder {
          color: #64748b;
          letter-spacing: 0.05em;
        }

        .clear-btn {
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 0.875rem;
          cursor: pointer;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        .clear-btn:hover {
          color: #f8fafc;
        }

        .verify-submit-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          border: none;
          color: #ffffff;
          padding: 0.75rem 1.25rem;
          border-radius: 0.75rem;
          font-size: 0.9375rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
          margin-left: 0.5rem;
        }

        .verify-submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          transform: translateY(-1px);
        }

        .verify-submit-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }

        .error-message {
          color: #f87171;
          font-size: 0.8125rem;
          margin: 0.5rem 0 0 0.5rem;
        }

        @media (max-width: 500px) {
          .seal-input {
            font-size: 1.05rem;
          }
          .verify-submit-btn {
            padding: 0.625rem 0.875rem;
            font-size: 0.84rem;
          }
        }
      `}</style>
    </form>
  );
}

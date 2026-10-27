"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPaisa } from "@/lib/money";

export interface SearchProductHit {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string;
  brand: string;
  category_path_en?: string;
  category_path_bn?: string;
  tier: "AUTHENTIC" | "BUDGET_SMART" | string;
  fulfillment_type: string;
  min_price_paisa: number;
  availability: "IN_STOCK" | "AVAILABLE" | "OUT_OF_STOCK" | "PRE_ORDER" | string;
  spec_keywords?: string[];
  sku_codes?: string[];
  _formatted?: Partial<{
    title_en?: string;
    title_bn?: string;
    brand?: string;
  }>;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TRENDING_QUERIES = [
  "65W GaN Charger",
  "T12 Soldering Iron",
  "USB-C 100W Cable",
  "Industrial Multimeter",
  "CCTV 4K Dome Camera",
  "Hakko Heat Gun",
];

const LOCAL_STORAGE_KEY = "nca_recent_searches";

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hits, setHits] = useState<SearchProductHit[]>([]);
  const [selectedTier, setSelectedTier] = useState<"ALL" | "AUTHENTIC" | "BUDGET_SMART">("ALL");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.slice(0, 8));
        }
      }
    } catch {
      // Ignore local storage parse error
    }
  }, []);

  const saveRecentSearch = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 8);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // storage quota exceeded or disabled
        }
      }
      return updated;
    });
  }, []);

  const removeRecentSearch = (term: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item !== term);
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
      return updated;
    });
  };

  const clearAllRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  };


  // Keyboard shortcut listener (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open triggered from shortcut
          const trigger = document.querySelector<HTMLButtonElement>('[aria-label*="Search catalog"]');
          if (trigger) {
            trigger.click();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      setQuery("");
      setDebouncedQuery("");
      setHits([]);
      setActiveIndex(-1);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Debounce query input (150ms per prompt requirement)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  // Execute search API request
  useEffect(() => {
    if (!debouncedQuery) {
      setHits([]);
      setIsLoading(false);
      return;
    }

    let isSubscribed = true;
    setIsLoading(true);

    const controller = new AbortController();

    const fetchSearch = async () => {
      try {
        const url = `/api/v1/catalog/search?q=${encodeURIComponent(debouncedQuery)}&limit=15`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          throw new Error("Search request failed");
        }
        const data = await res.json();
        if (isSubscribed) {
          setHits(data.hits || []);
          setActiveIndex(-1);
          setIsLoading(false);
        }
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError" && isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    fetchSearch();

    return () => {
      isSubscribed = false;
      controller.abort();
    };
  }, [debouncedQuery]);

  // Filter hits by tier selection
  const filteredHits = hits.filter((hit) => {
    if (selectedTier === "ALL") return true;
    return hit.tier === selectedTier;
  });

  const authenticCount = hits.filter((h) => h.tier === "AUTHENTIC").length;
  const budgetCount = hits.filter((h) => h.tier === "BUDGET_SMART").length;

  // Keyboard navigation inside modal (ArrowUp, ArrowDown, Enter, Escape)
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }

    if (filteredHits.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < filteredHits.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredHits.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredHits.length) {
        const selected = filteredHits[activeIndex];
        saveRecentSearch(selected.title_en);
        onClose();
        router.push(`/products/${selected.slug}`);
      } else if (query.trim()) {
        saveRecentSearch(query.trim());
        onClose();
        router.push(`/catalog?q=${encodeURIComponent(query.trim())}`);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.children[activeIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search catalog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-index-modal)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "min(12vh, 100px)",
        paddingLeft: "var(--space-md)",
        paddingRight: "var(--space-md)",
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(12px)",
        animation: "fadeIn var(--duration-fast) ease-out",
      }}
      onClick={onClose}
    >
      {/* Modal Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 24px rgba(245, 158, 11, 0.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "80vh",
          animation: "scaleIn var(--duration-fast) cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "var(--space-md) var(--space-lg)",
            borderBottom: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-surface-elevated)",
            gap: "var(--space-md)",
          }}
        >
          {/* Search Icon */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--tier-authentic-gold)"
            strokeWidth="2.5"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search products, brands, or GaN chargers... (বাংলা / English)"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "var(--font-size-base)",
              fontWeight: "var(--font-weight-medium)",
              fontFamily: "var(--font-family-base)",
            }}
          />

          {/* Spinner or Clear Icon */}
          {isLoading ? (
            <div
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                border: "2px solid var(--border-subtle)",
                borderTopColor: "var(--tier-authentic-gold)",
                animation: "spin 0.7s linear infinite",
              }}
            />
          ) : query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-tertiary)",
                padding: "2px",
                display: "flex",
                alignItems: "center",
              }}
              aria-label="Clear search input"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : (
            <kbd
              style={{
                backgroundColor: "var(--bg-surface-active)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-xs)",
                padding: "2px 6px",
                fontSize: "11px",
                fontFamily: "var(--font-family-mono)",
                color: "var(--text-tertiary)",
              }}
            >
              ESC
            </kbd>
          )}
        </div>

        {/* Tier Filter Tabs (When results exist) */}
        {hits.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-sm)",
              padding: "8px var(--space-lg)",
              backgroundColor: "var(--bg-canvas)",
              borderBottom: "1px solid var(--border-subtle)",
              fontSize: "var(--font-size-xs)",
            }}
          >
            <span style={{ color: "var(--text-tertiary)", fontWeight: "var(--font-weight-medium)" }}>
              Filter Tier:
            </span>
            <button
              type="button"
              onClick={() => setSelectedTier("ALL")}
              style={{
                background: selectedTier === "ALL" ? "var(--bg-surface-active)" : "transparent",
                border: "1px solid",
                borderColor: selectedTier === "ALL" ? "var(--border-default)" : "transparent",
                borderRadius: "var(--radius-sm)",
                padding: "3px 8px",
                color: selectedTier === "ALL" ? "var(--text-primary)" : "var(--text-tertiary)",
                cursor: "pointer",
                fontWeight: selectedTier === "ALL" ? "var(--font-weight-bold)" : "var(--font-weight-normal)",
              }}
            >
              All ({hits.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier("AUTHENTIC")}
              style={{
                background: selectedTier === "AUTHENTIC" ? "var(--tier-authentic-gold-bg)" : "transparent",
                border: "1px solid",
                borderColor: selectedTier === "AUTHENTIC" ? "var(--tier-authentic-gold)" : "transparent",
                borderRadius: "var(--radius-sm)",
                padding: "3px 8px",
                color: "var(--tier-authentic-gold)",
                cursor: "pointer",
                fontWeight: selectedTier === "AUTHENTIC" ? "var(--font-weight-bold)" : "var(--font-weight-normal)",
              }}
            >
              ✨ Authentic ({authenticCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedTier("BUDGET_SMART")}
              style={{
                background: selectedTier === "BUDGET_SMART" ? "var(--tier-budget-teal-bg)" : "transparent",
                border: "1px solid",
                borderColor: selectedTier === "BUDGET_SMART" ? "var(--tier-budget-teal)" : "transparent",
                borderRadius: "var(--radius-sm)",
                padding: "3px 8px",
                color: "var(--tier-budget-teal)",
                cursor: "pointer",
                fontWeight: selectedTier === "BUDGET_SMART" ? "var(--font-weight-bold)" : "var(--font-weight-normal)",
              }}
            >
              ⚡ Budget Smart ({budgetCount})
            </button>
          </div>
        )}

        {/* Content Body: Hits List OR Recent & Trending */}
        <div
          ref={listRef}
          style={{
            overflowY: "auto",
            padding: "var(--space-md)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-xs)",
          }}
        >
          {query.trim() === "" ? (
            /* Recent Searches & Trending SKUs */
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)", padding: "var(--space-xs)" }}>
              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "var(--space-sm)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--font-size-xs)",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        fontWeight: "var(--font-weight-bold)",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      Recent Searches
                    </span>
                    <button
                      type="button"
                      onClick={clearAllRecentSearches}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-tertiary)",
                        fontSize: "var(--font-size-xs)",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Clear all
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
                    {recentSearches.map((term) => (
                      <span
                        key={term}
                        onClick={() => {
                          setQuery(term);
                          inputRef.current?.focus();
                        }}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "5px 10px",
                          borderRadius: "var(--radius-full)",
                          backgroundColor: "var(--bg-surface-elevated)",
                          border: "1px solid var(--border-subtle)",
                          fontSize: "var(--font-size-xs)",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          transition: "all var(--duration-fast) ease",
                        }}
                        className="interactive-scale"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 14 14" />
                        </svg>
                        <span>{term}</span>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(term, e)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-tertiary)",
                            cursor: "pointer",
                            padding: "0 2px",
                            display: "flex",
                            alignItems: "center",
                          }}
                          aria-label={`Remove recent search ${term}`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Trending in Nawabpur */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    marginBottom: "var(--space-sm)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: "var(--font-weight-bold)",
                      color: "var(--text-tertiary)",
                    }}
                  >
                    Trending in Nawabpur Tech Hub
                  </span>
                  <span style={{ fontSize: "12px" }}>🔥</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-xs)" }}>
                  {TRENDING_QUERIES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setQuery(item);
                        inputRef.current?.focus();
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 12px",
                        borderRadius: "var(--radius-full)",
                        backgroundColor: "var(--bg-surface-elevated)",
                        border: "1px solid var(--border-default)",
                        fontSize: "var(--font-size-xs)",
                        color: "var(--text-primary)",
                        cursor: "pointer",
                        fontWeight: "var(--font-weight-medium)",
                        transition: "all var(--duration-fast) ease",
                      }}
                      className="interactive-scale"
                    >
                      <span style={{ color: "var(--tier-authentic-gold)" }}>⚡</span>
                      <span>{item}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : filteredHits.length === 0 && !isLoading ? (
            /* No Results Found */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "var(--space-2xl) var(--space-md)",
                textAlign: "center",
                color: "var(--text-tertiary)",
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <p
                style={{
                  marginTop: "var(--space-md)",
                  fontWeight: "var(--font-weight-bold)",
                  color: "var(--text-primary)",
                  fontSize: "var(--font-size-base)",
                }}
              >
                No products found for &ldquo;{query}&rdquo;
              </p>
              <p style={{ fontSize: "var(--font-size-xs)", marginTop: "4px" }}>
                Try searching with alternate Bangla or English keywords, or ask about OEM parts.
              </p>
            </div>
          ) : (
            /* Product Hits */
            filteredHits.map((hit, index) => {
              const isAuthentic = hit.tier === "AUTHENTIC";
              const isActive = index === activeIndex;

              return (
                <Link
                  key={hit.id}
                  href={`/products/${hit.slug}`}
                  onClick={() => {
                    saveRecentSearch(hit.title_en);
                    onClose();
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderRadius: "var(--radius-lg)",
                    backgroundColor: isActive
                      ? "var(--bg-surface-active)"
                      : "transparent",
                    border: "1px solid",
                    borderColor: isActive
                      ? isAuthentic
                        ? "var(--tier-authentic-gold)"
                        : "var(--tier-budget-teal)"
                      : "transparent",
                    textDecoration: "none",
                    transition: "all var(--duration-fast) ease",
                    cursor: "pointer",
                  }}
                >
                  {/* Left Info: Tier badge, Title & Brand */}
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", minWidth: 0 }}>
                    {/* Tier Indicator Pill */}
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "var(--radius-md)",
                        backgroundColor: isAuthentic
                          ? "var(--tier-authentic-gold-bg)"
                          : "var(--tier-budget-teal-bg)",
                        border: `1.5px solid ${isAuthentic ? "var(--tier-authentic-gold)" : "var(--tier-budget-teal)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "16px",
                        flexShrink: 0,
                      }}
                    >
                      {isAuthentic ? "✨" : "⚡"}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span
                          style={{
                            color: "var(--text-primary)",
                            fontWeight: "var(--font-weight-semibold)",
                            fontSize: "var(--font-size-sm)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {hit.title_en}
                        </span>
                        {/* Tier mini badge */}
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "1px 5px",
                            borderRadius: "var(--radius-xs)",
                            fontWeight: "var(--font-weight-bold)",
                            backgroundColor: isAuthentic
                              ? "var(--tier-authentic-gold-bg)"
                              : "var(--tier-budget-teal-bg)",
                            color: isAuthentic ? "var(--tier-authentic-gold)" : "var(--tier-budget-teal)",
                            letterSpacing: "0.03em",
                            flexShrink: 0,
                          }}
                        >
                          {isAuthentic ? "100% Authentic" : "Budget Smart OEM"}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                        <span
                          style={{
                            fontSize: "var(--font-size-xs)",
                            color: "var(--text-tertiary)",
                          }}
                        >
                          {hit.brand}
                        </span>
                        {hit.category_path_en && (
                          <>
                            <span style={{ color: "var(--border-default)", fontSize: "10px" }}>•</span>
                            <span
                              style={{
                                fontSize: "var(--font-size-xs)",
                                color: "var(--text-tertiary)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {hit.category_path_en}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Info: Price & Stock Status Tag */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      flexShrink: 0,
                      marginLeft: "var(--space-md)",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-family-mono)",
                        fontWeight: "var(--font-weight-bold)",
                        fontSize: "var(--font-size-sm)",
                        color: isAuthentic ? "var(--tier-authentic-gold)" : "var(--text-primary)",
                      }}
                    >
                      ৳{formatPaisa(hit.min_price_paisa)}
                    </span>

                    {/* Stock Status Tag */}
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: "var(--font-weight-medium)",
                        marginTop: "2px",
                        color:
                          hit.availability === "IN_STOCK"
                            ? "var(--color-status-success)"
                            : hit.availability === "PRE_ORDER"
                            ? "#818cf8"
                            : "var(--text-tertiary)",
                      }}
                    >
                      {hit.availability === "IN_STOCK"
                        ? "In Stock Dhaka"
                        : hit.availability === "PRE_ORDER"
                        ? "Pre-Order Available"
                        : "Available"}
                    </span>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Modal Footer Controls Helper */}
        <div
          style={{
            padding: "8px var(--space-lg)",
            backgroundColor: "var(--bg-canvas)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
            color: "var(--text-tertiary)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span>
              <kbd style={{ padding: "1px 4px", borderRadius: "3px", background: "var(--bg-surface-elevated)" }}>↑</kbd>
              <kbd style={{ padding: "1px 4px", borderRadius: "3px", background: "var(--bg-surface-elevated)", marginLeft: "2px" }}>↓</kbd> Navigate
            </span>
            <span>
              <kbd style={{ padding: "1px 4px", borderRadius: "3px", background: "var(--bg-surface-elevated)" }}>↵</kbd> Select
            </span>
            <span>
              <kbd style={{ padding: "1px 4px", borderRadius: "3px", background: "var(--bg-surface-elevated)" }}>ESC</kbd> Close
            </span>
          </div>
          <span style={{ fontStyle: "italic" }}>
            Powered by Meilisearch & Holographic Registry
          </span>
        </div>
      </div>
    </div>
  );
}

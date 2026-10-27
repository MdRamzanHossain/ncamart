"use client";

import { useEffect, useRef } from "react";

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  minChars?: number;
  maxIntervalMs?: number;
  playSound?: boolean;
}

export function playPosBeep() {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // High pitch POS confirmation tone (A6)
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch {
    // Ignore audio context autoplay limitations if user hasn't interacted
  }
}

export function useBarcodeScanner({
  onScan,
  minChars = 4,
  maxIntervalMs = 60,
  playSound = true,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture if user is actively typing in a standard text/textarea input
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement &&
        activeEl.type !== "radio" &&
        activeEl.type !== "checkbox" &&
        activeEl.id !== "barcode-quick-field";
      const isTextarea = activeEl instanceof HTMLTextAreaElement;

      const now = performance.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Handle barcode termination via Enter key
      if (e.key === "Enter") {
        if (bufferRef.current.length >= minChars) {
          const barcode = bufferRef.current.trim();
          bufferRef.current = "";
          if (playSound) playPosBeep();
          onScan(barcode);
          e.preventDefault();
          return;
        }
        bufferRef.current = "";
        return;
      }

      // If typed too slowly, reset buffer (human typing vs hardware laser scanner)
      if (interval > maxIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = "";
      }

      // If single printable character
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // If human is typing in a text field, don't hijack unless it's the dedicated barcode field
        if ((isInput || isTextarea) && activeEl?.id !== "barcode-quick-field") {
          return;
        }
        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, minChars, maxIntervalMs, playSound]);
}

"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export interface RealtimeEventPayload {
  eventId: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export type EventCallback = (event: RealtimeEventPayload) => void;

export function useRealtimeEvents(channel = "public") {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEventPayload | null>(null);
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffDelayRef = useRef(1000); // 1s start

  const addListener = useCallback((eventType: string, cb: EventCallback) => {
    if (!listenersRef.current.has(eventType)) {
      listenersRef.current.set(eventType, new Set());
    }
    listenersRef.current.get(eventType)!.add(cb);

    return () => {
      listenersRef.current.get(eventType)?.delete(cb);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    function connect() {
      if (typeof window === "undefined") return;

      try {
        const streamUrl = `/api/v1/events/stream?channel=${encodeURIComponent(channel)}`;
        const es = new EventSource(streamUrl, { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          backoffDelayRef.current = 1000; // Reset backoff on successful connect
        };

        es.onmessage = (e) => {
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(e.data) as RealtimeEventPayload;
            setLastEvent(parsed);

            // Notify specific listeners
            const specificListeners = listenersRef.current.get(parsed.type);
            specificListeners?.forEach((cb) => cb(parsed));

            // Notify wildcard listeners
            const wildcardListeners = listenersRef.current.get("*");
            wildcardListeners?.forEach((cb) => cb(parsed));
          } catch {
            // Heartbeat or malformed comment
          }
        };

        es.onerror = () => {
          if (!isMounted) return;
          setIsConnected(false);
          es.close();

          // Exponential backoff reconnect
          const delay = backoffDelayRef.current;
          backoffDelayRef.current = Math.min(delay * 2, 30000); // Cap at 30s
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        };
      } catch {
        // SSE connection failure
        const delay = backoffDelayRef.current;
        backoffDelayRef.current = Math.min(delay * 2, 30000);
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    }

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [channel]);

  return {
    isConnected,
    lastEvent,
    addListener,
  };
}

"use client";

import { useEffect, useState, useRef, useCallback } from "react";

export interface RealtimeEventPayload {
  eventId: string;
  type: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export type EventCallback = (event: RealtimeEventPayload) => void;

export function useRealtimeEvents(channel: string | null = "public") {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEventPayload | null>(null);
  const listenersRef = useRef<Map<string, Set<EventCallback>>>(new Map());
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const backoffDelayRef = useRef(1000); // 1s start
  const failureCountRef = useRef(0);

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

    // Do not initiate SSE if channel is disabled or null
    if (!channel || channel === "none") {
      setIsConnected(false);
      return;
    }

    function connect() {
      if (typeof window === "undefined" || !channel) return;

      try {
        const streamUrl = `/api/v1/events/stream?channel=${encodeURIComponent(channel)}`;
        const es = new EventSource(streamUrl, { withCredentials: true });
        eventSourceRef.current = es;

        es.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          backoffDelayRef.current = 1000;
          failureCountRef.current = 0;
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
            // Heartbeat or comment
          }
        };

        es.onerror = () => {
          if (!isMounted) return;
          setIsConnected(false);
          es.close();

          failureCountRef.current += 1;
          // If unauthorized (401/403) or rejected multiple times, stop reconnect loop
          if (failureCountRef.current >= 2) {
            return;
          }

          // Exponential backoff reconnect
          const delay = backoffDelayRef.current;
          backoffDelayRef.current = Math.min(delay * 2, 30000);
          reconnectTimeoutRef.current = setTimeout(connect, delay);
        };
      } catch {
        // SSE connection failure
        failureCountRef.current += 1;
        if (failureCountRef.current >= 2) return;
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

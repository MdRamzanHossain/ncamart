export interface StaffEvent {
  id: string; // Time-sequence ID or monotonic stream ID (e.g. 1730000000000-0)
  event: string; // e.g. 'sourcing.override_requested', 'qc.sampling_due', etc.
  data: Record<string, unknown>; // PII-free JSON payload, links by ID
  channel: string; // e.g. "role:SOURCING_MANAGER", "staff:{id}", "all-staff"
  createdAt: string; // ISO 8601 string
}

export interface StaffEventInput {
  id?: string;
  event: string;
  data: Record<string, unknown>;
  createdAt?: string | Date;
}

export interface StaffEventAck {
  eventId: string;
  staffId: string;
  acknowledgedAt: string;
}

export interface ActiveStreamConnection {
  connectionId: string;
  staffId: string;
  sessionId: string;
  sessionToken?: string;
  channels: string[];
  send: (chunk: string) => void;
  close: () => void;
  createdAt: number;
  lastHeartbeatAt?: number;
}

export interface StreamOptions {
  replica?: import("./replica").RealtimeReplica;
  heartbeatIntervalMs?: number;
  revocationCheckIntervalMs?: number;
}

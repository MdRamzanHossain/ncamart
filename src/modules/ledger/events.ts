export interface JournalEntryPostedEventPayload {
  entryId: string;
  entryNumber: string;
  eventType: string;
  sourceType: string;
  sourceId: string;
  totalPaisa: number;
  postedAt: string;
}

export interface JournalEntryReversedEventPayload {
  reversalEntryId: string;
  reversalEntryNumber: string;
  originalEntryId: string;
  originalEntryNumber: string;
  reason: string;
  postedAt: string;
}

export type LedgerEvent =
  | {
      type: "ledger.entry_posted";
      payload: JournalEntryPostedEventPayload;
    }
  | {
      type: "ledger.entry_reversed";
      payload: JournalEntryReversedEventPayload;
    };

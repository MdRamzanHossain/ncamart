"use client";

import React from "react";
import type { AuditLogEntry } from "./types";

export interface AuditLogDiffViewerProps {
  entry: AuditLogEntry;
}

export function AuditLogDiffViewer({ entry }: AuditLogDiffViewerProps) {
  const allKeys = Array.from(
    new Set([...Object.keys(entry.beforeJson || {}), ...Object.keys(entry.afterJson || {})])
  );

  return (
    <div className="diff-viewer" data-testid={`diff-viewer-${entry.id}`}>
      <div className="diff-header">
        <span className="diff-title">State Mutation Diff Viewer (JSON)</span>
        <div className="diff-meta">
          <span className="ip-tag font-mono">IP: {entry.ipAddress}</span>
          <span className="res-tag font-mono">{entry.resourceType}: {entry.resourceId}</span>
        </div>
      </div>

      <div className="diff-table-wrap">
        <table className="diff-table">
          <thead>
            <tr>
              <th className="th-prop">Attribute Key</th>
              <th className="th-before">Before Mutation</th>
              <th className="th-after">After Mutation</th>
            </tr>
          </thead>
          <tbody>
            {allKeys.map((key) => {
              const beforeVal = entry.beforeJson?.[key];
              const afterVal = entry.afterJson?.[key];
              const isChanged = JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
              const isAdded = beforeVal === undefined && afterVal !== undefined;
              const isRemoved = beforeVal !== undefined && afterVal === undefined;

              return (
                <tr
                  key={key}
                  className={`diff-row ${
                    isChanged ? (isAdded ? "diff-added" : isRemoved ? "diff-removed" : "diff-modified") : ""
                  }`}
                  data-testid={`diff-row-${key}`}
                >
                  <td className="td-key font-mono">{key}</td>
                  <td className="td-val font-mono before-val">
                    {beforeVal !== undefined ? (
                      <span className="val-text">{JSON.stringify(beforeVal, null, 2)}</span>
                    ) : (
                      <span className="val-null">&lt;undefined&gt;</span>
                    )}
                  </td>
                  <td className="td-val font-mono after-val">
                    {afterVal !== undefined ? (
                      <span className="val-text">{JSON.stringify(afterVal, null, 2)}</span>
                    ) : (
                      <span className="val-null">&lt;removed&gt;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style jsx>{`
        .diff-viewer {
          background: #030712;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          overflow: hidden;
          margin-top: 10px;
        }

        .diff-header {
          padding: 8px 14px;
          background: #090f1d;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .diff-title {
          font-size: 11px;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .diff-meta {
          display: flex;
          gap: 12px;
          font-size: 10px;
        }

        .ip-tag {
          color: #64748b;
        }

        .res-tag {
          color: #f59e0b;
        }

        .diff-table-wrap {
          overflow-x: auto;
        }

        .diff-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          text-align: left;
        }

        .diff-table th {
          background: #070d18;
          color: #64748b;
          font-weight: 700;
          padding: 6px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .diff-table td {
          padding: 6px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          vertical-align: top;
        }

        .th-prop {
          width: 25%;
        }

        .th-before,
        .th-after {
          width: 37.5%;
        }

        .td-key {
          color: #cbd5e1;
          font-weight: 600;
        }

        .diff-modified td.before-val {
          background: rgba(239, 68, 68, 0.08);
          color: #fca5a5;
        }

        .diff-modified td.after-val {
          background: rgba(16, 185, 129, 0.08);
          color: #86efac;
        }

        .diff-added td.after-val {
          background: rgba(16, 185, 129, 0.12);
          color: #86efac;
        }

        .diff-removed td.before-val {
          background: rgba(239, 68, 68, 0.12);
          color: #fca5a5;
        }

        .val-text {
          white-space: pre-wrap;
          word-break: break-all;
        }

        .val-null {
          color: #475569;
          font-style: italic;
        }

        .font-mono {
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}

import { db } from '../services/db.service.js';
import crypto from 'crypto';

export interface TelemetryEvent {
  id?: string;
  event_type: 'http_request' | 'llm_generation' | 'mcp_tool_call';
  name: string;
  provider: string; // e.g. 'gemini', 'openai', 'express', 'mcp-google-calendar'
  duration_ms: number;
  status: string; // e.g. '200', '401', '500', 'success', 'failure'
  input_tokens?: number;
  output_tokens?: number;
  created_at?: Date | string;
}

export class TelemetryModel {
  public static async create(event: TelemetryEvent): Promise<TelemetryEvent> {
    const id = event.id || crypto.randomUUID();
    const query = `
      INSERT INTO telemetry_events (id, event_type, name, provider, duration_ms, status, input_tokens, output_tokens)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const res = await db.query(query, [
      id,
      event.event_type,
      event.name,
      event.provider,
      event.duration_ms,
      event.status,
      event.input_tokens || 0,
      event.output_tokens || 0,
    ]);
    return res.rows[0];
  }

  public static async list(): Promise<TelemetryEvent[]> {
    const query = `
      SELECT * FROM telemetry_events
      ORDER BY created_at DESC;
    `;
    const res = await db.query(query);
    return res.rows;
  }

  public static async clear(): Promise<void> {
    const query = `
      DELETE FROM telemetry_events;
    `;
    await db.query(query);
  }
}

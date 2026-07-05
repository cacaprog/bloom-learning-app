import crypto from 'crypto';
import { TelemetryModel } from '../models/telemetry.js';


export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
}

export class CalendarService {
  private static mockEvents: Map<string, CalendarEvent> = new Map();
  private client: any | null = null;
  private isInitialized = false;
  private toolNames = {
    create: 'create_calendar_event',
    delete: 'delete_calendar_event',
  };

  private async getMcpClient(): Promise<any | null> {
    const sseUrl = process.env.MCP_CALENDAR_SERVER_URL;
    if (!sseUrl) {
      return null;
    }
    if (this.isInitialized) {
      return this.client;
    }

    try {
      if (typeof globalThis.EventSource === 'undefined') {
        const { EventSource } = await import('eventsource');
        (globalThis as any).EventSource = EventSource;
      }

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');

      const transport = new SSEClientTransport(new URL(sseUrl));
      const client = new Client(
        {
          name: 'bloom-coaching-backend',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect with a 2-second timeout
      const connectPromise = client.connect(transport);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('MCP handshake timeout after 2000ms')), 2000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      this.client = client;

      // Dynamically resolve exposed tools if possible
      try {
        const toolsResult = await client.listTools();
        const list = (toolsResult.tools || []).map((t: any) => t.name);

        const createTool = list.find((n: string) => n === 'create_calendar_event' || n === 'create_event' || n === 'quick_add');
        if (createTool) {
          this.toolNames.create = createTool;
        }
        const deleteTool = list.find((n: string) => n === 'delete_calendar_event' || n === 'delete_event' || n === 'remove_event');
        if (deleteTool) {
          this.toolNames.delete = deleteTool;
        }
      } catch (err) {
        console.warn('[CalendarService] Failed to list tools, using default tool names:', err);
      }

      this.isInitialized = true;
      console.log(`[CalendarService] Successfully connected to MCP Calendar server at ${sseUrl}`);
      return this.client;
    } catch (err) {
      console.warn(`[CalendarService] Failed to initialize MCP client, falling back to mock:`, err);
      this.isInitialized = true; // Mark true so we don't repeatedly retry on every call
      this.client = null;
      return null;
    }
  }

  public async createEvent(title: string, start: Date, durationMinutes: number): Promise<{ eventId: string; synced: boolean }> {
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const sseUrl = process.env.MCP_CALENDAR_SERVER_URL;

    let googleEventId: string | null = null;
    let synced = false;

    if (sseUrl) {
      const client = await this.getMcpClient();
      if (client) {
        const startMcp = process.hrtime();
        try {
          const toolResult = await client.callTool({
            name: this.toolNames.create,
            arguments: {
              summary: title,  // Google Calendar API uses 'summary' not 'title'
              start: start.toISOString(),
              end: end.toISOString(),
            },
          });
          // Extract Google Calendar event ID from MCP SDK response
          try {
            const text = (toolResult as any)?.content?.[0]?.text;
            if (text) googleEventId = JSON.parse(text)?.event?.id ?? null;
          } catch { /* ignore parse errors */ }

          const diff = process.hrtime(startMcp);
          const duration = (diff[0] * 1e9 + diff[1]) / 1e6;
          console.log(`[Telemetry] MCP Tool Call "${this.toolNames.create}" - Duration: ${duration.toFixed(2)}ms`);
          TelemetryModel.create({
            event_type: 'mcp_tool_call',
            name: this.toolNames.create,
            provider: 'mcp-google-calendar',
            duration_ms: Number(duration.toFixed(2)),
            status: 'success',
          }).catch(err => console.error('[Telemetry] Failed to save createEvent tool call log:', err));

          console.log(`[MCP Calendar] Successfully synced to external calendar via tool "${this.toolNames.create}"`);
          synced = true;
        } catch (err) {
          console.warn(`[MCP Calendar] Failed to call external calendar tool:`, err);
        }
      }

      // Fallback: Try Direct HTTP POST (for custom JSON-RPC servers like this project's MCP server)
      if (!synced) {
        try {
          const res = await fetch(sseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'create_event',
              parameters: {
                summary: title,
                start: start.toISOString(),
                end: end.toISOString(),
              },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            googleEventId = data?.value?.event?.id ?? null;
            console.log(`[MCP Calendar] Successfully synced to external calendar via direct HTTP POST`);
            synced = true;
          }
        } catch (postErr) {
          console.warn('[MCP Calendar] Direct HTTP POST failed:', postErr);
        }
      }
    }

    // Use Google's event ID when available so future deletes can target the right event
    const eventId = googleEventId ?? crypto.randomUUID();
    CalendarService.mockEvents.set(eventId, { id: eventId, title, start, end });
    console.log(`[MCP Calendar] Created event ${eventId}: "${title}"${synced ? ' (synced to Google Calendar)' : ''}`);
    return { eventId, synced };
  }

  public async deleteEvent(id: string): Promise<boolean> {
    const event = CalendarService.mockEvents.get(id);
    const deleted = CalendarService.mockEvents.delete(id);
    const sseUrl = process.env.MCP_CALENDAR_SERVER_URL;

    if (deleted && event && sseUrl) {
      let mcpDeleted = false;
      const client = await this.getMcpClient();
      if (client) {
        const startMcp = process.hrtime();
        try {
          await client.callTool({
            name: this.toolNames.delete,
            arguments: {
              eventId: id,  // Google Calendar MCP server expects 'eventId' not 'id'
            },
          });
          const diff = process.hrtime(startMcp);
          const duration = (diff[0] * 1e9 + diff[1]) / 1e6;
          console.log(`[Telemetry] MCP Tool Call "${this.toolNames.delete}" - Duration: ${duration.toFixed(2)}ms`);
          
          TelemetryModel.create({
            event_type: 'mcp_tool_call',
            name: this.toolNames.delete,
            provider: 'mcp-google-calendar',
            duration_ms: Number(duration.toFixed(2)),
            status: 'success',
          }).catch(err => console.error('[Telemetry] Failed to save deleteEvent tool call log:', err));

          console.log(`[MCP Calendar] Successfully deleted external calendar event via tool "${this.toolNames.delete}"`);
          mcpDeleted = true;
        } catch (err) {
          console.warn(`[MCP Calendar] Failed to call delete tool:`, err);
        }
      }

      // Fallback: Direct HTTP POST delete_event
      if (!mcpDeleted) {
        try {
          const res = await fetch(sseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'delete_event',
              parameters: {
                eventId: id,
              },
            }),
          });
          if (res.ok) {
            console.log(`[MCP Calendar] Successfully deleted external calendar event via direct HTTP POST`);
          }
        } catch (postErr) {
          console.warn('[MCP Calendar] Direct HTTP POST delete failed:', postErr);
        }
      }
    }

    console.log(`[MCP Calendar] Deleted event ${id}: ${deleted}`);
    return deleted;
  }

  public async getEvents(): Promise<CalendarEvent[]> {
    return Array.from(CalendarService.mockEvents.values());
  }

  public async getFreeBusy(weekStart?: Date): Promise<Array<{ start: string; end: string; available: boolean }>> {
    const base = weekStart ?? new Date();
    const slots: Array<{ start: string; end: string; available: boolean }> = [];
    const existing = Array.from(CalendarService.mockEvents.values());

    for (let day = 0; day < 7; day++) {
      for (let halfHour = 0; halfHour < 48; halfHour++) {
        const slotStart = new Date(base);
        slotStart.setDate(base.getDate() + day);
        slotStart.setHours(Math.floor(halfHour / 2), (halfHour % 2) * 30, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + 30 * 60 * 1000);

        const busy = existing.some(e => e.start < slotEnd && e.end > slotStart);
        slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString(), available: !busy });
      }
    }
    return slots;
  }

  public async listUpcoming(limit = 10): Promise<CalendarEvent[]> {
    const now = new Date();
    return Array.from(CalendarService.mockEvents.values())
      .filter(e => e.start >= now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, limit);
  }

  public static clear(): void {
    CalendarService.mockEvents.clear();
  }
}

export const calendarService = new CalendarService();

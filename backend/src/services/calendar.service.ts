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

  public async createEvent(title: string, start: Date, durationMinutes: number): Promise<string> {
    const id = crypto.randomUUID();
    const end = new Date(start.getTime() + durationMinutes * 60000);
    const sseUrl = process.env.MCP_CALENDAR_SERVER_URL;

    let synced = false;

    if (sseUrl) {
      const client = await this.getMcpClient();
      if (client) {
        const startMcp = process.hrtime();
        try {
          await client.callTool({
            name: this.toolNames.create,
            arguments: {
              title,
              start: start.toISOString(),
              end: end.toISOString(),
            },
          });
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

      // Fallback: Try Direct HTTP POST (for custom JSON-RPC servers like daemonX10/Google-Calendar-MCP-Server)
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
            console.log(`[MCP Calendar] Successfully synced to external calendar via direct HTTP POST`);
            synced = true;
          }
        } catch (postErr) {
          console.warn('[MCP Calendar] Direct HTTP POST failed:', postErr);
        }
      }
    }

    CalendarService.mockEvents.set(id, { id, title, start, end });
    console.log(`[MCP Calendar] Created event ${id}: "${title}"`);
    return id;
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
              id,
              title: event.title,
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

  public static clear(): void {
    CalendarService.mockEvents.clear();
  }
}

export const calendarService = new CalendarService();

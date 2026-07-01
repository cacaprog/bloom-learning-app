import crypto from 'crypto';

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
}

export class CalendarService {
  private static mockEvents: Map<string, CalendarEvent> = new Map();

  public async createEvent(title: string, start: Date, durationMinutes: number): Promise<string> {
    const id = crypto.randomUUID();
    const end = new Date(start.getTime() + durationMinutes * 60000);
    CalendarService.mockEvents.set(id, { id, title, start, end });
    console.log(`[MCP Calendar] Created event ${id}: "${title}"`);
    return id;
  }

  public async deleteEvent(id: string): Promise<boolean> {
    const deleted = CalendarService.mockEvents.delete(id);
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

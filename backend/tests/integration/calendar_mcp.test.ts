describe('MCP Calendar Client Integration Tests', () => {
  let calendarService: any;
  const originalEnv = process.env.MCP_CALENDAR_SERVER_URL;

  beforeAll(async () => {
    jest.doMock('@modelcontextprotocol/sdk/client/index.js', () => {
      return {
        __esModule: true,
        Client: class {
          async connect() {
            return Promise.resolve();
          }
          async listTools() {
            return Promise.resolve({
              tools: [
                { name: 'create_event' },
                { name: 'delete_event' },
              ],
            });
          }
          async callTool() {
            return Promise.resolve({ content: [{ type: 'text', text: 'Success' }] });
          }
        },
      };
    });

    jest.doMock('@modelcontextprotocol/sdk/client/sse.js', () => {
      return {
        __esModule: true,
        SSEClientTransport: jest.fn().mockImplementation(() => {
          return {};
        }),
      };
    });

    // Dynamically import after mocking
    const mod = await import('../../src/services/calendar.service.js');
    calendarService = mod.calendarService;
  });

  beforeEach(() => {
    if (calendarService) {
      calendarService.client = null;
      calendarService.isInitialized = false;
      (calendarService.constructor as any).mockEvents?.clear();
      calendarService.toolNames = {
        create: 'create_calendar_event',
        delete: 'delete_calendar_event',
      };
    }
  });

  afterAll(() => {
    process.env.MCP_CALENDAR_SERVER_URL = originalEnv;
  });

  it('should fall back to mock when MCP_CALENDAR_SERVER_URL is not set', async () => {
    delete process.env.MCP_CALENDAR_SERVER_URL;

    const { eventId, synced } = await calendarService.createEvent('Test Session', new Date(), 60);
    expect(eventId).toBeDefined();
    expect(synced).toBe(false);

    const events = await calendarService.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Test Session');
  });

  it('should connect to MCP server and call dynamic tool name when URL is set', async () => {
    process.env.MCP_CALENDAR_SERVER_URL = 'http://localhost:8000/sse';

    const { eventId, synced } = await calendarService.createEvent('MCP Course', new Date(), 45);
    expect(eventId).toBeDefined();
    expect(synced).toBe(true);

    // Verify MCP tool creation name mapping resolved correctly
    expect(calendarService.toolNames.create).toBe('create_event');

    const deleted = await calendarService.deleteEvent(eventId);
    expect(deleted).toBe(true);
    expect(calendarService.toolNames.delete).toBe('delete_event');
  });
});

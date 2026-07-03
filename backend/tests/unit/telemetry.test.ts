import { TelemetryModel } from '../../src/models/telemetry.js';
import crypto from 'crypto';

describe('TelemetryModel Unit Tests', () => {
  beforeEach(async () => {
    await TelemetryModel.clear();
  });

  afterAll(async () => {
    await TelemetryModel.clear();
  });

  it('should successfully create and list telemetry events', async () => {
    const eventId = crypto.randomUUID();
    const event = await TelemetryModel.create({
      id: eventId,
      event_type: 'llm_generation',
      name: 'onboarding',
      provider: 'gemini',
      duration_ms: 120.45,
      status: 'success',
      input_tokens: 150,
      output_tokens: 80,
    });

    expect(event).toBeDefined();
    expect(event.id).toBe(eventId);
    expect(Number(event.duration_ms)).toBe(120.45);
    expect(event.input_tokens).toBe(150);
    expect(event.output_tokens).toBe(80);

    const list = await TelemetryModel.list();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(eventId);
  });

  it('should clear telemetry events', async () => {
    await TelemetryModel.create({
      event_type: 'http_request',
      name: 'POST /api/chat',
      provider: 'express',
      duration_ms: 12.3,
      status: '200',
    });

    let list = await TelemetryModel.list();
    expect(list.length).toBe(1);

    await TelemetryModel.clear();

    list = await TelemetryModel.list();
    expect(list.length).toBe(0);
  });
});

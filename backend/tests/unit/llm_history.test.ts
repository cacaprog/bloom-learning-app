// Simple global-scoped arrays to record call arguments (prefixed with "mock" to satisfy Jest's hoisting rules)
const mockOpenAICalls: any[] = [];
const mockGeminiCalls: any[] = [];

jest.mock('openai', () => {
  return {
    __esModule: true,
    OpenAI: class {
      chat = {
        completions: {
          create: (args: any) => {
            mockOpenAICalls.push(args);
            return Promise.resolve({
              choices: [{ message: { content: 'OpenAI response with history' } }],
            });
          },
        },
      };
    },
  };
});

jest.mock('@google/generative-ai', () => {
  return {
    __esModule: true,
    GoogleGenerativeAI: class {
      getGenerativeModel(modelArgs: any) {
        mockGeminiCalls.push({ type: 'getGenerativeModel', args: modelArgs });
        return {
          startChat(chatArgs: any) {
            mockGeminiCalls.push({ type: 'startChat', args: chatArgs });
            return {
              sendMessage(msgArgs: any) {
                mockGeminiCalls.push({ type: 'sendMessage', args: msgArgs });
                return Promise.resolve({
                  response: { text: () => 'Gemini response with history' },
                });
              },
            };
          },
          generateContent(contentArgs: any) {
            mockGeminiCalls.push({ type: 'generateContent', args: contentArgs });
            return Promise.resolve({
              response: { text: () => 'Gemini response' },
            });
          },
        };
      }
    },
  };
});

describe('LlmService History Propagation Tests', () => {
  let originalGeminiKey: string | undefined;
  let originalOpenaiKey: string | undefined;
  let llmServiceInstance: any;

  beforeAll(() => {
    originalGeminiKey = process.env.GEMINI_API_KEY;
    originalOpenaiKey = process.env.OPENAI_API_KEY;

    // Isolate module loading so we fetch the mocked classes
    jest.isolateModules(() => {
      const module = require('../../src/services/llm.service.js');
      llmServiceInstance = module.llmService;
    });
  });

  afterAll(() => {
    process.env.GEMINI_API_KEY = originalGeminiKey;
    process.env.OPENAI_API_KEY = originalOpenaiKey;
  });

  beforeEach(() => {
    mockOpenAICalls.length = 0;
    mockGeminiCalls.length = 0;
  });

  it('should propagate conversation history turns to OpenAI completions messages', async () => {
    process.env.OPENAI_API_KEY = 'real-openai-key-for-test';
    delete process.env.GEMINI_API_KEY;

    const mockHistory = [
      { role: 'user', content: 'What is my goal?' },
      { role: 'coach', content: 'You want to learn coding.' },
    ];

    const response = await llmServiceInstance.generate('planning', 'Confirm Option A', mockHistory);
    expect(response).toBe('OpenAI response with history');

    expect(mockOpenAICalls.length).toBe(1);
    expect(mockOpenAICalls[0]).toEqual({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: expect.any(String) },
        { role: 'user', content: 'What is my goal?' },
        { role: 'assistant', content: 'You want to learn coding.' },
        { role: 'user', content: 'Confirm Option A' },
      ],
    });
  });

  it('should propagate conversation history turns to Gemini startChat SDK method', async () => {
    process.env.GEMINI_API_KEY = 'real-gemini-key-for-test';
    delete process.env.OPENAI_API_KEY;

    const mockHistory = [
      { role: 'user', content: 'What is my goal?' },
      { role: 'coach', content: 'You want to learn coding.' },
    ];

    const response = await llmServiceInstance.generate('planning', 'Confirm Option A', mockHistory);
    expect(response).toBe('Gemini response with history');

    // Verify model was fetched with system instructions and chat started
    const getModelCall = mockGeminiCalls.find(c => c.type === 'getGenerativeModel');
    expect(getModelCall).toBeDefined();

    const startChatCall = mockGeminiCalls.find(c => c.type === 'startChat');
    expect(startChatCall).toBeDefined();
    expect(startChatCall.args).toEqual({
      history: [
        { role: 'user', parts: [{ text: 'What is my goal?' }] },
        { role: 'model', parts: [{ text: 'You want to learn coding.' }] },
      ],
    });

    const sendMessageCall = mockGeminiCalls.find(c => c.type === 'sendMessage');
    expect(sendMessageCall).toBeDefined();
    expect(sendMessageCall.args).toBe('Confirm Option A');
  });
});

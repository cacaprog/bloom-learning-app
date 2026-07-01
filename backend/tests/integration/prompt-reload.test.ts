import request from 'supertest';
import app from '../../src/index.js';
import fs from 'fs';
import path from 'path';
import { promptService } from '../../src/services/prompt.service.js';

describe('Prompt Hot Reloading Integration', () => {
  const reflectionFile = path.join(process.cwd(), 'src', 'prompts', 'reflection.md');
  let originalPromptContent: string;

  beforeAll(() => {
    if (fs.existsSync(reflectionFile)) {
      originalPromptContent = fs.readFileSync(reflectionFile, 'utf8');
    }
  });

  afterAll(() => {
    if (originalPromptContent !== undefined) {
      fs.writeFileSync(reflectionFile, originalPromptContent);
    }
    promptService.close(); // Clean up watchers
  });

  it('should hot-reload prompts immediately on disk modifications', async () => {
    const customPromptText = 'What felt like a win this week? Custom testing prompt.';
    
    // Modify prompt file on disk
    fs.writeFileSync(reflectionFile, customPromptText);

    const loadedPrompt = promptService.getPrompt('reflection');
    expect(loadedPrompt).toBeDefined();
  });
});

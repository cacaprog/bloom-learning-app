import fs from 'fs';
import path from 'path';

export class PromptService {
  private cache: Record<string, string> = {};
  private promptsDir: string;
  private watchers: fs.FSWatcher[] = [];

  constructor() {
    // Resolve prompts directory relative to current working directory
    const cwd = process.cwd();
    const srcPrompts = path.join(cwd, 'src', 'prompts');
    const distPrompts = path.join(cwd, 'dist', 'prompts');
    this.promptsDir = fs.existsSync(srcPrompts) ? srcPrompts : distPrompts;

    this.loadAll();
    this.setupWatchers();
  }

  private loadAll() {
    const keys = ['onboarding', 'planning', 'recovery', 'reflection'];
    for (const key of keys) {
      const filePath = path.join(this.promptsDir, `${key}.md`);
      try {
        if (fs.existsSync(filePath)) {
          this.cache[key] = fs.readFileSync(filePath, 'utf8').trim();
        } else {
          this.cache[key] = this.getFallback(key);
        }
      } catch (err) {
        console.warn(`Failed to read prompt file ${filePath}, using fallback.`, err);
        this.cache[key] = this.getFallback(key);
      }
    }
  }

  private setupWatchers() {
    if (process.env.NODE_ENV === 'test') return; // Skip watchers in test runs

    try {
      if (fs.existsSync(this.promptsDir)) {
        const watcher = fs.watch(this.promptsDir, (eventType, filename) => {
          if (filename && filename.endsWith('.md')) {
            const key = filename.replace('.md', '');
            const filePath = path.join(this.promptsDir, filename);
            try {
              if (fs.existsSync(filePath)) {
                this.cache[key] = fs.readFileSync(filePath, 'utf8').trim();
                console.log(`[PromptService] Hot-reloaded prompt: ${filename}`);
              }
            } catch (err) {
              console.error(`Failed to hot-reload prompt ${filename}:`, err);
            }
          }
        });
        this.watchers.push(watcher);
      }
    } catch (err) {
      console.warn('Failed to setup prompt directory file watchers:', err);
    }
  }

  public getPrompt(key: string): string {
    return this.cache[key] || this.getFallback(key);
  }

  private getFallback(key: string): string {
    switch (key) {
      case 'onboarding':
        return 'Hello! I am your Onboarding Specialist.';
      case 'planning':
        return 'Option A: Three 2-hour sessions on evenings, or Option B: Four 1.5-hour sessions on mornings. Which style fits best for you?';
      case 'recovery':
        return 'I noticed you missed your session. No judgment—life happens. What got in the way?';
      case 'reflection':
        return 'What went well in this session?';
      default:
        return 'Coaching system instruction.';
    }
  }

  public close() {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
  }
}

export const promptService = new PromptService();

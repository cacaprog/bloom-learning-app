import express from 'express';
import { json } from 'express';
import { errorHandler, latencyLogger } from './api/middleware.js';
import chatRouter from './api/chat.js';
import planningRouter from './api/planning.js';

import a2aRouter from './api/a2a.js';
import wellKnownRouter from './api/well-known.js';
import reflectionRouter from './api/reflection.js';
import telemetryRouter from './api/telemetry.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(latencyLogger);
app.use(json());
app.use(chatRouter);

app.use(planningRouter);
app.use(a2aRouter);
app.use(wellKnownRouter);
app.use(reflectionRouter);
app.use(telemetryRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', time: new Date().toISOString() });
});

app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Bloom Coordinator running on port ${port}`);
  });
}

export default app;

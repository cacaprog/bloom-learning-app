import express from 'express';
import { json } from 'express';
import { errorHandler } from './api/middleware.js';
import chatRouter from './api/chat.js';
import planningRouter from './api/planning.js';

import a2aRouter from './api/a2a.js';
import wellKnownRouter from './api/well-known.js';
import reflectionRouter from './api/reflection.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(json());
app.use(chatRouter);
app.use(planningRouter);
app.use(a2aRouter);
app.use(wellKnownRouter);
app.use(reflectionRouter);

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

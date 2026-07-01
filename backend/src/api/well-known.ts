import { Router, Request, Response } from 'express';

const router = Router();

const agentCard = {
  name: "bloom-coaching-agent",
  description: "Facilitative self-learning coach: weekly planning, recovery support, and structured reflection for self-directed learners.",
  version: "1.1.0",
  url: "https://bloom-for-learning.app/a2a",
  provider: {
    organization: "Bloom-for-Learning",
    url: "https://bloom-for-learning.app"
  },
  capabilities: {
    streaming: false,
    pushNotifications: true,
    stateTransitionHistory: true
  },
  securitySchemes: {
    oauth2: {
      type: "oauth2",
      scopes: {
        "coach.plan": "Request a weekly plan on behalf of an authenticated user",
        "coach.recovery": "Request recovery coaching for a missed session",
        "coach.reflect": "Trigger a reflection prompt"
      }
    }
  },
  skills: [
    {
      id: "plan_week",
      name: "Weekly Plan Creation",
      description: "Collaboratively draft or adjust a learner's weekly study plan, respecting their time budget and known barriers.",
      inputModes: ["text", "data"],
      outputModes: ["data"],
      requiredScopes: ["coach.plan"]
    },
    {
      id: "recovery_coaching",
      name: "Missed Session Recovery",
      description: "Provide a single nonjudgmental recovery interaction after a learner misses a planned session.",
      inputModes: ["text", "data"],
      outputModes: ["text", "data"],
      requiredScopes: ["coach.recovery"]
    },
    {
      id: "reflect_session",
      name: "Structured Reflection Prompt",
      description: "Generate a context-appropriate reflection prompt (post-session, end-of-week, or post-recovery).",
      inputModes: ["data"],
      outputModes: ["text"],
      requiredScopes: ["coach.reflect"]
    }
  ]
};

router.get('/.well-known/agent.json', (_req: Request, res: Response) => {
  res.json(agentCard);
});

export default router;

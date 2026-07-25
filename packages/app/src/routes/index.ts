import type { App } from '../app.js';
import { authRoutes } from './auth.js';
import { orgRoutes } from './org.js';
import { landRoutes } from './land.js';
import { cultivationRoutes } from './cultivation.js';
import { taskRoutes } from './tasks.js';
import { memberRoutes } from './members.js';
import { biddingRoutes } from './bidding.js';
import { observationRoutes } from './observations.js';
import { foundingRoutes } from './founding.js';
import { feedbackRoutes } from './feedback.js';
import { meRoutes } from './me.js';
import { opsRoutes } from './ops.js';

export function registerRoutes(app: App): void {
  authRoutes(app);
  orgRoutes(app);
  foundingRoutes(app);
  landRoutes(app);
  cultivationRoutes(app);
  taskRoutes(app);
  memberRoutes(app);
  biddingRoutes(app);
  observationRoutes(app);
  feedbackRoutes(app);
  meRoutes(app);
  opsRoutes(app);
}

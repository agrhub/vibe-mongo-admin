import * as express from 'express';
import 'express-session';

declare global {
  namespace Express {
    interface Request {
      nconf?: any;

      app_context?: string;
      db?: any;
      params: any;
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    loggedIn?: boolean | null;
  }
}

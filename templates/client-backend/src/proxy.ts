import { Router, Request, Response } from 'express';
import proxy from 'express-http-proxy';
import { getTenantIdFromRequest, requireAuth } from './auth';

const CORE_URL = (process.env.CORE_SERVICE_URL || '').replace(/\/$/, '');
const CHAT_URL = (process.env.CHAT_SERVICE_URL || '').replace(/\/$/, '');

function tenantHeaderDecorator(proxyReqOpts: any, srcReq: Request): any {
  const tenantId = getTenantIdFromRequest(srcReq);
  if (tenantId) {
    proxyReqOpts.headers = { ...proxyReqOpts.headers, 'x-tenant-id': tenantId };
  }
  return proxyReqOpts;
}

export const proxyRouter = Router();

if (CORE_URL) {
  proxyRouter.use(
    '/core',
    requireAuth,
    proxy(CORE_URL, {
      proxyReqPathResolver: (req) => (req.url || '').replace(/^\/core/, '') || '/',
      proxyReqOptDecorator: tenantHeaderDecorator,
    }) as any,
  );
} else {
  proxyRouter.use('/core', (_req: Request, res: Response) => {
    res.status(503).json({ message: 'CORE_SERVICE_URL não configurado' });
  });
}

if (CHAT_URL) {
  proxyRouter.use(
    '/chat',
    requireAuth,
    proxy(CHAT_URL, {
      proxyReqPathResolver: (req) => (req.url || '').replace(/^\/chat/, '') || '/',
      proxyReqOptDecorator: tenantHeaderDecorator,
    }) as any,
  );
} else {
  proxyRouter.use('/chat', (_req: Request, res: Response) => {
    res.status(503).json({ message: 'CHAT_SERVICE_URL não configurado' });
  });
}

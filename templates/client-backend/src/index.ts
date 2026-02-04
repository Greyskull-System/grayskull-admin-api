import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { authRouter } from './auth';
import { proxyRouter } from './proxy';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/auth', authRouter);
app.use('/api', proxyRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'client-backend' });
});

app.listen(port, () => {
  console.log(`Client backend running on http://localhost:${port}`);
});

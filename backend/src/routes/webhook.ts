import { Router, Request, Response } from 'express';

const router = Router();

router.get('/google-calendar/callback', (req: Request, res: Response) => {
  res.send('Callback received');
});

export default router;

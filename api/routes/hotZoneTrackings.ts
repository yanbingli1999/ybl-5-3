import { Router, type Request, type Response } from 'express';
import fileService from '../services/fileService.js';
import type { HotZoneTracking } from '../../shared/types.js';

const router = Router();
const TRACKINGS_DIR = fileService.getPath('hotzone_trackings');

router.get('/:experimentId', async (req: Request, res: Response) => {
  try {
    const experimentId = req.params.experimentId;
    const allTrackings = await fileService.listJsonFiles<HotZoneTracking>(TRACKINGS_DIR, {
      sortBy: 'createdAt',
      order: 'desc'
    });

    const filtered = allTrackings.filter(t => t.experimentId === experimentId);
    res.json({ success: true, data: filtered });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load hot zone trackings' });
  }
});

router.get('/detail/:id', async (req: Request, res: Response) => {
  try {
    const filePath = fileService.getPath('hotzone_trackings', `${req.params.id}.json`);
    const tracking = await fileService.readJsonFile<HotZoneTracking>(filePath);

    if (!tracking) {
      return res.status(404).json({ success: false, error: 'Hot zone tracking not found' });
    }

    res.json({ success: true, data: tracking });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load hot zone tracking' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const tracking: HotZoneTracking = req.body;
    const filePath = fileService.getPath('hotzone_trackings', `${tracking.id}.json`);

    if (await fileService.fileExists(filePath)) {
      return res.status(400).json({ success: false, error: 'Hot zone tracking ID already exists' });
    }

    await fileService.writeJsonFile(filePath, tracking);
    res.json({ success: true, data: tracking });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create hot zone tracking' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const filePath = fileService.getPath('hotzone_trackings', `${req.params.id}.json`);
    const deleted = await fileService.deleteFile(filePath);

    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Hot zone tracking not found' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete hot zone tracking' });
  }
});

export default router;

import settingsRepository from '../../infrastructure/repositories/SettingsRepository';

class SettingsController {
  async get(req, res, next) {
    try {
      const settings = await settingsRepository.getAll();
      res.json({ success: true, data: { settings } });
    } catch (error) {
      next(error);
    }
  }

  async save(req, res, next) {
    try {
      const settings = req.body; // { schoolNameEn: '...', contactEmail: '...' }
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ success: false, message: 'Invalid settings payload' });
      }
      const saved = await settingsRepository.upsertMany(settings);
      res.json({ success: true, data: { settings: saved } });
    } catch (error) {
      next(error);
    }
  }
}

export default new SettingsController();

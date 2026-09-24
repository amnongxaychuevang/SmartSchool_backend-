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
      // Validated by settingsSaveSchema, e.g. { schoolInfo: { schoolNameEn, ... } }.
      const saved = await settingsRepository.upsertMany(req.body, req.user?.userId);
      res.json({ success: true, data: { settings: saved } });
    } catch (error) {
      next(error);
    }
  }
}

export default new SettingsController();

import schoolEventRepository from '../../infrastructure/repositories/SchoolEventRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';

const audit = (req, action: string, entityId: number, detail?: unknown) =>
  auditLogRepository.log({ userId: req.user.userId, action, entityType: 'school_event', entityId, detail, ipAddress: req.ip });

// Express 5 forwards rejected promises to the error handler, so handlers can simply throw.
const SchoolEventController = {
  // GET /calendar?from=YYYY-MM-DD&to=YYYY-MM-DD — every signed-in user (admin, teacher, parent) may read it.
  async list(req, res) {
    const { from, to } = req.query;
    res.json({ success: true, data: { events: await schoolEventRepository.findBetween(from, to) } });
  },

  async create(req, res) {
    const event = await schoolEventRepository.create(req.body, req.user.userId);
    audit(req, 'create', event.eventId, req.body);
    res.status(201).json({ success: true, data: { event } });
  },

  async update(req, res) {
    const event = await schoolEventRepository.update(Number(req.params.id), req.body);
    audit(req, 'update', event.eventId, req.body);
    res.json({ success: true, data: { event } });
  },

  async delete(req, res) {
    await schoolEventRepository.delete(Number(req.params.id));
    audit(req, 'delete', Number(req.params.id));
    res.json({ success: true });
  },
};

export default SchoolEventController;

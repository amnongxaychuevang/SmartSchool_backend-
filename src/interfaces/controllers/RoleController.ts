import { PrismaClient  } from '@prisma/client';
const prisma = new PrismaClient();

const RoleController = {
  list: async (req, res) => {
    try {
      const roles = await prisma.role.findMany({
        orderBy: { roleId: 'asc' }
      });
      res.json({ success: true, data: roles });
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch roles' });
    }
  }
};

export default RoleController;

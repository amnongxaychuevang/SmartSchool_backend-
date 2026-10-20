import prisma from '../database/PrismaClient';

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  const row = await prisma.schoolSetting.findUnique({ where: { key: 'whatsapp' } });
  if (!row) return null;
  const val = row.value as any;
  if (!val?.phoneNumberId || !val?.accessToken) return null;
  return { phoneNumberId: val.phoneNumberId, accessToken: val.accessToken };
}

class WhatsAppService {
  async sendTextMessage(recipientPhone: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const config = await getWhatsAppConfig();
    if (!config) {
      console.warn('[WhatsApp] Not configured — message skipped:', text);
      return { success: false, error: 'WhatsApp not configured' };
    }

    const phone = recipientPhone.replace(/\D/g, '');
    const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: text },
        }),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        const errMsg = data?.error?.message || response.statusText;
        console.error('[WhatsApp] API error:', errMsg);
        return { success: false, error: errMsg };
      }

      const messageId = data?.messages?.[0]?.id;
      console.log(`[WhatsApp] Sent to ${phone}, messageId: ${messageId}`);
      return { success: true, messageId };
    } catch (err: any) {
      console.error('[WhatsApp] Network error:', err.message);
      return { success: false, error: err.message };
    }
  }

  async sendTemplateMessage(
    recipientPhone: string,
    templateName: string,
    languageCode: string,
    components?: any[],
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const config = await getWhatsAppConfig();
    if (!config) {
      console.warn('[WhatsApp] Not configured — template skipped:', templateName);
      return { success: false, error: 'WhatsApp not configured' };
    }

    const phone = recipientPhone.replace(/\D/g, '');
    const url = `https://graph.facebook.com/v21.0/${config.phoneNumberId}/messages`;

    try {
      const body: any = {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
        },
      };
      if (components) body.template.components = components;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        const errMsg = data?.error?.message || response.statusText;
        console.error('[WhatsApp] Template error:', errMsg);
        return { success: false, error: errMsg };
      }

      const messageId = data?.messages?.[0]?.id;
      return { success: true, messageId };
    } catch (err: any) {
      console.error('[WhatsApp] Network error:', err.message);
      return { success: false, error: err.message };
    }
  }
}

export default new WhatsAppService();

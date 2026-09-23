// TelegramNotificationService lives in infrastructure because it makes
// external HTTP calls to the Telegram API — a pure infrastructure concern.
class TelegramNotificationService { telegramToken: any; defaultChatId: any;
  constructor() {
    this.telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    this.defaultChatId = process.env.TELEGRAM_CHAT_ID;
  }

  async notifyParentAttendance(studentId, logType, time) {
    const action = logType === 'check_in' ? 'checked in' : 'checked out';
    const message = `Student ID: ${studentId} just ${action} at ${time.toLocaleString()}`;
    await this._sendTelegramMessage(this.defaultChatId, message);
  }

  async notifyParentTransaction(studentId, amount, newBalance, shopId) {
    const message = `Student ID: ${studentId} spent ${amount} LAK at shop ${shopId}. New Balance: ${newBalance} LAK`;
    await this._sendTelegramMessage(this.defaultChatId, message);
  }

  async _sendTelegramMessage(chatId, text) {
    if (!this.telegramToken || !chatId) {
      console.warn('[TelegramNotification Mock]', text);
      return;
    }

    const url = `https://api.telegram.org/bot${this.telegramToken}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
      if (!response.ok) {
        console.error('Telegram API Error:', await response.text());
      }
    } catch (err) {
      console.error('Error sending Telegram message:', err);
    }
  }
}

export default new TelegramNotificationService();

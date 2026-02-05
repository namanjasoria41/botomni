const axios = require('axios');

class WhatsAppService {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.apiVersion = 'v18.0';
        this.baseURL = `https://graph.facebook.com/${this.apiVersion}/${this.phoneNumberId}`;
    }

    // Send a text message
    async sendMessage(to, message) {
        try {
            // Remove 'whatsapp:' prefix if present and clean phone number
            const cleanPhone = to.replace('whatsapp:', '').replace(/\D/g, '');

            const response = await axios.post(
                `${this.baseURL}/messages`,
                {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: cleanPhone,
                    type: 'text',
                    text: {
                        preview_url: false,
                        body: message
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Message sent to ${cleanPhone}`);
            return response.data;
        } catch (error) {
            console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
            throw error;
        }
    }

    // Send a formatted message with template
    async sendTemplate(to, templateData) {
        try {
            const cleanPhone = to.replace('whatsapp:', '').replace(/\D/g, '');

            const response = await axios.post(
                `${this.baseURL}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: cleanPhone,
                    type: 'template',
                    template: templateData
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Template sent to ${cleanPhone}`);
            return response.data;
        } catch (error) {
            console.error('❌ Error sending WhatsApp template:', error.response?.data || error.message);
            throw error;
        }
    }

    // Mark message as read
    async markAsRead(messageId) {
        try {
            await axios.post(
                `${this.baseURL}/messages`,
                {
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: messageId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
        } catch (error) {
            console.error('Error marking message as read:', error.response?.data || error.message);
        }
    }

    // Format phone number for WhatsApp
    formatPhoneNumber(phone) {
        // Remove all non-digit characters
        let cleaned = phone.replace(/\D/g, '');

        // Add country code if not present (assuming India +91)
        if (!cleaned.startsWith('91') && cleaned.length === 10) {
            cleaned = '91' + cleaned;
        }

        return cleaned;
    }

    // Send message with retry logic
    async sendMessageWithRetry(to, message, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await this.sendMessage(to, message);
            } catch (error) {
                if (i === maxRetries - 1) throw error;

                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
            }
        }
    }
}

// Export singleton instance
module.exports = new WhatsAppService();

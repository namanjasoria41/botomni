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

    // Send interactive button message
    async sendButtonMessage(to, bodyText, buttons, headerText = null, footerText = null) {
        try {
            const cleanPhone = to.replace('whatsapp:', '').replace(/\D/g, '');

            // WhatsApp allows max 3 buttons
            const buttonArray = buttons.slice(0, 3).map((btn, index) => ({
                type: 'reply',
                reply: {
                    id: btn.id || `btn_${index}`,
                    title: btn.title.substring(0, 20) // Max 20 chars
                }
            }));

            const messageData = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanPhone,
                type: 'interactive',
                interactive: {
                    type: 'button',
                    body: {
                        text: bodyText
                    },
                    action: {
                        buttons: buttonArray
                    }
                }
            };

            // Add optional header
            if (headerText) {
                messageData.interactive.header = {
                    type: 'text',
                    text: headerText.substring(0, 60) // Max 60 chars
                };
            }

            // Add optional footer
            if (footerText) {
                messageData.interactive.footer = {
                    text: footerText.substring(0, 60) // Max 60 chars
                };
            }

            const response = await axios.post(
                `${this.baseURL}/messages`,
                messageData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ Button message sent to ${cleanPhone}`);
            return response.data;
        } catch (error) {
            console.error('❌ Error sending button message:', error.response?.data || error.message);
            // Fallback to regular text message
            return await this.sendMessage(to, bodyText);
        }
    }

    // Send interactive list message
    async sendListMessage(to, bodyText, buttonText, sections, headerText = null, footerText = null) {
        try {
            const cleanPhone = to.replace('whatsapp:', '').replace(/\D/g, '');

            const messageData = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: cleanPhone,
                type: 'interactive',
                interactive: {
                    type: 'list',
                    body: {
                        text: bodyText
                    },
                    action: {
                        button: buttonText.substring(0, 20), // Max 20 chars
                        sections: sections
                    }
                }
            };

            // Add optional header
            if (headerText) {
                messageData.interactive.header = {
                    type: 'text',
                    text: headerText.substring(0, 60)
                };
            }

            // Add optional footer
            if (footerText) {
                messageData.interactive.footer = {
                    text: footerText.substring(0, 60)
                };
            }

            const response = await axios.post(
                `${this.baseURL}/messages`,
                messageData,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`✅ List message sent to ${cleanPhone}`);
            return response.data;
        } catch (error) {
            console.error('❌ Error sending list message:', error.response?.data || error.message);
            // Fallback to regular text message
            return await this.sendMessage(to, bodyText);
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

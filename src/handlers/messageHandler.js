const whatsappService = require('../services/whatsappService');
const orderStatusHandler = require('./orderStatusHandler');
const orderHistoryHandler = require('./orderHistoryHandler');
const Customer = require('../models/Customer');
const { supabase } = require('../database/db');
const {
    welcomeMessage,
    helpMessage
} = require('../utils/messageTemplates');
const {
    sanitizeInput,
    isCommand,
    parseCommand,
    extractOrderId
} = require('../utils/validators');

class MessageHandler {
    // Main message processing entry point
    async processMessage(phone, message, senderName = null) {
        try {
            // Sanitize input
            const cleanMessage = sanitizeInput(message);

            if (!cleanMessage) return;

            // Ensure customer exists in database
            await Customer.getOrCreate(phone, senderName);

            // Log incoming message
            await this.logMessage(phone, cleanMessage, 'incoming');

            // Check if it's a command
            if (isCommand(cleanMessage)) {
                const command = parseCommand(cleanMessage);
                await this.handleCommand(phone, command, senderName);
                return;
            }

            // Check if message contains an order ID
            const orderId = extractOrderId(cleanMessage);
            if (orderId) {
                await orderStatusHandler.handle(phone, cleanMessage);
                return;
            }

            // Default: show help
            await whatsappService.sendMessage(phone, helpMessage());

        } catch (error) {
            console.error('Error processing message:', error);
            await whatsappService.sendMessage(
                phone,
                '⚠️ Sorry, something went wrong. Please try again or contact support.'
            );
        }
    }

    // Handle specific commands
    async handleCommand(phone, command, senderName) {
        switch (command) {
            case 'welcome':
                await whatsappService.sendMessage(phone, welcomeMessage(senderName));
                break;

            case 'help':
                await whatsappService.sendMessage(phone, helpMessage());
                break;

            case 'history':
                await orderHistoryHandler.handle(phone);
                break;

            case 'status':
                await whatsappService.sendMessage(
                    phone,
                    '📦 Please send me your order ID or AWB number to check the status.'
                );
                break;

            case 'unsubscribe':
                await this.handleUnsubscribe(phone);
                break;

            default:
                await whatsappService.sendMessage(phone, helpMessage());
        }
    }

    // Handle unsubscribe request
    async handleUnsubscribe(phone) {
        try {
            // Update customer preference (you can add a field in customers table)
            await whatsappService.sendMessage(
                phone,
                '✅ You have been unsubscribed from promotional messages.\n\nYou will still receive order updates. To resubscribe, type "START".'
            );
        } catch (error) {
            console.error('Error handling unsubscribe:', error);
        }
    }

    // Log message to database
    async logMessage(phone, message, type) {
        try {
            await supabase.from('messages').insert([{
                customer_phone: phone,
                message_type: type,
                message_content: message,
                status: 'received'
            }]);
        } catch (error) {
            console.error('Error logging message:', error);
        }
    }
}

module.exports = new MessageHandler();

const whatsappService = require('../services/whatsappService');
const orderStatusHandler = require('./orderStatusHandler');
const orderHistoryHandler = require('./orderHistoryHandler');
const faqHandler = require('./faqHandler');
const sizeGuideHandler = require('./sizeGuideHandler');
const returnExchangeHandler = require('./returnExchangeHandler');
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

            // Check for size guide queries (high priority)
            const sizeGuideHandled = await sizeGuideHandler.handle(phone, cleanMessage);
            if (sizeGuideHandled) return;

            // Check for return/exchange requests
            const returnExchangeHandled = await returnExchangeHandler.handle(phone, cleanMessage);
            if (returnExchangeHandled) return;

            // Check for FAQ queries
            const faqHandled = await faqHandler.handle(phone, cleanMessage);
            if (faqHandled) return;

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
                // Send welcome message with interactive buttons
                await whatsappService.sendButtonMessage(
                    phone,
                    `I'm your personal OffComfrt shopping assistant. I can help you with:\n\n📦 Track your order status\n📋 View your order history  \n🎁 Get exclusive offers\n❓ Get help anytime`,
                    [
                        { id: 'track_order', title: '📦 Track Order' },
                        { id: 'order_history', title: '📋 Order History' },
                        { id: 'get_help', title: '❓ Help' }
                    ],
                    `👋 Hi ${senderName || 'there'}! Welcome to OffComfrt!`,
                    'Experience comfort, delivered. ✨'
                );
                break;

            case 'help':
                // Send help message with interactive buttons
                await whatsappService.sendButtonMessage(
                    phone,
                    `*To check order status:*\nSend your order ID or AWB tracking number\n\n*To view order history:*\nType "orders" or "history"\n\n*Need human support?*\n📧 support@offcomfrt.in\n🌐 www.offcomfrt.in\n\nI'm here 24/7 to help!`,
                    [
                        { id: 'track_order', title: '📦 Track Order' },
                        { id: 'order_history', title: '📋 My Orders' },
                        { id: 'contact_support', title: '💬 Contact Support' }
                    ],
                    'OffComfrt Support',
                    'Your comfort is our priority. ✨'
                );
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

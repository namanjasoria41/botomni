const whatsappService = require('../services/whatsappService');
const returnService = require('../services/returnService');
const razorpayService = require('../services/razorpayService');
const { supabase } = require('../database/db');

class ReturnExchangeHandler {
    constructor() {
        // Store conversation states
        this.conversations = new Map();
    }

    /**
     * Handle return/exchange requests
     */
    async handle(phone, message) {
        const lowerMessage = message.toLowerCase().trim();

        // Check if this is a return/exchange initiation
        if (lowerMessage === 'return' || lowerMessage === 'exchange' ||
            lowerMessage.includes('return order') || lowerMessage.includes('exchange order')) {

            const type = lowerMessage.includes('exchange') ? 'exchange' : 'return';
            await this.startProcess(phone, type);
            return true;
        }

        // Check if user is in an active conversation
        const conversation = this.conversations.get(phone);
        if (conversation) {
            await this.handleConversationStep(phone, message, conversation);
            return true;
        }

        // Check for return/exchange status queries
        if (lowerMessage.startsWith('return status') || lowerMessage.startsWith('exchange status')) {
            const id = message.split(' ').pop();
            await this.sendStatus(phone, id, lowerMessage.includes('exchange') ? 'exchange' : 'return');
            return true;
        }

        return false;
    }

    /**
     * Start return/exchange process
     */
    async startProcess(phone, type) {
        this.conversations.set(phone, {
            type: type,
            step: 'awaiting_order_id',
            data: {}
        });

        const message = type === 'return'
            ? `🔄 *Return Request*\n\nPlease send your *Order ID* to initiate the return process.\n\nExample: ORD-2024-001`
            : `🔄 *Exchange Request*\n\nPlease send your *Order ID* to initiate the exchange process.\n\nExample: ORD-2024-001`;

        await whatsappService.sendMessage(phone, message);
    }

    /**
     * Handle conversation steps
     */
    async handleConversationStep(phone, message, conversation) {
        const { type, step, data } = conversation;

        switch (step) {
            case 'awaiting_order_id':
                await this.handleOrderId(phone, message, conversation);
                break;

            case 'awaiting_reason':
                await this.handleReason(phone, message, conversation);
                break;

            case 'awaiting_item_selection':
                await this.handleItemSelection(phone, message, conversation);
                break;

            case 'awaiting_new_item_selection':
                await this.handleNewItemSelection(phone, message, conversation);
                break;

            case 'awaiting_confirmation':
                await this.handleConfirmation(phone, message, conversation);
                break;

            default:
                this.conversations.delete(phone);
                await whatsappService.sendMessage(phone, 'Session expired. Please start again.');
        }
    }

    /**
     * Handle order ID input
     */
    async handleOrderId(phone, message, conversation) {
        const orderId = message.trim().toUpperCase();

        // Check eligibility
        const eligibility = await returnService.checkEligibility(orderId);

        if (!eligibility.eligible) {
            await whatsappService.sendMessage(phone, `❌ ${eligibility.reason}\n\nPlease contact support if you need assistance.`);
            this.conversations.delete(phone);
            return;
        }

        // Update conversation
        conversation.data.orderId = orderId;
        conversation.data.order = eligibility.order;
        conversation.step = 'awaiting_reason';

        // Ask for reason
        const reasonMessage = `✅ Order found!\n\n📦 Order: ${orderId}\n⏰ ${eligibility.daysRemaining} days remaining for ${conversation.type}\n\n*Select reason:*\n\n1️⃣ Wrong size\n2️⃣ Defective/Damaged\n3️⃣ Wrong item received\n4️⃣ Quality issues\n5️⃣ Changed mind\n6️⃣ Other\n\nReply with the number (1-6)`;

        await whatsappService.sendMessage(phone, reasonMessage);
    }

    /**
     * Handle reason selection
     */
    async handleReason(phone, message, conversation) {
        const reasons = {
            '1': 'Wrong size',
            '2': 'Defective/Damaged',
            '3': 'Wrong item received',
            '4': 'Quality issues',
            '5': 'Changed mind',
            '6': 'Other'
        };

        const reasonCode = message.trim();
        const reason = reasons[reasonCode];

        if (!reason) {
            await whatsappService.sendMessage(phone, '❌ Invalid selection. Please reply with a number from 1-6.');
            return;
        }

        conversation.data.reason = reason;
        conversation.step = 'awaiting_item_selection';

        // For simplicity, assuming single item orders
        // In production, you'd list all items and let user select
        const itemMessage = conversation.type === 'return'
            ? `📝 Reason: ${reason}\n\n*Confirm return of all items?*\n\n1️⃣ Yes, return all items\n2️⃣ Cancel\n\nReply with 1 or 2`
            : `📝 Reason: ${reason}\n\n*What would you like to exchange?*\n\nPlease describe the new size/product you want.\n\nExample: "Size L instead of M" or "Blue color instead of Red"`;

        await whatsappService.sendMessage(phone, itemMessage);
    }

    /**
     * Handle item selection
     */
    async handleItemSelection(phone, message, conversation) {
        if (conversation.type === 'return') {
            if (message.trim() === '1') {
                await this.processReturn(phone, conversation);
            } else {
                await whatsappService.sendMessage(phone, '❌ Return cancelled.');
                this.conversations.delete(phone);
            }
        } else {
            // For exchange, store the new item request
            conversation.data.newItemDescription = message.trim();
            conversation.step = 'awaiting_new_item_selection';

            await whatsappService.sendMessage(phone,
                `✅ Exchange request noted: "${message}"\n\n*Price difference:*\n\nIf the new item costs more, you'll receive a payment link.\nIf it costs less, you'll get a refund.\n\n*Confirm exchange?*\n\n1️⃣ Yes, proceed\n2️⃣ Cancel\n\nReply with 1 or 2`
            );
        }
    }

    /**
     * Handle new item selection for exchange
     */
    async handleNewItemSelection(phone, message, conversation) {
        if (message.trim() === '1') {
            await this.processExchange(phone, conversation);
        } else {
            await whatsappService.sendMessage(phone, '❌ Exchange cancelled.');
            this.conversations.delete(phone);
        }
    }

    /**
     * Process return
     */
    async processReturn(phone, conversation) {
        const { orderId, order, reason } = conversation.data;

        await whatsappService.sendMessage(phone, '⏳ Processing your return request...');

        // Create return
        const result = await returnService.createReturn(
            orderId,
            [{ sku: 'ITEM-001', name: 'Product', price: order.total_amount || 1000, quantity: 1 }], // Simplified
            reason,
            {
                phone: phone,
                address: order.shipping_address || 'Customer Address',
                name: order.customer_name || 'Customer'
            }
        );

        if (result.success) {
            const message = `✅ *Return Request Created!*\n\n🔄 Return ID: ${result.returnId}\n📦 Order ID: ${orderId}\n📅 Pickup Date: ${result.pickupDate}\n💰 Refund Amount: ₹${result.refundAmount}\n\n📍 *Next Steps:*\n1. Keep items ready with original packaging\n2. Courier will pick up on ${result.pickupDate}\n3. Refund processed after quality check (3-5 days)\n\n📊 Track status: Reply "return status ${result.returnId}"`;

            await whatsappService.sendMessage(phone, message);
        } else {
            await whatsappService.sendMessage(phone, `❌ Failed to create return: ${result.error}\n\nPlease contact support.`);
        }

        this.conversations.delete(phone);
    }

    /**
     * Process exchange
     */
    async processExchange(phone, conversation) {
        const { orderId, order, reason, newItemDescription } = conversation.data;

        await whatsappService.sendMessage(phone, '⏳ Processing your exchange request...');

        // For demo, using sample prices. In production, fetch actual product prices
        const oldItems = [{ sku: 'OLD-001', name: 'Original Product', price: 1000, quantity: 1 }];
        const newItems = [{ sku: 'NEW-001', name: newItemDescription, price: 1200, quantity: 1 }];

        // Create exchange
        const result = await returnService.createExchange(
            orderId,
            oldItems,
            newItems,
            reason,
            {
                phone: phone,
                name: order.customer_name || 'Customer',
                email: order.customer_email
            }
        );

        if (result.success) {
            if (result.paymentRequired) {
                // Generate payment link
                const paymentLink = await razorpayService.createPaymentLink(
                    result.priceDifference,
                    orderId,
                    {
                        phone: phone,
                        name: order.customer_name || 'Customer',
                        email: order.customer_email
                    }
                );

                if (paymentLink.success) {
                    // Store payment link ID
                    await supabase
                        .from('exchanges')
                        .update({ payment_link_id: paymentLink.paymentLinkId })
                        .eq('exchange_id', result.exchangeId);

                    const message = `🔄 *Exchange Request Created!*\n\n🆔 Exchange ID: ${result.exchangeId}\n📦 Order ID: ${orderId}\n\n💰 *Payment Required:*\nOld Item: ₹${oldItems[0].price}\nNew Item: ₹${newItems[0].price}\nBalance: ₹${result.priceDifference}\n\n💳 *Pay Now:*\n${paymentLink.shortUrl}\n\n⏰ Link expires in 24 hours\n\n✅ After payment:\n• Pickup scheduled automatically\n• New item ships after quality check`;

                    await whatsappService.sendMessage(phone, message);
                } else {
                    await whatsappService.sendMessage(phone, `❌ Failed to generate payment link: ${paymentLink.error}`);
                }
            } else if (result.refundDue) {
                const message = `✅ *Exchange Request Created!*\n\n🆔 Exchange ID: ${result.exchangeId}\n📦 Order ID: ${orderId}\n\n💰 *Refund Due:*\nOld Item: ₹${oldItems[0].price}\nNew Item: ₹${newItems[0].price}\nRefund: ₹${Math.abs(result.priceDifference)}\n\n📅 Pickup will be scheduled shortly\n💸 Refund processed after quality check`;

                await whatsappService.sendMessage(phone, message);
            } else {
                const message = `✅ *Exchange Request Created!*\n\n🆔 Exchange ID: ${result.exchangeId}\n📦 Order ID: ${orderId}\n\n✨ No payment required (same price)\n📅 Pickup will be scheduled shortly`;

                await whatsappService.sendMessage(phone, message);
            }
        } else {
            await whatsappService.sendMessage(phone, `❌ Failed to create exchange: ${result.error}\n\nPlease contact support.`);
        }

        this.conversations.delete(phone);
    }

    /**
     * Send return/exchange status
     */
    async sendStatus(phone, id, type) {
        const result = type === 'return'
            ? await returnService.getReturnStatus(id)
            : await returnService.getExchangeStatus(id);

        if (result.success) {
            const record = result.return || result.exchange;
            const statusEmojis = {
                'initiated': '🔄',
                'pickup_scheduled': '📅',
                'picked_up': '📦',
                'in_transit': '🚚',
                'delivered_to_warehouse': '🏭',
                'qc_passed': '✅',
                'qc_failed': '❌',
                'refund_processed': '💰',
                'completed': '✅'
            };

            const emoji = statusEmojis[record.status] || '📊';
            const message = `${emoji} *${type.toUpperCase()} Status*\n\n🆔 ID: ${id}\n📦 Order: ${record.order_id}\n📊 Status: ${record.status.replace(/_/g, ' ').toUpperCase()}\n\n${type === 'return' ? `💰 Refund: ₹${record.refund_amount}\n💳 Refund Status: ${record.refund_status}` : `💰 Price Difference: ₹${record.price_difference}\n💳 Payment: ${record.payment_status}`}\n\n📅 Created: ${new Date(record.created_at).toLocaleDateString()}`;

            await whatsappService.sendMessage(phone, message);
        } else {
            await whatsappService.sendMessage(phone, `❌ ${type.charAt(0).toUpperCase() + type.slice(1)} not found: ${id}`);
        }
    }
}

module.exports = new ReturnExchangeHandler();

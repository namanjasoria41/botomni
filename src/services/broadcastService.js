const whatsappService = require('./whatsappService');
const { supabase } = require('../database/db');
const Customer = require('../models/Customer');

class BroadcastService {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.messagesPerMinute = 20; // WhatsApp rate limit
        this.delayBetweenMessages = 60000 / this.messagesPerMinute; // ~3 seconds
    }

    // Send message to all customers
    async sendToAll(message, createdBy = 'admin') {
        try {
            // Get all customers
            const customers = await this.getAllCustomers();

            if (customers.length === 0) {
                return { success: false, message: 'No customers found' };
            }

            // Create broadcast record
            const broadcast = await this.createBroadcastRecord({
                title: 'Broadcast to All',
                message,
                segment: 'all',
                total_recipients: customers.length,
                created_by: createdBy
            });

            // Add to queue
            const phones = customers.map(c => c.phone);
            await this.addToQueue(phones, message, broadcast.id);

            return {
                success: true,
                broadcastId: broadcast.id,
                totalRecipients: customers.length,
                message: 'Broadcast queued successfully'
            };
        } catch (error) {
            console.error('Error in sendToAll:', error);
            return { success: false, message: error.message };
        }
    }

    // Send message to specific segment
    async sendToSegment(message, segment, createdBy = 'admin') {
        try {
            let customers = [];

            switch (segment) {
                case 'recent':
                    // Customers from last 30 days
                    customers = await this.getRecentCustomers(30);
                    break;
                case 'with_orders':
                    // Customers who have placed orders
                    customers = await this.getCustomersWithOrders();
                    break;
                default:
                    customers = await this.getAllCustomers();
            }

            if (customers.length === 0) {
                return { success: false, message: 'No customers found in segment' };
            }

            // Create broadcast record
            const broadcast = await this.createBroadcastRecord({
                title: `Broadcast to ${segment}`,
                message,
                segment,
                total_recipients: customers.length,
                created_by: createdBy
            });

            // Add to queue
            const phones = customers.map(c => c.phone);
            await this.addToQueue(phones, message, broadcast.id);

            return {
                success: true,
                broadcastId: broadcast.id,
                totalRecipients: customers.length,
                message: 'Broadcast queued successfully'
            };
        } catch (error) {
            console.error('Error in sendToSegment:', error);
            return { success: false, message: error.message };
        }
    }

    // Send promotional offer
    async sendOffer(offerData, createdBy = 'admin') {
        try {
            // Create offer record
            const { data: offer, error } = await supabase
                .from('offers')
                .insert([{
                    title: offerData.title,
                    description: offerData.description,
                    discount_code: offerData.discountCode,
                    message: offerData.message,
                    expires_at: offerData.expiresAt
                }])
                .select()
                .single();

            if (error) throw error;

            // Send to all or specific segment
            const result = await this.sendToAll(offerData.message, createdBy);

            // Update offer with sent count
            await supabase
                .from('offers')
                .update({ sent_to_count: result.totalRecipients })
                .eq('id', offer.id);

            return {
                ...result,
                offerId: offer.id
            };
        } catch (error) {
            console.error('Error sending offer:', error);
            return { success: false, message: error.message };
        }
    }

    // Add messages to queue
    async addToQueue(phones, message, broadcastId) {
        for (const phone of phones) {
            this.queue.push({
                phone,
                message,
                broadcastId,
                attempts: 0
            });
        }

        // Start processing if not already running
        if (!this.isProcessing) {
            this.processQueue();
        }
    }

    // Process message queue with rate limiting
    async processQueue() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const item = this.queue.shift();

        try {
            // Send message
            await whatsappService.sendMessage(item.phone, item.message);

            // Log success
            await this.logMessage(item.phone, item.message, 'sent', 'broadcast');

            // Update broadcast stats
            await this.updateBroadcastStats(item.broadcastId, 'sent');

        } catch (error) {
            console.error(`Failed to send to ${item.phone}:`, error.message);

            // Retry logic
            if (item.attempts < 2) {
                item.attempts++;
                this.queue.push(item); // Re-queue
            } else {
                // Log failure
                await this.logMessage(item.phone, item.message, 'failed', 'broadcast');
                await this.updateBroadcastStats(item.broadcastId, 'failed');
            }
        }

        // Wait before processing next message (rate limiting)
        setTimeout(() => this.processQueue(), this.delayBetweenMessages);
    }

    // Helper methods
    async getAllCustomers() {
        const { data } = await supabase.from('customers').select('phone');
        return data || [];
    }

    async getRecentCustomers(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);

        const { data } = await supabase
            .from('customers')
            .select('phone')
            .gte('created_at', date.toISOString());

        return data || [];
    }

    async getCustomersWithOrders() {
        const { data } = await supabase
            .from('orders')
            .select('customer_phone')
            .not('customer_phone', 'is', null);

        const uniquePhones = [...new Set(data?.map(o => o.customer_phone) || [])];
        return uniquePhones.map(phone => ({ phone }));
    }

    async createBroadcastRecord(broadcastData) {
        const { data, error } = await supabase
            .from('broadcasts')
            .insert([broadcastData])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    async updateBroadcastStats(broadcastId, type) {
        if (!broadcastId) return;

        const field = type === 'sent' ? 'sent_count' : 'failed_count';

        await supabase.rpc('increment_broadcast_count', {
            broadcast_id: broadcastId,
            count_field: field
        }).catch(() => {
            // Fallback if RPC doesn't exist
            supabase
                .from('broadcasts')
                .select(field)
                .eq('id', broadcastId)
                .single()
                .then(({ data }) => {
                    const newCount = (data?.[field] || 0) + 1;
                    return supabase
                        .from('broadcasts')
                        .update({ [field]: newCount })
                        .eq('id', broadcastId);
                });
        });
    }

    async logMessage(phone, message, status, type) {
        await supabase.from('messages').insert([{
            customer_phone: phone,
            message_type: type,
            message_content: message,
            status
        }]);
    }
}

// Export singleton instance
module.exports = new BroadcastService();

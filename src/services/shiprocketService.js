const axios = require('axios');

class ShiprocketService {
    constructor() {
        this.baseURL = 'https://apiv2.shiprocket.in/v1/external';
        this.token = null;
        this.tokenExpiry = null;
    }

    // Authenticate and get token
    async authenticate() {
        try {
            // Check if direct token is provided
            if (process.env.SHIPROCKET_TOKEN) {
                console.log('⚠️  Using direct Shiprocket token (expires in 10 days)');
                this.token = process.env.SHIPROCKET_TOKEN;
                // Set expiry to 10 days from now
                this.tokenExpiry = Date.now() + (10 * 24 * 60 * 60 * 1000);
                console.log('✅ Shiprocket token loaded');
                return this.token;
            }

            // Otherwise, authenticate with email/password
            if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
                throw new Error('Shiprocket credentials not configured. Please set either SHIPROCKET_TOKEN or SHIPROCKET_EMAIL + SHIPROCKET_PASSWORD');
            }

            const response = await axios.post(`${this.baseURL}/auth/login`, {
                email: process.env.SHIPROCKET_EMAIL,
                password: process.env.SHIPROCKET_PASSWORD
            });

            this.token = response.data.token;
            // Token expires in 10 days, refresh after 9 days
            this.tokenExpiry = Date.now() + (9 * 24 * 60 * 60 * 1000);

            console.log('✅ Shiprocket authentication successful (auto-refresh enabled)');
            return this.token;
        } catch (error) {
            console.error('❌ Shiprocket authentication failed:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Shiprocket');
        }
    }

    // Ensure we have a valid token
    async ensureAuthenticated() {
        // If using direct token and it's expired, throw error
        if (process.env.SHIPROCKET_TOKEN && Date.now() >= this.tokenExpiry) {
            console.error('❌ Shiprocket token expired! Please provide a new token.');
            throw new Error('Shiprocket token expired. Please update SHIPROCKET_TOKEN in .env file');
        }

        // If using email/password, auto-refresh
        if (!this.token || Date.now() >= this.tokenExpiry) {
            await this.authenticate();
        }
    }

    // Get order tracking details by order ID
    async getOrderStatus(orderId) {
        try {
            await this.ensureAuthenticated();

            const response = await axios.get(
                `${this.baseURL}/orders/show/${orderId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return this.formatOrderStatus(response.data.data);
        } catch (error) {
            console.error('Error fetching order status:', error.response?.data || error.message);
            return null;
        }
    }

    // Get tracking details by AWB number
    async getTrackingByAWB(awb) {
        try {
            await this.ensureAuthenticated();

            const response = await axios.get(
                `${this.baseURL}/courier/track/awb/${awb}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return response.data;
        } catch (error) {
            console.error('Error fetching tracking by AWB:', error.response?.data || error.message);
            return null;
        }
    }

    // Get all orders for a customer by phone
    async getOrdersByPhone(phone) {
        try {
            await this.ensureAuthenticated();

            const response = await axios.get(
                `${this.baseURL}/orders`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        phone: phone
                    }
                }
            );

            return response.data.data || [];
        } catch (error) {
            console.error('Error fetching orders by phone:', error.response?.data || error.message);
            return [];
        }
    }

    // Format order status for display
    formatOrderStatus(orderData) {
        if (!orderData) return null;

        return {
            orderId: orderData.id,
            channelOrderId: orderData.channel_order_id,
            awb: orderData.awb_code,
            courierName: orderData.courier_name,
            status: orderData.status,
            statusCode: orderData.status_code,
            customerName: orderData.customer_name,
            customerPhone: orderData.customer_phone,
            shippingAddress: orderData.shipping_address,
            products: orderData.products,
            orderDate: orderData.created_at,
            pickupDate: orderData.pickup_scheduled_date,
            deliveredDate: orderData.delivered_date,
            expectedDelivery: orderData.etd,
            paymentMethod: orderData.payment_method,
            total: orderData.total,
            weight: orderData.weight,
            shipments: orderData.shipments || []
        };
    }

    // Get formatted tracking timeline
    async getTrackingTimeline(awb) {
        const tracking = await this.getTrackingByAWB(awb);

        if (!tracking || !tracking.tracking_data) {
            return [];
        }

        const timeline = tracking.tracking_data.shipment_track || [];

        return timeline.map(event => ({
            date: event.date,
            time: event.time,
            location: event.location,
            activity: event.activity,
            status: event.sr_status_label
        })).reverse(); // Most recent first
    }
}

// Export singleton instance
module.exports = new ShiprocketService();

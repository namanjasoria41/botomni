const shiprocketService = require('./shiprocketService');
const { supabase } = require('../database/db');

class ReturnService {
    /**
     * Create a return request
     */
    async createReturn(orderId, items, reason, customerDetails) {
        try {
            // Generate unique return ID
            const returnId = `RET-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            // Get order details from Shiprocket
            const orderDetails = await shiprocketService.getOrderDetails(orderId);
            if (!orderDetails.success) {
                throw new Error('Order not found in Shiprocket');
            }

            // Create return in Shiprocket
            const shiprocketReturn = await this.createShiprocketReturn(
                orderDetails.order,
                items,
                reason
            );

            if (!shiprocketReturn.success) {
                throw new Error('Failed to create return in Shiprocket');
            }

            // Calculate refund amount
            const refundAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            // Save return in database
            const { data: returnRecord, error } = await supabase
                .from('returns')
                .insert({
                    return_id: returnId,
                    order_id: orderId,
                    customer_phone: customerDetails.phone,
                    items: items,
                    reason: reason,
                    status: 'initiated',
                    shiprocket_return_id: shiprocketReturn.returnId,
                    refund_amount: refundAmount,
                    refund_status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;

            // Schedule pickup
            const pickup = await this.schedulePickup(
                shiprocketReturn.returnId,
                customerDetails.address,
                this.getNextPickupDate()
            );

            return {
                success: true,
                returnId: returnId,
                shiprocketReturnId: shiprocketReturn.returnId,
                pickupDate: pickup.pickupDate,
                refundAmount: refundAmount,
                message: `Return request created successfully. Pickup scheduled for ${pickup.pickupDate}.`
            };
        } catch (error) {
            console.error('Create return error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create an exchange request
     */
    async createExchange(orderId, oldItems, newItems, reason, customerDetails) {
        try {
            // Generate unique exchange ID
            const exchangeId = `EXC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

            // Calculate price difference
            const oldTotal = oldItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            const priceDifference = newTotal - oldTotal;

            // Save exchange in database
            const { data: exchangeRecord, error } = await supabase
                .from('exchanges')
                .insert({
                    exchange_id: exchangeId,
                    order_id: orderId,
                    customer_phone: customerDetails.phone,
                    old_items: oldItems,
                    new_items: newItems,
                    reason: reason,
                    price_difference: priceDifference,
                    payment_status: priceDifference > 0 ? 'pending' : 'not_required',
                    status: 'initiated'
                })
                .select()
                .single();

            if (error) throw error;

            return {
                success: true,
                exchangeId: exchangeId,
                priceDifference: priceDifference,
                paymentRequired: priceDifference > 0,
                refundDue: priceDifference < 0,
                message: priceDifference > 0
                    ? `Exchange initiated. Please pay ₹${priceDifference} to proceed.`
                    : priceDifference < 0
                        ? `Exchange initiated. You'll receive ₹${Math.abs(priceDifference)} refund.`
                        : 'Exchange initiated. No payment required.'
            };
        } catch (error) {
            console.error('Create exchange error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Complete exchange after payment
     */
    async completeExchange(exchangeId, paymentLinkId) {
        try {
            // Get exchange details
            const { data: exchange } = await supabase
                .from('exchanges')
                .select('*')
                .eq('exchange_id', exchangeId)
                .single();

            if (!exchange) {
                throw new Error('Exchange not found');
            }

            // Get order details
            const orderDetails = await shiprocketService.getOrderDetails(exchange.order_id);
            if (!orderDetails.success) {
                throw new Error('Order not found');
            }

            // Create return for old items in Shiprocket
            const shiprocketReturn = await this.createShiprocketReturn(
                orderDetails.order,
                exchange.old_items,
                exchange.reason
            );

            // Schedule pickup for old items
            const pickup = await this.schedulePickup(
                shiprocketReturn.returnId,
                orderDetails.order.pickup_location,
                this.getNextPickupDate()
            );

            // Update exchange record
            await supabase
                .from('exchanges')
                .update({
                    payment_link_id: paymentLinkId,
                    payment_status: 'completed',
                    status: 'pickup_scheduled',
                    shiprocket_exchange_id: shiprocketReturn.returnId,
                    pickup_scheduled_date: pickup.pickupDate,
                    updated_at: new Date().toISOString()
                })
                .eq('exchange_id', exchangeId);

            return {
                success: true,
                pickupDate: pickup.pickupDate,
                message: 'Exchange confirmed! Pickup scheduled for old items. New items will ship after quality check.'
            };
        } catch (error) {
            console.error('Complete exchange error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create return in Shiprocket
     */
    async createShiprocketReturn(order, items, reason) {
        try {
            const token = await shiprocketService.getToken();

            const returnData = {
                order_id: order.id,
                order_date: order.created_at,
                channel_id: order.channel_id,
                pickup_customer_name: order.customer_name,
                pickup_customer_phone: order.customer_phone,
                pickup_address: order.customer_address,
                pickup_city: order.customer_city,
                pickup_state: order.customer_state,
                pickup_pincode: order.customer_pincode,
                return_items: items.map(item => ({
                    sku: item.sku,
                    name: item.name,
                    units: item.quantity,
                    selling_price: item.price
                })),
                return_reason: reason
            };

            const response = await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/return', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(returnData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Shiprocket return creation failed');
            }

            return {
                success: true,
                returnId: result.order_id,
                awb: result.awb_code
            };
        } catch (error) {
            console.error('Shiprocket return creation error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Schedule pickup
     */
    async schedulePickup(returnId, address, pickupDate) {
        try {
            const token = await shiprocketService.getToken();

            const pickupData = {
                order_id: returnId,
                pickup_date: pickupDate
            };

            const response = await fetch('https://apiv2.shiprocket.in/v1/external/courier/assign/awb', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(pickupData)
            });

            const result = await response.json();

            return {
                success: true,
                pickupDate: pickupDate,
                awb: result.awb_code
            };
        } catch (error) {
            console.error('Pickup scheduling error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get return status
     */
    async getReturnStatus(returnId) {
        try {
            const { data: returnRecord } = await supabase
                .from('returns')
                .select('*')
                .eq('return_id', returnId)
                .single();

            if (!returnRecord) {
                throw new Error('Return not found');
            }

            return {
                success: true,
                return: returnRecord
            };
        } catch (error) {
            console.error('Get return status error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get exchange status
     */
    async getExchangeStatus(exchangeId) {
        try {
            const { data: exchangeRecord } = await supabase
                .from('exchanges')
                .select('*')
                .eq('exchange_id', exchangeId)
                .single();

            if (!exchangeRecord) {
                throw new Error('Exchange not found');
            }

            return {
                success: true,
                exchange: exchangeRecord
            };
        } catch (error) {
            console.error('Get exchange status error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if order is eligible for return/exchange
     */
    async checkEligibility(orderId) {
        try {
            const { data: order } = await supabase
                .from('orders')
                .select('*')
                .eq('order_id', orderId)
                .single();

            if (!order) {
                return {
                    eligible: false,
                    reason: 'Order not found'
                };
            }

            if (order.status !== 'delivered') {
                return {
                    eligible: false,
                    reason: 'Order must be delivered to initiate return/exchange'
                };
            }

            // Check if within 7-day window
            const deliveredDate = new Date(order.delivered_at);
            const today = new Date();
            const daysSinceDelivery = Math.floor((today - deliveredDate) / (1000 * 60 * 60 * 24));

            if (daysSinceDelivery > 7) {
                return {
                    eligible: false,
                    reason: 'Return/exchange window has expired (7 days from delivery)'
                };
            }

            return {
                eligible: true,
                daysRemaining: 7 - daysSinceDelivery,
                order: order
            };
        } catch (error) {
            console.error('Eligibility check error:', error);
            return {
                eligible: false,
                reason: 'Error checking eligibility'
            };
        }
    }

    /**
     * Get next available pickup date
     */
    getNextPickupDate() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    /**
     * Update return status
     */
    async updateReturnStatus(returnId, status, notes = {}) {
        try {
            await supabase
                .from('returns')
                .update({
                    status: status,
                    updated_at: new Date().toISOString(),
                    ...notes
                })
                .eq('return_id', returnId);

            return { success: true };
        } catch (error) {
            console.error('Update return status error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Update exchange status
     */
    async updateExchangeStatus(exchangeId, status, notes = {}) {
        try {
            await supabase
                .from('exchanges')
                .update({
                    status: status,
                    updated_at: new Date().toISOString(),
                    ...notes
                })
                .eq('exchange_id', exchangeId);

            return { success: true };
        } catch (error) {
            console.error('Update exchange status error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new ReturnService();

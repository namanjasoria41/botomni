const shiprocketService = process.env.USE_MOCK_SHIPROCKET === 'true'
    ? require('../services/mockShiprocketService')
    : require('../services/shiprocketService');
const whatsappService = require('../services/whatsappService');
const Order = require('../models/Order');
const { orderStatusMessage, orderTimelineMessage, errorMessages } = require('../utils/messageTemplates');
const { isValidOrderId, isValidAWB, extractOrderId } = require('../utils/validators');

class OrderStatusHandler {
    // Handle order status query
    async handle(phone, message) {
        try {
            // Extract order ID from message
            const orderId = extractOrderId(message);

            if (!orderId) {
                await whatsappService.sendMessage(phone, errorMessages.invalidOrderId());
                return;
            }

            // Check if it's an AWB or Order ID
            const isAWB = isValidAWB(orderId);

            let orderData;

            if (isAWB) {
                // Fetch by AWB
                orderData = await shiprocketService.getTrackingByAWB(orderId);

                if (orderData && orderData.tracking_data) {
                    const timeline = await shiprocketService.getTrackingTimeline(orderId);
                    const statusMsg = this.formatAWBStatus(orderData.tracking_data);
                    const timelineMsg = orderTimelineMessage(timeline);

                    await whatsappService.sendMessage(phone, `${statusMsg}\n\n${timelineMsg}`);
                    return;
                }
            } else {
                // Fetch by Order ID
                orderData = await shiprocketService.getOrderStatus(orderId);

                if (orderData) {
                    const statusMsg = orderStatusMessage(orderData);

                    // Get timeline if AWB exists
                    if (orderData.awb) {
                        const timeline = await shiprocketService.getTrackingTimeline(orderData.awb);
                        const timelineMsg = orderTimelineMessage(timeline);
                        await whatsappService.sendMessage(phone, `${statusMsg}\n\n${timelineMsg}`);
                    } else {
                        await whatsappService.sendMessage(phone, statusMsg);
                    }

                    // Update order in database
                    await this.updateOrderInDB(orderData, phone);
                    return;
                }
            }

            // Order not found
            await whatsappService.sendMessage(phone, errorMessages.orderNotFound(orderId));

        } catch (error) {
            console.error('Error in OrderStatusHandler:', error);
            await whatsappService.sendMessage(phone, errorMessages.apiError());
        }
    }

    // Format AWB tracking status
    formatAWBStatus(trackingData) {
        return `
📦 *Tracking Status*

*AWB:* ${trackingData.awb_code || 'N/A'}
*Current Status:* ${trackingData.current_status || 'N/A'}
*Courier:* ${trackingData.courier_name || 'N/A'}

*Shipped Date:* ${trackingData.shipped_date || 'N/A'}
*Expected Delivery:* ${trackingData.edd || 'N/A'}
`.trim();
    }

    // Update order in database
    async updateOrderInDB(orderData, phone) {
        try {
            const existingOrder = await Order.findByOrderId(orderData.channelOrderId || orderData.orderId);

            if (existingOrder) {
                // Update existing order
                await Order.updateStatus(existingOrder.order_id, orderData.status, {
                    awb: orderData.awb,
                    courier_name: orderData.courierName,
                    expected_delivery: orderData.expectedDelivery
                });
            } else {
                // Create new order
                await Order.create({
                    order_id: orderData.channelOrderId || orderData.orderId,
                    customer_phone: phone,
                    shiprocket_order_id: orderData.orderId,
                    awb: orderData.awb,
                    status: orderData.status,
                    courier_name: orderData.courierName,
                    product_name: orderData.products?.[0]?.name,
                    order_date: orderData.orderDate,
                    expected_delivery: orderData.expectedDelivery
                });
            }
        } catch (error) {
            console.error('Error updating order in DB:', error);
        }
    }
}

module.exports = new OrderStatusHandler();

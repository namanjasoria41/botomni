const shiprocketService = process.env.USE_MOCK_SHIPROCKET === 'true'
    ? require('../services/mockShiprocketService')
    : require('../services/shiprocketService');
const Customer = require('../models/Customer');
const { orderHistoryMessage, errorMessages } = require('../utils/messageTemplates');

class OrderHistoryHandler {
    // Handle order history request
    async handle(phone) {
        try {
            // Get customer's orders from database
            const orders = await Customer.getOrders(phone);

            if (!orders || orders.length === 0) {
                await whatsappService.sendMessage(phone, errorMessages.noOrders());
                return;
            }

            // Format and send order history
            const message = orderHistoryMessage(orders);
            await whatsappService.sendMessage(phone, message);

        } catch (error) {
            console.error('Error in OrderHistoryHandler:', error);
            await whatsappService.sendMessage(phone, errorMessages.apiError());
        }
    }

    // Get order details by ID
    async getOrderDetails(phone, orderId) {
        try {
            const orders = await Customer.getOrders(phone);
            const order = orders.find(o => o.order_id === orderId);

            if (!order) {
                await whatsappService.sendMessage(phone, errorMessages.orderNotFound(orderId));
                return;
            }

            // Use order status handler to show details
            const orderStatusHandler = require('./orderStatusHandler');
            await orderStatusHandler.handle(phone, orderId);

        } catch (error) {
            console.error('Error getting order details:', error);
            await whatsappService.sendMessage(phone, errorMessages.apiError());
        }
    }
}

module.exports = new OrderHistoryHandler();

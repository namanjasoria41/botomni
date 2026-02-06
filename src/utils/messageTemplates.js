// Welcome message
const welcomeMessage = (name = 'there') => `
👋 Hi ${name}! Welcome to *OffComfrt*! 🛍️

I'm your personal shopping assistant. I can help you with:
📦 Track your order status
📋 View your order history  
🎁 Get exclusive offers
❓ Get help anytime

Just send me your order ID or choose an option:
1️⃣ Check Order Status
2️⃣ View Order History
3️⃣ Help

Type the number or describe what you need!

_Experience comfort, delivered._ ✨
`.trim();

// Order status message
const orderStatusMessage = (orderData) => {
    const statusEmoji = {
        'pending': '⏳',
        'confirmed': '✅',
        'shipped': '🚚',
        'in_transit': '📍',
        'out_for_delivery': '🏃',
        'delivered': '✅',
        'cancelled': '❌',
        'returned': '↩️'
    };

    const emoji = statusEmoji[orderData.status?.toLowerCase()] || '📦';

    let message = `
${emoji} *Order Status*

*Order ID:* ${orderData.channelOrderId || orderData.orderId}
*Status:* ${orderData.status}
${orderData.awb ? `*AWB:* ${orderData.awb}` : ''}
${orderData.courierName ? `*Courier:* ${orderData.courierName}` : ''}

📅 *Order Date:* ${formatDate(orderData.orderDate)}
${orderData.expectedDelivery ? `🕐 *Expected Delivery:* ${formatDate(orderData.expectedDelivery)}` : ''}
${orderData.deliveredDate ? `✅ *Delivered On:* ${formatDate(orderData.deliveredDate)}` : ''}
`.trim();

    return message;
};

// Order timeline message
const orderTimelineMessage = (timeline) => {
    if (!timeline || timeline.length === 0) {
        return '📍 No tracking updates available yet.';
    }

    let message = '📍 *Tracking Timeline*\n\n';

    timeline.slice(0, 5).forEach((event, index) => {
        const isLatest = index === 0;
        const marker = isLatest ? '🔵' : '⚪';

        message += `${marker} *${event.activity}*\n`;
        message += `   📅 ${event.date} ${event.time}\n`;
        if (event.location) {
            message += `   📍 ${event.location}\n`;
        }
        message += '\n';
    });

    if (timeline.length > 5) {
        message += `_...and ${timeline.length - 5} more updates_`;
    }

    return message.trim();
};

// Order history list message
const orderHistoryMessage = (orders) => {
    if (!orders || orders.length === 0) {
        return '📋 No previous orders found.\n\nPlace your first order and I\'ll help you track it!';
    }

    let message = '📋 *Your Order History*\n\n';

    orders.slice(0, 10).forEach((order, index) => {
        const statusEmoji = order.status === 'delivered' ? '✅' : '📦';
        message += `${index + 1}. ${statusEmoji} Order #${order.order_id}\n`;
        message += `   Status: ${order.status}\n`;
        message += `   Date: ${formatDate(order.order_date)}\n\n`;
    });

    if (orders.length > 10) {
        message += `_...and ${orders.length - 10} more orders_\n\n`;
    }

    message += 'Send me an order ID to see details!';

    return message.trim();
};

// Error messages
const errorMessages = {
    orderNotFound: (orderId) => `
❌ Sorry, I couldn't find order #${orderId}

Please check:
• Order ID is correct
• Order exists in our system

Need help? Type "help" or contact support@offcomfrt.in

_OffComfrt - We've got you covered._ ✨
`.trim(),

    invalidOrderId: () => `
❌ That doesn't look like a valid order ID.

Please send:
• Your order number (e.g., 12345)
• AWB tracking number

Or type "help" for more options.
`.trim(),

    apiError: () => `
⚠️ Oops! Something went wrong on our end.

Please try again in a moment. If the issue persists, contact our support team.
`.trim(),

    noOrders: () => `
📋 You don't have any orders with OffComfrt yet.

Ready to experience ultimate comfort? 🛍️
Visit www.offcomfrt.in to shop now!

Once you place an order, I'll help you track it!
`.trim()
};

// Help message
const helpMessage = () => `
❓ *OffComfrt Support - How can I help?*

*To check order status:*
Send your order ID or AWB tracking number

*To view order history:*
Type "orders" or "history"

*Available commands:*
• "status" - Check order status
• "orders" - View all orders  
• "help" - Show this message

*Need human support?*
📧 Email: support@offcomfrt.in
🌐 Website: www.offcomfrt.in

I'm here 24/7 to help! 🤖

_Your comfort is our priority._ ✨
`.trim();

// Broadcast/Offer message template
const broadcastMessage = (title, content) => `
📢 *${title}*

${content}

---
Reply STOP to unsubscribe from promotional messages.
`.trim();

// Helper function to format dates
function formatDate(dateString) {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };

    return date.toLocaleDateString('en-IN', options);
}

module.exports = {
    welcomeMessage,
    orderStatusMessage,
    orderTimelineMessage,
    orderHistoryMessage,
    errorMessages,
    helpMessage,
    broadcastMessage,
    formatDate
};

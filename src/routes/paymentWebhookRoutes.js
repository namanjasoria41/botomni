const express = require('express');
const router = express.Router();
const razorpayService = require('../services/razorpayService');
const returnService = require('../services/returnService');
const whatsappService = require('../services/whatsappService');
const { supabase } = require('../database/db');

/**
 * Razorpay Payment Webhook
 */
router.post('/razorpay', async (req, res) => {
    try {
        const webhookSignature = req.headers['x-razorpay-signature'];
        const webhookBody = req.body;

        // Verify signature
        const isValid = razorpayService.verifyWebhookSignature(webhookBody, webhookSignature);

        if (!isValid) {
            console.error('Invalid Razorpay webhook signature');
            return res.status(400).json({ error: 'Invalid signature' });
        }

        const event = webhookBody.event;
        const payload = webhookBody.payload.payment.entity;

        console.log('Razorpay webhook event:', event);

        // Handle payment success
        if (event === 'payment.captured') {
            await handlePaymentSuccess(payload);
        }

        // Handle payment failure
        if (event === 'payment.failed') {
            await handlePaymentFailure(payload);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Razorpay webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * Shiprocket Return Status Webhook
 */
router.post('/shiprocket/return', async (req, res) => {
    try {
        const webhookData = req.body;
        console.log('Shiprocket return webhook:', webhookData);

        const { order_id, status, awb } = webhookData;

        // Find return by Shiprocket order ID
        const { data: returnRecord } = await supabase
            .from('returns')
            .select('*')
            .eq('shiprocket_return_id', order_id)
            .single();

        if (returnRecord) {
            // Update return status
            await returnService.updateReturnStatus(returnRecord.return_id, status);

            // Notify customer
            await notifyCustomerReturnStatus(returnRecord, status);
        }

        // Check for exchange
        const { data: exchangeRecord } = await supabase
            .from('exchanges')
            .select('*')
            .eq('shiprocket_exchange_id', order_id)
            .single();

        if (exchangeRecord) {
            // Update exchange status
            await returnService.updateExchangeStatus(exchangeRecord.exchange_id, status);

            // Notify customer
            await notifyCustomerExchangeStatus(exchangeRecord, status);
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Shiprocket webhook error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
    }
});

/**
 * Handle successful payment
 */
async function handlePaymentSuccess(payment) {
    try {
        const orderId = payment.notes.order_id;
        const paymentId = payment.id;

        console.log('Payment successful for order:', orderId);

        // Find exchange by order ID
        const { data: exchange } = await supabase
            .from('exchanges')
            .select('*')
            .eq('order_id', orderId)
            .eq('payment_status', 'pending')
            .single();

        if (exchange) {
            // Complete the exchange
            const result = await returnService.completeExchange(
                exchange.exchange_id,
                exchange.payment_link_id
            );

            if (result.success) {
                // Notify customer
                const message = `✅ *Payment Received!*\n\n💳 Payment ID: ${paymentId}\n🔄 Exchange ID: ${exchange.exchange_id}\n\n📅 Pickup scheduled for: ${result.pickupDate}\n\n📦 Next Steps:\n1. Keep old items ready\n2. Courier will pick up on ${result.pickupDate}\n3. New items ship after quality check\n\nTrack status: Reply "exchange status ${exchange.exchange_id}"`;

                await whatsappService.sendMessage(exchange.customer_phone, message);
            }
        }
    } catch (error) {
        console.error('Payment success handler error:', error);
    }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailure(payment) {
    try {
        const orderId = payment.notes.order_id;

        console.log('Payment failed for order:', orderId);

        // Find exchange
        const { data: exchange } = await supabase
            .from('exchanges')
            .select('*')
            .eq('order_id', orderId)
            .eq('payment_status', 'pending')
            .single();

        if (exchange) {
            // Notify customer
            const message = `❌ *Payment Failed*\n\n🔄 Exchange ID: ${exchange.exchange_id}\n\nYour payment could not be processed. Please try again or contact support.\n\nReason: ${payment.error_description || 'Payment declined'}`;

            await whatsappService.sendMessage(exchange.customer_phone, message);
        }
    } catch (error) {
        console.error('Payment failure handler error:', error);
    }
}

/**
 * Notify customer of return status update
 */
async function notifyCustomerReturnStatus(returnRecord, status) {
    try {
        const statusMessages = {
            'pickup_scheduled': `📅 *Pickup Scheduled*\n\nYour return pickup is scheduled. Please keep items ready with original packaging.`,
            'picked_up': `📦 *Items Picked Up*\n\nYour return items have been picked up and are on their way to our warehouse.`,
            'delivered_to_warehouse': `🏭 *Received at Warehouse*\n\nYour items have reached our warehouse. Quality check in progress.`,
            'qc_passed': `✅ *Quality Check Passed*\n\nYour return has been approved. Refund will be processed within 3-5 business days.`,
            'qc_failed': `❌ *Quality Check Failed*\n\nYour return could not be approved. Items will be sent back to you. Please contact support for details.`,
            'refund_processed': `💰 *Refund Processed*\n\nYour refund of ₹${returnRecord.refund_amount} has been initiated. It will reflect in your account within 5-7 business days.`,
            'completed': `✅ *Return Completed*\n\nYour return has been successfully completed. Thank you!`
        };

        const message = statusMessages[status];
        if (message) {
            const fullMessage = `🔄 Return ID: ${returnRecord.return_id}\n\n${message}`;
            await whatsappService.sendMessage(returnRecord.customer_phone, fullMessage);
        }
    } catch (error) {
        console.error('Return notification error:', error);
    }
}

/**
 * Notify customer of exchange status update
 */
async function notifyCustomerExchangeStatus(exchangeRecord, status) {
    try {
        const statusMessages = {
            'pickup_scheduled': `📅 *Pickup Scheduled*\n\nYour exchange pickup is scheduled. Please keep old items ready.`,
            'picked_up': `📦 *Items Picked Up*\n\nYour old items have been picked up. Quality check in progress.`,
            'qc_passed': `✅ *Quality Check Passed*\n\nYour exchange has been approved. New items will be shipped shortly!`,
            'qc_failed': `❌ *Quality Check Failed*\n\nYour exchange could not be approved. Please contact support.`,
            'new_order_created': `📦 *New Order Created*\n\nYour new items have been shipped! You'll receive tracking details soon.`,
            'completed': `✅ *Exchange Completed*\n\nYour exchange has been successfully completed. Enjoy your new items!`
        };

        const message = statusMessages[status];
        if (message) {
            const fullMessage = `🔄 Exchange ID: ${exchangeRecord.exchange_id}\n\n${message}`;
            await whatsappService.sendMessage(exchangeRecord.customer_phone, fullMessage);
        }
    } catch (error) {
        console.error('Exchange notification error:', error);
    }
}

/**
 * Payment callback (for redirect after payment)
 */
router.get('/payment/callback', async (req, res) => {
    const { razorpay_payment_id, razorpay_payment_link_id } = req.query;

    if (razorpay_payment_id) {
        res.send(`
            <html>
                <head>
                    <title>Payment Successful</title>
                    <style>
                        body { font-family: Arial; text-align: center; padding: 50px; }
                        .success { color: #28a745; font-size: 24px; margin: 20px; }
                        .info { color: #666; margin: 10px; }
                    </style>
                </head>
                <body>
                    <h1 class="success">✅ Payment Successful!</h1>
                    <p class="info">Your exchange request is being processed.</p>
                    <p class="info">You'll receive updates on WhatsApp.</p>
                    <p class="info">Payment ID: ${razorpay_payment_id}</p>
                </body>
            </html>
        `);
    } else {
        res.send(`
            <html>
                <head>
                    <title>Payment Failed</title>
                    <style>
                        body { font-family: Arial; text-align: center; padding: 50px; }
                        .error { color: #dc3545; font-size: 24px; margin: 20px; }
                        .info { color: #666; margin: 10px; }
                    </style>
                </head>
                <body>
                    <h1 class="error">❌ Payment Failed</h1>
                    <p class="info">Your payment could not be processed.</p>
                    <p class="info">Please try again or contact support.</p>
                </body>
            </html>
        `);
    }
});

module.exports = router;

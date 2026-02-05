const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const broadcastService = require('../services/broadcastService');
const { supabase } = require('../database/db');

// Admin login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check credentials (in production, hash password and store in DB)
        if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
            // Generate JWT token
            const token = jwt.sign(
                { username, role: 'admin' },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({
                success: true,
                token,
                username
            });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get dashboard statistics
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const [customerCount, orderCount, messagesCount] = await Promise.all([
            Customer.getCount(),
            Order.getCount(),
            getMessageCount()
        ]);

        // Get today's messages
        const todayMessages = await getTodayMessageCount();

        // Get recent broadcasts
        const { data: recentBroadcasts } = await supabase
            .from('broadcasts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        res.json({
            success: true,
            stats: {
                totalCustomers: customerCount,
                totalOrders: orderCount,
                totalMessages: messagesCount,
                todayMessages,
                recentBroadcasts: recentBroadcasts || []
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Get all customers
router.get('/customers', verifyToken, async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;
        const customers = await Customer.getAll(parseInt(limit), parseInt(offset));

        res.json({
            success: true,
            customers
        });
    } catch (error) {
        console.error('Customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get customer details
router.get('/customers/:phone', verifyToken, async (req, res) => {
    try {
        const { phone } = req.params;
        const customer = await Customer.findByPhone(phone);

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const orders = await Customer.getOrders(phone);

        res.json({
            success: true,
            customer,
            orders
        });
    } catch (error) {
        console.error('Customer details error:', error);
        res.status(500).json({ error: 'Failed to fetch customer details' });
    }
});

// Send broadcast to all
router.post('/broadcast', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await broadcastService.sendToAll(message, req.admin.username);

        res.json(result);
    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

// Send broadcast to segment
router.post('/broadcast/segment', verifyToken, async (req, res) => {
    try {
        const { message, segment } = req.body;

        if (!message || !segment) {
            return res.status(400).json({ error: 'Message and segment are required' });
        }

        const result = await broadcastService.sendToSegment(message, segment, req.admin.username);

        res.json(result);
    } catch (error) {
        console.error('Segment broadcast error:', error);
        res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

// Create and send offer
router.post('/offers', verifyToken, async (req, res) => {
    try {
        const { title, description, discountCode, message, expiresAt } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: 'Title and message are required' });
        }

        const result = await broadcastService.sendOffer({
            title,
            description,
            discountCode,
            message,
            expiresAt
        }, req.admin.username);

        res.json(result);
    } catch (error) {
        console.error('Offer error:', error);
        res.status(500).json({ error: 'Failed to send offer' });
    }
});

// Get message history
router.get('/messages', verifyToken, async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const { data: messages, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) throw error;

        res.json({
            success: true,
            messages: messages || []
        });
    } catch (error) {
        console.error('Messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Get analytics
router.get('/analytics', verifyToken, async (req, res) => {
    try {
        // Get message stats by type
        const { data: messageStats } = await supabase
            .from('messages')
            .select('message_type, created_at');

        // Get order stats by status
        const { data: orderStats } = await supabase
            .from('orders')
            .select('status, created_at');

        // Process data for charts
        const analytics = {
            messagesByType: processMessagesByType(messageStats || []),
            ordersByStatus: processOrdersByStatus(orderStats || []),
            messagesOverTime: processMessagesOverTime(messageStats || [])
        };

        res.json({
            success: true,
            analytics
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Helper functions
async function getMessageCount() {
    const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });
    return count || 0;
}

async function getTodayMessageCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

    return count || 0;
}

function processMessagesByType(messages) {
    const counts = {};
    messages.forEach(msg => {
        counts[msg.message_type] = (counts[msg.message_type] || 0) + 1;
    });
    return counts;
}

function processOrdersByStatus(orders) {
    const counts = {};
    orders.forEach(order => {
        counts[order.status] = (counts[order.status] || 0) + 1;
    });
    return counts;
}

function processMessagesOverTime(messages) {
    const last7Days = {};
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days[dateStr] = 0;
    }

    messages.forEach(msg => {
        const dateStr = msg.created_at.split('T')[0];
        if (last7Days.hasOwnProperty(dateStr)) {
            last7Days[dateStr]++;
        }
    });

    return last7Days;
}

module.exports = router;

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

        // Get today's active customers
        const activeToday = await getActiveTodayCount();

        // Calculate growth percentages
        const customersGrowth = await calculateGrowth('customers');
        const ordersGrowth = await calculateGrowth('orders');
        const messagesGrowth = await calculateGrowth('messages');

        res.json({
            success: true,
            stats: {
                totalCustomers: customerCount,
                totalOrders: orderCount,
                totalMessages: messagesCount,
                activeToday,
                customersGrowth,
                ordersGrowth,
                messagesGrowth,
                activeGrowth: 0
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

// Get recent activity
router.get('/activity/recent', verifyToken, async (req, res) => {
    try {
        const { data: recentMessages } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        const activity = (recentMessages || []).map(msg => ({
            title: `Message from ${msg.customer_phone}`,
            description: msg.message_content.substring(0, 50) + '...',
            created_at: msg.created_at
        }));

        res.json({ success: true, activity });
    } catch (error) {
        console.error('Activity error:', error);
        res.status(500).json({ error: 'Failed to fetch activity' });
    }
});

// Get analytics charts data
router.get('/analytics/charts', verifyToken, async (req, res) => {
    try {
        // Message volume (last 7 days)
        const messageVolume = await getMessageVolume();

        // Order status distribution
        const orderStatus = await getOrderStatusDistribution();

        res.json({
            success: true,
            messageVolume,
            orderStatus
        });
    } catch (error) {
        console.error('Charts error:', error);
        res.status(500).json({ error: 'Failed to fetch charts' });
    }
});

// Get detailed analytics
router.get('/analytics/detailed', verifyToken, async (req, res) => {
    try {
        // FAQ analytics (mock data - implement based on your FAQ tracking)
        const faqData = {
            labels: ['Returns', 'Shipping', 'Payment', 'Sizing', 'Tracking'],
            values: [45, 38, 32, 28, 25]
        };

        // Customer growth trend
        const growthData = await getCustomerGrowth();

        res.json({
            success: true,
            faqData,
            growthData
        });
    } catch (error) {
        console.error('Detailed analytics error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// Get all customers with stats
router.get('/customers', verifyToken, async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        // Get customers with order and message counts
        const { data: customers, error } = await supabase
            .from('customers')
            .select(`
                *,
                orders:orders(count),
                messages:messages(count)
            `)
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) throw error;

        // Format the data
        const formattedCustomers = (customers || []).map(c => ({
            ...c,
            order_count: c.orders?.[0]?.count || 0,
            message_count: c.messages?.[0]?.count || 0
        }));

        res.json({
            success: true,
            customers: formattedCustomers
        });
    } catch (error) {
        console.error('Customers error:', error);
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Get customer details
router.get('/customers/:phone/details', verifyToken, async (req, res) => {
    try {
        const { phone } = req.params;

        // Get customer
        const { data: customer } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', phone)
            .single();

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get orders
        const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .eq('customer_phone', phone)
            .order('created_at', { ascending: false })
            .limit(10);

        // Get message count
        const { count: messageCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('customer_phone', phone);

        res.json({
            success: true,
            customer: {
                ...customer,
                order_count: orders?.length || 0,
                message_count: messageCount || 0,
                orders: orders || []
            }
        });
    } catch (error) {
        console.error('Customer details error:', error);
        res.status(500).json({ error: 'Failed to fetch customer details' });
    }
});

// Get all orders
router.get('/orders', verifyToken, async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;

        const { data: orders, error } = await supabase
            .from('orders')
            .select(`
                *,
                customers!inner(name)
            `)
            .order('created_at', { ascending: false })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) throw error;

        const formattedOrders = (orders || []).map(o => ({
            ...o,
            customer_name: o.customers?.name
        }));

        res.json({
            success: true,
            orders: formattedOrders
        });
    } catch (error) {
        console.error('Orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Send broadcast
router.post('/broadcast/send', verifyToken, async (req, res) => {
    try {
        const { message, segment } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        let result;
        if (segment === 'all') {
            result = await broadcastService.sendToAll(message, req.admin.username);
        } else {
            result = await broadcastService.sendToSegment(message, segment, req.admin.username);
        }

        res.json(result);
    } catch (error) {
        console.error('Broadcast error:', error);
        res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

// Get broadcast recipient count
router.get('/broadcast/count', verifyToken, async (req, res) => {
    try {
        const { segment } = req.query;
        let count = 0;

        if (segment === 'all') {
            count = await Customer.getCount();
        } else if (segment === 'active') {
            // Active in last 7 days
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const { count: activeCount } = await supabase
                .from('messages')
                .select('customer_phone', { count: 'exact', head: true })
                .gte('created_at', sevenDaysAgo.toISOString());

            count = activeCount || 0;
        } else if (segment === 'recent') {
            // Recent in last 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { count: recentCount } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', thirtyDaysAgo.toISOString());

            count = recentCount || 0;
        }

        res.json({ success: true, count });
    } catch (error) {
        console.error('Count error:', error);
        res.status(500).json({ error: 'Failed to get count' });
    }
});

// Get broadcast history
router.get('/broadcast/history', verifyToken, async (req, res) => {
    try {
        const { data: broadcasts, error } = await supabase
            .from('broadcasts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        res.json({
            success: true,
            broadcasts: broadcasts || []
        });
    } catch (error) {
        console.error('Broadcast history error:', error);
        res.status(500).json({ error: 'Failed to fetch broadcast history' });
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

async function getActiveTodayCount() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: activeCustomers } = await supabase
        .from('messages')
        .select('customer_phone')
        .gte('created_at', today.toISOString());

    const uniqueCustomers = new Set(activeCustomers?.map(m => m.customer_phone) || []);
    return uniqueCustomers.size;
}

async function calculateGrowth(table) {
    try {
        const now = new Date();
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        const { count: thisWeek } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .gte('created_at', lastWeek.toISOString());

        const { count: previousWeek } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
            .gte('created_at', twoWeeksAgo.toISOString())
            .lt('created_at', lastWeek.toISOString());

        if (!previousWeek) return 0;
        return Math.round(((thisWeek - previousWeek) / previousWeek) * 100);
    } catch (error) {
        return 0;
    }
}

async function getMessageVolume() {
    const labels = [];
    const values = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        labels.push(date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));

        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', date.toISOString())
            .lt('created_at', nextDay.toISOString());

        values.push(count || 0);
    }

    return { labels, values };
}

async function getOrderStatusDistribution() {
    const { data: orders } = await supabase
        .from('orders')
        .select('status');

    const statusCounts = {};
    (orders || []).forEach(order => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
    });

    return {
        labels: Object.keys(statusCounts),
        values: Object.values(statusCounts)
    };
}

async function getCustomerGrowth() {
    const labels = [];
    const values = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);

        labels.push(date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }));

        const { count } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .lte('created_at', date.toISOString());

        values.push(count || 0);
    }

    return { labels, values };
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

// ===================================
// Returns & Exchanges Endpoints
// ===================================

// Get all returns
router.get('/returns', verifyToken, async (req, res) => {
    try {
        const { data: returns, error } = await supabase
            .from('returns')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            returns: returns || []
        });
    } catch (error) {
        console.error('Error fetching returns:', error);
        res.status(500).json({ error: 'Failed to fetch returns' });
    }
});

// Get all exchanges
router.get('/exchanges', verifyToken, async (req, res) => {
    try {
        const { data: exchanges, error } = await supabase
            .from('exchanges')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            exchanges: exchanges || []
        });
    } catch (error) {
        console.error('Error fetching exchanges:', error);
        res.status(500).json({ error: 'Failed to fetch exchanges' });
    }
});

module.exports = router;

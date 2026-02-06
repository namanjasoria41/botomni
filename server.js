require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const messageHandler = require('./src/handlers/messageHandler');
const adminRoutes = require('./src/routes/adminRoutes');
const { testConnection, initializeDatabase } = require('./src/database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files (admin dashboard)
app.use(express.static(path.join(__dirname, 'public')));

// Admin API routes
app.use('/api/admin', adminRoutes);

// WhatsApp webhook verification (Meta Cloud API)
app.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
            console.log('✅ Webhook verified');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// WhatsApp webhook - receive messages
app.post('/webhook', async (req, res) => {
    try {
        const body = req.body;

        // Check if it's a WhatsApp message
        if (body.object === 'whatsapp_business_account') {
            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            if (value?.messages) {
                const message = value.messages[0];
                const from = message.from; // Phone number
                const messageId = message.id;

                // Get sender name if available
                const senderName = value.contacts?.[0]?.profile?.name;

                // Handle different message types
                let messageBody;

                // Check for interactive button response
                if (message.interactive) {
                    if (message.interactive.type === 'button_reply') {
                        const buttonId = message.interactive.button_reply.id;
                        messageBody = this.handleButtonResponse(buttonId);
                    } else if (message.interactive.type === 'list_reply') {
                        const listId = message.interactive.list_reply.id;
                        messageBody = this.handleButtonResponse(listId);
                    }
                } else if (message.text?.body) {
                    messageBody = message.text.body;
                }

                if (messageBody) {
                    console.log(`📨 Message from ${from}: ${messageBody}`);

                    // Process message asynchronously
                    messageHandler.processMessage(from, messageBody, senderName)
                        .catch(err => console.error('Error processing message:', err));
                }

                // Acknowledge receipt immediately
                res.sendStatus(200);
            } else {
                res.sendStatus(200);
            }
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error('Webhook error:', error);
        res.sendStatus(500);
    }
});

// Helper function to convert button IDs to commands
function handleButtonResponse(buttonId) {
    const buttonMap = {
        'track_order': 'status',
        'order_history': 'history',
        'get_help': 'help',
        'contact_support': 'help'
    };

    return buttonMap[buttonId] || buttonId;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// Serve admin dashboard
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard', 'index.html'));
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Start server
async function startServer() {
    try {
        // Test database connection
        console.log('🔄 Testing database connection...');
        const dbConnected = await testConnection();

        if (!dbConnected) {
            console.error('❌ Database connection failed. Please check your Supabase credentials.');
            process.exit(1);
        }

        // Initialize database tables
        console.log('🔄 Initializing database...');
        await initializeDatabase();

        // Start Express server
        app.listen(PORT, () => {
            console.log('');
            console.log('🚀 WhatsApp Order Bot Server Started!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`📡 Server running on port ${PORT}`);
            console.log(`🌐 Webhook URL: ${process.env.WEBHOOK_URL || `http://localhost:${PORT}`}/webhook`);
            console.log(`👨‍💼 Admin Dashboard: http://localhost:${PORT}/admin`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT signal received: closing HTTP server');
    process.exit(0);
});

// Start the server
startServer();

// Validate order ID format
function isValidOrderId(orderId) {
    if (!orderId) return false;

    // Remove whitespace
    const cleaned = orderId.trim();

    // Check if it's a number or alphanumeric
    // Most order IDs are numeric or alphanumeric with length 4-20
    const pattern = /^[a-zA-Z0-9-_]{4,20}$/;

    return pattern.test(cleaned);
}

// Validate AWB number
function isValidAWB(awb) {
    if (!awb) return false;

    // AWB numbers are typically 10-15 digits
    const cleaned = awb.trim().replace(/\s/g, '');
    const pattern = /^[0-9]{10,15}$/;

    return pattern.test(cleaned);
}

// Validate phone number
function isValidPhone(phone) {
    if (!phone) return false;

    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // Check if it's 10 digits (Indian) or 12 digits (with country code)
    return cleaned.length === 10 || cleaned.length === 12;
}

// Validate email
function isValidEmail(email) {
    if (!email) return false;

    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}

// Extract order ID from message
function extractOrderId(message) {
    if (!message) return null;

    // Remove common prefixes
    const cleaned = message
        .toLowerCase()
        .replace(/order\s*(id|number|#)?\s*:?\s*/gi, '')
        .replace(/awb\s*:?\s*/gi, '')
        .trim();

    // Extract first valid-looking order ID
    const matches = cleaned.match(/[a-zA-Z0-9-_]{4,20}/);

    return matches ? matches[0] : null;
}

// Sanitize user input
function sanitizeInput(input) {
    if (!input) return '';

    return input
        .trim()
        .replace(/[<>]/g, '') // Remove potential HTML tags
        .substring(0, 1000); // Limit length
}

// Check if message is a command
function isCommand(message) {
    const commands = ['help', 'orders', 'history', 'status', 'start', 'stop'];
    const cleaned = message.toLowerCase().trim();

    return commands.includes(cleaned) || /^[1-4]$/.test(cleaned);
}

// Parse command from message
function parseCommand(message) {
    const cleaned = message.toLowerCase().trim();

    const commandMap = {
        'help': 'help',
        '3': 'help',
        'orders': 'history',
        'history': 'history',
        '2': 'history',
        'status': 'status',
        'track': 'status',
        '1': 'status',
        'start': 'welcome',
        'hi': 'welcome',
        'hello': 'welcome',
        'stop': 'unsubscribe'
    };

    return commandMap[cleaned] || null;
}

module.exports = {
    isValidOrderId,
    isValidAWB,
    isValidPhone,
    isValidEmail,
    extractOrderId,
    sanitizeInput,
    isCommand,
    parseCommand
};

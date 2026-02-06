const whatsappService = require('../services/whatsappService');

class FAQHandler {
    constructor() {
        // FAQ database with keywords and responses
        this.faqs = [
            {
                keywords: ['return', 'refund', 'money back', 'return policy'],
                question: 'What is your return policy?',
                answer: `🔄 *OffComfrt Return Policy*

✅ *Easy Returns within 7 days*

We accept returns if:
• Product is unused and in original packaging
• Tags are intact
• No damage or alterations

*How to return:*
1. Type "return" and your order ID
2. We'll arrange free pickup
3. Refund within 5-7 business days

*Non-returnable:*
• Innerwear & socks
• Sale items (unless defective)

Questions? Contact support@offcomfrt.in`
            },
            {
                keywords: ['exchange', 'size change', 'wrong size', 'different size'],
                question: 'Can I exchange my order?',
                answer: `🔄 *Size Exchange*

Yes! We offer FREE size exchanges within 7 days.

*How it works:*
1. Request exchange with order ID
2. We pick up the item
3. New size delivered within 3-5 days

*Note:* Exchange subject to stock availability

Need help with sizing? Type "size guide"`
            },
            {
                keywords: ['shipping', 'delivery', 'how long', 'when will i get', 'delivery time'],
                question: 'How long does shipping take?',
                answer: `🚚 *Shipping & Delivery*

*Delivery Timeline:*
• Metro cities: 2-3 business days
• Other cities: 4-6 business days
• Remote areas: 6-8 business days

*Shipping Charges:*
• FREE on orders above ₹999
• ₹99 for orders below ₹999

*Track your order:*
Just send me your order ID!

*International shipping:*
Currently not available`
            },
            {
                keywords: ['payment', 'pay', 'cod', 'cash on delivery', 'payment methods', 'upi'],
                question: 'What payment methods do you accept?',
                answer: `💳 *Payment Methods*

We accept:
✅ Credit/Debit Cards
✅ UPI (GPay, PhonePe, Paytm)
✅ Net Banking
✅ Wallets (Paytm, Mobikwik)
✅ Cash on Delivery (COD)

*COD Available:*
• Orders up to ₹5,000
• ₹50 COD charges apply

*100% Secure Payments*
All transactions are encrypted and secure.

Shop now: www.offcomfrt.in`
            },
            {
                keywords: ['size', 'sizing', 'what size', 'size chart', 'measurements'],
                question: 'How do I choose my size?',
                answer: `📏 *Size Guide*

I can help you find your perfect size!

*Quick Size Check:*
Type "size guide" for detailed measurements

*General Guide:*
• S: Chest 36-38"
• M: Chest 38-40"
• L: Chest 40-42"
• XL: Chest 42-44"
• XXL: Chest 44-46"

*Fit Types:*
• Regular Fit - True to size
• Slim Fit - Size up for comfort
• Oversized - Size down for fitted look

Need personalized help? Type "size guide"`
            },
            {
                keywords: ['quality', 'material', 'fabric', 'cotton', 'what is it made of'],
                question: 'What is the quality of your products?',
                answer: `✨ *Premium Quality Guaranteed*

*Our Promise:*
• 100% Premium Cotton
• Pre-shrunk fabric
• Colorfast dyes
• Reinforced stitching
• Quality checked

*Certifications:*
• OEKO-TEX certified
• Eco-friendly materials
• Sustainable production

*Care Instructions:*
• Machine wash cold
• Tumble dry low
• Iron if needed

*Quality Guarantee:*
Defective products? Full refund or replacement!

_Experience comfort, delivered._ ✨`
            },
            {
                keywords: ['track', 'tracking', 'where is my order', 'order status', 'awb'],
                question: 'How can I track my order?',
                answer: `📦 *Track Your Order*

Super easy! Just send me:
• Your Order ID (e.g., ORD-2024-001)
• Or AWB tracking number

I'll show you:
✅ Current status
✅ Location
✅ Expected delivery
✅ Complete timeline

*Don't have your order ID?*
Type "orders" to see all your orders

Try it now!`
            },
            {
                keywords: ['cancel', 'cancellation', 'cancel order', 'dont want'],
                question: 'Can I cancel my order?',
                answer: `❌ *Order Cancellation*

*Before Shipping:*
✅ Yes! Free cancellation
• Instant refund
• No questions asked

*After Shipping:*
• Cannot cancel
• You can return after delivery

*How to cancel:*
1. Send your order ID
2. Type "cancel"
3. Refund in 3-5 business days

*Need help?*
Contact: support@offcomfrt.in`
            },
            {
                keywords: ['discount', 'offer', 'coupon', 'promo code', 'sale'],
                question: 'Do you have any offers?',
                answer: `🎁 *Current Offers*

*Active Deals:*
• First Order: 10% OFF (Code: FIRST10)
• Orders above ₹1999: 15% OFF
• Free shipping on ₹999+

*Upcoming Sales:*
Subscribe to get notified!

*Loyalty Program:*
Earn points on every purchase
Redeem for discounts

*Want exclusive offers?*
We'll send you personalized deals!

Shop now: www.offcomfrt.in`
            },
            {
                keywords: ['contact', 'support', 'help', 'customer care', 'phone number', 'email'],
                question: 'How can I contact support?',
                answer: `💬 *Contact OffComfrt Support*

*We're here to help!*

📧 Email: support@offcomfrt.in
🌐 Website: www.offcomfrt.in
💬 WhatsApp: Right here! (24/7)

*Response Time:*
• WhatsApp: Instant
• Email: Within 24 hours

*Office Hours:*
Mon-Sat: 10 AM - 7 PM IST
Sunday: Closed

*I can help you with:*
• Order tracking
• Returns & exchanges
• Product questions
• Size guidance

How can I help you today?`
            }
        ];
    }

    // Check if message matches any FAQ
    matchFAQ(message) {
        const lowerMessage = message.toLowerCase();

        for (const faq of this.faqs) {
            for (const keyword of faq.keywords) {
                if (lowerMessage.includes(keyword)) {
                    return faq;
                }
            }
        }

        return null;
    }

    // Handle FAQ query
    async handle(phone, message) {
        const matchedFAQ = this.matchFAQ(message);

        if (matchedFAQ) {
            await whatsappService.sendMessage(phone, matchedFAQ.answer);
            return true;
        }

        return false;
    }

    // Get all FAQs for help menu
    getAllFAQs() {
        return this.faqs.map(faq => faq.question);
    }
}

module.exports = new FAQHandler();

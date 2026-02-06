const whatsappService = require('../services/whatsappService');

class SizeGuideHandler {
    constructor() {
        // Size chart data
        this.sizeChart = {
            tshirts: {
                name: 'T-Shirts & Polos',
                sizes: {
                    'XS': { chest: '34-36', length: '26', shoulder: '16' },
                    'S': { chest: '36-38', length: '27', shoulder: '17' },
                    'M': { chest: '38-40', length: '28', shoulder: '18' },
                    'L': { chest: '40-42', length: '29', shoulder: '19' },
                    'XL': { chest: '42-44', length: '30', shoulder: '20' },
                    'XXL': { chest: '44-46', length: '31', shoulder: '21' }
                }
            },
            shirts: {
                name: 'Shirts',
                sizes: {
                    'S': { chest: '38', length: '28', shoulder: '17', sleeve: '24' },
                    'M': { chest: '40', length: '29', shoulder: '18', sleeve: '24.5' },
                    'L': { chest: '42', length: '30', shoulder: '19', sleeve: '25' },
                    'XL': { chest: '44', length: '31', shoulder: '20', sleeve: '25.5' },
                    'XXL': { chest: '46', length: '32', shoulder: '21', sleeve: '26' }
                }
            },
            jeans: {
                name: 'Jeans & Trousers',
                sizes: {
                    '28': { waist: '28', length: '39', hip: '36' },
                    '30': { waist: '30', length: '39', hip: '38' },
                    '32': { waist: '32', length: '40', hip: '40' },
                    '34': { waist: '34', length: '40', hip: '42' },
                    '36': { waist: '36', length: '41', hip: '44' },
                    '38': { waist: '38', length: '41', hip: '46' }
                }
            }
        };

        // Fit guide
        this.fitGuide = {
            'Regular Fit': 'True to size - comfortable, not too tight or loose',
            'Slim Fit': 'Fitted - size up if you prefer more room',
            'Oversized': 'Relaxed, loose fit - size down for a fitted look',
            'Skinny': 'Very fitted - true to size or size up for comfort'
        };
    }

    // Main size guide message
    getSizeGuideMenu() {
        return `📏 *OffComfrt Size Guide*

Choose a category:

1️⃣ T-Shirts & Polos
2️⃣ Shirts
3️⃣ Jeans & Trousers
4️⃣ Fit Guide
5️⃣ How to Measure

*Or tell me:*
• Your measurements (e.g., "38 inch chest")
• What you're looking for (e.g., "size for oversized tee")

Type the number or describe your need!`;
    }

    // Get size chart for category
    getSizeChart(category) {
        const chart = this.sizeChart[category];
        if (!chart) return null;

        let message = `📏 *${chart.name} Size Chart*\n\n`;
        message += `All measurements in inches\n\n`;

        for (const [size, measurements] of Object.entries(chart.sizes)) {
            message += `*Size ${size}*\n`;
            for (const [part, value] of Object.entries(measurements)) {
                message += `${part.charAt(0).toUpperCase() + part.slice(1)}: ${value}"\n`;
            }
            message += `\n`;
        }

        message += `\n*How to measure:*\nType "how to measure" for instructions\n\n`;
        message += `*Need help choosing?*\nTell me your measurements!`;

        return message;
    }

    // Get fit guide
    getFitGuide() {
        let message = `👕 *Fit Guide*\n\n`;

        for (const [fit, description] of Object.entries(this.fitGuide)) {
            message += `*${fit}*\n${description}\n\n`;
        }

        message += `*Pro Tips:*\n`;
        message += `• Between sizes? Size up for comfort\n`;
        message += `• Check product description for fit type\n`;
        message += `• Still unsure? Contact support@offcomfrt.in\n\n`;
        message += `_Experience comfort, delivered._ ✨`;

        return message;
    }

    // How to measure guide
    getHowToMeasure() {
        return `📐 *How to Measure Yourself*

*For Tops (T-shirts, Shirts):*

📏 *Chest:*
Measure around the fullest part of your chest, keeping the tape horizontal

📏 *Length:*
Measure from the highest point of shoulder to the bottom hem

📏 *Shoulder:*
Measure from one shoulder point to the other across the back

📏 *Sleeve:*
Measure from shoulder point to wrist

*For Bottoms (Jeans, Trousers):*

📏 *Waist:*
Measure around your natural waistline

📏 *Hip:*
Measure around the fullest part of your hips

📏 *Length:*
Measure from waist to ankle

*Pro Tips:*
✅ Use a soft measuring tape
✅ Wear light clothing
✅ Don't pull tape too tight
✅ Measure twice for accuracy

*Got your measurements?*
Tell me and I'll recommend your size!`;
    }

    // Recommend size based on measurements
    recommendSize(measurement, type = 'chest') {
        const value = parseInt(measurement);

        if (type === 'chest') {
            if (value <= 36) return { size: 'S', fit: 'Regular Fit', note: 'XS for slim fit' };
            if (value <= 38) return { size: 'M', fit: 'Regular Fit', note: 'S for slim fit' };
            if (value <= 40) return { size: 'L', fit: 'Regular Fit', note: 'M for slim fit' };
            if (value <= 42) return { size: 'XL', fit: 'Regular Fit', note: 'L for slim fit' };
            if (value <= 44) return { size: 'XXL', fit: 'Regular Fit', note: 'XL for slim fit' };
            return { size: 'XXL', fit: 'Oversized Fit', note: 'Contact us for custom sizes' };
        }

        if (type === 'waist') {
            if (value <= 29) return { size: '28', note: 'Perfect fit' };
            if (value <= 31) return { size: '30', note: 'Perfect fit' };
            if (value <= 33) return { size: '32', note: 'Perfect fit' };
            if (value <= 35) return { size: '34', note: 'Perfect fit' };
            if (value <= 37) return { size: '36', note: 'Perfect fit' };
            return { size: '38', note: 'Contact us for larger sizes' };
        }

        return null;
    }

    // Handle size guide queries
    async handle(phone, message) {
        const lowerMessage = message.toLowerCase();

        // Main size guide menu
        if (lowerMessage.includes('size guide') || lowerMessage === 'size') {
            await whatsappService.sendMessage(phone, this.getSizeGuideMenu());
            return true;
        }

        // Category selection
        if (lowerMessage === '1' || lowerMessage.includes('t-shirt') || lowerMessage.includes('tshirt') || lowerMessage.includes('polo')) {
            await whatsappService.sendMessage(phone, this.getSizeChart('tshirts'));
            return true;
        }

        if (lowerMessage === '2' || (lowerMessage.includes('shirt') && !lowerMessage.includes('t-shirt'))) {
            await whatsappService.sendMessage(phone, this.getSizeChart('shirts'));
            return true;
        }

        if (lowerMessage === '3' || lowerMessage.includes('jean') || lowerMessage.includes('trouser') || lowerMessage.includes('pant')) {
            await whatsappService.sendMessage(phone, this.getSizeChart('jeans'));
            return true;
        }

        if (lowerMessage === '4' || lowerMessage.includes('fit guide')) {
            await whatsappService.sendMessage(phone, this.getFitGuide());
            return true;
        }

        if (lowerMessage === '5' || lowerMessage.includes('how to measure')) {
            await whatsappService.sendMessage(phone, this.getHowToMeasure());
            return true;
        }

        // Measurement-based recommendation
        const chestMatch = lowerMessage.match(/(\d+)\s*(inch|"|cm)?\s*(chest)?/);
        const waistMatch = lowerMessage.match(/(\d+)\s*(inch|"|cm)?\s*(waist)/);

        if (chestMatch) {
            const measurement = chestMatch[1];
            const recommendation = this.recommendSize(measurement, 'chest');

            if (recommendation) {
                const response = `✅ *Size Recommendation*\n\nBased on ${measurement}" chest:\n\n*Recommended Size: ${recommendation.size}*\n${recommendation.fit}\n\n💡 ${recommendation.note}\n\n*Want to see the full size chart?*\nType "1" for T-shirts\nType "2" for Shirts`;
                await whatsappService.sendMessage(phone, response);
                return true;
            }
        }

        if (waistMatch) {
            const measurement = waistMatch[1];
            const recommendation = this.recommendSize(measurement, 'waist');

            if (recommendation) {
                const response = `✅ *Size Recommendation*\n\nBased on ${measurement}" waist:\n\n*Recommended Size: ${recommendation.size}*\n\n💡 ${recommendation.note}\n\n*Want to see the full size chart?*\nType "3" for Jeans & Trousers`;
                await whatsappService.sendMessage(phone, response);
                return true;
            }
        }

        return false;
    }
}

module.exports = new SizeGuideHandler();

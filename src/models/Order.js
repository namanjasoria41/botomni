const { supabase } = require('../database/db');

class Order {
    // Find order by order ID
    static async findByOrderId(orderId) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('order_id', orderId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            console.error('Error finding order:', error);
            return null;
        }
    }

    // Find orders by customer phone
    static async findByCustomerPhone(phone) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('customer_phone', phone)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error finding orders by phone:', error);
            return [];
        }
    }

    // Create new order
    static async create(orderData) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .insert([{
                    order_id: orderData.order_id,
                    customer_phone: orderData.customer_phone,
                    shiprocket_order_id: orderData.shiprocket_order_id || null,
                    awb: orderData.awb || null,
                    status: orderData.status || 'pending',
                    courier_name: orderData.courier_name || null,
                    product_name: orderData.product_name || null,
                    order_date: orderData.order_date || new Date(),
                    expected_delivery: orderData.expected_delivery || null
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating order:', error);
            return null;
        }
    }

    // Update order status
    static async updateStatus(orderId, status, additionalData = {}) {
        try {
            const updateData = {
                status,
                updated_at: new Date(),
                ...additionalData
            };

            const { data, error } = await supabase
                .from('orders')
                .update(updateData)
                .eq('order_id', orderId)
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error updating order:', error);
            return null;
        }
    }

    // Get order count
    static async getCount() {
        try {
            const { count, error } = await supabase
                .from('orders')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error('Error getting order count:', error);
            return 0;
        }
    }

    // Get all orders (for admin dashboard)
    static async getAll(limit = 100, offset = 0) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting all orders:', error);
            return [];
        }
    }
}

module.exports = Order;

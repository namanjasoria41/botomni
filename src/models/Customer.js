const { supabase } = require('../database/db');

class Customer {
    // Find customer by phone number
    static async findByPhone(phone) {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('phone', phone)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            return data;
        } catch (error) {
            console.error('Error finding customer:', error);
            return null;
        }
    }

    // Create new customer
    static async create(customerData) {
        try {
            const { data, error } = await supabase
                .from('customers')
                .insert([{
                    phone: customerData.phone,
                    name: customerData.name || null,
                    email: customerData.email || null
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating customer:', error);
            return null;
        }
    }

    // Get or create customer
    static async getOrCreate(phone, name = null) {
        let customer = await this.findByPhone(phone);

        if (!customer) {
            customer = await this.create({ phone, name });
        }

        return customer;
    }

    // Get customer's orders
    static async getOrders(phone) {
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('*')
                .eq('customer_phone', phone)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting customer orders:', error);
            return [];
        }
    }

    // Get all customers (for admin dashboard)
    static async getAll(limit = 100, offset = 0) {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .order('created_at', { ascending: false })
                .range(offset, offset + limit - 1);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting all customers:', error);
            return [];
        }
    }

    // Get customer count
    static async getCount() {
        try {
            const { count, error } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true });

            if (error) throw error;
            return count || 0;
        } catch (error) {
            console.error('Error getting customer count:', error);
            return 0;
        }
    }
}

module.exports = Customer;

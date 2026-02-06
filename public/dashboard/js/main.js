// ===================================
// Professional Admin Dashboard JS
// ===================================

const API_BASE = '/api/admin';
let authToken = localStorage.getItem('authToken');
let currentPage = 'overview';
let charts = {};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showDashboard();
        loadDashboardData();
    } else {
        showLogin();
    }
    setupEventListeners();
});

// ===================================
// Event Listeners
// ===================================

function setupEventListeners() {
    // Login
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);

    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateTo(item.dataset.page);
        });
    });

    // Refresh
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadDashboardData();
        loadPageData(currentPage);
    });

    // Broadcast
    document.getElementById('broadcastForm')?.addEventListener('submit', handleBroadcast);

    // Search & Filters
    document.getElementById('customerSearch')?.addEventListener('input', filterCustomers);
    document.getElementById('orderSearch')?.addEventListener('input', filterOrders);
    document.getElementById('orderStatusFilter')?.addEventListener('change', filterOrders);
    document.getElementById('messageTypeFilter')?.addEventListener('change', filterMessages);
    document.getElementById('messageDateFilter')?.addEventListener('change', filterMessages);

    // Broadcast recipients
    document.getElementById('broadcastRecipients')?.addEventListener('change', updateRecipientCount);
}

// ===================================
// Authentication
// ===================================

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    const buttonText = document.getElementById('loginButtonText');
    const loader = document.getElementById('loginLoader');

    buttonText.style.display = 'none';
    loader.style.display = 'inline-block';

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            showDashboard();
            loadDashboardData();
        } else {
            throw new Error('Invalid credentials');
        }
    } catch (error) {
        errorDiv.textContent = error.message;
        buttonText.style.display = 'inline';
        loader.style.display = 'none';
    }
}

function handleLogout() {
    authToken = null;
    localStorage.removeItem('authToken');
    showLogin();
}

function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboardScreen').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'flex';
}

// ===================================
// Navigation
// ===================================

function navigateTo(page) {
    currentPage = page;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Update pages
    document.querySelectorAll('.page-section').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}Page`)?.classList.add('active');

    // Update title
    const titles = {
        overview: 'Overview',
        customers: 'Customer Management',
        orders: 'Order Management',
        messages: 'Message History',
        broadcast: 'Broadcast Messages',
        analytics: 'Detailed Analytics'
    };

    const subtitles = {
        overview: 'WhatsApp Bot Performance Dashboard',
        customers: 'Manage and view customer information',
        orders: 'Track and manage all orders',
        messages: 'View conversation history',
        broadcast: 'Send messages to customers',
        analytics: 'In-depth performance metrics'
    };

    document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';
    document.getElementById('pageSubtitle').textContent = subtitles[page] || '';

    // Load page data
    loadPageData(page);
}

// ===================================
// Data Loading
// ===================================

async function loadDashboardData() {
    await loadStats();
    await loadRecentActivity();
    await loadCharts();
}

async function loadPageData(page) {
    switch (page) {
        case 'customers':
            await loadCustomers();
            break;
        case 'orders':
            await loadOrders();
            break;
        case 'messages':
            await loadMessages();
            break;
        case 'broadcast':
            await loadBroadcastHistory();
            await updateRecipientCount();
            break;
        case 'analytics':
            await loadAnalytics();
            break;
    }
}

// Load Statistics
async function loadStats() {
    try {
        const response = await apiCall('/stats');

        if (response.success) {
            const { stats } = response;

            // Update stat cards
            document.getElementById('totalCustomers').textContent = stats.totalCustomers || 0;
            document.getElementById('totalOrders').textContent = stats.totalOrders || 0;
            document.getElementById('totalMessages').textContent = stats.totalMessages || 0;
            document.getElementById('activeToday').textContent = stats.activeToday || 0;

            // Update changes
            updateStatChange('customersChange', stats.customersGrowth);
            updateStatChange('ordersChange', stats.ordersGrowth);
            updateStatChange('messagesChange', stats.messagesGrowth);
            updateStatChange('activeChange', stats.activeGrowth);
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

function updateStatChange(elementId, growth) {
    const element = document.getElementById(elementId);
    if (!element || growth === undefined) return;

    const isPositive = growth >= 0;
    element.className = `stat-change ${isPositive ? 'positive' : 'negative'}`;
    element.innerHTML = `<span>${isPositive ? '↑' : '↓'}</span> ${Math.abs(growth)}% vs last week`;
}

// Load Recent Activity
async function loadRecentActivity() {
    try {
        const response = await apiCall('/activity/recent');

        if (response.success) {
            const container = document.getElementById('recentActivity');

            if (response.activity.length === 0) {
                container.innerHTML = '<div class="empty-state"><p class="text-muted">No recent activity</p></div>';
                return;
            }

            container.innerHTML = response.activity.map(a => `
                <div style="padding: 12px 0; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <strong>${a.title}</strong>
                        <span class="text-small text-muted">${formatTimeAgo(a.created_at)}</span>
                    </div>
                    <p class="text-small text-muted">${a.description}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load activity:', error);
    }
}

// Load Charts
async function loadCharts() {
    try {
        const response = await apiCall('/analytics/charts');

        if (response.success) {
            // Message Volume Chart
            createLineChart('messageChart', response.messageVolume);

            // Order Status Chart
            createDoughnutChart('orderStatusChart', response.orderStatus);
        }
    } catch (error) {
        console.error('Failed to load charts:', error);
    }
}

// Load Customers
async function loadCustomers() {
    try {
        const response = await apiCall('/customers');

        if (response.success) {
            window.customersData = response.customers;
            renderCustomersTable(response.customers);
        }
    } catch (error) {
        console.error('Failed to load customers:', error);
    }
}

function renderCustomersTable(customers) {
    const tbody = document.getElementById('customersTableBody');

    if (customers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="empty-state">
                        <div class="empty-state-icon">👥</div>
                        <div class="empty-state-title">No customers yet</div>
                        <div class="empty-state-text">Customers will appear here once they start using the bot</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = customers.map(c => `
        <tr>
            <td><strong>${c.name || 'Unknown'}</strong></td>
            <td>${formatPhone(c.phone)}</td>
            <td><span class="badge badge-info">${c.order_count || 0}</span></td>
            <td><span class="badge badge-primary">${c.message_count || 0}</span></td>
            <td class="text-small text-muted">${formatDate(c.created_at)}</td>
            <td>
                <button class="btn btn-secondary" onclick="viewCustomerDetails('${c.phone}')">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

// Load Orders
async function loadOrders() {
    try {
        const response = await apiCall('/orders');

        if (response.success) {
            window.ordersData = response.orders;
            renderOrdersTable(response.orders);
        }
    } catch (error) {
        console.error('Failed to load orders:', error);
    }
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');

    if (orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center">
                    <div class="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <div class="empty-state-title">No orders yet</div>
                        <div class="empty-state-text">Orders will appear here once customers place them</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = orders.map(o => `
        <tr>
            <td><strong>${o.order_id}</strong></td>
            <td>${o.customer_name || formatPhone(o.customer_phone)}</td>
            <td>${getStatusBadge(o.status)}</td>
            <td class="text-small">${o.awb || 'N/A'}</td>
            <td class="text-small text-muted">${formatDate(o.created_at)}</td>
            <td>
                <button class="btn btn-secondary" onclick="viewOrderDetails('${o.order_id}')">
                    View
                </button>
            </td>
        </tr>
    `).join('');
}

// Load Messages
async function loadMessages() {
    try {
        const response = await apiCall('/messages');

        if (response.success) {
            window.messagesData = response.messages;
            renderMessagesTable(response.messages);
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

function renderMessagesTable(messages) {
    const tbody = document.getElementById('messagesTableBody');

    if (messages.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center">
                    <div class="empty-state">
                        <div class="empty-state-icon">💬</div>
                        <div class="empty-state-title">No messages yet</div>
                        <div class="empty-state-text">Messages will appear here as customers interact with the bot</div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = messages.map(m => `
        <tr>
            <td class="text-small text-muted">${formatTime(m.created_at)}</td>
            <td>${formatPhone(m.customer_phone)}</td>
            <td>
                <span class="badge ${m.message_type === 'incoming' ? 'badge-primary' : 'badge-success'}">
                    ${m.message_type === 'incoming' ? '📥 In' : '📤 Out'}
                </span>
            </td>
            <td class="text-small">${truncate(m.message_content, 80)}</td>
        </tr>
    `).join('');
}

// Load Broadcast History
async function loadBroadcastHistory() {
    try {
        const response = await apiCall('/broadcast/history');

        if (response.success) {
            const container = document.getElementById('broadcastHistory');

            if (response.broadcasts.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📢</div>
                        <div class="empty-state-title">No broadcasts yet</div>
                        <div class="empty-state-text">Your broadcast campaigns will appear here</div>
                    </div>
                `;
                return;
            }

            container.innerHTML = response.broadcasts.map(b => `
                <div class="card" style="margin-bottom: 16px;">
                    <div class="card-body">
                        <div class="d-flex justify-between align-center mb-2">
                            <strong>${b.title || 'Broadcast Campaign'}</strong>
                            <span class="text-small text-muted">${formatDate(b.created_at)}</span>
                        </div>
                        <p class="text-small mb-2">${truncate(b.message, 100)}</p>
                        <div class="d-flex gap-2">
                            <span class="badge badge-info">${b.total_recipients} recipients</span>
                            <span class="badge badge-success">${b.sent_count} sent</span>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load broadcast history:', error);
    }
}

// Load Analytics
async function loadAnalytics() {
    try {
        const response = await apiCall('/analytics/detailed');

        if (response.success) {
            // FAQ Chart
            createBarChart('faqChart', response.faqData);

            // Growth Chart
            createAreaChart('growthChart', response.growthData);
        }
    } catch (error) {
        console.error('Failed to load analytics:', error);
    }
}

// ===================================
// Chart Functions
// ===================================

function createLineChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Messages',
                data: data.values || [],
                borderColor: '#4F46E5',
                backgroundColor: 'rgba(79, 70, 229, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createDoughnutChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels || [],
            datasets: [{
                data: data.values || [],
                backgroundColor: [
                    '#4F46E5',
                    '#059669',
                    '#D97706',
                    '#DC2626',
                    '#0284C7'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function createBarChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Queries',
                data: data.values || [],
                backgroundColor: '#4F46E5'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function createAreaChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (charts[canvasId]) {
        charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels || [],
            datasets: [{
                label: 'Customers',
                data: data.values || [],
                borderColor: '#059669',
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

// ===================================
// Actions
// ===================================

async function handleBroadcast(e) {
    e.preventDefault();

    const message = document.getElementById('broadcastMessage').value;
    const recipients = document.getElementById('broadcastRecipients').value;

    if (!confirm(`Send broadcast to ${recipients} customers?`)) return;

    try {
        const response = await apiCall('/broadcast/send', 'POST', {
            message,
            segment: recipients
        });

        if (response.success) {
            alert(`✅ Broadcast sent to ${response.totalRecipients} customers!`);
            document.getElementById('broadcastForm').reset();
            loadBroadcastHistory();
        }
    } catch (error) {
        alert(`❌ Failed to send broadcast: ${error.message}`);
    }
}

async function updateRecipientCount() {
    try {
        const segment = document.getElementById('broadcastRecipients').value;
        const response = await apiCall(`/broadcast/count?segment=${segment}`);

        if (response.success) {
            document.getElementById('recipientCount').textContent = response.count;
        }
    } catch (error) {
        console.error('Failed to update count:', error);
    }
}

function viewCustomerDetails(phone) {
    // Show modal with customer details
    const modal = document.getElementById('customerModal');
    const modalBody = document.getElementById('customerModalBody');

    modalBody.innerHTML = '<div class="loading"></div>';
    modal.classList.add('active');

    apiCall(`/customers/${phone}/details`).then(response => {
        if (response.success) {
            const customer = response.customer;
            modalBody.innerHTML = `
                <div>
                    <h4>${customer.name || 'Unknown'}</h4>
                    <p class="text-muted">${formatPhone(customer.phone)}</p>
                    <hr>
                    <div class="stats-grid" style="margin-top: 20px;">
                        <div>
                            <div class="text-small text-muted">Total Orders</div>
                            <div style="font-size: 24px; font-weight: 700;">${customer.order_count || 0}</div>
                        </div>
                        <div>
                            <div class="text-small text-muted">Total Messages</div>
                            <div style="font-size: 24px; font-weight: 700;">${customer.message_count || 0}</div>
                        </div>
                    </div>
                    <hr>
                    <h5 class="mt-3">Recent Orders</h5>
                    ${customer.orders && customer.orders.length > 0 ?
                    customer.orders.map(o => `
                            <div style="padding: 12px; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 8px;">
                                <div class="d-flex justify-between">
                                    <strong>${o.order_id}</strong>
                                    ${getStatusBadge(o.status)}
                                </div>
                                <div class="text-small text-muted mt-1">${formatDate(o.created_at)}</div>
                            </div>
                        `).join('') :
                    '<p class="text-muted">No orders yet</p>'
                }
                </div>
            `;
        }
    });
}

function closeCustomerModal() {
    document.getElementById('customerModal').classList.remove('active');
}

function viewOrderDetails(orderId) {
    alert(`Order Details: ${orderId}\n\nThis will show full order information, tracking timeline, and customer details.`);
}

// ===================================
// Filters & Search
// ===================================

function filterCustomers() {
    const searchTerm = document.getElementById('customerSearch').value.toLowerCase();
    const filtered = window.customersData.filter(c =>
        (c.name && c.name.toLowerCase().includes(searchTerm)) ||
        c.phone.includes(searchTerm)
    );
    renderCustomersTable(filtered);
}

function filterOrders() {
    const searchTerm = document.getElementById('orderSearch').value.toLowerCase();
    const statusFilter = document.getElementById('orderStatusFilter').value;

    let filtered = window.ordersData;

    if (searchTerm) {
        filtered = filtered.filter(o =>
            o.order_id.toLowerCase().includes(searchTerm) ||
            (o.customer_name && o.customer_name.toLowerCase().includes(searchTerm))
        );
    }

    if (statusFilter) {
        filtered = filtered.filter(o => o.status === statusFilter);
    }

    renderOrdersTable(filtered);
}

function filterMessages() {
    const typeFilter = document.getElementById('messageTypeFilter').value;
    const dateFilter = document.getElementById('messageDateFilter').value;

    let filtered = window.messagesData;

    if (typeFilter) {
        filtered = filtered.filter(m => m.message_type === typeFilter);
    }

    if (dateFilter) {
        filtered = filtered.filter(m => m.created_at.startsWith(dateFilter));
    }

    renderMessagesTable(filtered);
}

// ===================================
// Export Functions
// ===================================

function exportCustomers() {
    const csv = convertToCSV(window.customersData, ['phone', 'name', 'order_count', 'message_count', 'created_at']);
    downloadCSV(csv, 'customers.csv');
}

function exportMessages() {
    const csv = convertToCSV(window.messagesData, ['created_at', 'customer_phone', 'message_type', 'message_content']);
    downloadCSV(csv, 'messages.csv');
}

function convertToCSV(data, fields) {
    const header = fields.join(',');
    const rows = data.map(item =>
        fields.map(field => `"${item[field] || ''}"`).join(',')
    );
    return [header, ...rows].join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
}

// ===================================
// Utility Functions
// ===================================

async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(`${API_BASE}${endpoint}`, options);

    if (response.status === 401) {
        handleLogout();
        throw new Error('Unauthorized');
    }

    return await response.json();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function formatPhone(phone) {
    return phone.replace(/(\d{2})(\d{5})(\d{5})/, '+$1 $2-$3');
}

function truncate(str, length) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
}

function getStatusBadge(status) {
    const badges = {
        pending: '<span class="badge badge-warning">Pending</span>',
        confirmed: '<span class="badge badge-info">Confirmed</span>',
        shipped: '<span class="badge badge-primary">Shipped</span>',
        delivered: '<span class="badge badge-success">Delivered</span>',
        cancelled: '<span class="badge badge-danger">Cancelled</span>'
    };
    return badges[status] || `<span class="badge badge-gray">${status}</span>`;
}

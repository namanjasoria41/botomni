// API Base URL
const API_BASE = '/api/admin';

// Auth token
let authToken = localStorage.getItem('authToken');
let currentPage = 'overview';

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

// Event Listeners
function setupEventListeners() {
    // Login form
    document.getElementById('loginForm')?.addEventListener('submit', handleLogin);

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            navigateTo(page);
        });
    });

    // Broadcast form
    document.getElementById('broadcastForm')?.addEventListener('submit', handleBroadcast);

    // Offer form
    document.getElementById('offerForm')?.addEventListener('submit', handleOffer);

    // Character count
    document.getElementById('broadcastMessage')?.addEventListener('input', (e) => {
        document.getElementById('charCount').textContent = e.target.value.length;
    });
}

// Login
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');

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
            localStorage.setItem('username', data.username);
            showDashboard();
            loadDashboardData();
        } else {
            errorDiv.textContent = 'Invalid credentials';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Login failed. Please try again.';
        errorDiv.style.display = 'block';
    }
}

// Logout
function handleLogout() {
    authToken = null;
    localStorage.removeItem('authToken');
    localStorage.removeItem('username');
    showLogin();
}

// Show/Hide Screens
function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboardScreen').style.display = 'none';
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboardScreen').style.display = 'flex';

    const username = localStorage.getItem('username') || 'Admin';
    document.getElementById('adminUsername').textContent = username;
}

// Navigation
function navigateTo(page) {
    currentPage = page;

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });

    // Update pages
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`${page}Page`).classList.add('active');

    // Update title
    const titles = {
        overview: 'Dashboard Overview',
        customers: 'Customer Management',
        broadcast: 'Broadcast Messages',
        offers: 'Promotional Offers',
        messages: 'Message History',
        analytics: 'Analytics & Insights'
    };
    document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

    // Load page-specific data
    loadPageData(page);
}

// Load Dashboard Data
async function loadDashboardData() {
    await loadStats();
    await loadRecentBroadcasts();
}

// Load page-specific data
async function loadPageData(page) {
    switch (page) {
        case 'customers':
            await loadCustomers();
            break;
        case 'messages':
            await loadMessages();
            break;
        case 'analytics':
            await loadAnalytics();
            break;
    }
}

// Load Stats
async function loadStats() {
    try {
        const response = await apiCall('/stats');

        if (response.success) {
            const { stats } = response;
            document.getElementById('totalCustomers').textContent = stats.totalCustomers;
            document.getElementById('totalOrders').textContent = stats.totalOrders;
            document.getElementById('totalMessages').textContent = stats.totalMessages;
            document.getElementById('todayMessages').textContent = stats.todayMessages;
        }
    } catch (error) {
        console.error('Failed to load stats:', error);
    }
}

// Load Recent Broadcasts
async function loadRecentBroadcasts() {
    try {
        const response = await apiCall('/stats');

        if (response.success && response.stats.recentBroadcasts.length > 0) {
            const container = document.getElementById('recentBroadcasts');
            container.innerHTML = response.stats.recentBroadcasts.map(b => `
                <div class="broadcast-item">
                    <h4>${b.title}</h4>
                    <p>Sent to ${b.total_recipients} customers • ${b.sent_count} delivered • ${formatDate(b.created_at)}</p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load broadcasts:', error);
    }
}

// Load Customers
async function loadCustomers() {
    try {
        const response = await apiCall('/customers');

        if (response.success) {
            const tbody = document.getElementById('customersTableBody');

            if (response.customers.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No customers yet</td></tr>';
                return;
            }

            tbody.innerHTML = response.customers.map(c => `
                <tr>
                    <td>${c.phone}</td>
                    <td>${c.name || 'N/A'}</td>
                    <td>${c.email || 'N/A'}</td>
                    <td>${formatDate(c.created_at)}</td>
                    <td><button class="btn btn-secondary" onclick="viewCustomer('${c.phone}')">View</button></td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load customers:', error);
    }
}

// Load Messages
async function loadMessages() {
    try {
        const response = await apiCall('/messages');

        if (response.success) {
            const tbody = document.getElementById('messagesTableBody');

            if (response.messages.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No messages yet</td></tr>';
                return;
            }

            tbody.innerHTML = response.messages.map(m => `
                <tr>
                    <td>${formatDate(m.created_at)}</td>
                    <td>${m.customer_phone}</td>
                    <td>${m.message_type}</td>
                    <td>${truncate(m.message_content, 50)}</td>
                    <td>${m.status}</td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

// Load Analytics
async function loadAnalytics() {
    try {
        const response = await apiCall('/analytics');

        if (response.success) {
            const { analytics } = response;

            // Display messages by type
            displayChart('messagesByType', analytics.messagesByType);

            // Display orders by status
            displayChart('ordersByStatus', analytics.ordersByStatus);

            // Display messages over time
            displayChart('messagesOverTime', analytics.messagesOverTime);
        }
    } catch (error) {
        console.error('Failed to load analytics:', error);
    }
}

// Handle Broadcast
async function handleBroadcast(e) {
    e.preventDefault();

    const segment = document.getElementById('broadcastSegment').value;
    const message = document.getElementById('broadcastMessage').value;
    const statusDiv = document.getElementById('broadcastStatus');

    try {
        const endpoint = segment === 'all' ? '/broadcast' : '/broadcast/segment';
        const body = segment === 'all' ? { message } : { message, segment };

        const response = await apiCall(endpoint, 'POST', body);

        if (response.success) {
            statusDiv.className = 'status-message success';
            statusDiv.textContent = `✅ Broadcast queued! Sending to ${response.totalRecipients} customers.`;
            statusDiv.style.display = 'block';

            // Reset form
            document.getElementById('broadcastForm').reset();
            document.getElementById('charCount').textContent = '0';
        } else {
            throw new Error(response.message);
        }
    } catch (error) {
        statusDiv.className = 'status-message error';
        statusDiv.textContent = `❌ Failed to send broadcast: ${error.message}`;
        statusDiv.style.display = 'block';
    }
}

// Handle Offer
async function handleOffer(e) {
    e.preventDefault();

    const title = document.getElementById('offerTitle').value;
    const description = document.getElementById('offerDescription').value;
    const discountCode = document.getElementById('offerCode').value;
    const message = document.getElementById('offerMessage').value;
    const expiresAt = document.getElementById('offerExpiry').value;
    const statusDiv = document.getElementById('offerStatus');

    try {
        const response = await apiCall('/offers', 'POST', {
            title,
            description,
            discountCode,
            message,
            expiresAt: expiresAt || null
        });

        if (response.success) {
            statusDiv.className = 'status-message success';
            statusDiv.textContent = `✅ Offer created and sent to ${response.totalRecipients} customers!`;
            statusDiv.style.display = 'block';

            // Reset form
            document.getElementById('offerForm').reset();
        } else {
            throw new Error(response.message);
        }
    } catch (error) {
        statusDiv.className = 'status-message error';
        statusDiv.textContent = `❌ Failed to create offer: ${error.message}`;
        statusDiv.style.display = 'block';
    }
}

// API Call Helper
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

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function truncate(str, length) {
    return str.length > length ? str.substring(0, length) + '...' : str;
}

function displayChart(elementId, data) {
    const element = document.getElementById(elementId);

    if (!data || Object.keys(data).length === 0) {
        element.textContent = 'No data available';
        return;
    }

    // Simple text-based chart (you can integrate Chart.js for better visuals)
    const html = Object.entries(data).map(([key, value]) => `
        <div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                <span>${key}</span>
                <span><strong>${value}</strong></span>
            </div>
            <div style="background: #3a3a3a; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: var(--primary); height: 100%; width: ${Math.min(value * 10, 100)}%;"></div>
            </div>
        </div>
    `).join('');

    element.innerHTML = html;
}

// Refresh functions
function refreshCustomers() {
    loadCustomers();
}

function refreshMessages() {
    loadMessages();
}

function viewCustomer(phone) {
    alert(`View customer: ${phone}\n\nThis feature will show customer details and order history.`);
}

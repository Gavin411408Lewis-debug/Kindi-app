const API_URL = '/api';

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadItems();
    loadTransactions();
    loadItemsDropdowns();

    // فحص الاتصال بالشبكة
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
});

function updateOnlineStatus() {
    const statusBadge = document.getElementById('online-status');
    if (navigator.onLine) {
        statusBadge.textContent = 'متصل';
        statusBadge.style.backgroundColor = '#22c55e';
    } else {
        statusBadge.textContent = 'غير متصل';
        statusBadge.style.backgroundColor = '#ef4444';
    }
}

// التبديل بين الشاشات
function switchTab(tabId, el) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    if (el) el.classList.add('active');

    if (tabId === 'tab-dashboard') loadDashboard();
    if (tabId === 'tab-items') loadItems();
    if (tabId === 'tab-transactions') loadTransactions();
}

// إدارة النوافذ المنبثقة
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// 1. تحميل البيانات الرئيسية
async function loadDashboard() {
    try {
        const res = await fetch(`${API_URL}/dashboard`);
        const data = await res.json();
        
        document.getElementById('stat-total-items').textContent = data.total_items || 0;
        document.getElementById('stat-total-qty').textContent = data.total_quantity || 0;
        document.getElementById('stat-reorder-reached').textContent = data.reorder_reached || 0;
        document.getElementById('stat-reorder-near').textContent = data.reorder_near || 0;

        const container = document.getElementById('recent-transactions');
        container.innerHTML = '';
        if (data.recent_transactions && data.recent_transactions.length > 0) {
            data.recent_transactions.forEach(t => {
                container.innerHTML += `
                    <div class="list-item">
                        <strong>${t.type}</strong>: ${t.description} (${t.code})<br>
                        الكمية: ${t.quantity} | التاريخ: ${new Date(t.created_at).toLocaleString('ar-EG')}
                    </div>`;
            });
        } else {
            container.innerHTML = '<div class="list-item">لا توجد حركات مؤخراً</div>';
        }
    } catch (e) {
        console.error(e);
    }
}

// 2. تحميل قائمة المواد
async function loadItems() {
    const search = document.getElementById('search-input')?.value || '';
    try {
        const res = await fetch(`${API_URL}/items?search=${encodeURIComponent(search)}`);
        const items = await res.json();
        
        const container = document.getElementById('items-list');
        container.innerHTML = '';

        items.forEach(item => {
            container.innerHTML += `
                <div class="item-card ${item.status_color}">
                    <div class="item-header">
                        <span>${item.description}</span>
                        <span>الرمز: ${item.code}</span>
                    </div>
                    <div class="item-details">
                        المستحضر: ${item.product_name}<br>
                        الكمية الحالية: <strong>${item.quantity} ${item.unit}</strong> (حد الطلب: ${item.reorder_level})<br>
                        موقع التخزين: ${item.location || 'غير محدد'}<br>
                        ${item.notes ? `ملاحظات: ${item.notes}` : ''}
                    </div>
                </div>`;
        });
    } catch (e) {
        console.error(e);
    }
}

// تحميل المواد في القوائم المنسدلة
async function loadItemsDropdowns() {
    try {
        const res = await fetch(`${API_URL}/items`);
        const items = await res.json();
        
        const selects = ['in-item-id', 'out-item-id', 'audit-item-id'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="">-- اختر المادة --</option>';
            items.forEach(item => {
                el.innerHTML += `<option value="${item.id}">${item.code} - ${item.description} (الرصيد: ${item.quantity})</option>`;
            });
        });
    } catch (e) {
        console.error(e);
    }
}

// 3. إضافة مادة جديدة
async function handleAddItem(e) {
    e.preventDefault();
    const payload = {
        code: document.getElementById('add-code').value,
        description: document.getElementById('add-desc').value,
        product_name: document.getElementById('add-product').value,
        unit: document.getElementById('add-unit').value,
        quantity: parseFloat(document.getElementById('add-qty').value) || 0,
        reorder_level: parseFloat(document.getElementById('add-reorder').value) || 0,
        location: document.getElementById('add-location').value,
        notes: document.getElementById('add-notes').value
    };

    const res = await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
        alert(data.message);
        closeModal('modal-add-item');
        loadItems();
        loadItemsDropdowns();
        loadDashboard();
    } else {
        alert(data.error);
    }
}

// 4. إدخال كميات للمخزون
async function handleInTransaction(e) {
    e.preventDefault();
    const payload = {
        item_id: document.getElementById('in-item-id').value,
        quantity: document.getElementById('in-qty').value,
        document_number: document.getElementById('in-doc').value,
        notes: document.getElementById('in-notes').value
    };

    const res = await fetch(`${API_URL}/transactions/in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
        alert(data.message);
        closeModal('modal-in');
        loadTransactions();
        loadItemsDropdowns();
        loadDashboard();
    } else {
        alert(data.error);
    }
}

// 5. صرف مواد من المخزون
async function handleOutTransaction(e) {
    e.preventDefault();
    const payload = {
        item_id: document.getElementById('out-item-id').value,
        quantity: document.getElementById('out-qty').value,
        product_name: document.getElementById('out-product').value,
        batch_number: document.getElementById('out-batch').value,
        document_number: document.getElementById('out-doc').value,
        notes: document.getElementById('out-notes').value
    };

    const res = await fetch(`${API_URL}/transactions/out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
        alert(data.message);
        closeModal('modal-out');
        loadTransactions();
        loadItemsDropdowns();
        loadDashboard();
    } else {
        alert(data.error);
    }
}

// 6. تسجيل نتيجة الجرد الفعلي
async function handleAudit(e) {
    e.preventDefault();
    const payload = {
        item_id: document.getElementById('audit-item-id').value,
        actual_quantity: document.getElementById('audit-actual-qty').value,
        notes: document.getElementById('audit-notes').value
    };

    const res = await fetch(`${API_URL}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok) {
        alert(`${data.message} (الفرق: ${data.difference})`);
        loadItemsDropdowns();
        loadDashboard();
    } else {
        alert(data.error);
    }
}

// 7. عرض سجل الحركات
async function loadTransactions() {
    try {
        const res = await fetch(`${API_URL}/transactions`);
        const list = await res.json();
        
        const container = document.getElementById('all-transactions');
        container.innerHTML = '';
        list.forEach(t => {
            container.innerHTML += `
                <div class="list-item">
                    <strong>[${t.type}]</strong> ${t.description} (${t.code})<br>
                    الكمية: ${t.quantity} ${t.unit} | المستند: ${t.document_number || '-'}<br>
                    الباج: ${t.batch_number || '-'} | المستحضر: ${t.product_name || '-'}<br>
                    <small>التاريخ: ${new Date(t.created_at).toLocaleString('ar-EG')}</small>
                </div>`;
        });
    } catch (e) {
        console.error(e);
    }
}

// 8. تصدير التقارير
function exportData(type) {
    window.open(`${API_URL}/items`, '_blank');
}

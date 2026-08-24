const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error(err.message);
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE,
        description TEXT,
        product_name TEXT,
        unit TEXT,
        quantity REAL DEFAULT 0,
        reorder_level REAL DEFAULT 0,
        location TEXT,
        notes TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_id INTEGER,
        type TEXT,
        quantity REAL,
        product_name TEXT,
        batch_number TEXT,
        document_number TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(item_id) REFERENCES items(id)
    )`);
});

app.get('/api/dashboard', (req, res) => {
    db.get('SELECT COUNT(*) as total_items, SUM(quantity) as total_quantity FROM items', [], (err, row1) => {
        db.get('SELECT COUNT(*) as reorder_reached FROM items WHERE quantity <= reorder_level AND reorder_level > 0', [], (err, row2) => {
            db.get('SELECT COUNT(*) as reorder_near FROM items WHERE quantity > reorder_level AND quantity <= (reorder_level * 1.2)', [], (err, row3) => {
                db.all('SELECT t.*, i.description, i.code FROM transactions t JOIN items i ON t.item_id = i.id ORDER BY t.created_at DESC LIMIT 5', [], (err, rows) => {
                    res.json({
                        total_items: row1 ? row1.total_items : 0,
                        total_quantity: row1 ? row1.total_quantity : 0,
                        reorder_reached: row2 ? row2.reorder_reached : 0,
                        reorder_near: row3 ? row3.reorder_near : 0,
                        recent_transactions: rows || []
                    });
                });
            });
        });
    });
});

app.get('/api/items', (req, res) => {
    const search = req.query.search ? `%${req.query.search}%` : '%';
    db.all('SELECT * FROM items WHERE code LIKE ? OR description LIKE ? OR product_name LIKE ?', [search, search, search], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const items = rows.map(item => {
            let status_color = 'green';
            if (item.quantity <= item.reorder_level) status_color = 'red';
            else if (item.quantity <= item.reorder_level * 1.2) status_color = 'orange';
            return { ...item, status_color };
        });
        res.json(items);
    });
});

app.post('/api/items', (req, res) => {
    const { code, description, product_name, unit, quantity, reorder_level, location, notes } = req.body;
    db.run(`INSERT INTO items (code, description, product_name, unit, quantity, reorder_level, location, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, description, product_name, unit, quantity || 0, reorder_level || 0, location, notes],
        function (err) {
            if (err) return res.status(400).json({ error: 'رمز المادة موجود مسبقاً' });
            res.json({ message: 'تمت إضافة المادة بنجاح', id: this.lastID });
        }
    );
});

app.post('/api/transactions/in', (req, res) => {
    const { item_id, quantity, document_number, notes } = req.body;
    const qty = parseFloat(quantity);
    db.run(`UPDATE items SET quantity = quantity + ? WHERE id = ?`, [qty, item_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        db.run(`INSERT INTO transactions (item_id, type, quantity, document_number, notes) VALUES (?, 'دخول', ?, ?, ?)`,
            [item_id, qty, document_number, notes],
            () => res.json({ message: 'تمت إضافة الكمية للمخزون' })
        );
    });
});

app.post('/api/transactions/out', (req, res) => {
    const { item_id, quantity, product_name, batch_number, document_number, notes } = req.body;
    const qty = parseFloat(quantity);
    db.get('SELECT quantity FROM items WHERE id = ?', [item_id], (err, row) => {
        if (!row || row.quantity < qty) {
            return res.status(400).json({ error: 'الكمية المطلوبة غير متوفرة!' });
        }
        db.run(`UPDATE items SET quantity = quantity - ? WHERE id = ?`, [qty, item_id], () => {
            db.run(`INSERT INTO transactions (item_id, type, quantity, product_name, batch_number, document_number, notes) VALUES (?, 'صرف', ?, ?, ?, ?, ?)`,
                [item_id, qty, product_name, batch_number, document_number, notes],
                () => res.json({ message: 'تم صرف المادة بنجاح' })
            );
        });
    });
});

app.post('/api/audit', (req, res) => {
    const { item_id, actual_quantity, notes } = req.body;
    const actual = parseFloat(actual_quantity);
    db.get('SELECT quantity FROM items WHERE id = ?', [item_id], (err, row) => {
        if (!row) return res.status(404).json({ error: 'المادة غير موجودة' });
        const diff = actual - row.quantity;
        db.run(`UPDATE items SET quantity = ? WHERE id = ?`, [actual, item_id], () => {
            db.run(`INSERT INTO transactions (item_id, type, quantity, notes) VALUES (?, 'جرد', ?, ?)`,
                [item_id, diff, `جرد فعلي - ${notes || ''}`],
                () => res.json({ message: 'تم تعديل الرصيد بنجاح', difference: diff })
            );
        });
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

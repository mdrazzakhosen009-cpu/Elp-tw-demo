const { createClient } = require("@libsql/client");

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) throw new Error("TURSO_DATABASE_URL is required");
if (!authToken) throw new Error("TURSO_AUTH_TOKEN is required");

const db = createClient({ url, authToken });

async function query(sql, args = []) {
  return db.execute({ sql, args });
}

async function batch(statements) {
  return db.batch(statements, "write");
}

async function initDb() {
  await batch([
    { sql: `CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '',
      price REAL NOT NULL DEFAULT 0,
      compare_price REAL,
      stock INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT '',
      featured INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id)
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(phone)
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_code TEXT NOT NULL UNIQUE,
      customer_id INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      delivery_fee REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cod',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      order_status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      line_total REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS landing_sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_key TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '',
      subtitle TEXT NOT NULL DEFAULT '',
      body TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      button_text TEXT NOT NULL DEFAULT '',
      button_url TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`, args: [] },
    { sql: `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`, args: [] }
  ]);

  const defaults = [
    ["site_name", "Trend Wear"],
    ["tagline", "Modern essentials. Timeless confidence."],
    ["contact_phone", ""],
    ["contact_whatsapp", ""],
    ["contact_email", ""],
    ["address", ""],
    ["delivery_fee", "80"],
    ["currency", "৳"],
    ["hero_image", ""]
  ];
  for (const [key, value] of defaults) {
    await query(`INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)`, [key, value]);
  }

  const section = await query(`SELECT COUNT(*) AS c FROM landing_sections`);
  if (Number(section.rows[0].c) === 0) {
    const defaultsSections = [
      ["hero","Elevate Your Everyday","Curated fashion for a sharper, more confident you.","Discover refined pieces designed for modern wardrobes.","", "Shop Collection","#products",1,1],
      ["about","Designed for the way you live","Trend Wear brings clean silhouettes, versatile pieces and effortless style.","", "", "","","",1,2],
      ["why","Why Trend Wear","Thoughtful pieces, clear pricing and a shopping experience built around you.","","","","","",1,3],
      ["cta","Your next favorite look","Find the pieces that fit your style.","","","Shop Now","#products",1,4]
    ];
    for (const s of defaultsSections) {
      await query(`INSERT INTO landing_sections
        (section_key,title,subtitle,body,image_url,button_text,button_url,enabled,sort_order)
        VALUES (?,?,?,?,?,?,?,?,?)`, s);
    }
  }

  const cat = await query(`SELECT COUNT(*) AS c FROM categories`);
  if (Number(cat.rows[0].c) === 0) {
    await query(`INSERT INTO categories(name,slug) VALUES(?,?)`, ["New Arrivals","new-arrivals"]);
    await query(`INSERT INTO categories(name,slug) VALUES(?,?)`, ["Men","men"]);
    await query(`INSERT INTO categories(name,slug) VALUES(?,?)`, ["Women","women"]);
  }
}

module.exports = { db, query, batch, initDb };

const { createClient } = require('@libsql/client');

const url = process.env.TURSO_DATABASE_URL || 'file:trend-wear.local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
const db = createClient({ url, authToken });

async function query(sql, args = []) {
  return db.execute({ sql, args });
}

async function batch(statements) {
  return db.batch(statements.map(s => ({ sql: s.sql, args: s.args || [] })), 'write');
}

async function initDb() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS landing_sections (id INTEGER PRIMARY KEY AUTOINCREMENT,section_key TEXT UNIQUE NOT NULL,type TEXT NOT NULL,title TEXT DEFAULT '',subtitle TEXT DEFAULT '',body TEXT DEFAULT '',image_url TEXT DEFAULT '',button_text TEXT DEFAULT '',button_url TEXT DEFAULT '',content_json TEXT DEFAULT '{}',enabled INTEGER DEFAULT 1,sort_order INTEGER DEFAULT 0,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,description TEXT DEFAULT '',image_url TEXT DEFAULT '',active INTEGER DEFAULT 1,sort_order INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT,category_id INTEGER,name TEXT NOT NULL,slug TEXT UNIQUE NOT NULL,description TEXT DEFAULT '',price REAL NOT NULL DEFAULT 0,compare_price REAL,stock INTEGER NOT NULL DEFAULT 0,image_url TEXT DEFAULT '',gallery_json TEXT DEFAULT '[]',featured INTEGER DEFAULT 0,active INTEGER DEFAULT 1,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(category_id) REFERENCES categories(id))`,
    `CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT UNIQUE NOT NULL,email TEXT DEFAULT '',address TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT,order_code TEXT UNIQUE NOT NULL,customer_id INTEGER NOT NULL,subtotal REAL NOT NULL,delivery_fee REAL NOT NULL,total REAL NOT NULL,payment_method TEXT NOT NULL,payment_sender TEXT DEFAULT '',transaction_id TEXT DEFAULT '',payment_status TEXT DEFAULT 'pending',order_status TEXT DEFAULT 'pending',notes TEXT DEFAULT '',items_json TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(customer_id) REFERENCES customers(id))`,
    `CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT DEFAULT '',email TEXT DEFAULT '',phone TEXT DEFAULT '',message TEXT DEFAULT '',created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)`,
    `CREATE INDEX IF NOT EXISTS idx_products_active ON products(active)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status)`,
    `CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at)`
  ].map(sql => ({ sql, args: [] })));

  const defaults = {
    store_name: 'Trend Wear',
    tagline: 'Modern essentials. Refined every day.',
    logo_url: '/assets/logo.jpg',
    currency: '৳',
    delivery_fee: '80',
    delivery_note: 'Inside Dhaka 1–2 days · Outside Dhaka 2–5 days',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    support_hours: 'Every day · 10:00 AM – 10:00 PM',
    facebook_url: '',
    instagram_url: '',
    tiktok_url: '',
    about_store: 'Trend Wear brings together elevated everyday fashion with a clean, confident point of view.',
    bkash_enabled: '0',
    bkash_number: '',
    nagad_enabled: '0',
    nagad_number: '',
    rocket_enabled: '0',
    rocket_number: '',
    cod_enabled: '1',
    payment_note: 'For manual mobile payments, send the payment first and enter the sender number and transaction ID. Orders remain pending until verified.',
    seo_title: 'Trend Wear — Modern fashion for everyday style',
    seo_description: 'Discover refined everyday fashion from Trend Wear.'
  };
  for (const [key, value] of Object.entries(defaults)) {
    await query(`INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING`, [key, value]);
  }

  const sectionCount = await query('SELECT COUNT(*) AS c FROM landing_sections');
  if (Number(sectionCount.rows[0].c) === 0) {
    const sections = [
      {key:'hero',type:'hero',title:'Everyday, elevated.',subtitle:'TREND WEAR / NEW SEASON',body:'A refined edit of modern essentials designed to move with you.',button_text:'Shop the collection',button_url:'#shop',image_url:'',json:{eyebrow:'TREND WEAR',secondary:'Quiet confidence. Strong silhouettes.'}},
      {key:'marquee',type:'marquee',title:'',subtitle:'',body:'NEW SEASON  •  FREE DELIVERY OVER ৳2,500  •  EASY ORDERING  •  CURATED EVERYDAY STYLE',button_text:'',button_url:'',image_url:'',json:{}},
      {key:'categories',type:'categories',title:'Shop by edit',subtitle:'CURATED FOR YOUR EVERYDAY',body:'',button_text:'View all',button_url:'#shop',image_url:'',json:{}},
      {key:'featured',type:'products',title:'The current edit',subtitle:'SELECTED PIECES',body:'A focused selection of pieces worth wearing on repeat.',button_text:'Shop all',button_url:'#shop',image_url:'',json:{limit:8}},
      {key:'story',type:'story',title:'Designed for the way you live.',subtitle:'THE TREND WEAR POINT OF VIEW',body:'We believe great everyday style is less about noise and more about proportion, texture and confidence. Every edit is designed to feel considered without feeling complicated.',button_text:'Discover Trend Wear',button_url:'#about',image_url:'',json:{}},
      {key:'benefits',type:'benefits',title:'The essentials, made simple.',subtitle:'WHY TREND WEAR',body:'',button_text:'',button_url:'',image_url:'',json:{items:[['01','Considered quality','Pieces selected for repeat wear.'],['02','Easy ordering','A clean checkout with clear payment steps.'],['03','Human support','Reach us directly when you need help.']]}},
      {key:'faq',type:'faq',title:'Questions, answered.',subtitle:'GOOD TO KNOW',body:'',button_text:'',button_url:'',image_url:'',json:{items:[['How long does delivery take?','Inside Dhaka usually 1–2 days; outside Dhaka usually 2–5 days.'],['Can I order by phone or WhatsApp?','Yes. Use the contact or WhatsApp buttons and our team can assist you.'],['How do manual payments work?','Choose an enabled mobile payment method, send payment, then provide the sender number and transaction ID.']]}},
      {key:'about',type:'about',title:'About Trend Wear',subtitle:'OUR STORY',body:'Trend Wear is an independent fashion destination built around clean design, wearable silhouettes and a premium shopping experience.',button_text:'Contact us',button_url:'#contact',image_url:'',json:{}},
      {key:'contact',type:'contact',title:'Let’s talk.',subtitle:'CONTACT & SUPPORT',body:'For order help, sizing, availability or anything else, our team is here.',button_text:'WhatsApp us',button_url:'',image_url:'',json:{}},
      {key:'footer',type:'footer',title:'Trend Wear',subtitle:'',body:'Modern essentials. Refined every day.',button_text:'',button_url:'',image_url:'',json:{} }
    ];
    for (let i=0;i<sections.length;i++) {
      const s=sections[i];
      await query(`INSERT INTO landing_sections(section_key,type,title,subtitle,body,image_url,button_text,button_url,content_json,enabled,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[s.key,s.type,s.title,s.subtitle,s.body,s.image_url,s.button_text,s.button_url,JSON.stringify(s.json),1,i]);
    }
  }
}

module.exports = { db, query, batch, initDb };

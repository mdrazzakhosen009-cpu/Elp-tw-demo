require("dotenv").config?.();
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { query, initDb, batch } = require("./db");

const app = express();
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET is required");

function slugify(s) {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || crypto.randomBytes(4).toString("hex");
}
function signAdmin(id, email) {
  return jwt.sign({ sub: id, email, role: "admin" }, JWT_SECRET, { expiresIn: "8h" });
}
function auth(req, res, next) {
  try {
    const token = req.cookies.tw_admin;
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
function safeInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function safeMoney(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback;
}

app.get("/api/health", async (_req,res) => {
  try { await query("SELECT 1 AS ok"); res.json({ ok: true, service: "trend-wear" }); }
  catch { res.status(503).json({ ok:false }); }
});

app.get("/api/store", async (_req,res) => {
  const [settings, sections] = await Promise.all([
    query("SELECT key,value FROM settings"),
    query("SELECT * FROM landing_sections WHERE enabled=1 ORDER BY sort_order,id")
  ]);
  const obj = {};
  for (const r of settings.rows) obj[r.key] = r.value;
  res.json({ settings: obj, sections: sections.rows });
});

app.get("/api/categories", async (_req,res) => {
  const r = await query("SELECT * FROM categories ORDER BY name");
  res.json(r.rows);
});

app.get("/api/products", async (req,res) => {
  const args = [];
  const where = ["p.active=1"];
  if (req.query.category) { where.push("c.slug=?"); args.push(String(req.query.category)); }
  if (req.query.search) { where.push("(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)"); const q=`%${String(req.query.search).toLowerCase()}%`; args.push(q,q); }
  if (req.query.featured === "1") where.push("p.featured=1");
  const r = await query(`SELECT p.*, c.name AS category_name, c.slug AS category_slug
    FROM products p LEFT JOIN categories c ON c.id=p.category_id
    WHERE ${where.join(" AND ")} ORDER BY p.created_at DESC`, args);
  res.json(r.rows);
});

app.get("/api/products/:slug", async (req,res) => {
  const r = await query(`SELECT p.*, c.name category_name,c.slug category_slug
    FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.slug=? AND p.active=1`, [req.params.slug]);
  if (!r.rows[0]) return res.status(404).json({error:"Product not found"});
  res.json(r.rows[0]);
});

app.post("/api/orders", async (req,res) => {
  const { customer, items, payment_method = "cod", notes = "" } = req.body || {};
  if (!customer?.name || !customer?.phone || !customer?.address || !Array.isArray(items) || items.length < 1) {
    return res.status(400).json({error:"Name, phone, address and at least one item are required."});
  }
  const cleanItems = [];
  for (const item of items.slice(0, 50)) {
    const id = safeInt(item.product_id);
    const qty = safeInt(item.quantity, 0);
    if (id < 1 || qty < 1 || qty > 99) return res.status(400).json({error:"Invalid cart item."});
    const p = await query("SELECT id,name,price,stock,active FROM products WHERE id=?", [id]);
    if (!p.rows[0] || !p.rows[0].active) return res.status(400).json({error:"A product is unavailable."});
    if (p.rows[0].stock < qty) return res.status(400).json({error:`Not enough stock for ${p.rows[0].name}.`});
    cleanItems.push({ ...p.rows[0], quantity: qty, line_total: Number(p.rows[0].price) * qty });
  }
  const subtotal = cleanItems.reduce((a,b)=>a+b.line_total,0);
  const s = await query("SELECT value FROM settings WHERE key='delivery_fee'");
  const delivery = safeMoney(s.rows[0]?.value, 80);
  const total = subtotal + delivery;

  const existing = await query("SELECT id FROM customers WHERE phone=?", [String(customer.phone).trim()]);
  let customerId;
  if (existing.rows[0]) {
    customerId = existing.rows[0].id;
    await query("UPDATE customers SET name=?,email=?,address=? WHERE id=?", [
      String(customer.name).trim(), String(customer.email||"").trim(), String(customer.address).trim(), customerId
    ]);
  } else {
    const c = await query("INSERT INTO customers(name,phone,email,address) VALUES(?,?,?,?)", [
      String(customer.name).trim(), String(customer.phone).trim(), String(customer.email||"").trim(), String(customer.address).trim()
    ]);
    customerId = Number(c.lastInsertRowid);
  }

  const code = "TW-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(2).toString("hex").toUpperCase();
  const order = await query(`INSERT INTO orders(order_code,customer_id,subtotal,delivery_fee,total,payment_method,notes)
    VALUES(?,?,?,?,?,?,?)`, [code, customerId, subtotal, delivery, total, String(payment_method), String(notes).slice(0,1000)]);
  const orderId = Number(order.lastInsertRowid);

  const statements = [];
  for (const p of cleanItems) {
    statements.push({sql:`INSERT INTO order_items(order_id,product_id,product_name,unit_price,quantity,line_total) VALUES(?,?,?,?,?,?)`,
      args:[orderId,p.id,p.name,p.price,p.quantity,p.line_total]});
    statements.push({sql:`UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=?`,
      args:[p.quantity,p.id,p.quantity]});
  }
  await batch(statements);
  res.status(201).json({order_code:code,total,payment_status:"pending"});
});

app.post("/api/admin/login", async (req,res) => {
  const email = String(req.body?.email||"").trim().toLowerCase();
  const password = String(req.body?.password||"");
  const r = await query("SELECT * FROM admins WHERE email=?", [email]);
  if (!r.rows[0] || !(await bcrypt.compare(password, r.rows[0].password_hash))) {
    return res.status(401).json({error:"Invalid credentials"});
  }
  const token = signAdmin(r.rows[0].id, r.rows[0].email);
  res.cookie("tw_admin", token, { httpOnly:true, sameSite:"lax", secure:process.env.NODE_ENV==="production", maxAge:8*60*60*1000 });
  res.json({ok:true});
});
app.post("/api/admin/logout", auth, (_req,res) => {
  res.clearCookie("tw_admin");
  res.json({ok:true});
});
app.get("/api/admin/me", auth, (req,res)=>res.json({id:req.admin.sub,email:req.admin.email}));

app.get("/api/admin/dashboard", auth, async (_req,res) => {
  const [o,p,c,r] = await Promise.all([
    query("SELECT COUNT(*) c, COALESCE(SUM(total),0) revenue FROM orders"),
    query("SELECT COUNT(*) c, COALESCE(SUM(CASE WHEN stock<=5 THEN 1 ELSE 0 END),0) low FROM products WHERE active=1"),
    query("SELECT COUNT(*) c FROM customers"),
    query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 10")
  ]);
  res.json({orders:o.rows[0],products:p.rows[0],customers:c.rows[0],recent:r.rows});
});

app.get("/api/admin/products", auth, async (_req,res) => {
  const r=await query(`SELECT p.*,c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.created_at DESC`);
  res.json(r.rows);
});
app.post("/api/admin/products", auth, async (req,res) => {
  const b=req.body||{};
  if(!b.name) return res.status(400).json({error:"Name required"});
  const slug=slugify(b.slug||b.name);
  try {
    const r=await query(`INSERT INTO products(category_id,name,slug,description,price,compare_price,stock,image_url,featured,active)
      VALUES(?,?,?,?,?,?,?,?,?,?)`,[
        safeInt(b.category_id)||null,String(b.name).trim(),slug,String(b.description||""),
        safeMoney(b.price),b.compare_price===""||b.compare_price==null?null:safeMoney(b.compare_price),
        Math.max(0,safeInt(b.stock)),String(b.image_url||""),b.featured?1:0,b.active===false?0:1
      ]);
    res.status(201).json({id:Number(r.lastInsertRowid)});
  } catch(e) { res.status(400).json({error:e.message.includes("UNIQUE")?"Slug already exists.":"Unable to create product."}); }
});
app.put("/api/admin/products/:id", auth, async (req,res) => {
  const b=req.body||{};
  await query(`UPDATE products SET category_id=?,name=?,description=?,price=?,compare_price=?,stock=?,image_url=?,featured=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[
    safeInt(b.category_id)||null,String(b.name||"").trim(),String(b.description||""),safeMoney(b.price),
    b.compare_price===""||b.compare_price==null?null:safeMoney(b.compare_price),Math.max(0,safeInt(b.stock)),
    String(b.image_url||""),b.featured?1:0,b.active===false?0:1,safeInt(req.params.id)
  ]);
  res.json({ok:true});
});
app.delete("/api/admin/products/:id", auth, async (req,res) => {
  await query("UPDATE products SET active=0 WHERE id=?", [safeInt(req.params.id)]);
  res.json({ok:true});
});

app.get("/api/admin/orders", auth, async (_req,res) => {
  const r=await query(`SELECT o.*,c.name customer_name,c.phone,c.address FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC`);
  res.json(r.rows);
});
app.put("/api/admin/orders/:id", auth, async (req,res) => {
  const allowedStatus=["pending","confirmed","processing","shipped","delivered","cancelled"];
  const allowedPayment=["pending","paid","failed","refunded"];
  const status=String(req.body?.order_status||"pending"), payment=String(req.body?.payment_status||"pending");
  if(!allowedStatus.includes(status)||!allowedPayment.includes(payment)) return res.status(400).json({error:"Invalid status"});
  await query("UPDATE orders SET order_status=?,payment_status=? WHERE id=?",[status,payment,safeInt(req.params.id)]);
  res.json({ok:true});
});

app.get("/api/admin/settings", auth, async (_req,res) => {
  const r=await query("SELECT key,value FROM settings ORDER BY key");
  res.json(Object.fromEntries(r.rows.map(x=>[x.key,x.value])));
});
app.put("/api/admin/settings", auth, async (req,res) => {
  for (const [key,value] of Object.entries(req.body||{})) {
    if(!/^[a-z0-9_]{1,60}$/.test(key)) continue;
    await query(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`,[key,String(value).slice(0,5000)]);
  }
  res.json({ok:true});
});
app.get("/api/admin/landing", auth, async (_req,res) => {
  const r=await query("SELECT * FROM landing_sections ORDER BY sort_order,id");
  res.json(r.rows);
});
app.put("/api/admin/landing/:id", auth, async (req,res) => {
  const b=req.body||{};
  await query(`UPDATE landing_sections SET title=?,subtitle=?,body=?,image_url=?,button_text=?,button_url=?,enabled=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[
    String(b.title||""),String(b.subtitle||""),String(b.body||""),String(b.image_url||""),String(b.button_text||""),
    String(b.button_url||""),b.enabled?1:0,safeInt(b.sort_order),safeInt(req.params.id)
  ]);
  res.json({ok:true});
});

app.use(express.static(path.join(__dirname, "..", "public"), { extensions:["html"] }));
app.get("/admin", (_req,res)=>res.sendFile(path.join(__dirname,"..","public","admin.html")));
app.get("/{*splat}", (_req,res)=>res.sendFile(path.join(__dirname,"..","public","index.html")));

async function bootstrap() {
  await initDb();
  const email=String(process.env.ADMIN_EMAIL||"").trim().toLowerCase();
  const password=String(process.env.ADMIN_PASSWORD||"");
  if(!email||!password) throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  const hash=await bcrypt.hash(password,12);
  await query(`INSERT INTO admins(email,password_hash) VALUES(?,?)
    ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash`,[email,hash]);
  app.listen(PORT,()=>console.log(`Trend Wear running on port ${PORT}`));
}
bootstrap().catch(err=>{console.error(err);process.exit(1);});

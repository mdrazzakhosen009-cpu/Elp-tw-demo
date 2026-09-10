require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query, initDb, db } = require('./db');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required');

const loginAttempts = new Map();
const RATE_WINDOW = 15 * 60 * 1000;
const RATE_LIMIT = 10;

function clean(v, max = 5000) { return String(v ?? '').trim().slice(0, max); }
function int(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : fallback; }
function money(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : fallback; }
function slugify(v) { return clean(v,120).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || crypto.randomBytes(4).toString('hex'); }
function signAdmin(id,email) { return jwt.sign({sub:id,email,role:'admin'},JWT_SECRET,{expiresIn:'8h'}); }
function auth(req,res,next) { try { const token=req.cookies.tw_admin; if(!token) return res.status(401).json({error:'Unauthorized'}); req.admin=jwt.verify(token,JWT_SECRET); next(); } catch { res.status(401).json({error:'Unauthorized'}); } }
function rateKey(req){ return `${req.ip}:${clean(req.body?.email,120).toLowerCase()}`; }
function rateBlocked(req){ const now=Date.now(), key=rateKey(req), a=loginAttempts.get(key)||[]; const fresh=a.filter(t=>now-t<RATE_WINDOW); loginAttempts.set(key,fresh); return fresh.length>=RATE_LIMIT; }
function rateFail(req){ const key=rateKey(req), a=loginAttempts.get(key)||[]; a.push(Date.now()); loginAttempts.set(key,a.slice(-RATE_LIMIT)); }
function rateClear(req){ loginAttempts.delete(rateKey(req)); }
function parseJson(v, fallback={}) { try { return JSON.parse(v || ''); } catch { return fallback; } }
function publicSettings(rows){ const o={}; for(const r of rows) o[r.key]=r.value; return o; }
function paymentOptions(s){
  const out=[];
  if(s.cod_enabled==='1') out.push({method:'Cash on Delivery',number:'',manual:false});
  if(s.bkash_enabled==='1' && s.bkash_number) out.push({method:'bKash',number:s.bkash_number,manual:true});
  if(s.nagad_enabled==='1' && s.nagad_number) out.push({method:'Nagad',number:s.nagad_number,manual:true});
  if(s.rocket_enabled==='1' && s.rocket_number) out.push({method:'Rocket',number:s.rocket_number,manual:true});
  return out;
}

app.get('/api/health', async (_req,res)=>{ try { await query('SELECT 1 AS ok'); res.json({ok:true,service:'trend-wear'}); } catch(e){ res.status(503).json({ok:false}); } });

app.get('/api/store', async (_req,res)=>{
  try {
    const [s,sections,cats] = await Promise.all([
      query('SELECT key,value FROM settings'),
      query('SELECT * FROM landing_sections WHERE enabled=1 ORDER BY sort_order,id'),
      query('SELECT * FROM categories WHERE active=1 ORDER BY sort_order,name')
    ]);
    res.json({settings:publicSettings(s.rows),sections:sections.rows.map(x=>({...x,content:parseJson(x.content_json,{})})),categories:cats.rows,payments:paymentOptions(publicSettings(s.rows))});
  } catch(e){ res.status(500).json({error:'Unable to load store.'}); }
});

app.get('/api/categories', async (_req,res)=>{ const r=await query('SELECT * FROM categories WHERE active=1 ORDER BY sort_order,name'); res.json(r.rows); });

app.get('/api/products', async (req,res)=>{
  const args=[]; const where=['p.active=1'];
  if(req.query.category){ where.push('c.slug=?'); args.push(clean(req.query.category,120)); }
  if(req.query.search){ const q=`%${clean(req.query.search,100).toLowerCase()}%`; where.push('(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ?)'); args.push(q,q); }
  if(req.query.featured==='1') where.push('p.featured=1');
  const sort = req.query.sort==='price_asc' ? 'p.price ASC' : req.query.sort==='price_desc' ? 'p.price DESC' : 'p.created_at DESC';
  const r=await query(`SELECT p.*,c.name category_name,c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE ${where.join(' AND ')} ORDER BY ${sort}`,args);
  res.json(r.rows.map(p=>({...p,gallery:parseJson(p.gallery_json,[])})));
});

app.get('/api/products/:slug', async (req,res)=>{
  const r=await query(`SELECT p.*,c.name category_name,c.slug category_slug FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.slug=? AND p.active=1`,[clean(req.params.slug,150)]);
  if(!r.rows[0]) return res.status(404).json({error:'Product not found'});
  const p=r.rows[0]; p.gallery=parseJson(p.gallery_json,[]); res.json(p);
});

app.get('/api/orders/:code', async (req,res)=>{
  const r=await query(`SELECT o.order_code,o.subtotal,o.delivery_fee,o.total,o.payment_method,o.payment_status,o.order_status,o.created_at,o.updated_at,c.name,c.phone,c.address,o.items_json FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.order_code=?`,[clean(req.params.code,80)]);
  if(!r.rows[0]) return res.status(404).json({error:'Order not found'});
  const o=r.rows[0]; res.json({...o,items:parseJson(o.items_json,[]),items_json:undefined});
});

app.post('/api/orders', async (req,res)=>{
  const b=req.body||{}; const customer=b.customer||{}; const items=Array.isArray(b.items)?b.items.slice(0,50):[];
  if(!clean(customer.name,120)||!clean(customer.phone,40)||!clean(customer.address,1000)||!items.length) return res.status(400).json({error:'Name, phone, address and at least one item are required.'});
  const settings=publicSettings((await query('SELECT key,value FROM settings')).rows); const options=paymentOptions(settings); const pm=clean(b.payment_method,80); const chosen=options.find(x=>x.method===pm);
  if(!chosen) return res.status(400).json({error:'Selected payment method is not available.'});
  if(chosen.manual && (!clean(b.payment_sender,40)||!clean(b.transaction_id,120))) return res.status(400).json({error:'Sender number and transaction ID are required for manual payment.'});
  const delivery=money(settings.delivery_fee,80); let subtotal=0; const finalItems=[];
  const tx=await db.transaction('write');
  try {
    for(const item of items){
      const id=int(item.product_id); const qty=Math.min(99,Math.max(1,int(item.quantity,1)));
      const p=await tx.execute({sql:'SELECT id,name,price,stock,image_url,active FROM products WHERE id=?',args:[id]});
      const row=p.rows[0]; if(!row||!row.active) throw new Error('A product is unavailable.');
      const updated=await tx.execute({sql:'UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND active=1 AND stock>=?',args:[qty,id,qty]});
      if(Number(updated.rowsAffected)!==1) throw new Error(`Not enough stock for ${row.name}.`);
      const line=Number(row.price)*qty; subtotal+=line; finalItems.push({id:row.id,name:row.name,price:Number(row.price),quantity:qty,image_url:row.image_url||'',line_total:line});
    }
    const total=subtotal+delivery; const phone=clean(customer.phone,40);
    const existing=await tx.execute({sql:'SELECT id FROM customers WHERE phone=?',args:[phone]}); let customerId;
    if(existing.rows[0]) { customerId=Number(existing.rows[0].id); await tx.execute({sql:'UPDATE customers SET name=?,email=?,address=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',args:[clean(customer.name,120),clean(customer.email,160),clean(customer.address,1000),customerId]}); }
    else { const c=await tx.execute({sql:'INSERT INTO customers(name,phone,email,address) VALUES(?,?,?,?)',args:[clean(customer.name,120),phone,clean(customer.email,160),clean(customer.address,1000)]}); customerId=Number(c.lastInsertRowid); }
    const code='TW-'+Date.now().toString(36).toUpperCase()+'-'+crypto.randomBytes(2).toString('hex').toUpperCase();
    await tx.execute({sql:`INSERT INTO orders(order_code,customer_id,subtotal,delivery_fee,total,payment_method,payment_sender,transaction_id,payment_status,order_status,notes,items_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,args:[code,customerId,subtotal,delivery,total,pm,chosen.manual?clean(b.payment_sender,40):'',chosen.manual?clean(b.transaction_id,120):'',chosen.manual?'pending':'pending','pending',clean(b.notes,1000),JSON.stringify(finalItems)]});
    await tx.commit(); res.status(201).json({success:true,order_code:code,total,payment_status:'pending',order_status:'pending'});
  } catch(e){ try{await tx.rollback();}catch{} res.status(400).json({error:e.message||'Unable to place order.'}); }
});

app.post('/api/leads', async (req,res)=>{ const b=req.body||{}; if(!clean(b.message,3000) && !clean(b.email,160) && !clean(b.phone,40)) return res.status(400).json({error:'Please provide a message or contact detail.'}); await query('INSERT INTO leads(name,email,phone,message) VALUES(?,?,?,?)',[clean(b.name,120),clean(b.email,160),clean(b.phone,40),clean(b.message,3000)]); res.status(201).json({success:true}); });

app.post('/api/admin/login', async (req,res)=>{
  if(rateBlocked(req)) return res.status(429).json({error:'Too many attempts. Please try again later.'});
  const email=clean(req.body?.email,160).toLowerCase(), password=String(req.body?.password||'');
  const r=await query('SELECT * FROM admins WHERE email=?',[email]);
  if(!r.rows[0] || !(await bcrypt.compare(password,r.rows[0].password_hash))){ rateFail(req); return res.status(401).json({error:'Invalid email or password'}); }
  rateClear(req); const token=signAdmin(r.rows[0].id,r.rows[0].email); res.cookie('tw_admin',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000}); res.json({success:true});
});
app.post('/api/admin/logout',auth,(_req,res)=>{res.clearCookie('tw_admin');res.json({success:true});});
app.get('/api/admin/me',auth,(req,res)=>res.json({authenticated:true,id:req.admin.sub,email:req.admin.email}));

app.get('/api/admin/dashboard',auth,async(_req,res)=>{
  const [o,p,c,l,recent]=await Promise.all([
    query('SELECT COUNT(*) c,COALESCE(SUM(total),0) revenue FROM orders'),
    query('SELECT COUNT(*) c,COALESCE(SUM(CASE WHEN stock<=5 THEN 1 ELSE 0 END),0) low FROM products WHERE active=1'),
    query('SELECT COUNT(*) c FROM customers'),
    query('SELECT COUNT(*) c FROM leads'),
    query('SELECT o.id,o.order_code,o.total,o.order_status,o.payment_status,o.created_at,c.name customer_name,c.phone FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC LIMIT 10')
  ]); res.json({orders:o.rows[0],products:p.rows[0],customers:c.rows[0],leads:l.rows[0],recent:recent.rows});
});

app.get('/api/admin/settings',auth,async(_req,res)=>res.json(publicSettings((await query('SELECT key,value FROM settings ORDER BY key')).rows)));
app.put('/api/admin/settings',auth,async(req,res)=>{ for(const [k,v] of Object.entries(req.body||{})){ if(!/^[a-z0-9_]{1,80}$/.test(k)) continue; await query(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`,[k,clean(v,10000)]); } res.json({success:true}); });

app.get('/api/admin/landing',auth,async(_req,res)=>{const r=await query('SELECT * FROM landing_sections ORDER BY sort_order,id');res.json(r.rows.map(x=>({...x,content:parseJson(x.content_json,{})})));});
app.put('/api/admin/landing/:id',auth,async(req,res)=>{const b=req.body||{};await query(`UPDATE landing_sections SET title=?,subtitle=?,body=?,image_url=?,button_text=?,button_url=?,content_json=?,enabled=?,sort_order=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[clean(b.title),clean(b.subtitle),clean(b.body,10000),clean(b.image_url,1000),clean(b.button_text,120),clean(b.button_url,500),JSON.stringify(b.content||{}),b.enabled?1:0,int(b.sort_order),int(req.params.id)]);res.json({success:true});});
app.post('/api/admin/landing',auth,async(req,res)=>{const b=req.body||{};const key=slugify(b.section_key||b.title||'section');const r=await query(`INSERT INTO landing_sections(section_key,type,title,subtitle,body,image_url,button_text,button_url,content_json,enabled,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[key,clean(b.type||'custom',50),clean(b.title),clean(b.subtitle),clean(b.body,10000),clean(b.image_url,1000),clean(b.button_text,120),clean(b.button_url,500),JSON.stringify(b.content||{}),b.enabled===false?0:1,int(b.sort_order,99)]);res.status(201).json({id:Number(r.lastInsertRowid)});});
app.delete('/api/admin/landing/:id',auth,async(req,res)=>{await query('DELETE FROM landing_sections WHERE id=?',[int(req.params.id)]);res.json({success:true});});

app.get('/api/admin/categories',auth,async(_req,res)=>res.json((await query('SELECT * FROM categories ORDER BY sort_order,name')).rows));
app.post('/api/admin/categories',auth,async(req,res)=>{const b=req.body||{};if(!clean(b.name,120))return res.status(400).json({error:'Category name required'});const r=await query('INSERT INTO categories(name,slug,description,image_url,active,sort_order) VALUES(?,?,?,?,?,?)',[clean(b.name,120),slugify(b.slug||b.name),clean(b.description,1000),clean(b.image_url,1000),b.active===false?0:1,int(b.sort_order)]);res.status(201).json({id:Number(r.lastInsertRowid)});});
app.put('/api/admin/categories/:id',auth,async(req,res)=>{const b=req.body||{};await query('UPDATE categories SET name=?,description=?,image_url=?,active=?,sort_order=? WHERE id=?',[clean(b.name,120),clean(b.description,1000),clean(b.image_url,1000),b.active?1:0,int(b.sort_order),int(req.params.id)]);res.json({success:true});});
app.delete('/api/admin/categories/:id',auth,async(req,res)=>{await query('UPDATE categories SET active=0 WHERE id=?',[int(req.params.id)]);res.json({success:true});});

app.get('/api/admin/products',auth,async(_req,res)=>res.json((await query(`SELECT p.*,c.name category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id ORDER BY p.created_at DESC`)).rows.map(p=>({...p,gallery:parseJson(p.gallery_json,[])}))));
app.post('/api/admin/products',auth,async(req,res)=>{const b=req.body||{};if(!clean(b.name,200))return res.status(400).json({error:'Product name required'});const r=await query(`INSERT INTO products(category_id,name,slug,description,price,compare_price,stock,image_url,gallery_json,featured,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,[int(b.category_id)||null,clean(b.name,200),slugify(b.slug||b.name),clean(b.description,10000),money(b.price),b.compare_price===''||b.compare_price==null?null:money(b.compare_price),Math.max(0,int(b.stock)),clean(b.image_url,1000),JSON.stringify(Array.isArray(b.gallery)?b.gallery.slice(0,12).map(x=>clean(x,1000)):[]),b.featured?1:0,b.active===false?0:1]);res.status(201).json({id:Number(r.lastInsertRowid)});});
app.put('/api/admin/products/:id',auth,async(req,res)=>{const b=req.body||{};await query(`UPDATE products SET category_id=?,name=?,description=?,price=?,compare_price=?,stock=?,image_url=?,gallery_json=?,featured=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`,[int(b.category_id)||null,clean(b.name,200),clean(b.description,10000),money(b.price),b.compare_price===''||b.compare_price==null?null:money(b.compare_price),Math.max(0,int(b.stock)),clean(b.image_url,1000),JSON.stringify(Array.isArray(b.gallery)?b.gallery.slice(0,12).map(x=>clean(x,1000)):[]),b.featured?1:0,b.active?1:0,int(req.params.id)]);res.json({success:true});});
app.delete('/api/admin/products/:id',auth,async(req,res)=>{await query('UPDATE products SET active=0 WHERE id=?',[int(req.params.id)]);res.json({success:true});});

app.get('/api/admin/orders',auth,async(_req,res)=>{const r=await query(`SELECT o.*,c.name customer_name,c.phone,c.email,c.address FROM orders o JOIN customers c ON c.id=o.customer_id ORDER BY o.created_at DESC`);res.json(r.rows.map(o=>({...o,items:parseJson(o.items_json,[])})));});
app.put('/api/admin/orders/:id',auth,async(req,res)=>{const status=['pending','confirmed','processing','shipped','delivered','cancelled'].includes(clean(req.body?.order_status,30))?clean(req.body.order_status,30):null;const payment=['pending','paid','failed','refunded'].includes(clean(req.body?.payment_status,30))?clean(req.body.payment_status,30):null;if(!status||!payment)return res.status(400).json({error:'Invalid status'});await query('UPDATE orders SET order_status=?,payment_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[status,payment,int(req.params.id)]);res.json({success:true});});

app.get('/api/admin/leads',auth,async(_req,res)=>res.json((await query('SELECT * FROM leads ORDER BY created_at DESC')).rows));
app.delete('/api/admin/leads/:id',auth,async(req,res)=>{await query('DELETE FROM leads WHERE id=?',[int(req.params.id)]);res.json({success:true});});
app.post('/api/admin/password',auth,async(req,res)=>{const old=String(req.body?.old_password||''), next=String(req.body?.new_password||'');if(next.length<10)return res.status(400).json({error:'New password must be at least 10 characters.'});const r=await query('SELECT password_hash FROM admins WHERE id=?',[int(req.admin.sub)]);if(!r.rows[0]||!(await bcrypt.compare(old,r.rows[0].password_hash)))return res.status(401).json({error:'Current password is incorrect.'});await query('UPDATE admins SET password_hash=? WHERE id=?',[await bcrypt.hash(next,12),int(req.admin.sub)]);res.json({success:true});});

app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found'}));
app.use(express.static(path.join(__dirname,'..','public'),{extensions:['html']}));
app.get('/admin',(_req,res)=>res.sendFile(path.join(__dirname,'..','public','admin','index.html')));
app.get('/admin/login',(_req,res)=>res.sendFile(path.join(__dirname,'..','public','admin','index.html')));
app.get('/admin/*splat',(_req,res)=>res.sendFile(path.join(__dirname,'..','public','admin','index.html')));
app.get('/*splat',(_req,res)=>res.sendFile(path.join(__dirname,'..','public','index.html')));

async function bootstrap(){
  await initDb();
  const email=clean(process.env.ADMIN_EMAIL,160).toLowerCase(); const password=String(process.env.ADMIN_PASSWORD||'');
  if(!email||password.length<10) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD (minimum 10 characters) are required');
  const hash=await bcrypt.hash(password,12);
  await query(`INSERT INTO admins(email,password_hash) VALUES(?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash`,[email,hash]);
  app.listen(PORT,()=>console.log(`Trend Wear running on port ${PORT}`));
}
bootstrap().catch(err=>{console.error(err);process.exit(1);});

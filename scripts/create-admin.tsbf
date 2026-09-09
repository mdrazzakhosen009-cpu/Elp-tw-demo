import 'dotenv/config';
import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
const [email,password,name='Trend Wear BD Admin']=process.argv.slice(2);
if(!email||!password){console.error('Usage: npm run create-admin -- admin@example.com StrongPassword "Admin Name"');process.exit(1)}
if(password.length<8){console.error('Password must be at least 8 characters.');process.exit(1)}
const db=createClient({url:process.env.TURSO_DATABASE_URL||'',authToken:process.env.TURSO_AUTH_TOKEN});
const hash=await bcrypt.hash(password,12);
await db.execute({sql:'INSERT INTO admin_users(id,email,password_hash,name) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,name=excluded.name,updated_at=CURRENT_TIMESTAMP',args:[randomUUID(),email,hash,name]});
console.log('Admin created/updated:',email);

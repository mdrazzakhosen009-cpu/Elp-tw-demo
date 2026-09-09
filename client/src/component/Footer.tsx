import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Footer() {
  const [settings,setSettings]=useState<any>({});
  const [social,setSocial]=useState<any[]>([]);
  useEffect(()=>{Promise.all([api<any>('/site'),api<any>('/social')]).then(([s,so])=>{setSettings(s.settings||{});setSocial(so.items||[])}).catch(()=>{})},[]);
  return <footer className="footer"><div className="container footer-grid">
    <div><div className="logo"><img src="/logo.jpg" alt="Trend Wear BD"/><span>Trend Wear BD</span></div><p className="muted">{settings.aboutText||'Premium fashion for every style.'}</p></div>
    <div><strong>Contact</strong><p>{settings.phone||''}</p><p>{settings.email||''}</p><p>{settings.address||''}</p></div>
    <div><strong>Social</strong>{social.filter(x=>x.enabled).map(x=><a key={x.id} href={x.url} target="_blank" rel="noreferrer">{x.platform}</a>)}</div>
    <div><strong>Quick Links</strong><a href="/shop">Shop</a><a href="#contact">Contact</a><a href="/admin/login">Admin</a></div>
  </div><div className="container" style={{borderTop:'1px solid #333',marginTop:35,paddingTop:18,color:'#888'}}>{settings.copyright||'© Trend Wear BD. All rights reserved.'}</div></footer>
}

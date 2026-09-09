import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getCart } from '../lib/cart';

export default function Header() {
  const [count,setCount] = useState(getCart().reduce((s,x)=>s+x.quantity,0));
  useEffect(()=>{ const f=()=>setCount(getCart().reduce((s,x)=>s+x.quantity,0)); addEventListener('cartchange',f); return()=>removeEventListener('cartchange',f);},[]);
  return <header className="header"><div className="container nav">
    <Link className="logo" to="/"><img src="/logo.jpg" alt="Trend Wear BD logo"/><span>Trend Wear BD</span></Link>
    <nav className="navlinks"><Link to="/">Home</Link><Link to="/shop">Shop</Link><a href="#categories">Categories</a><a href="#reviews">Reviews</a><a href="#contact">Contact</a></nav>
    <div className="nav-actions"><Link className="iconbtn" to="/shop" aria-label="Search">⌕</Link><Link className="iconbtn" to="/cart" aria-label="Cart">🛍️<small>{count}</small></Link><Link className="btn btn-dark" to="/admin/login">Admin</Link></div>
  </div></header>
}
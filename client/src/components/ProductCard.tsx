import { Link } from 'react-router-dom';
import { addToCart } from '../lib/cart';

export default function ProductCard({p,onAdd}:{p:any,onAdd?:()=>void}) {
  const price=Number(p.sale_price ?? p.price);
  const img=(p.images||[])[0];
  return <article className="card product-card">
    <Link to={`/product/${p.slug}`}><div className="pic">{p.featured&&<span className="badge">Featured</span>}{img?<img src={img} alt={p.name} loading="lazy"/>:<div style={{height:'100%',display:'grid',placeItems:'center',color:'#777'}}>No image</div>}</div></Link>
    <div className="product-info"><h3><Link to={`/product/${p.slug}`}>{p.name}</Link></h3><div><span className="price">৳{price.toLocaleString()}</span>{p.sale_price&&<span className="old">৳{Number(p.price).toLocaleString()}</span>}</div><button className="btn btn-dark" style={{width:'100%',marginTop:13}} disabled={p.stock<=0} onClick={()=>{addToCart({productId:p.id,name:p.name,price,image:img,quantity:1});onAdd?.()}}>{p.stock>0?'Add to cart':'Out of stock'}</button></div>
  </article>
}
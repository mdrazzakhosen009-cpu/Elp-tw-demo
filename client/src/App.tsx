import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import AdminLogin from './admin/AdminLogin';
import AdminApp from './admin/AdminApp';

export default function App(){
 return <Routes>
   <Route path="*" element={<PublicLayout/>}/>
   <Route path="/admin/login" element={<AdminLogin/>}/>
   <Route path="/admin/*" element={<AdminApp/>}/>
 </Routes>
}
function PublicLayout(){
 return <Routes>
   <Route path="/" element={<Home/>}/><Route path="/shop" element={<Shop/>}/><Route path="/product/:slug" element={<Product/>}/><Route path="/cart" element={<Cart/>}/><Route path="/checkout" element={<Checkout/>}/>
 </Routes>
}
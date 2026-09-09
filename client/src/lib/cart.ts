export type CartItem = {
  productId: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
  variant?: Record<string, string>;
};

const KEY = 'trend-wear-cart';

export function getCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function saveCart(items: CartItem[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('cartchange'));
}
export function addToCart(item: CartItem) {
  const cart = getCart();
  const existing = cart.find(x => x.productId === item.productId && JSON.stringify(x.variant||{}) === JSON.stringify(item.variant||{}));
  if (existing) existing.quantity += item.quantity;
  else cart.push(item);
  saveCart(cart);
}
export function removeFromCart(productId: string) {
  saveCart(getCart().filter(x => x.productId !== productId));
}
export function updateQty(productId: string, quantity: number) {
  saveCart(getCart().map(x => x.productId === productId ? {...x, quantity: Math.max(1, quantity)} : x));
}

const CART_KEY = 'etonManorCart';

export function getCart() {
  const raw = sessionStorage.getItem(CART_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCart(items) {
  sessionStorage.setItem(CART_KEY, JSON.stringify(items));
  document.dispatchEvent(new CustomEvent('cart:change', { detail: { items } }));
}

export function addToCart(id, size, quantity) {
  const items = getCart();
  const existing = items.find((item) => item.id === id && item.size === size);
  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({ id, size, quantity });
  }
  saveCart(items);
}

export function removeFromCart(id, size) {
  const items = getCart().filter((item) => !(item.id === id && item.size === size));
  saveCart(items);
}

export function updateQuantity(id, size, quantity) {
  const items = getCart();
  const existing = items.find((item) => item.id === id && item.size === size);
  if (!existing) return;
  if (quantity <= 0) {
    removeFromCart(id, size);
    return;
  }
  existing.quantity = quantity;
  saveCart(items);
}

export function clearCart() {
  sessionStorage.removeItem(CART_KEY);
  document.dispatchEvent(new CustomEvent('cart:change', { detail: { items: [] } }));
}

export function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

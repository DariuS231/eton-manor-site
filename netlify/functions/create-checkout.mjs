import { readFileSync } from 'node:fs';
import Stripe from 'stripe';
import * as Sentry from '@sentry/node';

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0 });
}

const catalog = JSON.parse(readFileSync(new URL('./kit-catalog.json', import.meta.url), 'utf-8'));

const MAX_CART_ITEMS = 50;
const MAX_QUANTITY = 100;

export class ValidationError extends Error {}

export function buildCheckoutParams(cartItems, catalogData, origin) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new ValidationError('Cart is empty.');
  }
  if (cartItems.length > MAX_CART_ITEMS) {
    throw new ValidationError('Cart has too many items.');
  }

  const line_items = cartItems.map((cartItem) => {
    if (!cartItem || typeof cartItem !== 'object' || typeof cartItem.id !== 'string') {
      throw new ValidationError('Invalid cart item.');
    }
    const product = catalogData.find((p) => p.id === cartItem.id);
    if (!product) {
      throw new ValidationError(`Unknown item: ${cartItem.id}`);
    }

    const hasSizes = Array.isArray(product.sizes) && product.sizes.length > 0;
    if (hasSizes && !product.sizes.includes(cartItem.size)) {
      throw new ValidationError(`Invalid size for ${product.name}.`);
    }
    if (!hasSizes && cartItem.size) {
      throw new ValidationError(`${product.name} does not have sizes.`);
    }

    const quantity = Number(cartItem.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      throw new ValidationError(`Invalid quantity for ${product.name}.`);
    }

    return {
      price_data: {
        currency: 'gbp',
        product_data: {
          name: cartItem.size ? `${product.name} — ${cartItem.size}` : product.name,
        },
        unit_amount: Math.round(product.priceGBP * 100),
      },
      quantity,
    };
  });

  return {
    mode: 'payment',
    line_items,
    success_url: `${origin}/club-kit/success`,
    cancel_url: `${origin}/club-kit/cart`,
  };
}

export default async (req) => {
  const origin = new URL(req.url).origin;
  const jsonHeaders = { 'Content-Type': 'application/json' };

  let items;
  try {
    const body = await req.json();
    items = body.items;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  let params;
  try {
    params = buildCheckoutParams(items, catalog, origin);
  } catch (err) {
    if (err instanceof ValidationError) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: jsonHeaders,
      });
    }
    console.error('Unexpected error building checkout params:', err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: 'Unable to create checkout session.' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
    const session = await stripe.checkout.sessions.create(params);
    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    console.error('Stripe checkout session creation failed:', err);
    Sentry.captureException(err);
    await Sentry.flush(2000);
    return new Response(JSON.stringify({ error: 'Unable to create checkout session.' }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
};

export const config = { path: '/api/checkout' };

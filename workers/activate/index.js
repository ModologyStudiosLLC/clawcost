/**
 * ClawCost Pro Activation Worker
 *
 * Verifies that a given email has an active ClawCost Pro subscription on Stripe.
 * Called by self-hosted ClawCost instances during Pro activation.
 *
 * Secrets (set via: npx wrangler secret put STRIPE_SECRET_KEY):
 *   STRIPE_SECRET_KEY   — Stripe live secret key
 *   STRIPE_PRODUCT_ID   — prod_UG2SghuGm80B30
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, message: 'Method not allowed' }, 405);
    }

    let email;
    try {
      const body = await request.json();
      email = body.email?.trim().toLowerCase();
    } catch {
      return json({ ok: false, message: 'Invalid JSON body' }, 400);
    }

    if (!email) {
      return json({ ok: false, message: 'Email is required' }, 400);
    }

    if (!env.STRIPE_SECRET_KEY) {
      return json({ ok: false, message: 'Worker not configured' }, 500);
    }

    try {
      const result = await verifySubscription(email, env.STRIPE_SECRET_KEY, env.STRIPE_PRODUCT_ID);
      return json(result);
    } catch (err) {
      console.error('Activation error:', err);
      return json({ ok: false, message: 'Verification failed — please try again.' }, 500);
    }
  },
};

async function verifySubscription(email, stripeKey, productId) {
  // Look up customers by email
  const customersRes = await stripeGet(
    `customers?email=${encodeURIComponent(email)}&limit=5`,
    stripeKey,
  );

  if (!customersRes.data?.length) {
    return {
      ok: false,
      message: `No account found for ${email}. Use the exact email you purchased with.`,
    };
  }

  for (const customer of customersRes.data) {
    const subsRes = await stripeGet(
      `subscriptions?customer=${customer.id}&status=active&limit=10&expand[]=data.items`,
      stripeKey,
    );

    for (const sub of subsRes.data ?? []) {
      const isClawcost = sub.items?.data?.some(
        item => item.price?.product === productId,
      );

      if (isClawcost) {
        return {
          ok: true,
          message: `Pro activated for ${email}`,
          customer_id: customer.id,
          subscription_id: sub.id,
        };
      }
    }
  }

  return {
    ok: false,
    message: `No active ClawCost Pro subscription found for ${email}. If you just purchased, wait a moment and try again.`,
  };
}

async function stripeGet(path, key) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${key}`,
    },
  });
  return res.json();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

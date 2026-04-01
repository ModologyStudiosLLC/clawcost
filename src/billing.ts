import Stripe from 'stripe';
import crypto from 'crypto';
import { getSetting, setSetting, createLicense, cancelLicense, getLicenseBySubscription, getActiveLicenses } from './db.js';

function getStripe(): Stripe | null {
  const key = getSetting('stripe_secret_key');
  if (!key) return null;
  return new Stripe(key);
}

function generateLicenseKey(): string {
  return 'cc_' + crypto.randomBytes(24).toString('hex');
}

// ── Checkout session ────────────────────────────────────────────────────────

export async function createCheckoutSession(successUrl: string, cancelUrl: string): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured. Set stripe_secret_key in settings.');

  const priceId = getSetting('stripe_price_id');
  if (!priceId) throw new Error('Stripe price not configured. Set stripe_price_id in settings.');

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl + '?session_id={CHECKOUT_SESSION_ID}',
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    metadata: { product: 'clawcost_pro' },
  });

  return { url: session.url! };
}

// ── Customer portal ─────────────────────────────────────────────────────────

export async function createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured.');

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

// ── Webhook handler ─────────────────────────────────────────────────────────

export async function handleWebhook(rawBody: Buffer, signature: string): Promise<{ handled: boolean; event: string }> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured.');

  const webhookSecret = getSetting('stripe_webhook_secret');
  if (!webhookSecret) throw new Error('stripe_webhook_secret not set.');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    throw new Error(`Webhook signature verification failed: ${String(err)}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription' || !session.customer_email) break;
      const licenseKey = generateLicenseKey();
      createLicense(
        licenseKey,
        session.customer_email,
        session.customer as string,
        session.subscription as string,
      );
      console.log(`[ClawCost] New Pro license issued: ${licenseKey} → ${session.customer_email}`);
      // Store license key in settings for single-instance use
      setSetting('active_license_key', licenseKey);
      setSetting('active_license_email', session.customer_email);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      cancelLicense(sub.id);
      console.log(`[ClawCost] License cancelled for subscription: ${sub.id}`);
      break;
    }

    case 'customer.subscription.updated': {
      // Handle plan changes or payment failures if needed
      break;
    }
  }

  return { handled: true, event: event.type };
}

// ── Self-hosted activation ───────────────────────────────────────────────────
// No central server — user enters their purchase email and we verify directly
// against Stripe, then issue a local license.

export async function activateByEmail(email: string): Promise<{ ok: boolean; message: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, message: 'Stripe not configured on this instance.' };

  const normalizedEmail = email.trim().toLowerCase();

  // Check if already activated with this email
  const existing = getActiveLicenses().find(l => l.email.toLowerCase() === normalizedEmail);
  if (existing) return { ok: true, message: 'Pro already active for ' + email };

  // Look up customer by email in Stripe
  const customers = await stripe.customers.list({ email: normalizedEmail, limit: 5 });
  if (!customers.data.length) {
    return { ok: false, message: 'No Stripe account found for ' + email + '. Make sure you use the same email you purchased with.' };
  }

  // Check for an active subscription on any of their customer records
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 10 });
    const clawcostSub = subs.data.find(s =>
      s.items.data.some(item => item.price.product === getSetting('stripe_product_id') || item.price.id === getSetting('stripe_price_id'))
    );

    if (clawcostSub) {
      // Check not already stored
      const bySubId = getLicenseBySubscription(clawcostSub.id);
      if (bySubId) {
        setSetting('active_license_key', bySubId.license_key);
        setSetting('active_license_email', email);
        return { ok: true, message: 'Pro activated for ' + email };
      }

      const licenseKey = generateLicenseKey();
      createLicense(licenseKey, normalizedEmail, customer.id, clawcostSub.id);
      setSetting('active_license_key', licenseKey);
      setSetting('active_license_email', normalizedEmail);
      console.log('[ClawCost] Pro activated via email lookup:', normalizedEmail);
      return { ok: true, message: 'Pro activated for ' + email };
    }
  }

  return { ok: false, message: 'No active ClawCost Pro subscription found for ' + email + '. If you just purchased, wait a moment and try again.' };
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getLicenseStatus(): { isConfigured: boolean; hasPro: boolean; licenses: { email: string; plan: string; status: string; created_at: number }[] } {
  const isConfigured = !!getSetting('stripe_secret_key');
  const licenses = getActiveLicenses().map(l => ({
    email: l.email,
    plan: l.plan,
    status: l.status,
    created_at: l.created_at,
  }));
  return { isConfigured, hasPro: licenses.length > 0, licenses };
}

// ── Settings ─────────────────────────────────────────────────────────────────

export const STRIPE_SETTING_KEYS = ['stripe_secret_key', 'stripe_webhook_secret', 'stripe_price_id', 'stripe_product_id'] as const;

import type Stripe from "stripe";
import { PROJECT_SLUG, type BillingCycle } from "@/lib/billing/catalog";
import type { PlanType } from "@/lib/rbac";

export type CheckoutMetadata = {
  user_id: string;
  price_id: string;
  project: typeof PROJECT_SLUG;
  plan?: PlanType;
  cycle?: BillingCycle;
  kind?: "seats" | "sends" | "fakturabai_test";
  orgId?: string;
  organization_id?: string;
};

/**
 * Reuse a Menoska customer. Never attach or relabel a Proposalyze / Astoha customer.
 */
export async function ensureMenoskaCustomer(
  stripe: Stripe,
  params: { userId: string; email: string; existingCustomerId?: string | null },
): Promise<string> {
  const metadata = { user_id: params.userId, project: PROJECT_SLUG };
  if (params.existingCustomerId) {
    const current = await stripe.customers.retrieve(params.existingCustomerId);
    if (!("deleted" in current && current.deleted)) {
      const project = current.metadata?.project;
      if (!project || project === PROJECT_SLUG) {
        await stripe.customers.update(current.id, { email: params.email, metadata });
        return current.id;
      }
    }
  }
  const created = await stripe.customers.create({ email: params.email, metadata });
  return created.id;
}

export function checkoutSessionParams(input: {
  priceId: string;
  customerId: string;
  userId: string;
  mode: "subscription" | "payment";
  metadata: CheckoutMetadata;
  successUrl: string;
  cancelUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  const metadata: Record<string, string> = {
    user_id: input.metadata.user_id,
    price_id: input.metadata.price_id,
    project: PROJECT_SLUG,
  };
  if (input.metadata.plan) metadata.plan = input.metadata.plan;
  if (input.metadata.cycle) metadata.cycle = input.metadata.cycle;
  if (input.metadata.kind) metadata.kind = input.metadata.kind;
  if (input.metadata.orgId) {
    metadata.orgId = input.metadata.orgId;
    metadata.organization_id = input.metadata.orgId;
  }

  return {
    mode: input.mode,
    line_items: [{ price: input.priceId, quantity: 1 }],
    client_reference_id: input.userId,
    customer: input.customerId,
    customer_update: { name: "auto", address: "auto" },
    metadata,
    tax_id_collection: { enabled: true, required: "if_supported" },
    billing_address_collection: "required",
    custom_fields: [
      {
        key: "razon_social",
        label: { type: "custom", custom: "Razón social / Nombre fiscal" },
        type: "text",
        optional: false,
      },
    ],
    allow_promotion_codes: true,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(input.mode === "subscription"
      ? { subscription_data: { metadata } }
      : { invoice_creation: { enabled: true, invoice_data: { metadata } } }),
  };
}

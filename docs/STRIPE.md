# Stripe — Menoska

Cuenta live: `acct_1TBIFCF3yyKUpy6t` (Menoska Consulting). Moneda EUR. `tax_behavior=exclusive` (la base no incluye IVA). El emisor de la factura es el autónomo, a través de FakturaBAI. La marca va en `metadata.project=menoska`.

El producto de 0,50 € no se publica en la web ni en variables `NEXT_PUBLIC_` / `VITE_`. Solo el secreto de Edge `STRIPE_PRICE_FAKTURABAI_TEST`.

No se han modificado productos, precios ni webhooks de Proposalyze ni de Astoha. El precio de prueba ya existía (`prod_VXN3D1jdRLxHPl`); se reutilizó y solo se le escribió `lookup_key` y metadata de este slug.

| Variable | price_… | lookup_key | Importe (sin IVA) |
|---|---|---|---|
| `STRIPE_PRICE_STARTER_MONTHLY` | `price_1UZZ89F3yyKUpy6txpLvpy9g` | `menoska-starter-monthly` | 149,00 € / mes |
| `STRIPE_PRICE_STARTER_YEARLY` | `price_1UZZ8AF3yyKUpy6tsnxDbrVT` | `menoska-starter-yearly` | 1.490,00 € / año |
| `STRIPE_PRICE_BUSINESS_MONTHLY` | `price_1UZZ8BF3yyKUpy6t33qnYHX1` | `menoska-business-monthly` | 349,00 € / mes |
| `STRIPE_PRICE_BUSINESS_YEARLY` | `price_1UZZ8DF3yyKUpy6tuDLcOznL` | `menoska-business-yearly` | 3.490,00 € / año |
| `STRIPE_PRICE_ENTERPRISE_MONTHLY` | `price_1UZZ8EF3yyKUpy6t3TdUtVg4` | `menoska-enterprise-monthly` | 890,00 € / mes |
| `STRIPE_PRICE_ENTERPRISE_YEARLY` | `price_1UZZ8GF3yyKUpy6t1KTE1avw` | `menoska-enterprise-yearly` | 8.900,00 € / año |
| `STRIPE_PRICE_ADDON_SEATS` | `price_1UZZ8HF3yyKUpy6tfs6USk11` | `menoska-addon-seats-monthly` | 49,00 € / mes (+3 asientos) |
| `STRIPE_PRICE_ADDON_SENDS` | `price_1UZZ8NF3yyKUpy6t7NjbUtOJ` | `menoska-addon-sends-monthly` | 29,00 € / mes (+20 envíos) |
| `STRIPE_PRICE_FAKTURABAI_TEST` | `price_1UWIJHF3yyKUpy6tMLQyWgMw` | `menoska-fakturabai-test-050` | 0,50 € pago único. No publicar |

Serie de factura: `MK`. El webhook de este producto es `menoska-stripe-webhook` en el proyecto Supabase `nheyqairforzviwheyrq` (`https://nheyqairforzviwheyrq.supabase.co`). El proyecto `ytxesvrbptfqqozizzmz` es el de Proposalyze y no recibe este endpoint.

`STRIPE_SECRET_KEY` es la clave live de Menoska Consulting. `STRIPE_WEBHOOK_SECRET_MENOSKA` es el signing secret del endpoint nuevo. Ninguno de los dos va en git. No reutilizar `STRIPE_WEBHOOK_SECRET` de Proposalyze.

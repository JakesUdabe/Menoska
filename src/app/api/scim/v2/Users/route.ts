import { NextResponse } from "next/server";

const ENTERPRISE_BODY = {
  schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
  status: "501",
  detail:
    "SCIM User provisioning requires Menoska Enterprise (SSO/SAML + SCIM). Contact enterprise@menoska.com to enable.",
  scimType: "notImplemented",
};

/** SCIM Users stub — always 501 until Enterprise SSO is provisioned. */
export async function GET() {
  return NextResponse.json(ENTERPRISE_BODY, {
    status: 501,
    headers: { "content-type": "application/scim+json" },
  });
}

export async function POST() {
  return NextResponse.json(ENTERPRISE_BODY, {
    status: 501,
    headers: { "content-type": "application/scim+json" },
  });
}

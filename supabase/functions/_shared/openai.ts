/**
 * OpenAI auth + project scoping for Edge Functions.
 *
 * Create a Project named "proposalyze" in platform.openai.com → Settings → Projects,
 * then set secrets:
 *   OPENAI_API_KEY      — key scoped to that project (preferred) or org-wide key
 *   OPENAI_PROJECT_ID   — proj_… (sends OpenAI-Project header; usage attributed to proposalyze)
 *   OPENAI_ORG_ID       — org-… (optional; OpenAI-Organization header)
 *
 * Astoha should use a separate Project (e.g. "astoha") with its own OPENAI_PROJECT_ID.
 */

export const OPENAI_PROJECT_SLUG = "proposalyze";

export type OpenAIAuthHeaderOptions = {
  /** Default true. Set false for multipart/form-data uploads. */
  json?: boolean;
};

/** Authorization (+ optional OpenAI-Project / Organization) for api.openai.com. */
export function openaiAuthHeaders(
  apiKey: string,
  opts: OpenAIAuthHeaderOptions = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (opts.json !== false) {
    headers["Content-Type"] = "application/json";
  }

  const projectId = Deno.env.get("OPENAI_PROJECT_ID")?.trim();
  const orgId = Deno.env.get("OPENAI_ORG_ID")?.trim();
  if (projectId) headers["OpenAI-Project"] = projectId;
  if (orgId) headers["OpenAI-Organization"] = orgId;

  return headers;
}

export function requireOpenAIApiKey(): string {
  const key = Deno.env.get("OPENAI_API_KEY")?.trim();
  if (!key) throw new Error("OPENAI_API_KEY no configurada");
  return key;
}

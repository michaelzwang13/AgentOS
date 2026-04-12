/**
 * Server-side only — never import this from a client component.
 * All calls require BACKEND_API_KEY which must stay out of the browser bundle.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || "";

async function backendFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": BACKEND_API_KEY,
      ...options.headers,
    },
  });
  return res;
}

export async function storeCredential(
  service: string,
  token: string,
  scopes: string[]
) {
  return backendFetch("/credentials", {
    method: "POST",
    body: JSON.stringify({ service, token, scopes }),
  });
}

export async function deleteCredential(service: string) {
  return backendFetch(`/credentials/${service}`, { method: "DELETE" });
}

export async function getSlackMessages() {
  return backendFetch("/gateway/slack/messages");
}

export async function disconnectSlack() {
  return backendFetch("/gateway/slack/disconnect", { method: "DELETE" });
}

export async function hireEmployee(role: string, config?: Record<string, unknown>) {
  return backendFetch("/agents", {
    method: "POST",
    body: JSON.stringify({ role, config: config || {} }),
  });
}

export async function listEmployees() {
  return backendFetch("/agents");
}

export async function fireEmployee(agentId: string) {
  return backendFetch(`/agents/${agentId}`, { method: "DELETE" });
}

export function getSlackOAuthUrl() {
  return `${BACKEND_URL}/auth/slack?api_key=${encodeURIComponent(BACKEND_API_KEY)}`;
}

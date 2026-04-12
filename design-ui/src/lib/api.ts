// Override with VITE_API_URL=http://... when pointing at a non-local backend.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

export interface Role {
  id: string
  display_name: string
  description: string
  required_tools: string[]
}

export async function listRoles(): Promise<Role[]> {
  const res = await fetch(`${API_URL}/roles`)
  if (!res.ok) throw new Error(`GET /roles failed: ${res.status}`)
  return res.json()
}

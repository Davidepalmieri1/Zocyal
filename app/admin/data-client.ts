export async function fetchAdminData<T>(view: string, code: string): Promise<T> {
  const query = new URLSearchParams({ view, code })
  const response = await fetch(`/admin/api/data?${query}`, {
    cache: "no-store",
    credentials: "same-origin",
  })
  const payload = (await response.json()) as T & { error?: string }

  if (response.status === 401) {
    const next = `${window.location.pathname}${window.location.search}`
    window.location.assign(`/admin/login?next=${encodeURIComponent(next)}`)
    throw new Error("Sessione scaduta")
  }

  if (!response.ok) {
    throw new Error(payload.error || "Impossibile caricare i dati.")
  }

  return payload
}

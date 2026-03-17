export type ApiEnvelope<T> = {
  status: number;
  message: string;
  data: T;
};

export async function readApiData<T>(response: Response): Promise<T> {
  const body = (await response.json()) as ApiEnvelope<T>;

  if (!response.ok || body.status !== 1) {
    throw new Error(body.message || "Request failed.");
  }

  return body.data;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("token") : null;
  const headers = new Headers(init?.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response = await fetch(input, { ...init, headers });

  if (response.status === 401 && typeof window !== "undefined") {
    // Attempt token refresh
    const refreshToken = window.localStorage.getItem("refresh_token");
    if (refreshToken) {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
      try {
        const refreshRes = await fetch(`${apiBase}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (refreshRes.ok) {
          const body = await refreshRes.json();
          if (body.status === 1 && body.data.access_token) {
            const newToken = body.data.access_token;
            window.localStorage.setItem("token", newToken);
            headers.set("Authorization", `Bearer ${newToken}`);
            // Retry the original request
            response = await fetch(input, { ...init, headers });
            return response;
          }
        }
      } catch {
        // network error, fall through
      }
    }

    // If refresh failed or no refresh token, kill session & redirect
    window.localStorage.removeItem("token");
    window.localStorage.removeItem("refresh_token");
    document.cookie = "auth_token=; path=/; max-age=0";
    window.location.href = "/login";
  }

  return response;
}


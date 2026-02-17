const backendBaseUrl = process.env.API_INTERNAL_BASE_URL ?? "http://backend:8000";

export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json()) as {
    email: string;
    username: string;
    password: string;
  };

  const response = await fetch(`${backendBaseUrl}/api/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const rawBody = await response.text();
  const contentType = response.headers.get("content-type") ?? "application/json";

  return new Response(rawBody, {
    status: response.status,
    headers: {
      "content-type": contentType,
    },
  });
}

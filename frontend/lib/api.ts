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

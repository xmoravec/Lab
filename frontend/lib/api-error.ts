type ApiErrorBody = {
  detail?: string;
  message?: string;
};

export function parseApiError(status: number, responseBody: string | undefined): string {
  const message = `Request failed: ${status}`;

  if (!responseBody) {
    return message;
  }

  try {
    const errorPayload = JSON.parse(responseBody) as ApiErrorBody;
    if (errorPayload.detail) {
      return errorPayload.detail;
    }
    if (errorPayload.message) {
      return errorPayload.message;
    }
  } catch {
    // Use raw response body when payload is not JSON.
  }

  return `${message} - ${responseBody}`;
}
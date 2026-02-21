const isProduction = process.env.NODE_ENV === "production";

type LogDetails = Record<string, unknown>;

type ClientLogOptions = {
  allowInProduction?: boolean;
};

export function logClientError(
  message: string,
  details: LogDetails,
  options: ClientLogOptions = {},
): void {
  if (isProduction && !options.allowInProduction) {
    return;
  }

  console.error(message, details);
}

export function logClientWarn(message: string, details: LogDetails): void {
  if (isProduction) {
    return;
  }

  console.warn(message, details);
}

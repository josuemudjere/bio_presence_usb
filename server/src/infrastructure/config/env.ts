export interface AppConfig {
  port: number;
  isProduction: boolean;
}

export function getAppConfig(): AppConfig {
  const isProduction = process.env.NODE_ENV === "production";
  const parsedPort = Number(process.env.PORT ?? 3000);

  return {
    port: Number.isFinite(parsedPort) ? parsedPort : 3000,
    isProduction,
  };
}

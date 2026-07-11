export interface AppConfig {
  port: number;
  isProduction: boolean;
}

export function getAppConfig(): AppConfig {
  // Je dérive toute la configuration minimale du process pour garder un bootstrap sans dépendance lourde.
  const isProduction = process.env.NODE_ENV === "production";
  const parsedPort = Number(process.env.PORT ?? 3000);

  return {
    port: Number.isFinite(parsedPort) ? parsedPort : 3000,
    isProduction,
  };
}

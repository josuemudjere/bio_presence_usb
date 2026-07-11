import { startServer } from "./src/main/server";

// Ce fichier reste le point d'entrée Node minimal pour lancer le serveur assemblé dans src/main.
startServer().catch(console.error);

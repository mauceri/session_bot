import * as fs from "fs";

const SOCKET_PATH = "/tmp/session_bot.sock";

// Supprimer la socket existante si nécessaire
try {
    if (fs.existsSync(SOCKET_PATH)) {
        fs.unlinkSync(SOCKET_PATH);
    }
} catch (e) {
    console.error("❌ Erreur lors de la suppression du fichier socket:", e);
}

// 📌 Démarrer un serveur HTTP écoutant sur le socket UNIX
const server = Bun.serve({
    unix: SOCKET_PATH,
    fetch(req) {
        console.log("📩 Requête reçue sur le socket UNIX !");
        
        return new Response(JSON.stringify({ message: "OK, message reçu par session_bot.ts" }), {
            headers: { "Content-Type": "application/json" }
        });
    }
});

console.log(`✅ Serveur IPC Unix Socket démarré sur ${SOCKET_PATH}`);

// 🔄 Empêcher la fermeture immédiate du programme
/*setInterval(() => {
    console.log("💡 Serveur IPC toujours actif...");
}, 5000);*/

import { generateSeedHex } from '@session.js/keypair';
import { encode } from '@session.js/mnemonic';
import { Session, ready, Poller } from '@session.js/client';
import { createServer } from "net";
import { createConnection } from "net";

import path from 'path';
import * as fs from 'fs';

// Définition du chemin de la Unix Socket
const SOCKET_PATH = "/tmp/session_bot.sock";


// Attendre que les modules soient prêts
await ready;
// Création de la session
const session = new Session();

// Supprimer l'ancienne socket si elle existe déjà
try {
    if (fs.existsSync(SOCKET_PATH)) {
        fs.unlinkSync(SOCKET_PATH);
    }
} catch (e) {
    console.error("❌ Erreur lors de la suppression du fichier socket:", e);
}



// 📌 Démarrer un serveur IPC UNIX
let bobotSocket: any = null;  // Stocker la connexion active

// 📌 Démarrer un serveur IPC UNIX qui garde la connexion ouverte
const server = createServer((socket) => {
    console.log("📩 Connexion entrante sur le socket IPC !");
    
    bobotSocket = socket;  // Stocker la connexion

    socket.on("data", async (data) => {
        // Analyser le message reçu
            const { from, text, attachments } = JSON.parse(data.toString());
            console.log("📩 Message reçu de `session_bot.py` :", text,"from ",from);
    
    
            // 📤 Envoyer le message via Session
            const fileAttachments = attachments.map(attachment => base64ToFile(attachment.content, attachment.name, attachment.type));
    
            await session.sendMessage({ to: from, text: text, attachments: fileAttachments });
    });

    socket.on("end", () => {
        console.log("🚪 Connexion IPC fermée par le client.");
        bobotSocket = null;  // Réinitialiser la connexion
    });

    socket.on("error", (err) => {
        console.error("❌ Erreur sur la socket IPC :", err);
    });
});


// 📌 Fonction pour envoyer un message à `session_bot.py`
function sendToPython(message) {
    if (bobotSocket) {
        bobotSocket.write(JSON.stringify(message) + "\n");
        console.log("📨 Message envoyé à `session_bot.py` :", message);
    } else {
        console.error("🚨 Aucun client IPC connecté !");
    }
}

server.listen(SOCKET_PATH, () => {
    console.log(`✅ Serveur IPC UNIX démarré sur ${SOCKET_PATH}`);
});
// Configuration de Session
const configFilePath = path.join(process.env.HOME || '', 'session_bot/session_bot_config.sh');
console.log('📌 Chemin du fichier de configuration:', configFilePath);

// Fonction pour sauvegarder le mnémonique
function saveMnemonicToConfigFile(mnemonic: string) {
    const envVarEntry = `export SESSION_BOT_MNEMONIC="${mnemonic}"\n`;
    fs.writeFileSync(configFilePath, envVarEntry);
}

// Charger le mnémonique depuis le fichier de configuration
function loadMnemonicFromConfigFile() {
    if (fs.existsSync(configFilePath)) {
        const content = fs.readFileSync(configFilePath, 'utf-8');
        const match = content.match(/export SESSION_BOT_MNEMONIC="(.+?)"/);
        return match ? match[1] : null;
    }
    return null;
}

// Initialisation du bot Session
let mnemonic = process.env.SESSION_BOT_MNEMONIC || loadMnemonicFromConfigFile();
if (!mnemonic) {
    mnemonic = encode(generateSeedHex());
    console.log('🔑 Mnemonic généré pour ce bot :', mnemonic);
    saveMnemonicToConfigFile(mnemonic);
} else {
    console.log('✅ Mnemonic chargé depuis la configuration');
}

session.setMnemonic(mnemonic, 'amicus');
console.log("🤖 Bot Session ID:", session.getSessionID());

session.addPoller(new Poller());



async function sendIPCMessage(message) {
    return new Promise((resolve, reject) => {
        const client = createConnection(SOCKET_PATH, () => {
            console.log("📨 Connexion au serveur IPC établie !");
            console.log("texte du message : ",message.text)
            client.write(JSON.stringify(message) + "\n");  // 📩 Envoyer le message
        });

        client.on("data", (data) => {
            console.log("✅ Réponse du serveur IPC :", data.toString());
            resolve(true);
            client.end();  // 🚪 Fermer la connexion proprement
        });

        client.on("error", (err) => {
            console.error("❌ Erreur d'envoi IPC :", err);
            reject(err);
        });

        client.on("end", () => {
            console.log("🚪 Connexion IPC fermée.");
        });
    });
}

session.on('message', async (message) => {
    const decryptedAttachments = [];

    for (const attachment of message.attachments) {
        const decryptedAttachment = await session.getFile(attachment);
        const base64Content = await bufferToBase64(decryptedAttachment);
        decryptedAttachments.push({
            name: decryptedAttachment.name,
            type: decryptedAttachment.type,
            content: base64Content
        });
    }

    //console.log("******************************************",message.text)
    const messageToSend = {
        to: message.from,
        from: session.getSessionID(),
        text: message.text,
        attachments: decryptedAttachments
    };

    try {
        await sendIPCMessage(messageToSend);
    } catch (err) {
        console.error("🚨 Échec d'envoi du message à bobot.py :", err);
    }
});

// 📌 Ajouter un log quand la boucle d'événements se termine
session.on('exit', (code) => {
    console.log(`⚠️ Processus en train de se fermer avec le code : ${code}`);
});

session.on('uncaughtException', (err) => {
    console.error("🔥 Exception non capturée :", err);
});

session.on('unhandledRejection', (reason, promise) => {
    console.error("❌ Promesse rejetée sans gestion :", promise, "raison :", reason);
});




// 📌 Conversion Buffer en Base64
async function bufferToBase64(buffer) {
    if (buffer instanceof File) buffer = await buffer.arrayBuffer();
    if (buffer instanceof ArrayBuffer) buffer = Buffer.from(buffer);
    return buffer.toString('base64');
}

// 📌 Convertir une chaîne Base64 en fichier
function base64ToFile(base64Content, fileName, mimeType) {
    const binaryString = atob(base64Content);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return new File([bytes.buffer], fileName, { type: mimeType });
}

process.on("uncaughtException", (err) => {
    console.error("🔥 Erreur fatale non capturée :", err);
});

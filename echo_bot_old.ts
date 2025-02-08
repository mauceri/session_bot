import { generateSeedHex } from '@session.js/keypair';
import { encode } from '@session.js/mnemonic';
import { Session, ready, Poller } from '@session.js/client';

import path from 'path';
import * as fs from 'fs';
const socketPath = '/tmp/bun_python.sock';



// Attendre que les modules soient prêts
await ready;

const configFilePath = path.join(process.env.HOME || '', 'session_bot/echo_bot_config.sh');
console.log('Chemin du fichier de configuration:', configFilePath);

// Fonction pour sauvegarder le mnémonique dans un fichier dédié
function saveMnemonicToConfigFile(mnemonic: string) {
    const envVarEntry = `export SESSION_BOT_MNEMONIC="${mnemonic}"\n`;
    fs.writeFileSync(configFilePath, envVarEntry);
}

// Fonction pour charger le mnémonique à partir du fichier de configuration
function loadMnemonicFromConfigFile() {
    if (fs.existsSync(configFilePath)) {
        const content = fs.readFileSync(configFilePath, 'utf-8');
        const match = content.match(/export SESSION_BOT_MNEMONIC="(.+?)"/);
        return match ? match[1] : null;
    }
    return null;
}

// Fonction pour convertir un ArrayBuffer ou un Buffer en Base64
async function bufferToBase64(buffer) {
    // Si le fichier est un objet `File`, convertissez-le en ArrayBuffer
    if (buffer instanceof File) {
        buffer = await buffer.arrayBuffer();
    }

    // Si le fichier est maintenant un ArrayBuffer, convertissez-le en Buffer
    if (buffer instanceof ArrayBuffer) {
        buffer = Buffer.from(buffer);
    }

    // Convertir en Base64
    return buffer.toString('base64');
}

function decodeBase64Content(base64Content) {
    const buffer = Buffer.from(base64Content, 'base64');  // Décoder Base64 en Buffer
    return buffer.toString('utf-8');  // Convertir le Buffer en chaîne de caractères
}


// Fonction pour convertir une chaîne Base64 en un objet File
function base64ToFile(base64Content, fileName, mimeType) {
    // Décoder la chaîne Base64 en ArrayBuffer
    const binaryString = atob(base64Content);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;

    // Créer un objet File à partir de l'ArrayBuffer
    return new File([arrayBuffer], fileName, { type: mimeType });
}

// Charger le mnémonique depuis la variable d'environnement ou le fichier de configuration
let mnemonic = process.env.SESSION_BOT_MNEMONIC || loadMnemonicFromConfigFile();

if (!mnemonic) {
    mnemonic = encode(generateSeedHex());
    console.log('Mnemonic généré pour ce bot :', mnemonic);
    saveMnemonicToConfigFile(mnemonic);
} else {
    console.log('Mnemonic trouvé dans SESSION_BOT_MNEMONIC ou le fichier de configuration');
}

// Configuration et démarrage du bot
const session = new Session();
session.setMnemonic(mnemonic, 'Arbath');
console.log("Bot's Session ID:", session.getSessionID());

session.addPoller(new Poller());

session.on('message', async (message) => {
    //console.log("Réception du message:", message.getContent());
    const decryptedAttachments = [];

    // Parcourir chaque attachement reçu et le convertir en Base64
    for (const attachment of message.attachments) {
        //console.log('Attachment reçu:', attachment);

        // Obtenir l'attachement déchiffré en tant qu'ArrayBuffer ou Buffer
        const decryptedAttachment = await session.getFile(attachment);
 
        // Convertir l'ArrayBuffer en Base64
        const base64Content = await bufferToBase64(decryptedAttachment);
        decryptedAttachments.push({
            name: decryptedAttachment.name,
            type: decryptedAttachment.type,
            content: base64Content
        });
    }

    console.log("Retour à l'envoyeur");

    await session.sendMessage({to: message.from,text: message.text, attachments: message.attachments});
});



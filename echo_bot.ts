import { generateSeedHex } from '@session.js/keypair';
import { encode } from '@session.js/mnemonic';
import { Session, ready, Poller } from '@session.js/client';
import path from 'path';
import * as fs from 'fs';
import { spawn } from 'bun';

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
    if (buffer instanceof File) {
        buffer = await buffer.arrayBuffer();
    }

    if (buffer instanceof ArrayBuffer) {
        buffer = Buffer.from(buffer);
    }

    return buffer.toString('base64');
}

function decodeBase64Content(base64Content) {
    const buffer = Buffer.from(base64Content, 'base64');
    return buffer.toString('utf-8');
}

// Fonction pour convertir une chaîne Base64 en un objet File
function base64ToFile(base64Content, fileName, mimeType) {
    const binaryString = atob(base64Content);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;
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

const childProc = Bun.spawn(["python3", "echo_bot.py"], {
    ipc(message) {
      /**
       * Message reçu f'echo_bot.py
       **/
        const { from, text, frombobot, attachments } = JSON.parse(message.toString());
        const fileAttachments = attachments.map(attachment => {
            const r = base64ToFile(attachment.content, attachment.name, attachment.type);
            return r;
        });
        // Envoyer le message via Session
        
        session.sendMessage({to: from,text: text, attachments: fileAttachments});
    },
  });
  

async function handleMessageFromLokinet(message: any) {
   
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

    const messageToSend = JSON.stringify({
        text: message.text,
        attachments: decryptedAttachments
    });

    //message envoyé à echo_bot.py
    childProc.send(messageToSend); 

    console.log("message sent");
}

async function handleResponseFromSocket(response: string) {
    const parsedResponse = JSON.parse(response);
    await session.sendMessage({
        to: parsedResponse.to || message.from, // Assurez-vous que 'to' est bien défini
        text: parsedResponse.text,
        attachments: parsedResponse.attachments.map((a: any) => base64ToFile(a.content, a.name, a.type))
    });
    console.log("Réponse renvoyée à Lokinet:", parsedResponse);
}

session.on('message', handleMessageFromLokinet);
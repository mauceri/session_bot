// session_bot.ts

import { generateSeedHex } from '@session.js/keypair';
import { encode } from '@session.js/mnemonic';
import { Session, ready, Poller } from '@session.js/client';

import path from 'path';
import WebSocket, { WebSocketServer } from 'ws';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'crypto';
import * as fs from 'fs';


// Attendre que les modules soient prêts
await ready;


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

interface PartialMessage {
    chunks: { [key: number]: string };
    received: number;
    total: number;
  }
  
const partialMessages: { [messageId: string]: PartialMessage } = {};
  
function handleChunks(data) {
    console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$  Dans handleChunks");
    const chunkObj = JSON.parse(data);
    const { messageId, index, total, data: chunkData } = chunkObj;
  
    if (!partialMessages[messageId]) {
      partialMessages[messageId] = {
        chunks: {},
        received: 0,
        total: 0
      };
    }
    partialMessages[messageId].chunks[index] = chunkData;
    partialMessages[messageId].received += 1;
    partialMessages[messageId].total = total;
  
    // Quand tous les fragments sont reçus, reconstitution
    if (partialMessages[messageId].received === total) {
      const { chunks } = partialMessages[messageId];
      let fullStr = "";
      for (let i = 0; i < total; i++) {
        fullStr += chunks[i];
      }
      //console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! ",fullStr)
      const finalMessage = JSON.parse(fullStr);
      const actualMessage = typeof finalMessage === "string" ? JSON.parse(finalMessage) : finalMessage;
         
      
      //console.log("finalMessage après correction:", actualMessage);
      //console.log("Accès direct à attachments:", actualMessage.attachments);  

      // Nettoyage
      delete partialMessages[messageId];
  
      const { from, text, frombobot, attachments } = actualMessage;
      
      if (!Array.isArray(attachments)) {
        console.error("Erreur: attachments n'est pas un tableau", attachments);
        return;
    }
    
      const fileAttachments = attachments.map(attachment => {
          const r = base64ToFile(attachment.content, attachment.name, attachment.type);
          return r;
      });
      // Envoyer le message via Session
      
      session.sendMessage({to: from,text: text, attachments: fileAttachments});

    }
  
    return null; // Pas encore complet
  }

  function chunkString(str: string, size: number): string[] {
    const chunks = [];
    for (let i = 0; i < str.length; i += size) {
      chunks.push(str.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * Envoie un objet JSON (messageToSend) sur un WebSocket en le scindant en fragments.
   */
  async function sendJsonInChunks(
    socket: WebSocket,
    messageToSend: any,
    chunkSize = 256*1024 // 256 ko par défaut
  ) {
    const fullString = JSON.stringify(messageToSend);
    //console.log("$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$$  ",fullString)
    const chunks = chunkString(fullString, chunkSize);
    const messageId = Date.now().toString(); // ou tout autre identifiant unique
  
    chunks.forEach((chunk, index) => {
      const payload = {
        messageId,
        index,
        total: chunks.length,
        data: chunk
      };
      socket.send(JSON.stringify(payload));
    });
  }
  



// Configurer le WebSocket Server pour écouter les messages de bobot
const wss = new WebSocketServer({ 
    port: 8089,
    host: '0.0.0.0',
    //maxPayload: 10 * 1024 * 1024 // Limite augmentée à 10 Mo (ça ne marche pas je suis tjrs limité à 1 Mo)
    });
let bobotSocket: WebSocket | null = null; // Stocke la connexion WebSocket avec bobot

wss.on('connection', (ws) => {
    console.log("Nouveau client WebSocket connecté.");

    // Stocker la connexion pour pouvoir envoyer des messages plus tard
    bobotSocket = ws;

    ws.on('message',  handleChunks);

    ws.on('close', (code, reason) => {
        console.log("Client WebSocket déconnecté.",code,reason);
        bobotSocket = null;
    });

    ws.on('error', (err) => {
        console.error('Erreur WebSocket:', err);
    });
});

console.log("Serveur WebSocket démarré sur le port 8089");
/*************************************** Début  */
// Chemin vers le fichier de configuration
const configFilePath = path.join(process.env.HOME || '', 'session_bot/session_bot_config.sh');
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
session.setMnemonic(mnemonic, 'amicus');
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

 
    // Envoyer le message et les pièces jointes déchiffrées à bobot.py via WebSocket
    if (bobotSocket && bobotSocket.readyState === WebSocket.OPEN) {
        console.log("Envoi du message à bobot via WebSocket");

        const messageToSend = {
            to: message.from,
            from: session.getSessionID(),
            text: message.text,
            attachments: decryptedAttachments
        };

        console.log("Message envoyé à bobot:");
        //bobotSocket.send(JSON.stringify(messageToSend));
        sendJsonInChunks(bobotSocket,messageToSend)
    } else {
        //console.log("Aucun client WebSocket connecté pour recevoir le message.");
    }
});


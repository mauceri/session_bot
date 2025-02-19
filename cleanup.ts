import { sequelize, SessionMessage } from "./db";

// Supprime les messages vieux de plus de 14 jours
async function cleanupOldMessages() {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() - 14);

  const deletedCount = await SessionMessage.destroy({
    where: {
      timestamp: { $lt: expirationDate },
    },
  });

  console.log(`🧹 Suppression de ${deletedCount} messages vieux de 14 jours.`);
}

// Exécution immédiate et répétition toutes les 24h
cleanupOldMessages();
setInterval(cleanupOldMessages, 24 * 60 * 60 * 1000);

import { Sequelize, DataTypes } from "sequelize";

// Connexion à SQLite via Sequelize
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "session_messages.sqlite",
  logging: false, // Désactive les logs SQL
});

// Définition du modèle
const SessionMessage = sequelize.define("SessionMessage", {
  messageId: {
    type: DataTypes.STRING,
    allowNull: false,
    primaryKey: true, // L'ID du message est unique
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

// Synchronisation automatique de la base de données
await sequelize.sync();
console.log("📦 Base de données synchronisée.");

export { sequelize, SessionMessage };

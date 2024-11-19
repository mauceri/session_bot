import { generateSeedHex } from '@session.js/keypair'
import { encode } from '@session.js/mnemonic'
import { Session, ready, Poller } from '@session.js/client'
await ready

const mnemonic = encode(generateSeedHex())
console.log('Mnemonic for this bot:', mnemonic)

const session = new Session()
session.setMnemonic(mnemonic, 'My echo bot')
console.log('Bot\'s Session ID:', session.getSessionID())

session.addPoller(new Poller())

session.on('message', async message => {
  const attachments = await Promise.all(message.attachments.map(async attachment =>
    await session.getFile(attachment)
  ))
  session.sendMessage({
    to: message.from,
    text: message.text,
    attachments: attachments
  })
})
const discord = jest.createMockFromModule("discord.js");

discord.Client.prototype.users = {
  cache: {
    get: jest.fn().mockReturnValue({
      send: jest.fn().mockReturnValue({
        then: jest.fn().mockReturnValue({
          catch: jest.fn(),
        }),
      }),
    }),
  },
  // TODO: This isn't right yet
  createDM: jest.fn().mockReturnValue({
    send: jest.fn().mockReturnValue({
      then: jest.fn(),
    }),
  }),
};

// TODO: I don't know if we can somehow pull this from the original?
// For now I've just copy/pasted it but that seems bad
discord.GatewayIntentBits = {
    Guilds: 1,
    GuildMembers: 2,
    GuildBans: 4,
    GuildEmojisAndStickers: 8,
    GuildIntegrations: 16,
    GuildWebhooks: 32,
    GuildInvites: 64,
    GuildVoiceStates: 128,
    GuildPresences: 256,
    GuildMessages: 512,
    GuildMessageReactions: 1024,
    GuildMessageTyping: 2048,
    DirectMessages: 4096,
    DirectMessageReactions: 8192,
    DirectMessageTyping: 16384,
    MessageContent: 32768,
    GuildScheduledEvents: 65536
};

module.exports = discord;

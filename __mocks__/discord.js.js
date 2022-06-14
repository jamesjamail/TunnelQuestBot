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
};

module.exports = discord;

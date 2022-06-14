const pg = jest.createMockFromModule("pg");

pg.Client.prototype.query.mockReturnValue({
  then: jest.fn().mockReturnValue({
    catch: jest.fn(),
  }),
});

module.exports = pg;

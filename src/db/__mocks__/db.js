const db = jest.createMockFromModule("./db.js");

db.validateWatchNotification = jest.fn().mockReturnValue(true);
db.postSuccessfulCommunication = jest.fn();

module.exports = db;

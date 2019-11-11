const faker = require('faker');
const fs = require('fs');
var price = 100;

function writeLine() {
    fs.appendFile('./fakeLogs/fakeLog.txt', `\nJephri auctions, 'WTS Thick Banded Belt ${price}'`, (err) => {
        if (err) {
            console.log('ERROR: ', err);
        }
    });
    price += 50;
};

setInterval(writeLine, 1000);
const Tail = require('tail').Tail;

//stream log file(s)

tail = new Tail ('./fakeLogs/fakeLog.txt');

tail.on("line", function(data) {
    console.log(data);
    parseLog(data);
})

tail.on("error", function(error) {
    console.log('ERROR: ', error)
})

function parseLog(text) {
    var words = text.toLowerCase().split(' ');
    //TODO: check that second word is "'WTS" too...
    if (words[1] === 'auctions,') {
        console.log("auction detected, words = ", words);
        //iterative search each word for item_watches
    }
}
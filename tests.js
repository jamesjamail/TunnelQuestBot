const logParser = require('./logParser');

testStr = "[Mon Feb 10 00:26:16 2020] Stashboxx auctions, 'wts Spell: Allure 7k ..Spell: Paralyzing Earth1k ..Spell: Blanket of Forgetfulness1.2k...Spell: Shiftless Deeds1.5k ...Spell: Tepid Deeds40p"

console.log(parsePrice(testStr));
/*
####################################################################################
# 
# IDEAS FOR FEATURES
#
####################################################################################
*/
/*
Private mode
    Only respond to messages if they @mention the bot
    Messages contain references in the format <@userid>

Export channel/user data
    To allow migration of a channel to another channel
    Or to allow a user to move all of his stuff to another channel

*/

/*
####################################################################################
#
# SETUP
#
####################################################################################
*/
/*
####################################################################################
# Requirements
####################################################################################
*/
var Parser = require('expr-eval').Parser;
const Discord = require('discord.js');
var parseString = require('xml2js').parseString;
var fs = require('fs');
var TextDecoder = require('text-encoding').TextDecoder; 
var PastebinAPI = require('better-pastebin');
/*
####################################################################################
# Discord parameters
####################################################################################
*/
const client = new Discord.Client();
const maxDiscordMessageLength = 2000;
const discordCodeBlockWrapper = '```';
/*
####################################################################################
# Fixer parameters
####################################################################################
*/
const versionId = '0.6.1';
const games = {'SR5e':'SR5e','DnD5e':'DnD5e'};
const outputLevels = {'minimal':1,'regular':2,'verbose':3};
const botSavePath = 'fixer.json';
const commands = getChatCommandList();
const helpTopics = getHelpTopicsList();
const reqArgs = ['token', 'user', 'password', 'devkey', 'root'];
const optArgs = ['glitch'];
var bot = {};
var args = {};
/*
####################################################################################
# Parse and validate input arguments
####################################################################################
*/
// Allocate inputs
reqArgs.forEach(function (e) {
    args[e] = '';
});
optArgs.forEach(function (e) {
    args[e] = '';
});

// Parse inputs
process.argv.forEach(function (val, index, array) {
    for (var ii = 0; ii < reqArgs.length; ii++) {
        let reArg = new RegExp('\-\(' + reqArgs[ii] + '\)\=([^\ ]+)');
        if (reArg.test(val)) {
            let matches = reArg.exec(val);
            args[matches[1]] = matches[2];
        }
    }
    for (var ii = 0; ii < reqArgs.length; ii++) {
        let reArg = new RegExp('\-\(' + optArgs[ii] + '\)\=([^\ ]+)');
        if (reArg.test(val)) {
            let matches = reArg.exec(val);
            args[matches[1]] = matches[2];
        }
    }
});

// Check all required inputs exist
reqArgs.forEach(function (e) {
    if (args[e] == '') {
        console.log('Missing input argument: ' + e);
        return false;
    }
});
/*
####################################################################################
# Setup Pastebin devkey for write access
####################################################################################
*/
PastebinAPI.setDevKey(args.devkey);
/*
####################################################################################
# Initialize / load bot data structure
####################################################################################
*/
setupBot();
/*
####################################################################################
# Action when bot has established connection to Discord
####################################################################################
*/
client.on('ready', () => {
    client.user.setPresence({
        game: {
            name: 'RPGs, [help] for info' + (bot.restrictedMode ? ' (R) ' : ''),
            type: 0
        }
    });
    console.log('I am ready!');
});
/*
####################################################################################
# Prepare for message parsing
####################################################################################
*/
client.on('message', message => {
    // If it's not a message from this bot
    if (message.author.id != client.user.id) {
        if (!(message.guild)) {
            // Private message
            //TODO: Implement private messaging stuff
        } else {
            // find all sections in brackets (not accounting for nesting)
            let regExDelim = new RegExp(/\[([^\]]+)\]/gi);
            let matches = regExDelim.exec(message.content);
            // while a section is found
            while (matches) {
                let match = matches[1];
                // go through the list of commands
                for (var ii = 0; ii < commands.length; ii++) {
                    // if it matches that command and the command is in use
                    let regExCmd = new RegExp(commands[ii].pattern);
                    if ( regExCmd.test(match) && isUsedInGame(message,commands[ii]) ) {
                        // then, if you have the required access level
                        if (!(commands[ii].permissions) || message.channel.guild.members.get(message.author.id).hasPermission(commands[ii].permission)) {
                            // execute that command
                            commands[ii].func(message,match,commands[ii]);
                        } else {
                            // otherwise warn the user that they do not have the permissions to use the command
                            message.reply('you need the access rights ' + commands[ii].permission + ' to use the command [' + match + '].')
                        }
                        // then go to the next section
                        break;
                    }
                }
                // go to the next section
                matches = regExDelim.exec(message.content);
            }
        }
    }
});
/*
####################################################################################
# Login to discord
####################################################################################
*/
console.log('Starting up in ' + (bot.restrictedMode ? 'restricted' : 'regular') + ' mode...');
client.login(args.token);
/*
####################################################################################
#
# EXTERNAL FUNCTIONS
#
####################################################################################
*/
/*
####################################################################################
# Chat message functions
####################################################################################
*/
function createMacro(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);

    let alias = matches[1];
    let commandList = matches[2];
    let macroString = matches[3];

    // Parse the command list to an object
    let regExSub = new RegExp(command.subpattern);
    let inputDef = regExSub.exec(commandList);

    let defaultInputs = {};
    while (inputDef) {
        defaultInputs[inputDef[1]] = inputDef[2] ? inputDef[2] : '0';
        inputDef = regExSub.exec(commandList);
    }

    // Save that as the macro function
    let activeGame = getGameMode(message);
    let channelId = message.channel.id;
    let userId = message.author.id;
    ensureUser(channelId,activeGame,userId);

    bot.channel[channelId].game[activeGame].user[userId].macro[alias] = {
        defaultInputs: defaultInputs,
        body: macroString.replace(/ /g,'')
    }
    saveBotData();
    message.reply('created/updated macro with alias "' + alias + '"');
}
function displayMacroList(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);
    let channelId = message.channel.id;
    let userId = message.author.id;
    let showAll = matches[1] ? matches[1].toLowerCase() == 'all' : false;
    let activeGame = getGameMode(message);

    let embed = new Discord.RichEmbed();
    let userHasAMacro = false;
    if (botHasChannel(channelId)) {
        let gameData = bot.channel[channelId].game;
        let gamesWithData = Object.keys(gameData);
        for (var ii=0;ii<gamesWithData.length;ii++) {
            let gameName = gamesWithData[ii];
            if ((showAll || gameName == activeGame) && gameHasUser(channelId,gameName,userId)) {
                let macroData = gameData[gameName].user[userId].macro;
                let macroNames = Object.keys(macroData);
                if (showAll) {
                    if (macroNames.length > 0) {
                        let macroString = '';
                        for (var jj=0;jj<macroNames.length;jj++) {
                            let macroName = macroNames[jj];
                            macroString += (macroString ? ', ' : '') + macroName;
                        }
                        embed.addField(gameName,macroString);
                        userHasAMacro = true;
                    }
                } else {
                    for (var jj=0;jj<macroNames.length;jj++) {
                        let macroName = macroNames[jj];
                        embed.addField(macroName,macroData[macroName].body);
                        userHasAMacro = true;
                    }
                }
            }
        }
    }

    embed.setColor(15746887);
    embed.setTitle('__**Macro list**__');
    embed.setDescription('You have ' + (userHasAMacro ? 'the following' : 'no') + ' macros in this channel.');

    message.reply({embed});
}
function deleteMacro(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);
    let channelId = message.channel.id;
    let activeGame = getGameMode(message);
    let userId = message.author.id;
    if (matches[1] && matches[1].toLowerCase() == 'all') {
        // delete all macros
        removeAllMacros(channelId,userId);
        message.reply('any macros you had have been deleted');
    } else {
        // delete specified macro
        let alias = matches[2];
        if (userHasMacro(channelId,activeGame,userId,alias)) {
            removeMacro(channelId,activeGame,userId,alias);
            message.reply('deleted macro "' + alias + '"');
        } else {
            message.reply('you do not have a macro called "' + alias + '" in the current game system ' + activeGame);
        }
    } 
}

function displayHelp(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);
    let game = getGameMode(message);

    if (matches.length > 1 && matches[1]) {
        let topicFound = false;
        for (var ii=0;ii<helpTopics.length;ii++) {
            if (matches[1].toLowerCase() == helpTopics[ii].topic.toLowerCase()) {
                helpTopics[ii].func(message);
                topicFound = true;
                break;
            }
        }
        if (!messageAssert(message, topicFound, 'no help exists on the topic "' + matches[1] + '".')) { return };
    } else {
        printHelpList(message);
    }
}
function exportBotData(message,match,command) {
    let str = JSON.stringify(bot);
    let pasteName = 'Exported bot data';
    let options = {
        contents: str,
        anonymous: true,
        expires: '10M',
        format: 'xml',
        privacy: '1',
        name: pasteName
    };
    PastebinAPI.create(options, function(success, data) {
        if (success) {
            message.author.send('You can find the exported data here: ' + data + '\nPlease note that it will be automatically removed in 10 minutes.')
            message.reply('a link to the data has been sent to you in a private message.')
        } else {
            message.reply('failed to export data: ' + data.message)
        }
    });
}
function importBotData(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);
    let pasteId = matches[1];

    PastebinAPI.get(pasteId, function(success, data) {
        //data contains the contents of the paste
        if (success) {
            if (isValidBotData(data)) {
                bot = JSON.parse(data);
                message.reply('imported bot data from paste ' + pasteId);
                saveBotData();
            } else {
                message.reply('import aborted as paste ' + pasteId + ' does not contain valid bot data.')
            }
        } else {
            message.reply('failed to imort bot data from paste ' + pasteId + ': ' + data.message);
        }
    });
    return false;
}
function generalRoll(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let regExSub = new RegExp(command.subpattern)
    let matches = regExSub.exec(match);
    let elementValue = [];
    let elementSign = [];
    let elementRolls = [];
    let elementCode = [];
    let parser = new Parser();
    while (matches) {
        if (isNaN(matches[2])) {
            // main component is not just a number, so it is XdY
            let result = XdY(matches[3],matches[4],matches[1]);
            elementValue.push(result.sum);
            elementRolls.push(result.rolls);
            elementSign.push(matches[1]);
            elementCode.push(matches[2]);
        } else {
            // main component is a number, so a constant
            elementValue.push(parser.evaluate(matches[0]));
            elementRolls.push([parser.evaluate(matches[2])]);
            elementSign.push(matches[1]);
            elementCode.push(matches[2]);
        }
        matches = regExSub.exec(match);
    }
    let rollTotal = elementValue.reduce(function (sum,value) {return sum+parseInt(value)});

    printGeneralRollDetails(message,match,elementValue,elementRolls,elementCode,elementSign);
}
function shadowrunBasicRoll(message,match,command) {
    let parser = new Parser();
    let regEx = new RegExp(command.pattern);
    let regExSub = new RegExp(command.subpattern)
    let matches = regEx.exec(match);

    let channelId = message.channel.id;
    let activeGame = getGameMode(message);
    let userId = message.author.id;

    // Check if it is a macro and if so treat it special.
    if (userHasMacro(channelId,activeGame,userId,matches[1])) {
        // Replace the matched text with the macro text
        let macroAlias = matches[1];
        let macro = bot.channel[channelId].game[activeGame].user[userId].macro[macroAlias];
        let inputObject = Object.assign({},macro.defaultInputs);
        let inputString = matches[8];

        let regExCsv = new RegExp(/,?\s*([A-z]+)(?:\s*=\s*([^,]+))?/gi);
        let inputData = regExCsv.exec(inputString);
        
        while (inputData) {
            if (inputData[1] in inputObject) {
                inputObject[inputData[1]] = inputData[2];
            }
            inputData = regExCsv.exec(inputString);
        }

        let macroResult = macroSubstitution(macro.body,inputObject)
        matches = regEx.exec(macroResult);
    }

    let nDiceA = sr5RollCodeParser(message,matches[1]);
    let limitA = sr5RollCodeParser(message,matches[2] ? matches[2].trim('()') : matches[2]);
    let edgeUseA = matches[3] ? matches[3] == '!' : false;
    let rollType = matches[4] ? matches[4].toLowerCase() : '';
    let nDiceB = sr5RollCodeParser(message,matches[5]);
    let limitB = sr5RollCodeParser(message,matches[6] ? matches[6].trim('()') : matches[6]);
    let edgeUseB = matches[7] ? matches[7] == '!' : false;
    let extraParam = matches[8] ? matches[8].substr(1).split(',') : undefined;

    if (nDiceA===undefined || limitA===undefined || nDiceB===undefined || limitB===undefined) { return; };

    let validRollType = rollType!='';

    // Case 1: simple roll, with not type defined.
    // Require: nDiceA
    // Optional: limitA, edgeUseA
    // Forbidden: rollType, nDiceB, limitB, edgeUseB, extraParam
    if ((nDiceA > 0) && (!validRollType) && (isNaN(nDiceB)) && (isNaN(limitB)) && (!edgeUseB) && (!extraParam)) {
        let roll = sr5roll(nDiceA,limitA,edgeUseA,edgeUseA,getGameSetting(message,games.SR5e,'glitch'),matches[0]);
        printSr5SimpleTest(message,roll);
    }

    // Case 2: opposed roll
    // Require: nDiceA, nDiceB, rollType=='v'
    // Optional: limitA, edgeUseA, limitB, edgeUseB
    // Forbidden: extraParam
    else if ((nDiceA > 0) && (nDiceB > 0) && (rollType=='v') && (!extraParam)) {
        let rollCodeA = ((matches[1] ? matches[1] : '') + (matches[2] ? matches[2] : '') + (matches[3] ? matches[3] : '')).replace(/ /g,'');
        let rollCodeB = ((matches[5] ? matches[5] : '') + (matches[6] ? matches[6] : '') + (matches[7] ? matches[7] : '')).replace(/ /g,'');
        let rollA = sr5roll(nDiceA,limitA,edgeUseA,edgeUseA,getGameSetting(message,games.SR5e,'glitch'),rollCodeA);
        let rollB = sr5roll(nDiceB,limitB,edgeUseB,edgeUseB,getGameSetting(message,games.SR5e,'glitch'),rollCodeB);
        printSr5OpposedTest(message,rollA,rollB);
    }

    // Case 3: threshold test
    // Require: nDiceA, nDiceB, rollType=='t'
    // Optional: limitA, edgeUseA
    // Forbidden: limitB, edgeUseB, extraParam
    // NOTE: Use nDiceB as threshold
    else if ((nDiceA>0) && (nDiceB>0) && (rollType=='t') && (isNaN(limitB)) && (!edgeUseB) && (!extraParam)) {
        let roll = sr5roll(nDiceA,limitA,edgeUseA,edgeUseA,getGameSetting(message,games.SR5e,'glitch'),matches[0]);
        let threshold = nDiceB;
        printSr5ThresholdTest(message,roll,threshold);
    }

    // Case 4: availability test
    // Require: nDiceA, nDiceB, rollType=='a'
    // Optional: limitA, edgeUseA, extraParam
    // Forbidden: limitB, edgeUseB
    else if ((nDiceA>0) && (nDiceB>0) && (rollType=='a') && (isNaN(limitB)) && (!edgeUseB)) {
        let rollCodeA = ((matches[1] ? matches[1] : '') + (matches[2] ? matches[2] : '') + (matches[3] ? matches[3] : '')).replace(/ /g,'');
        let rollCodeB = ((matches[5] ? matches[5] : '') + (matches[6] ? matches[6] : '') + (matches[7] ? matches[7] : '')).replace(/ /g,'');
        let rollA = sr5roll(nDiceA,limitA,edgeUseA,edgeUseA,getGameSetting(message,games.SR5e,'glitch'),matches[0]);
        let rollB = sr5roll(nDiceB,limitB,edgeUseB,edgeUseB,getGameSetting(message,games.SR5e,'glitch'),matches[0]);
        let cost = extraParam && extraParam.length > 0 ? extraParam[0] : NaN;
        
        printSr5AvailabilityTest(message,rollA,rollB,cost);
    }

    // Case 5: start of extended test
    // Require: nDiceA, rollType=='e'
    // Optional: limitA, edgeUseA, nDiceB, extraParam
    // Forbidden: limitB, edgeUseB
    // NOTES: nDiceB used as target, extraParam can contain interval
    else if ((nDiceA>0) && (rollType=='e') && (isNaN(limitB)) && (!edgeUseB)) {
        message.reply('extended test, first roll'); // TODO: Resolve how to handle this
    }

    // Case 6: continued extended test
    // Require: rollType=='e'
    // Optional: edgeUseA, extraParam
    // Forbidden: nDiceA, limitA, nDiceB, limitB, edgeUseB,
    // NOTES: extraParam can contain modifications to nDiceA or limitA
    else if ((rollType=='e') && (isNaN(nDiceB)) && (isNaN(limitB)) && (!edgeUseB)) {
        message.reply('extended test, subsequent roll'); // TODO: Resolve how to handle this
    }

    // Case N: accidentally matching empty strings
    // Require: 
    // Optional: 
    // Forbidden: nDiceA, limitA, edgeUseA, rollType, nDiceB, limitB, edgeUseB, extraParam
    else if ((isNaN(nDiceA)) && (isNaN(limitA)) && (!edgeUseA) && (isNaN(nDiceB)) && (isNaN(limitB)) && (!edgeUseB) && (!extraParam)) {
        // do nothing
    }

    // Otherwise: not recognized as a roll type
    else {
        suggestReport(message,'your command "' + match + '" was recognized as a Shadowrun roll, but did not match the pattern of a specific roll type.');
    }
}
function setGameMode(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);
    if (matches.length > 1) {
        let channelId = message.channel.id;
        let channelExists = botHasChannel(channelId);
        let activeGame = channelExists ? bot.channel[channelId].activeGame : '';
        let hasActiveGame = activeGame != '';
        if (!matches[1]) { // [setgame]
            message.reply('this channel is currently ' + (channelExists && hasActiveGame ? 'using the *' + activeGame + '* game system. ' : 'not using a game system. ') +
                          'The following game systems are supported: ' + Object.keys(games).join(', ') + '.' +
                          (channelExists && hasActiveGame ? ' Use "setgame none" to reset to no game system.' : ''));
        } else if (matches[1].toLowerCase() == 'none') { // [setgame none]
            if (channelExists) {
                if (!hasActiveGame) {
                    message.reply('no game system is loaded for this channel.');
                } else {
                    bot.channel[channelId].activeGame = '';
                    saveBotData();
                    message.reply('channel game system removed.');
                }                
            } else {
                message.reply('no game system is loaded for this channel.');
            }
        } else if (channelExists && hasActiveGame && activeGame.toLowerCase() == matches[1].toLowerCase()) { // [setgame <activeGame>]
            message.reply('channel is already using the *' + activeGame + '* game system.');
        } else if (isValidGame(matches[1],false)) { // [setgame <newGame>]
            ensureChannel(channelId);
            bot.channel[channelId].activeGame = Object.keys(games)[arrayIndexOf(Object.keys(games),matches[1],false)];
            saveBotData();
            message.reply('channel is now using the *' + bot.channel[channelId].activeGame + '* game system');
        } else { // [setgame <invalid>]
            message.reply('I do not recognize the game system "' + matches[1] +'". Please select one of the following game systems: ' + Object.keys(games).join(', '));
        }
    }
}
function setOutputLevel(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let regExSub = new RegExp(command.subpattern)
    let matches = regEx.exec(match);
    if (!matches[2]) { // no output mode specified, display current/available
        let hasChannel = botHasChannel(message.channel.id);
        printCurrentOutputSetting(message);
    } else { // output mode specified, attempt to set it
        let newOutputLevel = matches[2].toLowerCase();
        if (outputLevels.hasOwnProperty(newOutputLevel) || newOutputLevel.toLowerCase() == 'default') {
            if (matches[1] && matches[1].toLowerCase() == 'default') { // default output being set
                if (newOutputLevel == bot.outputLevel) {
                    message.reply('my default global output level is already *' + newOutputLevel + '*');
                } else {
                    bot.outputLevel = newOutputLevel;
                    saveBotData();
                    message.reply('my default global output level has been set to *' + newOutputLevel + '*');
                }
            } else { // channel output being set
                let hadChannel = ensureChannel(message.channel.id);
                let settingToDefault = newOutputLevel.toLowerCase() == 'default';
                if ((hadChannel && newOutputLevel == bot.channel[message.channel.id].outputLevel)
                    || (settingToDefault && !hadChannel)) {
                    message.reply('my output level in this channel is already ' + newOutputLevel);
                } else {
                    bot.channel[message.channel.id].outputLevel = newOutputLevel;
                    saveBotData();
                    message.reply('my output level in this channel has been set to ' + newOutputLevel);
                }
            }
        } else {
            message.reply('I do not recognize the output level "' + newOutputLevel + '". The valid output levels are: ' + Object.keys(outputLevels).join(', '));
        }
    }
}
function setGameSetting(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);

    let settingName = (matches[1] ? matches[1] : '');
    let newSettingValue = (matches[2] ? matches[2].replace(/^"(.*)"$/, '$1') : '');

    let activeGame = getGameMode(message);

    if (!activeGame) { return };

    ensureGame(message.channel.id,activeGame);
    let hasSetting = (settingName in bot.channel[message.channel.id].game[activeGame].setting);
    let isSetting = isGameSetting(activeGame,settingName);
    let isValidSetting = isValidGameSetting(activeGame,settingName,newSettingValue);

    // Request all game settings 
    if (!settingName && !newSettingValue) {
        printCurrentGameSettings(message);

    // Request specific game setting
    } else if (settingName && !newSettingValue) {
        printCurrentGameSetting(message,settingName)

    // Request setting specific value
    } else if (settingName && newSettingValue) {
        if (isValidSetting) {
            currentSettingValue = hasSetting ? bot.channel[message.channel.id].game[activeGame].setting[settingName] : '';
            if (newSettingValue == currentSettingValue) {
                message.reply('**' + settingName + '** is already set to **' + currentSettingValue + '**');
            } else {
                bot.channel[message.channel.id].game[activeGame].setting[settingName] = newSettingValue;
                message.reply('**' + settingName + '** is now set to **' + newSettingValue + '**');
                saveBotData();
            }
        } else {
            message.reply(settingName + ' cannot be set to "' + newSettingValue + '". Use [gamesetting ' + settingName + '] to see a list of accepted values.');
        }
    }
}
function importCharacterSaveFile(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);

    let alias = matches[1];
    let pastebinId = matches[2];
    let activeGame = getGameMode(message);

    if (!messageAssert(message,gameSupportsCharacterSaving(activeGame),'this channel is using the game system ' + activeGame + ' which does not support saving characters')) { return; }

    // Get pastebin data and send it to the store method if received
    PastebinAPI.get(pastebinId, function (success, data) {
        if (!success) {
            message.reply('failed to load character from paste ' + pastebinId + ' because: ' + data.message);
        } else {
            parseString(data, function (err, result) {
                if (activeGame == games.SR5e) {
                    parseSr5Character(message, result, alias);
                }
            });
        }
    })
}
function displayCharacterList(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);
    let channelId = message.channel.id;
    let userId = message.author.id;

    let embed = new Discord.RichEmbed();
    let userHasACharacter = false;
    let activeCharacter = getActiveCharacter(message);
    let activeGame = getGameMode(message);
    if (botHasChannel(channelId)) {
        let gameData = bot.channel[channelId].game;
        let gamesWithData = Object.keys(gameData);
        for (var ii=0;ii<gamesWithData.length;ii++) {
            let gameName = gamesWithData[ii];
            if (gameHasUser(channelId,gameName,userId)) {
                let characterData = gameData[gameName].user[userId].character;
                let characterNames = Object.keys(characterData);
                if (characterNames.length > 0) {
                    let characterString = '';
                    for (var jj=0;jj<characterNames.length;jj++) {
                        let characterName = characterNames[jj];
                        let isActiveCharacter = (characterName == activeCharacter) && (gameName == activeGame);
                        characterString += (characterString ? ', ' : '') + (isActiveCharacter ? '__' : '') + characterName + (isActiveCharacter ? '__' : '');
                    }
                    embed.addField(gameName,characterString);
                    userHasACharacter = true;
                }
            }
        }
    }

    embed.setColor(15746887);
    embed.setTitle('__**Character list**__');
    embed.setDescription('You have ' + (userHasACharacter ? 'the following' : 'no') + ' characters in this channel.' 
                    + (userHasACharacter ? ' If you have an active character, it is underlined.' : ''));

    message.reply({embed});
}
function changeCharacter(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);
    let channelId = message.channel.id;
    let userId = message.author.id;
    let activeGame = getGameMode(message);
    let alias = matches[1];

    if (userHasCharacter(channelId,activeGame,userId,alias)) {
        setActiveCharacter(message,alias);
        message.reply('you are now playing as ' + alias);
    } else {
        message.reply('you do not have a character saved as "' + alias + '"');
    }

}
function removeCharacterData(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);
    let channelId = message.channel.id;
    let activeGame = getGameMode(message);
    let userId = message.author.id;
    if (matches[1] && matches[1].toLowerCase() == 'all') {
        // delete all characters
        removeAllCharacters(channelId,userId);
        message.reply('any characters you had have been deleted');
    } else {
        // delete specified character
        let alias = matches[2];
        if (userHasCharacter(channelId,activeGame,userId,alias)) {
            removeCharacter(channelId,activeGame,userId,alias);
            message.reply('deleted "' + alias + '"');
        } else {
            message.reply('you do not have a character called "' + alias + '" in the current game system ' + activeGame);
        }
    } 
}
function dev(message,match,command) {
}
/*
####################################################################################
# Help topics
####################################################################################
*/
function printCommandList(message) {    

    let game = getGameMode(message);
    let title = 'Fixer command list'
    let desc = 'The channel is ' + (game ? 'using the game system ' + game : 'not using a game system') + ', so the following commands are available';

    let columns = ['example','desc'];
    printTable(message,title,desc,commands,columns)
}
/*
####################################################################################
#
# INTERNAL FUNCTIONS
#
####################################################################################
*/
/*
####################################################################################
# General utility functions
####################################################################################
*/
function arrayContains(arr,val,caseSens = true) {
    if (val.length == 0) { return false };
    for (var ii=0; ii<arr.length; ii++) {
        if (val == arr[ii].toString() || (!caseSens && val.toLowerCase() == arr[ii].toLowerCase())) {
            return true;
        }
    }
    return false;
}
function arrayIndexOf(arr,val,caseSens = true) {
    for (var ii=0; ii<arr.length; ii++) {
        if (val == arr[ii].toString() || (!caseSens && val.toLowerCase() == arr[ii].toLowerCase())) {
            return ii;
        }
    }
    return false;
}
function stringCondenseLower(str) {
    return str.replace(/ /g, '').toLowerCase();
}
String.prototype.trimLeft = function(charlist) {
    if (charlist === undefined) { charlist = "\s"; };
    return this.replace(new RegExp("^[" + charlist + "]+"), "");
}
String.prototype.trimRight = function(charlist) {
    if (charlist === undefined) { charlist = "\s";};
    return this.replace(new RegExp("[" + charlist + "]+$"), "");
}
String.prototype.trim = function(charlist) {
    return this.trimLeft(charlist).trimRight(charlist);
}
/*
####################################################################################
# Get bot / channel / user status or info
####################################################################################
*/
function getGameMode(message) {
    let channelId = message.channel.id;
    if ((botHasChannel(channelId)) && (!bot.channel[channelId].activeGame == '')) {
        return bot.channel[channelId].activeGame;
    } else {
        return '';
    }
}
function getOutputLevel(message) {
    if (botHasChannel(message.channel.id) && (bot.channel[message.channel.id].outputLevel !== '') && (bot.channel[message.channel.id].outputLevel !== 'default')) {
        return outputLevels[bot.channel[message.channel.id].outputLevel];
    } else {
        return outputLevels[bot.outputLevel];
    }
}
function getActiveCharacter(message) {
    let activeGame = getGameMode(message);
    let channelId = message.channel.id;
    let userId = message.author.id;
    if (gameHasUser(channelId,activeGame,userId)) {
        return bot.channel[channelId].game[activeGame].user[userId].activeCharacter;
    }
    return '';
}
function setActiveCharacter(message,alias) {
    let activeGame = getGameMode(message);
    let channelId = message.channel.id;
    let userId = message.author.id;
    ensureUser(channelId,activeGame,userId);
    bot.channel[channelId].game[activeGame].user[userId].activeCharacter = alias;
    saveBotData();
}
function getActiveCharacterField(message) {
    let activeCharacter = getActiveCharacter(message);
    let channelId = message.channel.id;
    let userId = message.author.id;
    let activeGame = getGameMode(message);
    if (userHasCharacter(channelId,activeGame,userId,activeCharacter)) {
        let characterDataObject = bot.channel[channelId].game[activeGame].user[userId].character[activeCharacter];
        for (var ii=1;ii<arguments.length;ii++) {
            if (arguments[ii] in characterDataObject) {
                characterDataObject = characterDataObject[arguments[ii]];
            } else {
                return undefined;
            }
        }
        return characterDataObject;
    }
    return undefined;
}
/*
####################################################################################
# Dice rolling kernels
####################################################################################
*/
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function XdY(dice,sides,sign) {
    sign = sign ? sign : "+";
    sign = sign == "+" ? 1 : -1;
    let rolls = [];
    for (var ii=0;ii<dice;ii++) {
        rolls.push(getRandomInt(1,sides));
    }
    let sum = sign*rolls.reduce(function(sum,value) { return sum + value});
    let result = {sum: sum, rolls: rolls}
    return result
}
function sr5roll(dice,limit,pushTheLimit,ruleOfSix,glitchSetting,rollCode) {
    let rolls = [];
    let nHitsBeforeLimit = [];
    let nOnes = [];
    let ruleOfSixDice = 0;
    for (var ii=0;ii<dice+ruleOfSixDice;ii++) {
        let roll = getRandomInt(1,6)
        rolls.push(roll);
        nHitsBeforeLimit.push(roll >= 5 ? 1 : 0);
        nOnes.push(roll == 1 ? 1 : 0);
        ruleOfSixDice += (ruleOfSix && roll == 6) ? 1 : 0;
    }
    nHitsBeforeLimit = nHitsBeforeLimit.reduce(function (sum,value) { return sum+parseInt(value)}); 
    nOnes = nOnes.reduce(function (sum,value) { return sum+parseInt(value)});
    nHits = pushTheLimit || isNaN(limit) ? nHitsBeforeLimit : Math.min(limit,nHitsBeforeLimit);

    let glitchMargin = sr5glitch(dice+ruleOfSixDice,nOnes,glitchSetting);

    return {
        baseDice: dice,
        ruleOfSix: ruleOfSix,
        ruleOfSixDice: ruleOfSixDice,
        roll: rolls,
        nHits: nHits,
        nHitsBeforeLimit: nHitsBeforeLimit,
        nOnes: nOnes,
        glitchMargin: glitchMargin,
        limit: limit,
        pushTheLimit: pushTheLimit,
        rollCode: rollCode
    }
}
function sr5glitch(dice,nOnes,glitchSetting) {
    // The glitch margin is how many more ones you'd need to roll to get a glitch.
    // Thus, glitchMargin <= 0 normally means you glitched
    // And a positive glitchMargin means a gremlin level of glitchMargin or higher would glitch
    let glitchMargin = -nOnes;
    switch (glitchSetting.toLowerCase()) {
        case '>u':
            glitchMargin += Math.ceil(dice / 2) + 1;
            break;
        case '>=u','classic':
            glitchMargin += Math.ceil(dice / 2);
            break;
        case '>d','default':
            glitchMargin += Math.floor(dice / 2) + 1;
            break;
        case '>=d':
            glitchMargin += Math.floor(dice / 2);
            break;
        default: 
            glitchMargin += Math.floor(dice / 2) + 1;
    }

    return glitchMargin; // TODO: Implement this; shall be the number of 1's away from a glitch, based on current glitch settings
}
/*
####################################################################################
# Roll code parsers
####################################################################################
*/
function sr5RollCodeParser(message,rollCode) {
    // take a roll code string, including references to character data and macros
    // output the corresponding number, which might be the number of dice or the limit
    // If blank, return NaN
    // If not valid, return undefined

    if (!rollCode) { return NaN; };

    let parser = new Parser();
    
    let activeSkills = getActiveCharacterField(message,'activeSkills');
    let attributes = getActiveCharacterField(message,'attributes');
    //let initiative = getActiveCharacterField(message,'initiative'); // TODO: include initiative
    //let limits = getActiveCharacterField(message,'limits'); //TODO: Include limits
    
    let regEx = new RegExp(/([\+\-]?)\s*(\d+|[A-z_]+)/gi);
    let matches = regEx.exec(rollCode);
    
    // First count identified skills and attributes
    let nSkills = 0;
    let nAttributes = 0;
    while (matches) {   
        if (matches[2].toLowerCase() in activeSkills) { nSkills += 1; } // count skills
        else if (matches[2].toUpperCase() in attributes) { nAttributes += 1; } // count attributes
        else if (matches[2].toLowerCase() in sr5attributeMap) { nAttributes += 1; }; // count attributes
        matches = regEx.exec(rollCode);
    }
    
    // Then go through the list again 
    matches = regEx.exec(rollCode);
    let totalDice = 0;
    while (matches) {   
        let sign = matches[1].replace(/ /g,'');
        // Handle skills
        if (matches[2].toLowerCase() in activeSkills) {
            let nDice = 
                nSkills == 1 && nAttributes == 0
                ? activeSkills[matches[2].toLowerCase()].totalDice
                : activeSkills[matches[2].toLowerCase()].ratingDice + activeSkills[matches[2].toLowerCase()].improvementOther;
            totalDice += (sign=='-' ? -1 : 1)*nDice;
        }
        
        // Handle attributes (short name)
        else if (matches[2].toUpperCase() in attributes) {
            totalDice += (sign=='-' ? -1 : 1)*attributes[matches[2]].totalValue;
        }

        // Handle attributes (full name)
        else if (matches[2].toLowerCase() in sr5attributeMap) {
            totalDice += (sign=='-' ? -1 : 1)*attributes[sr5attributeMap[matches[2]]].totalValue;
        }

        // Handle other
        else {
            try {
                totalDice += parser.evaluate(matches[0]);
            } catch (err) {
                message.reply('could not compute the term "' + matches[0].replace(/ /g,'') + '"');
                return undefined;
            }
        }
        matches = regEx.exec(rollCode);
    }

    return totalDice;
}
/*
####################################################################################
# Macro functionality
####################################################################################
*/
function macroSubstitution(string,inputMap) {
    // Apply all mapped keys
    let mappedKeys = Object.keys(inputMap);
    for (var ii=0;ii<mappedKeys.length;ii++) {
        let regEx = new RegExp(':' + mappedKeys[ii],'g')
        string = string.replace(regEx,inputMap[mappedKeys[ii]]);
    }
    return string;
}
/*
####################################################################################
# Roll outputs
####################################################################################
*/
function joinOutputString() {
    let outputString = '';
    for (var ii=0;ii<arguments.length;ii++) {
        if ((typeof(arguments[ii])=='string') && (arguments[ii])) {
            outputString += (outputString ? '\n' : '') + arguments[ii];
        }
    }
    //outputString = outputString ? '(' + outputString + ')' : outputString;
    return outputString;
}
function joinSr5AvailabilityTimeString(nMonths,nWeeks,nDays,nHours,nMinutes) {
    let timeString = '';
    timeString += nMonths == 0 ? '' : (timeString ? ', ' : '') + nMonths + ' month' + (nMonths == 1 ? '' : 's')
    timeString += nWeeks == 0 ? '' : (timeString ? ', ' : '') + nWeeks + ' week' + (nWeeks == 1 ? '' : 's')
    timeString += nDays == 0 ? '' : (timeString ? ', ' : '') + nDays + ' day' + (nDays == 1 ? '' : 's')
    timeString += nHours == 0 ? '' : (timeString ? ', ' : '') + nHours + ' hour' + (nHours == 1 ? '' : 's')
    timeString += nMinutes == 0 ? '' : (timeString ? ', ' : '') + nMinutes + ' minute' + (nMinutes == 1 ? '' : 's')
    return timeString;
}
function sr5AvailabilityTime(netHits,costString) {
    if (!costString) {
        if (netHits <= 0) { timeString = 'twice the base time' }
        else if (netHits == 1) { timeString = 'the base time' }
        else if (netHits == 2) { timeString = 'half the base time' }
        else if (netHits == 3) { timeString = 'a third of the base time' }
        else if (netHits == 4) { timeString = 'a quarter of the base time' }
        else if (netHits == 5) { timeString = 'a fifth of the base time' }
        else if (netHits > 5) { timeString = '1/' + netHits + ' of the base time' }
    } else {
        let parser = new Parser();
        let cost = parser.evaluate(costString);

        let baseTime = 0.25;
        if (cost > 100000) { baseTime = 28 }
        else if (cost > 10000) { baseTime = 7 }
        else if (cost > 1000) { baseTime = 2 }
        else if (cost > 100) { baseTime = 1 }
    
        let totalTime = baseTime / (netHits > 0 ? netHits : 1/2);
        let remTime = totalTime;
        let nMonths = Math.floor(remTime/28); remTime -= nMonths*28;
        let nWeeks = Math.floor(remTime/7); remTime -= nWeeks*7;
        let nDays = Math.floor(remTime/1); remTime -= nDays*1;
        let nHours = Math.floor(24*remTime); remTime -= nHours/24;
        let nMinutes = Math.floor(24*60*remTime); remTime -= nMinutes/24/60;

        timeString = joinSr5AvailabilityTimeString(nMonths,nWeeks,nDays,nHours,nMinutes);
    }

    return timeString
}

function printGeneralRollDetails(message,match,elementValue,elementRolls,elementCode,elementSign) {
    let outputLevel = getOutputLevel(message);
    
    let valueStr = '';
    let diceStr = '';
    let rollTotal = elementValue.reduce(function (sum,value) {return sum+parseInt(value)});

    let isVerbose = outputLevel >= outputLevels.verbose;
    let isRegular = outputLevel >= outputLevels.regular;

    for (var ii=0;ii<elementRolls.length;ii++) {
        valueStr += ((ii > 0 && elementValue[ii] >= 0) ? elementSign[ii] : '') + elementValue[ii];
        if (isNaN(elementCode[ii])) {
            diceStr += (elementSign[ii] == "-" ? elementSign[ii] : "") + elementCode[ii] + '=' + (elementSign[ii] == "-" ? elementSign[ii] : "") + '(' + elementRolls[ii].toString() + ')=' + elementValue[ii] + ', ';
        }
    }
    diceStr = diceStr.slice(0,-2);
    
    let resultString = '**' + rollTotal + '**';
    let diceCodeString = match.replace(/ /g,'') + '=' + valueStr + '=' + rollTotal;
    let diceOutcomeString = diceStr;

    let title = 'Roll: ' + resultString;
    let description = joinOutputString(
                        !isRegular ? '' : diceCodeString,
                        !isVerbose ? '' : diceOutcomeString
                    );

    let embed = new Discord.RichEmbed();
    embed.setTitle(title);
    embed.setDescription(description);
    embed.setColor(15746887);
    message.reply({embed});

}
function printSr5SimpleTest(message,roll) {
    let outputLevel = getOutputLevel(message);
    
    let diceOutcomes = roll.roll.join(',');
    let totalDice = roll.baseDice + roll.ruleOfSixDice;
    let nMisses = totalDice - roll.nHitsBeforeLimit;
    let nIgnoredHits = roll.nHitsBeforeLimit - roll.nHits;
    let isGlitch = roll.glitchMargin <= 0;
    
    let hitString = '**' + roll.nHits + '** hit' + (roll.nHits==1 ? '' : 's');
    let glitchString = 'and a **' + (roll.nHits == 0 ? 'critical ' : '') + 'glitch**!'
    let missString = nMisses + ' miss' + (nMisses == 1 ? '' : 'es');
    let ignoredHitsString = isNaN(roll.limit) || roll.pushTheLimit ? 'no limit in effect' : nIgnoredHits + ' hit' + (nIgnoredHits==1 ? '' : 's') + ' removed by limit ' + roll.limit;
    let glitchMarginString = roll.glitchMargin + ' more one' + (roll.glitchMargin == 1 ? '' : 's') + ' for a ' + (roll.nHits == 0 ? 'critical ' : '') + 'glitch';
    let rollCodeString = 'roll code: ' + roll.rollCode.replace(/ /g,'');
    let diceOutcomeString = 'roll: ' + diceOutcomes;
    let totalDiceString = 'dice: ' + roll.baseDice + (roll.ruleOfSix ? '+' + roll.ruleOfSixDice : '');
    
    let isVerbose = outputLevel >= outputLevels.verbose;
    let isRegular = outputLevel >= outputLevels.regular;

    let title = hitString + (isGlitch ? ' ' + glitchString : '');
    let description = joinOutputString(
        !isRegular ? '' : missString, 
        !isRegular ? '' : ignoredHitsString, 
        !isVerbose ? '' : glitchMarginString, 
        !isVerbose ? '' : totalDiceString,
        !isVerbose ? '' : rollCodeString,
        diceOutcomeString
    );

    let embed = new Discord.RichEmbed();
    embed.setTitle(title);
    embed.setDescription(description);
    embed.setColor(15746887);
    message.reply({embed});
}
function printSr5OpposedTest(message,rollA,rollB) {
    let outputLevel = getOutputLevel(message);
    
    let diceOutcomesA = rollA.roll.join(',');
    let totalDiceA = rollA.baseDice + rollA.ruleOfSixDice;
    let nMissesA = totalDiceA - rollA.nHitsBeforeLimit;
    let nIgnoredHitsA = rollA.nHitsBeforeLimit - rollA.nHits;
    let isGlitchA = rollA.glitchMargin <= 0;
    
    let diceOutcomesB = rollB.roll.join(',');
    let totalDiceB = rollB.baseDice + rollB.ruleOfSixDice;
    let nMissesB = totalDiceB - rollB.nHitsBeforeLimit;
    let nIgnoredHitsB = rollB.nHitsBeforeLimit - rollB.nHits;
    let isGlitchB = rollB.glitchMargin <= 0;

    let hitStringA = rollA.nHits + ' hit' + (rollA.nHits==1 ? '' : 's');
    let glitchStringA = 'and a **' + (rollA.nHits == 0 ? 'critical ' : '') + 'glitch**!'
    let missStringA = nMissesA + ' miss' + (nMissesA == 1 ? '' : 'es');
    let ignoredHitsStringA = isNaN(rollA.limit) || rollA.pushTheLimit ? 'no limit in effect' : nIgnoredHitsA + ' hit' + (nIgnoredHitsA==1 ? '' : 's') + ' removed by limit ' + rollA.limit;
    let glitchMarginStringA = rollA.glitchMargin + ' more one' + (rollA.glitchMargin == 1 ? '' : 's') + ' for a ' + (rollA.nHits == 0 ? 'critical ' : '') + 'glitch';
    let rollCodeStringA = 'roll code: ' + rollA.rollCode.replace(/ /g,'');
    let diceOutcomeStringA = 'roll: ' + diceOutcomesA;
    let totalDiceStringA = 'dice: ' + rollA.baseDice + (rollA.ruleOfSix ? '+' + rollA.ruleOfSixDice : '');
    
    let hitStringB = rollB.nHits + ' hit' + (rollB.nHits==1 ? '' : 's');
    let glitchStringB = 'and a **' + (rollB.nHits == 0 ? 'critical ' : '') + 'glitch**!'
    let missStringB = nMissesB + ' miss' + (nMissesB == 1 ? '' : 'es');
    let ignoredHitsStringB = isNaN(rollB.limit) || rollB.pushTheLimit ? 'no limit in effect' : nIgnoredHitsB + ' hit' + (nIgnoredHitsB==1 ? '' : 's') + ' removed by limit ' + rollB.limit;
    let glitchMarginStringB = rollB.glitchMargin + ' more one' + (rollB.glitchMargin == 1 ? '' : 's') + ' for a ' + (rollB.nHits == 0 ? 'critical ' : '') + 'glitch';
    let rollCodeStringB = 'roll code: ' + rollB.rollCode.replace(/ /g,'');
    let diceOutcomeStringB = 'roll: ' + diceOutcomesB;
    let totalDiceStringB = 'dice: ' + rollB.baseDice + (rollB.ruleOfSix ? '+' + rollB.ruleOfSixDice : '');
    
    let netHits = rollA.nHits - rollB.nHits;
    let netHitString = '**' + netHits + '** net hit' + (netHits==1 ? '' : 's');

    let isVerbose = outputLevel >= outputLevels.verbose;
    let isRegular = outputLevel >= outputLevels.regular;
    
    let title = netHitString + (isGlitchA ? ' ' + glitchStringA : '')
    let description = joinOutputString(
        (!isRegular ? '' : hitStringA) + (!isRegular || !isGlitchA ? '' : ' ' + glitchStringA) + (!isRegular ? '' : ' | ' + missStringA) + (!isRegular ? '' : ' | ' + ignoredHitsStringA),
        !isVerbose ? '' : glitchMarginStringA, 
        !isVerbose ? '' : totalDiceStringA,
        !isVerbose ? '' : rollCodeStringA,
        diceOutcomeStringA,
        !isRegular ? '' : 'vs',
        (!isRegular ? '' : hitStringB) + (!isRegular || !isGlitchB ? '' : ' ' + glitchStringB) + (!isRegular ? '' : ' | ' + missStringB) + (!isRegular ? '' : ' | ' + ignoredHitsStringB),
        !isVerbose ? '' : glitchMarginStringB, 
        !isVerbose ? '' : totalDiceStringB,
        !isVerbose ? '' : rollCodeStringB,
        diceOutcomeStringB
    )

    let embed = new Discord.RichEmbed();
    embed.setTitle(title);
    embed.setDescription(description);
    embed.setColor(15746887);
    message.reply({embed});
}
function printSr5ThresholdTest(message,roll,threshold) {
    let outputLevel = getOutputLevel(message);
    
    let diceOutcomes = roll.roll.join(',');
    let totalDice = roll.baseDice + roll.ruleOfSixDice;
    let nMisses = totalDice - roll.nHitsBeforeLimit;
    let nIgnoredHits = roll.nHitsBeforeLimit - roll.nHits;
    let isGlitch = roll.glitchMargin <= 0;
    
    let successString = '**' + (roll.nHits >= threshold ? 'Success' : 'Failure') + '**';
    let glitchString = 'and a **' + (roll.nHits == 0 ? 'critical ' : '') + 'glitch**!'

    let hitString = roll.nHits + ' hit' + (roll.nHits==1 ? '' : 's');
    let missString = nMisses + ' miss' + (nMisses == 1 ? '' : 'es');
    let ignoredHitsString = isNaN(roll.limit) || roll.pushTheLimit ? 'no limit in effect' : nIgnoredHits + ' hit' + (nIgnoredHits==1 ? '' : 's') + ' removed by limit ' + roll.limit;
    let thresholdString = 'threshold: ' + threshold;
    let thresholdMargin = 'margin: ' + roll.nHits - threshold;
    let glitchMarginString = roll.glitchMargin + ' more one' + (roll.glitchMargin == 1 ? '' : 's') + ' for a ' + (roll.nHits == 0 ? 'critical ' : '') + 'glitch';
    let rollCodeString = 'roll code: ' + roll.rollCode.replace(/ /g,'');
    let diceOutcomeString = 'roll: ' + diceOutcomes;
    let totalDiceString = 'dice: ' + roll.baseDice + (roll.ruleOfSix ? '+' + roll.ruleOfSixDice : '');
    
    let isVerbose = outputLevel >= outputLevels.verbose;
    let isRegular = outputLevel >= outputLevels.regular;

    let title = successString + (isGlitch ? ' ' + glitchString : '');
    let description = joinOutputString(
        !isRegular ? '' : hitString,
        !isRegular ? '' : missString, 
        !isRegular ? '' : ignoredHitsString, 
        !isVerbose ? '' : thresholdString,
        !isVerbose ? '' : thresholdMargin,
        !isVerbose ? '' : glitchMarginString, 
        !isVerbose ? '' : totalDiceString,
        !isVerbose ? '' : rollCodeString,
        diceOutcomeString
    );

    let embed = new Discord.RichEmbed();
    embed.setTitle(title);
    embed.setDescription(description);
    embed.setColor(15746887);
    message.reply({embed});
}
function printSr5AvailabilityTest(message,rollA,rollB,cost) {
    let outputLevel = getOutputLevel(message);
    
    let diceOutcomesA = rollA.roll.join(',');
    let totalDiceA = rollA.baseDice + rollA.ruleOfSixDice;
    let nMissesA = totalDiceA - rollA.nHitsBeforeLimit;
    let nIgnoredHitsA = rollA.nHitsBeforeLimit - rollA.nHits;
    let isGlitchA = rollA.glitchMargin <= 0;
    
    let diceOutcomesB = rollB.roll.join(',');
    let totalDiceB = rollB.baseDice + rollB.ruleOfSixDice;
    let nMissesB = totalDiceB - rollB.nHitsBeforeLimit;
    let nIgnoredHitsB = rollB.nHitsBeforeLimit - rollB.nHits;
    let isGlitchB = rollB.glitchMargin <= 0;

    let hitStringA = '**' + rollA.nHits + '** hit' + (rollA.nHits==1 ? '' : 's');
    let glitchStringA = 'and a **' + (rollA.nHits == 0 ? 'critical ' : '') + 'glitch**!'
    let glitchStringA2 = 'with a **' + (rollA.nHits == 0 ? 'critical ' : '') + 'glitch**!'
    let missStringA = nMissesA + ' miss' + (nMissesA == 1 ? '' : 'es');
    let ignoredHitsStringA = isNaN(rollA.limit) || rollA.pushTheLimit ? 'no limit in effect' : nIgnoredHitsA + ' hit' + (nIgnoredHitsA==1 ? '' : 's') + ' removed by limit ' + rollA.limit;
    let glitchMarginStringA = rollA.glitchMargin + ' more one' + (rollA.glitchMargin == 1 ? '' : 's') + ' for a ' + (rollA.nHits == 0 ? 'critical ' : '') + 'glitch';
    let rollCodeStringA = 'roll code: ' + rollA.rollCode.replace(/ /g,'');
    let diceOutcomeStringA = 'roll: ' + diceOutcomesA;
    let totalDiceStringA = 'dice: ' + rollA.baseDice + (rollA.ruleOfSix ? '+' + rollA.ruleOfSixDice : '');
    
    let hitStringB = '**' + rollB.nHits + '** hit' + (rollB.nHits==1 ? '' : 's');
    let glitchStringB = 'and a **' + (rollB.nHits == 0 ? 'critical ' : '') + 'glitch**!'
    let missStringB = nMissesB + ' miss' + (nMissesB == 1 ? '' : 'es');
    let ignoredHitsStringB = isNaN(rollB.limit) || rollB.pushTheLimit ? 'no limit in effect' : nIgnoredHitsB + ' hit' + (nIgnoredHitsB==1 ? '' : 's') + ' removed by limit ' + rollB.limit;
    let glitchMarginStringB = rollB.glitchMargin + ' more one' + (rollB.glitchMargin == 1 ? '' : 's') + ' for a ' + (rollB.nHits == 0 ? 'critical ' : '') + 'glitch';
    let rollCodeStringB = 'roll code: ' + rollB.rollCode.replace(/ /g,'');
    let diceOutcomeStringB = 'roll: ' + diceOutcomesB;
    let totalDiceStringB = 'dice: ' + rollB.baseDice + (rollB.ruleOfSix ? '+' + rollB.ruleOfSixDice : '');
    
    let netHits = rollA.nHits - rollB.nHits;
    let successString = 'the item is **' + (netHits < 0 ? 'un' : '') + 'available** ' + (netHits < 0 ? 'for ' : 'in ') + sr5AvailabilityTime(netHits,cost);

    let isVerbose = outputLevel >= outputLevels.verbose;
    let isRegular = outputLevel >= outputLevels.regular;
    
    let title = successString + (isGlitchA ? ' ' + glitchStringA2 : '');
    let description = joinOutputString(
        (!isRegular ? '' : hitStringA) + (!isRegular || !isGlitchA ? '' : ' ' + glitchStringA) + (!isRegular ? '' : ' | ' + missStringA) + (!isRegular ? '' : ' | ' + ignoredHitsStringA),
        !isVerbose ? '' : glitchMarginStringA, 
        !isVerbose ? '' : totalDiceStringA,
        !isVerbose ? '' : rollCodeStringA,
        diceOutcomeStringA,
        !isRegular ? '' : 'vs',
        (!isRegular ? '' : hitStringB) + (!isRegular || !isGlitchB ? '' : ' ' + glitchStringB) + (!isRegular ? '' : ' | ' + missStringB) + (!isRegular ? '' : ' | ' + ignoredHitsStringB),
        !isVerbose ? '' : glitchMarginStringB, 
        !isVerbose ? '' : totalDiceStringB,
        !isVerbose ? '' : rollCodeStringB,
        diceOutcomeStringB
    )

    let embed = new Discord.RichEmbed();
    embed.setTitle(title);
    embed.setDescription(description);
    embed.setColor(15746887);
    message.reply({embed});
}
function printSr5ExtendedTest() {
    
}
/*
####################################################################################
# Help and command list
####################################################################################
*/
function printHelpList(message) {
    let game = getGameMode(message);
    let title = 'Fixer ' + versionId + (bot.restrictedMode ? ' (restricted mode)' : '')
    let desc = 'This channel is ' + (game ? 'using the game system ' + game + '.': 'not using a game system.');
    desc += ' For more help, use one of the following commands:\n';

    let columns = ['example','desc'];
    printTable(message,title,desc,helpTopics,columns)
}
function printTable(message,title,desc,data,columns) {
    let embed = new Discord.RichEmbed()
    embed.setColor(15746887);
    embed.setTitle('__**' + title + '**__');
    embed.setDescription(desc);
    let knownPermissions = {};
    for (var ii=0;ii<data.length;ii++) { // Loop over main data entries
        if (isUsedInGame(message,data[ii])) {
            if ((data[ii].permission) && ('permission' in data[ii])) {
                if (!(data[ii].permission in knownPermissions)) {
                    knownPermissions[data[ii].permission] = message.channel.guild.members.get(message.author.id).hasPermission(data[ii].permission);
                }
            }

            let acceptedPermission = true;
            if ((data[ii].permission) && ('permission' in data[ii])) { 
                acceptedPermission = knownPermissions[data[ii].permission];
            }

            if (acceptedPermission) {
                let nSubEntries = data[ii][columns[0]].length; // TODO: Validate that all columns have the same number of entries
                for (var kk=0;kk<nSubEntries;kk++) { // Loop over sub-entries
                    embed.addField(data[ii][columns[0]][kk],data[ii][columns[1]][kk]);
                }
            }
        }
    }
    message.reply({embed});
}
function printCurrentGameSetting(message,settingName) {
    //print info on a single setting
    if (!messageAssert(message,(message.channel.id in bot.channel),'no data is stored for this channel')) { return };
    let activeGame = getGameMode(message);
    if (!messageAssert(message,activeGame,'no game mode is set for this channel')) { return };
    if (!messageAssert(isGameSetting(activeGame,settingName),'the setting "' + settingName + ' does not exist in the game system ' + activeGame)) { return };
    
    let gameDataAllocated = (activeGame in bot.channel[message.channel.id].game)
    let gameSettingsAllocated = gameDataAllocated && ('setting' in bot.channel[message.channel.id].game[activeGame]);
    let currentSetting = getGameSetting(message,activeGame,settingName);
    let validSettingData = getGameSettingList(activeGame)[settingName];
    let validSettingValues = validSettingData ? Object.keys(validSettingData.value) : [];

    // Add fields for all settings
    if (validSettingValues.length > 0) {
        let embed = new Discord.RichEmbed()

        for (var ii=0;ii<validSettingValues.length;ii++) {
            let valueName = validSettingValues[ii];
            let valueDesc = validSettingData.value[valueName];
            let isCurrent = valueName.toLowerCase() == currentSetting.toLowerCase();
            embed.addField((isCurrent ? '__' : '') + valueName + (isCurrent ? '__' : ''),valueDesc); 
        }
    
        embed.setColor(15746887);
        embed.setTitle('Valid values for __' + settingName + '__ ');
        embed.setDescription('Note: current setting below is underlined. You can change to a given value by using [gamesetting ' + settingName + '"<value>"], replacing <value> with the appropriate value.');
        message.reply({embed});
    } else {
        message.reply('there are no settings for the ' + activeGame + ' game system.')
    }
}
function printCurrentGameSettings(message) {
    // print info on all settings for the current game
    if (!messageAssert(message,(message.channel.id in bot.channel),'no data is stored for this channel')) { return };
    let activeGame = getGameMode(message);
    if (!messageAssert(message,activeGame,'no game mode is set for this channel')) { return };

    let gameDataAllocated = (activeGame in bot.channel[message.channel.id].game)
    let gameSettingsAllocated = gameDataAllocated && ('setting' in bot.channel[message.channel.id].game[activeGame]);
    let currentSettingObject = bot.channel[message.channel.id].game[activeGame].setting;
    let storedSettingNames = Object.keys(currentSettingObject);
    let validSettingList = getGameSettingList(activeGame);
    let validSettingNames = Object.keys(validSettingList);

    let embed = new Discord.RichEmbed();

    // Add fields for all settings
    for (var ii=0;ii<validSettingNames.length;ii++) {
        let settingName = validSettingNames[ii];
        let settingValue = arrayContains(storedSettingNames,settingName,true) ? currentSettingObject[settingName] : 'default';
        embed.addField(settingName + ": " + settingValue,validSettingList[settingName].value[settingValue]); 
    }

    embed.setColor(15746887);
    embed.setTitle('__**' + activeGame + ' settings**__');
    embed.setDescription('The settings listed below are used in this channel. Use [gamesetting <setting>] to get information on ' 
                        + 'a specific setting or [gamesetting <setting> "<value>"] to set a specific setting to the given value.');

    message.reply({embed});
}
function printCurrentOutputSetting(message) {
    // print info on current output setting and available output settings
    let channelId = message.channel.id;
    let botOutputLevel = bot.outputLevel;
    let channelOutputLevel = botHasChannel(channelId) ? bot.channel[channelId].outputLevel : '';
    let usingBotOutputLevel = !channelOutputLevel || channelOutputLevel.toLowerCase() == 'default';
    let activeOutputLevel = usingBotOutputLevel ? botOutputLevel : channelOutputLevel;

    let embed = new Discord.RichEmbed();
    let validOutputLevelNames = Object.keys(outputLevels);    
    let listOfOutputs = '';
    for (var ii=0;ii<validOutputLevelNames.length;ii++) {
        let outputName = validOutputLevelNames[ii];
        listOfOutputs += (listOfOutputs ? ', ' : '' ) + (outputName == activeOutputLevel ? '__' : '') + validOutputLevelNames[ii] + (outputName == activeOutputLevel ? '__' : '');
    }

    embed.setColor(15746887);
    embed.setTitle('__** Channel output level**__');
    embed.setDescription('This channel uses ' + (usingBotOutputLevel ? 'the default output level' : 'its own output level') + ', underlined below. '
                        + 'Use [output <level>] to ' + (usingBotOutputLevel ? 'set a level specifically for this channel' : 'change to another level'));

    embed.addField('Output levels',listOfOutputs)

    message.reply({embed});
}
/*
####################################################################################
# Saving and loading information
####################################################################################
*/
function setupBot() {
    if (botDataExists()) {
        console.log('Found saved bot data during setup - loading it');
        loadBotData();
    } else {
        console.log('No saved bot data found - generating default data');
        setupDefaultBot();
        saveBotData();
    }
}
function saveBotData() {
    fs.writeFileSync(botSavePath, JSON.stringify(bot));
}
function loadBotData() {
    let json = new TextDecoder("utf-8").decode(fs.readFileSync(botSavePath));
    bot = JSON.parse(json);
}
function saveCharacterData(channelId,activeGame,userId,alias,charData) {
    ensureUser(channelId,activeGame,userId);
    bot.channel[channelId].game[activeGame].user[userId].character[alias] = charData;
    saveBotData();
}
/*
####################################################################################
# Parsing save files
####################################################################################
*/
function parseSr5Character(message, chummerJson, alias) {
    // If 
    if (!messageAssert(message,chummerJson,'the pastebin data seems to be missing. Could not load character.')) { return; };

    // Go through attributes, active skills, knowledge skills, skill groups and improvements
    var attributeJson = chummerJson.character.attributes[0].attribute;
    var improvementJson = chummerJson.character.improvements[0].improvement;
    var activeSkillJson = chummerJson.character.newskills[0].skills[0].skill;
    var knowledgeSkillJson = chummerJson.character.newskills[0].knoskills[0].skill;
    var skillGroupJson = chummerJson.character.newskills[0].groups[0].group;

    var attributes = {};
    var improvements = {};
    var skillGroup = {};
    var activeSkills = {};

    // Go through skill groups (they are identified by name)
    Object.keys(skillGroupJson).forEach(function (id) {
        skillGroup[skillGroupJson[id].name[0]] = {};
        skillGroup[skillGroupJson[id].name[0]].base = parseInt(skillGroupJson[id].base[0]);
        skillGroup[skillGroupJson[id].name[0]].karma = parseInt(skillGroupJson[id].karma[0]);
    });

    // Go through attributes (they contain TotalValue, so won't need to check their improvements)
    Object.keys(attributeJson).forEach(function (id) {
        attributes[attributeJson[id].name[0]] = {};
        attributes[attributeJson[id].name[0]].totalValue = parseInt(attributeJson[id].totalvalue[0]);
    });

    // Go through improvements
    Object.keys(improvementJson).forEach(function (id) {
        let reImprovement = /^(SkillBase|InitiativeDice|Skill)$/;

        if (reImprovement.test(improvementJson[id].improvementttype[0])) {
            let improvementName = stringCondenseLower(improvementJson[id].improvedname[0]);
            let improvementType = stringCondenseLower(improvementJson[id].improvementttype[0]);
            if (!(improvementName)) {
                improvementName = stringCondenseLower(improvementType); // Used for initiative dice, as the bonus doesn't have a name
            }
            if (!(improvementName in improvements)) {
                improvements[improvementName] = {};
            }
            if (!(improvementType in improvements[improvementName])) {
                improvements[improvementName][improvementType] = 0;
            }
            improvements[improvementName][improvementType] += parseInt(improvementJson[id].val[0]);
        } else if (improvementJson[id].sourcename == 'edgeuse') { // Account for edge use 
            attributes['EDG'].totalValue -= parseInt(improvementJson[id].aug);
        }
    });

    // Go through active skills
    Object.keys(activeSkillJson).forEach(function (id) {
        // For each skill, get the base/karma values
        let skillName = sr5skillTable[activeSkillJson[id].suid].name;
        activeSkills[skillName] = {};
        activeSkills[skillName].base = parseInt(activeSkillJson[id].base[0]);
        activeSkills[skillName].karma = parseInt(activeSkillJson[id].karma[0]);

        // Get any related skill group effects
        activeSkills[skillName].groupName = sr5skillTable[activeSkillJson[id].suid].group;

        if (activeSkills[skillName].groupName) {
            activeSkills[skillName].groupBase = skillGroup[activeSkills[skillName].groupName].base;
            activeSkills[skillName].groupKarma = skillGroup[activeSkills[skillName].groupName].karma;
        } else {
            activeSkills[skillName].groupBase = 0;
            activeSkills[skillName].groupKarma = 0;
        }

        // Get any related attribute effects
        activeSkills[skillName].attributeName = sr5skillTable[activeSkillJson[id].suid].attribute;;
        activeSkills[skillName].attributeTotal = attributes[activeSkills[skillName].attributeName].totalValue;

        // Get defaulting status
        activeSkills[skillName].default = sr5skillTable[activeSkillJson[id].suid].default;

        // Get bonus dice from improvements
        activeSkills[skillName].improvementBase = 0;
        activeSkills[skillName].improvementOther = 0;
        if (skillName in improvements) {
            activeSkills[skillName].improvementBase = ('skillbase' in improvements[skillName]) ? improvements[skillName].skillbase : 0;
            activeSkills[skillName].improvementOther = ('skill' in improvements[skillName]) ? improvements[skillName].skill : 0;
        }

        // Calculate total base dice
        activeSkills[skillName].ratingDice = activeSkills[skillName].base
            + activeSkills[skillName].karma
            + activeSkills[skillName].groupBase
            + activeSkills[skillName].groupKarma
            + activeSkills[skillName].improvementBase;

        activeSkills[skillName].blockedDefault = false;
        activeSkills[skillName].totalDice = activeSkills[skillName].ratingDice + activeSkills[skillName].improvementOther;
        if (activeSkills[skillName].ratingDice > 0) {
            activeSkills[skillName].totalDice += activeSkills[skillName].attributeTotal;
        } else if (activeSkills[skillName].default == 'Yes') {
            activeSkills[skillName].totalDice += activeSkills[skillName].attributeTotal - 1;
        } else {
            activeSkills[skillName].totalDice = 0;
            activeSkills[skillName].blockedDefault = true;
        }
    });

    // TODO: Go through knowledge skills. This might require a skill.xml file
    //       from the user if they have custom knowledge skills? Will wait
    //       with implementing this

    // Get initiative
    // TODO: matrix initiatives
    //      AR: same as meat
    //      ColdSim: DataProcessing + Intuition + 3d6;
    //      HotSim: DataProcessing + Intuition + 4d6);
    //      RiggerAR: same as meat
    let initiative = {};
    initiative = {
        'meat': {
            'base': attributes['REA'].totalValue + attributes['INT'].totalValue,
            'dice': 1 + (('initiativedice' in improvements) ? improvements['initiativedice']['initiativedice'] : 0)
        },
        'astral': {
            'base': attributes['INT'].totalValue + attributes['INT'].totalValue,
            'dice': 3
        }
    };
    /*
      'hotsim':  {'base': attributes['reaction'].totalValue + attributes['intuition'].totalValue,
                  'dice': 1+(('initiativedice' in improvements) ? improvements['initiativedice']['initiativedice'] : 0)},
      'coldsim': {'base': attributes['reaction'].totalValue + attributes['intuition'].totalValue,
                  'dice': 1+(('initiativedice' in improvements) ? improvements['initiativedice']['initiativedice'] : 0)},
      'rigger':  {'base': attributes['reaction'].totalValue + attributes['intuition'].totalValue,
                  'dice': 1+(('initiativedice' in improvements) ? improvements['initiativedice']['initiativedice'] : 0)},
    */


    let charData = {
        'alias': chummerJson.character.alias[0],
        'initiative': initiative,
        'attributes': attributes,
        'activeSkills': activeSkills,
    }

    // Assign the character data to the user and channel
    let activeGame = getGameMode(message);
    let userId = message.author.id;
    let channelId = message.channel.id;
    alias = alias ? alias : chummerJson.character.alias[0]; // If no alias supplied, use alias from the character
    if (!messageAssert(message,alias,'either supply an alias for the character in the save file, or supply an alias in the chat command')) { return; }
    
    saveCharacterData(channelId,activeGame,userId,alias,charData);
    setActiveCharacter(message,alias);
    message.reply('loaded ' + (chummerJson.character.alias[0] ? '"' + chummerJson.character.alias[0] + '"' : 'character without alias') + ', saved as "' + alias + '"');
}
/*
####################################################################################
# Bot data structure and validation
####################################################################################
*/
function setupDefaultBot() {
    bot = {
        root: args.root,
        restrictedMode: false,
        outputLevel: 'regular',
        channel: {}
    }
}

function botDataExists() {
    return fs.existsSync(botSavePath);
}

function ensureChannel(channelId) {
    if (!(channelId in bot.channel)) {
        let init = {
            admin: [],
            mod: [],
            game: {},
            activeGame: '',
            outputLevel: ''
        };
        bot.channel[channelId] = init;
        return false;
    } else {
        if (!('admin' in bot.channel[channelId])) { bot.channel[channelId].admin = []};
        if (!('mod' in bot.channel[channelId])) { bot.channel[channelId].mod = []};
        if (!('game' in bot.channel[channelId])) { bot.channel[channelId].game = {}};
        if (!('activeGame' in bot.channel[channelId])) { bot.channel[channelId].activeGame = ''};
        if (!('outputLevel' in bot.channel[channelId])) { bot.channel[channelId].outputLevel = ''};
    }
    return true;
}
function ensureGame(channelId,gameId) {
    ensureChannel(channelId);
    if (!(gameId in bot.channel[channelId].game)) {
        let init = {
            user: {},
            init: {},
            setting: {}
        };
        bot.channel[channelId].game[gameId] = init;
        return false;
    } else {
        if (!('user' in bot.channel[channelId].game[gameId])) { bot.channel[channelId].game[gameId].user = {}};
        if (!('init' in bot.channel[channelId].game[gameId])) { bot.channel[channelId].game[gameId].init = {}};
        if (!('setting' in bot.channel[channelId].game[gameId])) { bot.channel[channelId].game[gameId].setting = {}};
    }
    return true;
}
function ensureUser(channelId,gameId,userId){
    ensureGame(channelId,gameId);
    if (!(userId in bot.channel[channelId].game[gameId].user)) {
        let init = {
            character: {},
            macro: {},
            activeCharacter: ''
        };
        bot.channel[channelId].game[gameId].user[userId] = init;
        return false;
    } else {
        if (!('character' in bot.channel[channelId].game[gameId].user[userId])) { bot.channel[channelId].game[gameId].user[userId].character = {}};
        if (!('macro' in bot.channel[channelId].game[gameId].user[userId])) { bot.channel[channelId].game[gameId].user[userId].macro = {}};
        if (!('activeCharacter' in bot.channel[channelId].game[gameId].user[userId])) { bot.channel[channelId].game[gameId].user[userId].activeCharacter = ''};
    }
    return true;
}

function botHasChannel(channelId) {
    return (channelId in bot.channel)
}
function channelHasGame(channelId,gameId) {
    if (botHasChannel(channelId)) {
        return (gameId in bot.channel[channelId].game)
    } else {
        return false;
    }
}
function gameHasUser(channelId,gameId,userId) {
    if (channelHasGame(channelId,gameId)) {
        return (userId in bot.channel[channelId].game[gameId].user)
    } else {
        return false;
    }
}
function userHasCharacter(channelId,gameId,userId,charId) {
    if (gameHasUser(channelId,gameId,userId)) {
        return (charId in bot.channel[channelId].game[gameId].user[userId].character)
    } else {
        return false;
    }
}
function userHasMacro(channelId,gameId,userId,macroAlias) {
    if (gameHasUser(channelId,gameId,userId)) {
        return (macroAlias in bot.channel[channelId].game[gameId].user[userId].macro)
    } else {
        return false;
    }
}
function characterHasField(channelId,gameId,userId,charId,field) {
    if (userHasCharacter(channelId,gameId,userId,charId)) {
        return (field in bot.channel[channelId].game[gameId].user[userId].character[charId])
    } else {
        return false;
    }
}

function isValidBotData(data) {
    // TODO: Implement more advanced validation of bot data here
    try {
        JSON.parse(data);
    } catch(err) {
        return false;
    }
    return true;
}

function isUsedInGame(message,obj) {
    let game = getGameMode(message);
    let usedInGame = obj.game;
    return usedInGame.length == 0 
            || arrayContains(usedInGame,game,false)
            || (game != '' && arrayContains(usedInGame,'any',false));
}

function getGameSetting(message,activeGame,settingName) {
    if (message.channel.id in bot.channel) {
        if ('game' in bot.channel[message.channel.id]) {
            if (activeGame in bot.channel[message.channel.id].game) {
                if ('setting' in bot.channel[message.channel.id].game[activeGame]) {
                    if (settingName in bot.channel[message.channel.id].game[activeGame].setting) {
                        return bot.channel[message.channel.id].game[activeGame].setting[settingName];
                    }
                }
            }
        }
    }
    return 'default';
}
function isGameSetting(game,settingName) {
    // Validate that the setting exists for the game
    if (isValidGame(game)) {
        let settingList = getGameSettingList();
        if (game in settingList) {
            return (settingName in settingList[game]);
        }
    }
    return false;
}
function isValidGameSetting(game,settingName,settingValue) {
    // Validate that the setting exists for the game and can be set to the given value
    if (isGameSetting(game,settingName)) {
        let settingList = getGameSettingList();
        return (arrayContains(Object.keys(settingList[game][settingName].value),settingValue,true));
    }
    return false;
}
function isValidGame(game,caseSens = true) {
    return arrayContains(Object.keys(games),game,caseSens);
}

function removeCharacter(channelId,activeGame,userId,alias) {
    if (userHasCharacter(channelId,activeGame,userId,alias)) {
        if (bot.channel[channelId].game[activeGame].user[userId].activeCharacter == alias) { 
            bot.channel[channelId].game[activeGame].user[userId].activeCharacter = '';
        }
        delete bot.channel[channelId].game[activeGame].user[userId].character[alias];
        saveBotData();
    }
}
function removeAllCharacters(channelId,userId) {
    if (botHasChannel(channelId)) {
        let gameData = bot.channel[channelId].game;
        let gamesWithData = Object.keys(gameData);
        let needsSaving = false;
        for (var ii=0;ii<gamesWithData.length;ii++) {
            let gameName = gamesWithData[ii];
            if (gameHasUser(channelId,gameName,userId)) {
                bot.channel[channelId].game[gameName].user[userId].character = {};
                bot.channel[channelId].game[gameName].user[userId].activeCharacter = '';
                needsSaving = true;
            }
        }
        if (needsSaving) { saveBotData() };
    }
}

function removeMacro(channelId,activeGame,userId,alias) {
    if (userHasMacro(channelId,activeGame,userId,alias)) {
        delete bot.channel[channelId].game[activeGame].user[userId].macro[alias];
        saveBotData();
    }
}
function removeAllMacros(channelId,userId) {
    if (botHasChannel(channelId)) {
        let gameData = bot.channel[channelId].game;
        let gamesWithData = Object.keys(gameData);
        let needsSaving = false;
        for (var ii=0;ii<gamesWithData.length;ii++) {
            let gameName = gamesWithData[ii];
            if (gameHasUser(channelId,gameName,userId)) {
                bot.channel[channelId].game[gameName].user[userId].macro = {};
                needsSaving = true;
            }
        }
        if (needsSaving) { saveBotData() };
    }
}
/*
####################################################################################
# Dev, debug, troubleshooting, etc.
####################################################################################
*/
function requestReport(message, str) {
    message.reply(str + ' Please report this at www.github.com/TheMalle/fixer');
}
function suggestReport(message, str) {
    message.reply(str + ' If you think this is in error, please report this at www.github.com/TheMalle/fixer');
}
function messageAssert(message, condition, str) {
    if (!condition) {
        message.reply(str);
    }
    return condition;
}
/*
####################################################################################
# Definitions, such as chat commands, help topics, info maps, etc.
####################################################################################
*/
function gameSupportsCharacterSaving(game) {
    return game == games.SR5e;
}
function getHelpTopicsList() {
    return [
        { // Commands
            topic: 'commands',
            example: ['[help commands]'],
            desc: ['list all available commands'],
            game: [],
            func: function (message) {printCommandList(message)},
            permission: ''
        }
    ];
}

function getChatCommandList() {
    return [
        { // Help
            pattern: /^\s*help *([^\]]+)?\s*$/i,
            subpattern: '',
            example: ['[help], [help <topic>]'],
            desc: ['Get help on the relevant topic. Omitt topic for general help including list of help topics.'],
            game: [],
            func: function (message, match, cmd) {displayHelp(message, match, cmd)},
            permission: ''
        },
        { // Export bot
            pattern: /^\s*export bot\s*$/i,
            subpattern: '',
            example: ['[export bot]'],
            desc: ['Export the entire data of the bot, so that it can be imported to another bot user.'],
            game: [],
            func: function (message, match, cmd) {exportBotData(message, match, cmd)},
            permission: 'ADMINISTRATOR'
        },
        { // Import bot
            pattern: /^\s*import bot *(.{8})\s*$/i,
            subpattern: '',
            example: ['[import bot <pasteId>]'],
            desc: ['Import data for the bot, overwriting any existing data.'],
            game: [],
            func: function (message, match, cmd) {importBotData(message, match, cmd)},
            permission: 'ADMINISTRATOR'
        }, 
        { // Import character sheet
            pattern: /^\s*import *(?:\"([^\"]+)\")? *(.{8})\s*$/i,
            subpattern: '',
            example: ['[import "<name>" <pasteId>]'],
            desc: ['Import a save file from the given paste ID, assigning the character the given name.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {importCharacterSaveFile(message, match, cmd)},
            permission: ''
        }, 
        { // Set which character you use
            pattern: /^\s*use *\"([^\"]+)\"\s*$/i,
            subpattern: '',
            example: ['[use "<character>"]'],
            desc: ['Change to using the given character.'],
            game: [],
            func: function (message, match, cmd) {changeCharacter(message, match, cmd)},
            permission: ''
        }, 
        { // List saved characters
            pattern: /^\s*characterlist\s*$/i,
            subpattern: '',
            example: ['[characterlist]'],
            desc: ['List all characters you currently have saved'],
            game: [],
            func: function (message, match, cmd) {displayCharacterList(message, match, cmd)},
            permission: ''
        }, 
        { // Delete saved character
            pattern: /^\s*delete *(?:(all)|\"([^\"]+)\")\s*$/i,
            subpattern: '',
            example: ['[delete "<alias>"]'],
            desc: ['Delete your character with the given alias.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {removeCharacterData(message, match, cmd)},
            permission: ''
        }, 
        { // Create macro
            //                   (alias )(inputs                                                         )   (macro string  )
            pattern: /^\s*macro *([A-z]+)(?:\(\s*((?:[A-z]+(?:\s*=\s*\d+)?)(?:,[A-z]+(?:\s*=\s*\d+)?)*)?\))\s*(?:\"([^\"]+)\")\s*$/i,
            subpattern: /,?\s*([A-z]+)\s*(?:=\s*(\d+))?/gi,
            example: ['[macro <alias>(<inputs>) "<command>"],[macro summon(F=6,B) "summoning + :B (:F) v :F+:F"]'],
            desc: ['Create a macro which can be used as a chat command to roll a customized roll. The inputs shall be comma separated,'
                    + ' and default values can be assigned as in the second example. If no default value is explicitly defined, 0 will be used.'
                    + ' The macro can then be used with [<alias>,<inputs>] e.g. [summon,B=2,F=5]. If the inputs are named, they can be supplied'
                    + ' in any order. If they are unnamed they are used in the original defined order, e.g. [summon,2,5] would be the same as'
                    + ' [summon,F=2,B=5]. Macro aliases and input names may only contain A-z.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {createMacro(message, match, cmd)},
            permission: ''
        }, 
        { // Check macros
            pattern: /^\s*macrolist *(all)?\s*$/i,
            subpattern: '',
            example: ['[macrolist], [macrolist all]'],
            desc: ['List all macros you have for the current game, or for all games.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {displayMacroList(message, match, cmd)},
            permission: ''
        },
        { // Delete macros
            pattern: /^\s*delmacro *(?:(all)|\"([^\"]+)\")?\s*$/i,
            subpattern: '',
            example: ['[delmacro "<alias>"], [delmacro all]'],
            desc: ['Delete a specific macro, or all of your macros.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {deleteMacro(message, match, cmd)},
            permission: ''
        },
        { // Set or check game system
            pattern: /^\s*setgame *(\S*)?\s*$/i,
            subpattern: '',
            example: ['[setgame], [setgame <game>]'],
            desc: ['Set the channel\'s game to the selected game system. Use [setgame] to see current and available game systems.'],
            game: [],
            func: function (message, match, cmd) {setGameMode(message, match, cmd)},
            permission: ''
        },
        { // Set or check game settings
            pattern: /^\s*gamesetting *(?:\s(\S*))? *(?:\s("[^\"]*"))? *$/i,
            subpattern: '',
            example: ['[gamesetting <setting> "<newValue>"], [gamesetting], [gamesetting <setting>]'],
            desc: ['Set the value of a setting for the current game. Omitt the value to check the current value. Also omitt the setting to check all settings.'],
            game: ['any'],
            func: function (message, match, cmd) {setGameSetting(message, match, cmd)},
            permission: 'ADMINISTRATOR'
        },
        { // Set or check output level
            pattern: /^\s*(?:(default)\s+)?output(?:\s+([^ ]+))?\s*$/i,
            subpattern: '',
            example: ['[output], [output <level>], [default output <level>] '],
            desc: ['Set bot output in this channel to given level.'
                    + ' Use [default output <level>] to set the default level used in channels with no specified output level.' 
                    + ' Use [output] to list current and available output levels'],
            game: [],
            func: function (message, match, cmd) {setOutputLevel(message, match, cmd)},
            permission: 'ADMINISTRATOR'
        },/*
        { // Shadowrun edge spend after roll //TODO: Implement this
            pattern: /^\s*\[\s*$/i, 
            subpattern: '',
            example: ['[!]',
                    '[R]'],
            desc: ['Push the limit on your previous roll',
                'Reroll misses on your previous roll'],
            game: ['SR5e'],
            func: function (message, match, cmd) {generalRoll(message, match, cmd)}, // TODO: Change command
            permission: ''
        },
        { // Shadowrun extended rolls //TODO: Implement this
            pattern: /^\s*\[\s*$/i, 
            subpattern: '',
            example: ['[E]'],
            desc: ['Extend your previous roll'],
            game: ['SR5e'],
            func: function (message, match, cmd) {generalRoll(message, match, cmd)}, // TODO: Change command
            permission: ''
        },
        { // Add character to initiative list //TODO: Implement this
            pattern: /^\s*\[\s*$/i,
            subpattern: '',
            example: ['[i N name]'],
            desc: ['Add a character with the given name to the initiative list with initiative N, which can be either a constant or a dice expression. '
                +'If the name is omitted, the name of your active character is used. If you have no active character, your user name is used. '
                +'This initiative is automatically rolled each new combat turn.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {generalRoll(message, match, cmd)}, // TODO: Change command
            permission: ''
        },
        { // Temporarily modify character's initiative //TODO: Implement this
            pattern: /^\s*\[\s*$/i, 
            subpattern: '',
            example: ['[i +N name]'],
            desc: ['Increase or decrease (with - instead of +) the initiative score of the character with the given name for this combat turn. N can be a constant or a dice expression. '
                +'If you omitt the name, your active character name will be used, otherwise your user name.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {generalRoll(message, match, cmd)}, // TODO: Change command
            permission: ''
        },
        { // Reroll character's initiative (e.g. change interface mode) //TODO: Implement this
            pattern: /^\s*\[\s*$/i, 
            subpattern: '',
            example: ['[reroll init]'],
            desc: ['Reroll the initiative of your active character, or the character with your user name, using their initiative expression.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {generalRoll(message, match, cmd)}, // TODO: Change command
            permission: ''
        },
        { // Start/end combat or go to next character //TODO: Implement this
            pattern: /^\s*\[\s*$/i,
            subpattern: '',
            example: ['[start combat], [next], [end combat]'],
            desc: ['At the start of combat, the initiative expressions for all added characters will be rolled and the initiative order will be established. '
                +'Use [next] to go to the next character in initiative order. This iterates through all initiative passes until a new combat turn begins, '
                +'at which point the initiative is rerolled automatically for all characters, using their initiative expressions. [end combat] removes all '
                +'characters from the initiative queue and resets their initiative expressions.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {generalRoll(message, match, cmd)}, // TODO: Change command
            permission: ''
        },
        { // List initiative //TODO: Implement this
            pattern: /^\s*\[\s*$/i,
            subpattern: '',
            example: ['[i show]'],
            desc: ['Show initiative information, such as current pass, current initiative values, etc.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {generalRoll(message, match, cmd)}, // TODO: Change command
            permission: ''
        },*/
        { // General dice roll
            pattern: /^\s*(\s*[\+\-]?\s*(\d+d\d+|\d+))*\s*([\+\-]?\s*\d+d\d+)\s*(\s*[\+\-]?\s*(\d+d\d+|\d+))*\s*$/i,
            //pattern: /^\s*(?:([\+\-]?)\s*(\d+d\d+|\d+))(?:\s*([\+\-])\s*(\d+d\d+|\d+))*\s*$/i,
            subpattern: /([\+\-]?)\s*((\d+)d(\d+)|\d+)/gi,
            example: ['[XdY+C]'],
            desc: ['Roll any combination of dice and static modifiers.'],
            game: [],
            func: function (message, match, cmd) {generalRoll(message, match, cmd)},
            permission: ''
        },
        { // Shadowrun basic rolls
            //            (nDice                                                    )    (limit                                                                   )    (e)    (type   )    (mDice                                                    )    (limit                                                                   )    (e)    (extraparam             )     
            pattern: /^\s*([\+\-]?\s*(?:\d+|[A-z_]+)(?:\s*[\+\-]\s*(?:\d+|[A-z_]+))*)?\s*(\(\s*(?:[\+\-]?\s*(?:\d+|[A-z_]+)(?:\s*[\+\-]\s*(?:\d+|[A-z_]+))*)?\s*\))?\s*(!)?\s*(v|T|a|e)?\s*([\+\-]?\s*(?:\d+|[A-z_]+)(?:\s*[\+\-]\s*(?:\d+|[A-z_]+))*)?\s*(\(\s*(?:[\+\-]?\s*(?:\d+|[A-z_]+)(?:\s*[\+\-]\s*(?:\d+|[A-z_]+))*)?\s*\))?\s*(!)?\s*((?:\s*,\s*[^,\s][^,]*)+)?\s*$/i, 
            //              (nDice                                )    (limit                                             )    (e)    (type   )    (mDice                              )    (limit                                               )    (e)    (extraparam             )     
            //pattern: /^\s*([\+\-\*]?\s*\d+(?:\s*[\+\-\*]\s*\d+)*)?\s*(\(\s*(?:[\+\-\*]?\s*\d+(?:\s*[\+\-]\s*\d+)*)?\s*\))?\s*(!)?\s*(v|T|a|e)?\s*([\+\-\*]?\s*\d+(?:\s*[\+\-]\s*\d+)*)?\s*(\(\s*(?:[\+\-\*]?\s*\d+(?:\s*[\+\-\*]\s*\d+)*)?\s*\))?\s*(!)?\s*((?:\s*,\s*[^,\s][^,]*)+)?\s*$/i, 
            subpattern: '',
            example: ['[D1(L1)!]',
                    '[D1(L1)!vD2(L2)!]',
                    '[D1(L1)!TN]',
                    '[D1(L1)!aD2,C2]'],
            desc: ['Simple test using D1 dice with limit L1 and pushing the limit. (L1) and ! are optional.',
                'Opposed test. Same basic format as simple tests.',
                'Threshold test. Same basic format as simple tests, except N is a mandatory threshold number.',
                'Availability test. Same basic format as simple tests, except C2 is the (optional) cost.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {shadowrunBasicRoll(message, match, cmd)}, // TODO: Change command
            permission: ''
        }
    ];
}

function getGameSettingList(game = '') {
    settingList = {}

    // Allocate entries for all games
    let definedGames = Object.keys(games);
    for (var ii=0;ii<definedGames.length;ii++) {
        settingList[definedGames[ii]] = {};
    }

    // Add individual settings to each game
    // Each setting should be an object with a 'description' and a 'value' field
    // The 'description' field contains a general description of the setting
    // The 'value' field is an object containing an entry for each valid setting
    // The key gives the option name, the value gives a description of that specific option

    //SR5e
    settingList.SR5e.glitch = {
        'description': 'Defines the method used to decide how many ones are required for a glitch.',
        'value': {
            'default': 'Strictly more than half (no rounding) of your dice are ones. Example: when using 7 or 8 dice, you glitch if you get at least 4 or 5 ones, respectively.',
            'classic': 'At least half (no rounding) of your dice are ones. Example: when using 7 or 8 dice, you glitch if you get at least 4 ones.',
            '>u': 'Strictly more than half (rounded up) of your dice are ones. Example: when using 7 or 8 dice, you glitch if you get at least 5 ones.',
            '>=u': 'At least half (rounded up) of your dice are ones. This is equivalent to the classic setting. Example: when using 7 or 8 dice, you glitch if you get at least 4 ones.',
            '>d': 'Strictly more than half (rounded down) of your dice are ones. This is equivalent to the default setting. Example: when using 7 or 8 dice, you glitch if you get at least 4 or 5 ones, respectively.',
            '>=d': 'At least half (rounded down) of your dice are ones. Example: when using 7 or 8 dice, you glitch if you get at least 3 or 4 ones, respectively.'
        }
    };

    // DnD5e

    // Return the setting list, either for the specified game or in its entirety
    if (game && isValidGame(game)) {
        return settingList[game];
    } else {
        return settingList;
    }
}

const sr5skillTable = {
    'b52f7575-eebf-41c4-938d-df3397b5ee68': { name: 'aeronauticsmechanic', attribute: 'LOG', default: 'No', group: 'Engineering' },
    'fc89344f-daa6-438e-b61d-23f10dd13e44': { name: 'alchemy', attribute: 'MAG', default: 'No', group: 'Enchanting' },
    'e09e5aa7-e496-41a2-97ce-17f577361888': { name: 'animalhandling', attribute: 'CHA', default: 'Yes', group: '' },
    '74a68a9e-8c5b-4998-8dbb-08c1e768afc3': { name: 'arcana', attribute: 'LOG', default: 'No', group: '' },
    '1537ca5c-fa93-4c05-b073-a2a0eed91b8e': { name: 'archery', attribute: 'AGI', default: 'Yes', group: '' },
    'ada6d9b2-e451-4289-be45-7085fa34a51a': { name: 'armorer', attribute: 'LOG', default: 'Yes', group: '' },
    '955d9376-3066-469d-8670-5170c1d59020': { name: 'artificing', attribute: 'MAG', default: 'No', group: 'Enchanting' },
    '2f4c706f-5ac5-4774-8a45-3b4667989a20': { name: 'artisan', attribute: 'INT', default: 'No', group: '' },
    '59318078-e071-411b-9194-7222560e9f4a': { name: 'assensing', attribute: 'INT', default: 'No', group: '' },
    'b7599a42-ceed-4558-b357-865aa3e317f5': { name: 'astralcombat', attribute: 'WIL', default: 'No', group: '' },
    '788b387b-ee41-4e6a-bf22-481a8cc4cf9f': { name: 'automatics', attribute: 'AGI', default: 'Yes', group: 'Firearms' },
    '5e5f2f7f-f63b-4f65-a65d-91b3d4523c6f': { name: 'automotivemechanic', attribute: 'LOG', default: 'No', group: 'Engineering' },
    '9a2d9175-d445-45ca-842d-90223ad13f05': { name: 'banishing', attribute: 'MAG', default: 'No', group: 'Conjuring' },
    'dfba7c09-3d95-43fd-be75-39b3e8b22cd3': { name: 'binding', attribute: 'MAG', default: 'No', group: 'Conjuring' },
    'ba624682-a5c0-4cf5-b47b-1021e6a1800d': { name: 'biotechnology', attribute: 'LOG', default: 'No', group: 'Biotech' },
    '48763fa5-4b89-48c7-80ff-d0a2761de4c0': { name: 'blades', attribute: 'AGI', default: 'Yes', group: 'Close Combat' },
    'bd4d977a-cbd4-4289-99bb-896caed6786a': { name: 'chemistry', attribute: 'LOG', default: 'No', group: '' },
    'cd9f6bf7-fa48-464b-9a8f-c7ce26713a72': { name: 'clubs', attribute: 'AGI', default: 'Yes', group: 'Close Combat' },
    'f338d383-ffd8-4ff8-b99b-cf4c2ed1b159': { name: 'compiling', attribute: 'RES', default: 'No', group: 'Tasking' },
    '1c14bf0d-cc69-4126-9a95-1f2429c11aa5': { name: 'computer', attribute: 'LOG', default: 'Yes', group: 'Electronics' },
    '6d7f48d3-84a1-4fce-90d3-58d566f70fa6': { name: 'con', attribute: 'CHA', default: 'Yes', group: 'Acting' },
    '3db81bcc-264b-47e1-847c-06bdacd88973': { name: 'counterspelling', attribute: 'MAG', default: 'No', group: 'Sorcery' },
    '7143f979-aa48-4cc8-a29c-e010400e6e11': { name: 'cybercombat', attribute: 'LOG', default: 'Yes', group: 'Cracking' },
    '9b386fe5-83b3-436f-9035-efd1c0f7a680': { name: 'cybertechnology', attribute: 'LOG', default: 'No', group: 'Biotech' },
    '64eed2e9-e61c-4cba-81d4-18a612cf2df6': { name: 'decompiling', attribute: 'RES', default: 'No', group: 'Tasking' },
    '276877e1-5cdf-4e95-befd-13c1abb5ae02': { name: 'demolitions', attribute: 'LOG', default: 'Yes', group: '' },
    'a9d9b686-bc4a-4347-b011-ff8f41455965': { name: 'disenchanting', attribute: 'MAG', default: 'No', group: 'Enchanting' },
    '9b2416b2-3e2b-4dd6-ab9d-530f493c1c22': { name: 'disguise', attribute: 'INT', default: 'Yes', group: 'Stealth' },
    '23c3320c-5010-4b2e-ac46-76f0a86af0b9': { name: 'diving', attribute: 'BOD', default: 'Yes', group: '' },
    '2c8e5f20-e52d-4844-89e9-51b92dba47df': { name: 'electronicwarfare', attribute: 'LOG', default: 'No', group: 'Cracking' },
    '3f93335c-49d6-4904-a97e-4c942ab05b59': { name: 'escapeartist', attribute: 'AGI', default: 'Yes', group: '' },
    'b20acd11-f102-40f3-a641-e3c420fbdb91': { name: 'etiquette', attribute: 'CHA', default: 'Yes', group: 'Influence' },
    'a1366ec2-772d-4f08-8c65-5f79464d975b': { name: 'exoticmeleeweapon', attribute: 'AGI', default: 'No', group: '' },
    '88ee65ba-c797-4f9c-91fe-39bc43b0f9c8': { name: 'exoticrangedweapon', attribute: 'AGI', default: 'No', group: '' },
    'b5f95b50-e630-4162-a6a4-7dd6ab8d0256': { name: 'pilotexoticvehicle', attribute: 'REA', default: 'No', group: '' },
    '47cb1e8b-c285-4c54-9aaa-75305ad6dd4f': { name: 'firstaid', attribute: 'LOG', default: 'Yes', group: 'Biotech' },
    '27db6e2a-a49f-4232-b150-e676b8dacb52': { name: 'flight', attribute: 'AGI', default: 'No', group: 'Athletics' },
    'c9f52f97-a284-44a7-8af6-802dd3ed554f': { name: 'forgery', attribute: 'LOG', default: 'Yes', group: '' },
    'f510ccc3-cf95-4461-b2f7-e966daaa5a91': { name: 'free-fall', attribute: 'BOD', default: 'Yes', group: '' },
    '58452cff-44ea-41c6-a554-28a869149b27': { name: 'gunnery', attribute: 'AGI', default: 'Yes', group: '' },
    'a9fa961d-07e5-46da-8edc-403ae3e6cc75': { name: 'gymnastics', attribute: 'AGI', default: 'Yes', group: 'Athletics' },
    'c2bb65f5-4a6b-49bf-9925-ef6434cb6929': { name: 'hacking', attribute: 'LOG', default: 'Yes', group: 'Cracking' },
    '41e184e0-7273-403a-9300-fa29a1707bf0': { name: 'hardware', attribute: 'LOG', default: 'No', group: 'Electronics' },
    '64841e6e-9487-4b63-80a1-dcad6eb78179': { name: 'heavyweapons', attribute: 'AGI', default: 'Yes', group: '' },
    'e7e5a43f-9762-4863-86dc-3fd7799e53a2': { name: 'impersonation', attribute: 'CHA', default: 'Yes', group: 'Acting' },
    '935621c5-d384-42f2-a740-1fa349fa85a1': { name: 'industrialmechanic', attribute: 'LOG', default: 'No', group: 'Engineering' },
    '3b34b209-00be-42b8-b4ac-cc7dea08af8a': { name: 'instruction', attribute: 'CHA', default: 'Yes', group: '' },
    '9de43fad-b365-4e73-bc06-91dd571b858a': { name: 'intimidation', attribute: 'CHA', default: 'Yes', group: '' },
    '963a548d-c629-4a13-a3e3-31b085a42e20': { name: 'leadership', attribute: 'CHA', default: 'Yes', group: 'Influence' },
    '09fbc992-9fad-4f2d-ab56-725bac943dc6': { name: 'locksmith', attribute: 'AGI', default: 'No', group: '' },
    '64088b25-de37-4d71-8800-4a430fde08af': { name: 'longarms', attribute: 'AGI', default: 'Yes', group: 'Firearms' },
    '938be691-4b3d-49a2-a673-bbf9924ce8f0': { name: 'medicine', attribute: 'LOG', default: 'No', group: 'Biotech' },
    '48cc79be-f75e-4fe6-8721-7864c9f231f6': { name: 'nauticalmechanic', attribute: 'LOG', default: 'No', group: 'Engineering' },
    'f8037e7f-d48b-452b-8f66-2e0c36677fea': { name: 'navigation', attribute: 'INT', default: 'Yes', group: 'Outdoors' },
    '729c9cee-ef8f-492d-aa7f-17ec1bc3816e': { name: 'negotiation', attribute: 'CHA', default: 'Yes', group: 'Influence' },
    '17fbaafa-8dbb-4f29-9244-5ae1cd4ac42f': { name: 'palming', attribute: 'AGI', default: 'No', group: 'Stealth' },
    '04e1eb3e-e82d-485b-a7fd-1e677df2a070': { name: 'perception', attribute: 'INT', default: 'Yes', group: '' },
    '53f96d6a-363b-4c14-be1d-68e74930c67b': { name: 'performance', attribute: 'CHA', default: 'Yes', group: 'Acting' },
    '3ba9397e-f790-44ca-ae40-15a2356e348d': { name: 'pilotaerospace', attribute: 'REA', default: 'No', group: '' },
    '10d5c887-a1e5-4cca-8613-3a28f1aab810': { name: 'pilotaircraft', attribute: 'REA', default: 'No', group: '' },
    'ae91a8a6-80e7-4f52-b9eb-21725a5528a4': { name: 'pilotgroundcraft', attribute: 'REA', default: 'Yes', group: '' },
    'b8a24d87-465a-4365-9948-038fe1ac62c4': { name: 'pilotwalker', attribute: 'REA', default: 'No', group: '' },
    '1579818e-af85-47cd-8c9f-2e86e9dc19da': { name: 'pilotwatercraft', attribute: 'REA', default: 'Yes', group: '' },
    'adf31a50-b228-4e09-a09c-46ab9f5e59a1': { name: 'pistols', attribute: 'AGI', default: 'Yes', group: 'Firearms' },
    '3a38bbcf-38b0-435b-98f2-4ce8c50e8490': { name: 'registering', attribute: 'RES', default: 'No', group: 'Tasking' },
    'a6287e62-6a3b-43ce-b6e0-20f3655910e2': { name: 'ritualspellcasting', attribute: 'MAG', default: 'No', group: 'Sorcery' },
    '1531b2d8-6116-4be4-87b0-232dba1fc447': { name: 'running', attribute: 'STR', default: 'Yes', group: 'Athletics' },
    '9cff9aa7-d092-4f89-8b7b-3ab835818874': { name: 'sneaking', attribute: 'AGI', default: 'Yes', group: 'Stealth' },
    'b693f3bf-48dc-4570-9743-d94d14ee698b': { name: 'software', attribute: 'LOG', default: 'No', group: 'Electronics' },
    'c4367a39-4065-4b1d-aa62-e9dce377e452': { name: 'spellcasting', attribute: 'MAG', default: 'No', group: 'Sorcery' },
    '51e34c6c-b07f-45f4-8a5e-8f2b617ed32f': { name: 'summoning', attribute: 'MAG', default: 'No', group: 'Conjuring' },
    '89ee1730-053a-400f-a13a-4fbadae015f0': { name: 'survival', attribute: 'WIL', default: 'Yes', group: 'Outdoors' },
    '0dbcb9cd-f824-4b5d-a387-90d33318b04c': { name: 'swimming', attribute: 'STR', default: 'Yes', group: 'Athletics' },
    '867a6fa0-7d98-4cde-83a4-b33dd39de08e': { name: 'throwingweapons', attribute: 'AGI', default: 'Yes', group: '' },
    '7ed2f3e0-a791-4cb7-ba3e-ac785fdc3d7e': { name: 'tracking', attribute: 'INT', default: 'Yes', group: 'Outdoors' },
    '4fcd40cb-4b02-4b7e-afcb-f44d46cd5706': { name: 'unarmedcombat', attribute: 'AGI', default: 'Yes', group: 'Close Combat' }
}

const sr5attributeMap = {
    'body': 'BOD',
    'agility': 'AGI',
    'reaction': 'REA',
    'strength': 'STR',
    'charisma': 'CHA',
    'intuition': 'INT',
    'logic': 'LOG',
    'willpower': 'WIL',
    'edge': 'EDG',
    'magic': 'MAG',
    'resonance': 'RES',
    'depth': 'DEP'
}

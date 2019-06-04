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
const moment = require('moment');
var CircularJSON = require('circular-json');
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
const versionId = '0.6.8';
const games = {'SR5e':'SR5e','DnD5e':'DnD5e','kitd':'Karma in the Dark','Witchcraft':'Witchcraft'};
const outputLevels = {'minimal':1,'regular':2,'verbose':3};
const botSavePath = 'fixer.json';
const errorLogPath = 'error.log';
const errorDataFolder = './errorData/';
const reqArgs = ['token', 'user', 'password', 'devkey', 'root'];
const optArgs = [];
var bot = {};
var args = {};
const internalFieldPrefix = '__';
const activeCombatFieldName = `${internalFieldPrefix}activeCombat`;
const maxParsingLength = 100;
const maxDiceToRoll = 100;
const maxCommandsPerMessage = 5;
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
    for (var ii = 0; ii < optArgs.length; ii++) {
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
setupBot(args);
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
client.on('message', message => { // TODO: check client.on('messageUpdate',oldMessage,newMessage) as well?
    // If it's not a message from this bot
    if (message.author.id != client.user.id && !message.author.bot) {
        if (!(message.guild)) {
            // Private message
            //TODO: Implement private messaging stuff
        } else {
            try { // TODO: Bot currently listens even if it is muted. Change?
                // find all sections in brackets (not accounting for nesting)
                let regExDelim = new RegExp(/\[([^\]]+)\]/gi);
                let matches = regExDelim.exec(message.content);
                let nMatches = 0;
                // while a section is found
                while (matches) {
                    nMatches += 1;
                    if (!messageAssert(message,nMatches <= maxCommandsPerMessage, `I can't handle more than ${maxCommandsPerMessage} commands in a single message.`)) { return; };
                    if (matches[1].length > maxParsingLength) { 
                        message.reply(`I can only parse messages of up to ${maxParsingLength} characters (your's was ${matches[1].length}).`);
                        matches = regExDelim.exec(message.content); 
                        continue;
                    }
                    let match = matches[1];
                    // go through the list of commands
                    let commands = getChatCommandList(message);
                    for (var ii = 0; ii < commands.length; ii++) {
                        // if it matches that command and the command is in use
                        let regExCmd = new RegExp(commands[ii].pattern);
                        if ( regExCmd.test(match) && isUsedInGame(message,commands[ii]) ) {
                            // then, if you have the required access level
                            if (authorizedForCommand(message,commands[ii])) {
                                // ensure supporting data exists
                                ensureBotData(message);
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
            } catch (err) {
                // Output error to console window
                console.log('DETECTED UNCAUGHT ERROR in message: ' + message.content);
                console.log(err);

                // Inform user of failure
                message.reply('I encountered an error parsing your message. An error log has been generated.')

                // Write to log file
                logMessageParsingError(message,err);
            }
        }
    }
});
/*
####################################################################################
# Handle promise rejections
####################################################################################
*/
process.on('unhandledRejection', (reason, p) => {
    logUnhandledRejection(reason,p);
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
        body: macroString
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

    // Check which topic to use - default to general
    let topic = "general";
    if (matches.length > 1 && matches[1]) {
        // topic supplied - use it
        topic = matches[1];
    }
    let topicLower = topic.toLowerCase();

    // Get the topic title and description, if any
    let helpTopics = getHelpTopicDescription(message);
    if (!messageAssert(message, topicLower in helpTopics, `no help exists on the topic "${topic}".`)) { return };
    let title = "";
    let desc = "";
    if (topicLower in helpTopics) {
        let topicData = helpTopics[topicLower];
        if ('title' in topicData) {
            title = topicData.title();
        }
        if ('desc' in topicData) {
            desc = topicData.desc();
        }
    }

    // Get list of all allowed non-hidden commands available in the current game mode and matching the topic
    let commands = getChatCommandList(message);
    let commandsToPrint = [];
    for (var ii=0;ii<commands.length;ii++) {
        let allowed = authorizedForCommand(message, commands[ii]);
        let hidden = commands[ii].hidden;
        let forCurrentGame = isUsedInGame(message,commands[ii]);
        let matchesTopic = arrayContains(commands[ii].topic,topic);
        if (allowed && !hidden && forCurrentGame && matchesTopic) {
            commandsToPrint.push(commands[ii]);
        }
    }

    // Otherwise print the example and descriptions for all the commands, together with the topic title and description
    if (commandsToPrint.length == 0) {
        desc += `There are currently no commands for this category.`;
    }
    let columns = ['example','desc'];
    printTable(message,title,desc,commandsToPrint,columns)
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
    let regExSub = new RegExp(command.subpattern)
    let matches = regExSub.exec(match);
    let parser = new Parser();
    let matchRaw = match.replace(new RegExp("\s+"),"");
    let matchCleaned = matchRaw; 
    let rollTotal = null;
    while (matches) {
        let matchedString = matches[0];
        let nDice = matches[1].length == 0 ? 1 : parser.evaluate(matches[1]);
        let nSides = parser.evaluate(matches[2]);
        let result = XdY(nDice,nSides);
        let diceOutcomeString = `(${result.rolls.join("+")})`
        matchCleaned = matchCleaned.replace(matchedString,diceOutcomeString);
        matches = regExSub.exec(match);
    }
    try {
        rollTotal = parser.evaluate(matchCleaned);
    }
    catch (err) {
        message.reply(`I cannot successfully parse '${match}'.`)
        return;
    }

    printGeneralRollDetails(message,matchRaw,matchCleaned,rollTotal);
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
    if (!messageAssert(message, nDiceA >= 0,`I can't roll less than 0 dice!`)) { return; };
    if (!messageAssert(message, nDiceA <= maxDiceToRoll,`I can't roll more than ${maxDiceToRoll} dice!`)) { return; };
    let limitA = sr5RollCodeParser(message,matches[2] ? matches[2].trim('()') : matches[2]);
    let edgeUseA = matches[3] ? matches[3] == '!' : false;
    let rollType = matches[4] ? matches[4].toLowerCase() : '';
    let nDiceB = sr5RollCodeParser(message,matches[5]);
    if (!messageAssert(message, !(nDiceB < 0),`I can't roll less than 0 dice!`)) { return; };
    if (!messageAssert(message, !(nDiceB > maxDiceToRoll),`I can't roll more than ${maxDiceToRoll} dice!`)) { return; };
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
function karmaInTheDarkRoll(message,match,command) {
    let parser = new Parser();
    let regEx = new RegExp(command.pattern);
    let regExSub = new RegExp(command.subpattern);
    let matches = regEx.exec(match);

    let channelId = message.channel.id;
    let userId = message.author.id;

    let nDice = parser.evaluate(matches[0]);
    let roll = kitdRoll(nDice,matches[0]);

    printKarmaInTheDarkRoll(message, roll);
}
function witchcraftRoll(message,match,command) {
    let parser = new Parser();
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);

    let channelId = message.channel.id;
    let userId = message.author.id;

    let modifier = parser.evaluate(matches[0]);
    let roll = witchcraftBasicRoll(modifier,matches[0]);

    printWitchcraftRoll(message, roll);
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
            if (!data.startsWith("<xml")) { 
                let regEx = new RegExp ();
                data = data.replace(/^((?!\<\?xml).)*/,"");
            }
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
function botBehaviour(message,match,command) {
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);
    let comment = matches[1];

    if (comment && (comment.toLowerCase() in botBehaviourResponses)) {
        let responses = botBehaviourResponses[comment.toLowerCase()];
        let n = responses.length;
        let i = getRandomInt(0,n-1);
        message.reply(responses[i]);
    } else {
        message.reply('what do you mean? "' + comment + '" bot? I don\'t know what that means!');
    }
    
}
function sr5Initiative(message,match,command) {
    let channelId = message.channel.id;
    let gameId = getGameMode(message);
    let regEx = new RegExp(command.pattern);
    let matches = regEx.exec(match);
    let userId = message.author.id;
    let userName = message.author.username;

    // Catching failed matches, they have a single match for the entire string
    if (!messageAssert(message,matches.length>1,"I cannot parse that initiative command.")) { return; };

    // Get the data from a successful match
    let initAction = matches[1];
    let charName = matches[2];
    let rollCode = matches[3];
    let appendInfo = matches[4]

    // ensure that the data structure for initiative is in place
    ensureInitiative(channelId,gameId);

    // Get message data and other metadata

    let initData = bot.channel[channelId].game[gameId].init;
    let charFieldName = charName ? charName.toFieldName() : userId.toFieldName();
    charName = charName ? charName : userName;
    let charExists = !charName ? false : initHasCharacter(channelId,gameId,charFieldName);
    let existingCharName = !charExists ? null : initData.character[charFieldName].name
    let combatIsActive = initHasCombat(channelId,gameId);
    let initCharacters = Object.keys(initData.character).length;
    let blitz = !appendInfo ? false : appendInfo.includes("blitz");
    let seize = !appendInfo ? false : appendInfo.includes("seize");
    let surprise = !appendInfo ? false : appendInfo.includes("surprise")
    let surge = !appendInfo ? false : appendInfo.includes("surge")
    let astral = !appendInfo ? false : appendInfo.includes("astral")

    // Perform initiative actions
    switch (initAction.toLowerCase()) {
        case 'add': {
            if (!messageAssert(message, !charExists, `there is already a character stored with the key for that name (key: ${charFieldName}, stored name: ${existingCharName})`)) { return; };
            let rollCodeParsed = parseD6Roll(rollCode);
            let staticValue = rollCodeParsed.staticValue;
            let dice = rollCodeParsed.addDice-rollCodeParsed.subDice;
            dice = Math.max(1,Math.min(5,dice));
            let condensedRollCode = getRollCode(dice,staticValue,1,5,null,null);
            bot.channel[channelId].game[gameId].init.character[charFieldName] = {
                name: charName,
                rollCode: condensedRollCode,
                blitz: blitz,
                seize: seize,
                surprise: surprise,
                surge: surge,
                actedThisPass: false,
                currentInit: null,
                removedFromCombat: false,
                edge: 0,
                reaction: 0,
                intuition: 0,
                tiebreaker: null
            };
            
            let outputMessage = `added ${charName} to the initiative tracker with ${condensedRollCode} initiative.`;
            if (combatIsActive) {
                let currInitPass = bot.channel[channelId].game[gameId].init[activeCombatFieldName].initiativePass;
                let currInitPenalty = -(currInitPass-1)*10; // 10 for every full initiative pass
                let currInit = XdY(dice,6,null).sum + staticValue + currInitPenalty;
                let tiebreaker = Math.random();
                bot.channel[channelId].game[gameId].init.character[charFieldName].currentInit = currInit;
                bot.channel[channelId].game[gameId].init.character[charFieldName].tiebreaker = tiebreaker;
                outputMessage += ` They enter at ${currInit} initiative score (penalty of ${currInitPenalty} from joining after ${currInitPass-1} initiative passes were fully completed).`
            }

            message.reply(outputMessage);
            }; break;
        case 'add loaded': {
            let charData = getCurrentUserCharacter(channelId,gameId,userId);
            if (!messageAssert(message,charData,"either you do not have a character loaded, or something went wrong when retrieving the character data.")) { return; };
            charName = charData.alias;
            charFieldName = userId.toFieldName();
            charExists = initHasCharacter(channelId,gameId,userId);
            existingCharName = !charExists ? "" : initData.character[userId].name
            if (!messageAssert(message, !charExists, `there is already a character stored with the key for that name (key: ${charFieldName}, stored name: ${existingCharName})`)) { return; };
            let initType = astral ? 'astral' : 'meat';
            let dice = charData.initiative[initType].dice;
            let staticValue = charData.initiative[initType].base;
            rollCode =  getRollCode(dice,staticValue,1,5,null,null);
            let edge =  charData.attributes['EDG'].totalValue;
            let reaction = charData.attributes['REA'].totalValue;
            let intuition = charData.attributes['INT'].totalValue;

            bot.channel[channelId].game[gameId].init.character[charFieldName] = {
                name: charName,
                rollCode: rollCode,
                blitz: blitz,
                seize: seize,
                surprise: surprise,
                surge: surge,
                actedThisPass: false,
                currentInit: null,
                removedFromCombat: false,
                edge: edge,
                reaction: reaction,
                intuition: intuition,
                tiebreaker: null
            };

            let outputMessage = `added loaded character ${charName} to the initiative tracker with ${rollCode} initiative.`;
            if (combatIsActive) {
                let currInitPass = bot.channel[channelId].game[gameId].init[activeCombatFieldName].initiativePass;
                let currInitPenalty = -(currInitPass-1)*10; // 10 for every full initiative pass
                let currInit = XdY(dice,6,null).sum + staticValue + currInitPenalty;
                let tiebreaker = Math.random();
                bot.channel[channelId].game[gameId].init.character[charFieldName].currentInit = currInit;
                bot.channel[channelId].game[gameId].init.character[charFieldName].tiebreaker = tiebreaker;
                outputMessage += ` They enter at ${currInit} initiative score (penalty of ${currInitPenalty} from joining after ${currInitPass-1} initiative passes were fully completed).`
            }

            message.reply(outputMessage);
            }; break;

        case 'set': // fall through to 'change'
        case 'change':  {
            if (!messageAssert(message, charExists, `no character found with the name "${charName}"`)) { return; };
            let regEx = new RegExp(/^\s*[\+\-]/);
            if (regEx.test(rollCode)) {
                // Roll code starts with a + or a -, treat as modifier
                let currRollCode = bot.channel[channelId].game[gameId].init.character[charFieldName].rollCode

                // We have the roll codes from the current and modified rolls, and can get the actual statistics from them
                let currInitStats = parseD6Roll(currRollCode);
                let modInitStats = parseD6Roll(rollCode);

                // The current dice and static modified
                let currDice = currInitStats.addDice-currInitStats.subDice;
                let currStatic = currInitStats.staticValue;

                // New values, not accounting for limits on dice
                let newDice = currDice + modInitStats.addDice-modInitStats.subDice;
                let newStatic = currStatic + modInitStats.staticValue;

                // Get the new roll code where the limit on dice is applied
                let newRollCode = getRollCode(newDice,newStatic,1,5,null,null);
                let newInitStats = parseD6Roll(newRollCode);

                // That gives us the actual change in dice and static values
                let modDice = (newInitStats.addDice - newInitStats.subDice) - (currInitStats.addDice - currInitStats.subDice);
                let modStatic = newInitStats.staticValue - currInitStats.staticValue;
                let modRollCode = getRollCode(modDice,modStatic,1,5,null,null);
                
                // From which we can get the change in the initiative score
                let modInitScore = XdY(modDice,6,null).sum + modStatic;
                let currInitScore = bot.channel[channelId].game[gameId].init.character[charFieldName].currentInit;
                let newInitScore = currInitScore == null ? null : currInitScore + modInitScore;

                // And we save the new roll code and initiative score
                bot.channel[channelId].game[gameId].init.character[charFieldName].rollCode = newRollCode;
                bot.channel[channelId].game[gameId].init.character[charFieldName].currentInit = newInitScore;

                // And reply to the user
                message.reply(`initiative of ${charName} changed to ${newRollCode} (previously ${currRollCode}).${currInitScore == null ? '' : ` Their initiative score was changed by ${modInitScore} to ${newInitScore}.`}`)
            } else {
                // Treat roll code as set value
                let currRollCode = bot.channel[channelId].game[gameId].init.character[charFieldName].rollCode

                // We have the roll codes from the current and new rolls, and can get the actual statistics from them
                let currInitStats = parseD6Roll(currRollCode);
                let newInitStatsOrig = parseD6Roll(rollCode);

                // The current dice and static modified
                let currDice = currInitStats.addDice-currInitStats.subDice;
                let currStatic = currInitStats.staticValue;

                // New values, not accounting for limits on dice
                let newDice = newInitStatsOrig.addDice - newInitStatsOrig.subDice;
                let newStatic = newInitStatsOrig.staticValue;

                // Get the new roll code where the limit on dice is applied
                let newRollCode = getRollCode(newDice,newStatic,1,5,null,null);
                let newInitStats = parseD6Roll(newRollCode);

                // That gives us the actual change in dice and static values
                let modDice = (newInitStats.addDice - newInitStats.subDice) - (currInitStats.addDice - currInitStats.subDice);
                let modStatic = newInitStats.staticValue - currInitStats.staticValue;
                
                // From which we can get the change in the initiative score
                let modInitScore = XdY(modDice,6,null).sum + modStatic;
                let currInitScore = bot.channel[channelId].game[gameId].init.character[charFieldName].currentInit;
                let newInitScore = currInitScore == null ? null : currInitScore + modInitScore;

                // And we save the new roll code and initiative score
                bot.channel[channelId].game[gameId].init.character[charFieldName].rollCode = newRollCode;
                bot.channel[channelId].game[gameId].init.character[charFieldName].currentInit = newInitScore;

                // And reply to the user
                message.reply(`initiative of ${charName} set to ${newRollCode} (previously ${currRollCode}).${currInitScore == null ? '' : ` Their initiative score was changed by ${modInitScore} to ${newInitScore}.`}`)
            }

            }; break;

        case 'remove': {
            // If the character does not exist, 

            if (!messageAssert(message, charExists, `no character found with the name "${charName}"`)) { return; };
            delete bot.channel[channelId].game[gameId].init.character[charFieldName];
            message.reply(`removed ${charName} from the initiative tracker.`)
            if (combatIsActive && charFieldName == bot.channel[channelId].game[gameId].init[activeCombatFieldName].currentCharacter) {
                // If a combat is running, select the next character and show the table
                sr5NextInitiativeCharacter(message);
                printSr5InitiativeTable(message);
            }
            }; break;

        case 'blitz': {
            if (!messageAssert(message, charExists, `no character found with the name "${charName}"`)) { return; };
            let newBlitz = !bot.channel[channelId].game[gameId].init.character[charFieldName].blitz;
            bot.channel[channelId].game[gameId].init.character[charFieldName].blitz = newBlitz;
            message.reply(`${charName} will ${!newBlitz ? 'not blitz next combat turn.' : 'blitz next combat turn, using five initiative dice.'}`);
            }; break;

        case 'seize': {
            if (!messageAssert(message, charExists, `no character found with the name "${charName}"`)) { return; };
            let newSeize = !bot.channel[channelId].game[gameId].init.character[charFieldName].seize;
            bot.channel[channelId].game[gameId].init.character[charFieldName].seize = newSeize;
            message.reply(`${charName} will ${!newSeize ? 'not seize the initiative next combat turn.' : 'seize the initiative next combat turn, having priority to act first regardless of initiative score.'}`);
            }; break;

        case 'surge': {
            if (!messageAssert(message, charExists, `no character found with the name "${charName}"`)) { return; };
            let newSurge = !bot.channel[channelId].game[gameId].init.character[charFieldName].surge;
            bot.channel[channelId].game[gameId].init.character[charFieldName].surge = newSurge;
            message.reply(`${charName} ${!newSurge ? 'no longer has Adrenaline Surge.' : 'now has Adrenaline Surge, having priority to act first regardless of initiative score in the first initiative pass of the first combat turn.'}`);
            }; break;

        case 'start': {
            if (!messageAssert(message, !combatIsActive, "combat is already started!")) { return; };
            if (!messageAssert(message, initCharacters > 0, "there are no characters in the initiative tracker.")) { return; }
            sr5InitiativeSetupCombat(message);
            }; break;

        case 'next': {
            if (!messageAssert(message, combatIsActive, "combat isn't running!")) { return; };
            sr5InitiativeNextCharacter(message);
            }; break;

        case 'new turn': {
            if (!messageAssert(message, combatIsActive, "combat hasn't started!")) { return; };
            sr5InitiativeNewTurn(message);
            }; break;

        case 'end': {
            if (!messageAssert(message, combatIsActive, "combat hasn't started!")) { return; };
            delete bot.channel[channelId].game[gameId].init[activeCombatFieldName];
            message.reply(`combat is now ended, but all characters remain in the tracker.`)
            }; break;

        case 'clear': {
            delete bot.channel[channelId].game[gameId].init[activeCombatFieldName];
            bot.channel[channelId].game[gameId].init.character = {};
            message.reply(`initiative tracker cleared and combat ended.`)
            }; break;

        case 'show': {
            if (!messageAssert(message, combatIsActive, "combat hasn't started!")) { return; };
            printSr5InitiativeTable(message);
            }; break;

        case 'details': {
            printSr5InitiativeDetails(message);
            }; break;

        default: {
            message.reply(`I don't know what to do with the '${initAction}' initiative action.`);
            }; break;
    }
}

function dev(message,match,command) {
}

function getCurrentUserCharacter(channelId,gameId,userId) {
    if (gameHasUser(channelId,gameId,userId)) {
        let userData = bot.channel[channelId].game[gameId].user[userId];
        if ('activeCharacter' in userData) {
            if (userData.activeCharacter) {
                let activeCharName = userData.activeCharacter;
                return userData.character[activeCharName];
            }
        }
    }
    return null;
}

function getRollCode(dice,static,minDice,maxDice,minStatic,maxStatic) {
    dice = maxDice && maxDice < dice ? maxDice : dice;
    dice = minDice && minDice > dice ? minDice : dice;
    static = maxStatic && maxStatic < static ? maxStatic : static;
    static = minStatic && minStatic > static ? minStatic : static;
    return `${static < 0 ? '-' : ''}${static != 0 ? static : ''}${dice < 0 ? '-' : ''}${dice > 0  && static != 0 ? '+' : ''}${dice != 0 ? `${dice}d6` : ''}`;
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
    let commands = getChatCommandList(message);
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
# Error logging
####################################################################################
*/
function logMessageParsingError(message,caughtError) {
    try {
        var gameMode = getGameMode(message);
    } catch (err) {
        var gameMode = 'FAILED TO GET';
    }

    try {
        var userGameData = bot.channel[message.channel.id].game[gameMode].user[message.author.id];
    } catch (err) {
        var userGameData = 'FAILED TO GET';
    }

    let timeString = moment().format('YYYY-MM-DD hh:mm:ss [GMT]ZZ');

    let errorMsg = timeString
        + '\n\t' + 'Nonce'  + '\t' + message.nonce
        + '\n\t' + 'Error'  + '\t' + caughtError.message
        + '\n\t' + 'String' + '\t' + message
        + '\n\t' + 'Author' + '\t' + message.author.username + '#' + message.author.discriminator
        + '\n\t' + 'Server' + '\t' + message.channel.guild.name
        + '\n\t' + 'Channel'+ '\t' + message.channel.name
        + '\n\t' + 'Game'   + '\t' + gameMode
        + '\n\t' + 'Error'  + '\t' + caughtError.name
        + '\n\t' + 'Stack'  + '\t' + caughtError.stack.replace(/\n\s*/g,'\n\t\t').replace(/^[^\n]*\n\s*/,'')
        + '\n';

    let errorStruct = {
        nonce: message.nonce,
        error: {message: caughtError.message, stack: caughtError.stack},
        message: message,
        botData: bot
    }

    fs.appendFile(errorLogPath, errorMsg, (err) => {
        if (err) throw err;
        console.log('Appended error to error log file');
    });
    
    if (!fs.existsSync(errorDataFolder)) {
        fs.mkdirSync(errorDataFolder);    
    }
    fs.appendFile(errorDataFolder + message.nonce + '.log', CircularJSON.stringify(errorStruct), (err) => {
        if (err) throw err;
        console.log('Appended error data to error data file');
    });
}
function logUnhandledRejection(reason,p) {
    console.log('Unhandled rejection at:',p,'reason:',reason);

    let timeString = moment().format('YYYY-MM-DD hh:mm:ss [GMT]ZZ');

    let errorMsg = timeString
        + '\n\t' + 'Error'  + '\t' + 'unhandled rejection'
        + '\n\t' + 'Error'  + '\t' + reason
        + '\n\t' + 'Stack'  + '\t' + p
        + '\n';

    fs.appendFile(errorLogPath, errorMsg, (err) => {
        if (err) throw err;
        console.log('Appended error to error log file');
    });
}
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
String.prototype.toFieldName = function() {
    return `_${this.replace(/[^A-z0-9]/,"")}`;
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
    if (!dice) { return {sum: 0, rolls: []}; };
    sign = sign ? sign : "+";
    sign = sign == "+" ? 1 : -1;
    if (dice < 0) {
        dice = -dice;
        sign = -sign;
    }
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
function kitdRoll(dice,rollCode) {
    // Limit to at least 0 dice
    dice = Math.max(0,dice);

    // if no dice, use 2 and pick lowest
    let useLowest = dice == 0;
    let diceActual = dice > 0 ? dice : 2; 
    let result = useLowest ? 6 : 0;
    let critical = false;

    // Roll the dice
    let rolls = [];
    for (var ii=0;ii<diceActual;ii++) {
        let roll = getRandomInt(1,6)
        rolls.push(roll);
        critical = critical || (!useLowest && result == 6 && roll == 6);
        result = useLowest ? Math.min(result,roll) : Math.max(result,roll)
    }

    let resultType = critical ? 'Critical success' : 
                    result == 6 ? 'Full success' : 
                    result >= 3 ? 'Partial success' : 'Bad outcome';

    return {
        rating: dice,
        roll: rolls,
        result: result,
        resultType: resultType,
        rollCode: rollCode
    }

}
function witchcraftBasicRoll(modifier,rollCode) {
    // Allocate roll array
    let rolls = [];

    // Roll the first die
    let currRoll = getRandomInt(1,10);
    let ruleOfOne = currRoll == 1;
    let ruleOfTen = currRoll == 10;
    let done = !(ruleOfOne || ruleOfTen);
    rolls.push(currRoll);

    // Handle rule of 1 / rule of 10
    while ((ruleOfOne || ruleOfTen) && !done) {
        if (ruleOfOne) {
            ruleOfTen = false;
            let newRoll = getRandomInt(1,10);
            rolls.push(newRoll);
            if (newRoll != 1) {
                done = true;
            }
        }
        else if (ruleOfTen) {
            ruleOfOne = false;
            let newRoll = getRandomInt(1,10);
            rolls.push(newRoll);
            if (newRoll != 10) {
                done = true;
            }
        }
    }

    // Calculate numerical result
    let result = rolls[0];
    if (ruleOfOne) {
        for (var ii=1;ii<rolls.length;ii++) {
            let newRoll = rolls[ii];
            if (newRoll == 1 && ii == 1) {
                result = -5;
            }
            else if (newRoll == 1) {
                result -= 5;
            }
            else if (newRoll < 5 && ii == 1) {
                result = newRoll-5;
            }
            else if (newRoll < 5) {
                result += newRoll-5;
            }
            else if (newRoll >= 5 && ii == 1) {
                result = 1;
            }
            else if (newRoll >= 5) {
                result += 1;
            }
        }
    }
    else if (ruleOfTen) {
        for (var ii=1;ii<rolls.length;ii++) {
            result += Math.max(0,rolls[ii] - 5);
        }
    }
    result += modifier;
    
    // Levels of success
    let levelsOfSuccess = 0;
    if (result <= 8) { }
    else if (result <= 16)
        levelsOfSuccess = Math.ceil((result-8)/2);
    else if (result <= 20)
        levelsOfSuccess = 5;
    else
        levelsOfSuccess = 5+Math.ceil((result-20)/3);

    // Descriptor
    let descriptor = witchcraftSuccessLevels[Math.min(witchcraftSuccessLevels.length,levelsOfSuccess)];
    
    return {
        roll: rolls,
        result: result,
        modifier: modifier,
        successLevel: levelsOfSuccess,
        resultType: descriptor,
        rollCode: rollCode
    }
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
        if (activeSkills && matches[2] && matches[2].toLowerCase() in activeSkills) { nSkills += 1; } // count skills
        else if (attributes && matches[2] && matches[2].toUpperCase() in attributes) { nAttributes += 1; } // count attributes
        else if (attributes && matches[2] && matches[2].toLowerCase() in sr5attributeMap) { nAttributes += 1; }; // count attributes
        matches = regEx.exec(rollCode);
    }
    
    // Then go through the list again 
    matches = regEx.exec(rollCode);
    let totalDice = 0;
    while (matches) {   
        let sign = matches[1].replace(/ /g,'');
        // Handle skills
        if (activeSkills && matches[2] && matches[2].toLowerCase() in activeSkills) {
            let nDice = 
                nSkills == 1 && nAttributes == 0
                ? activeSkills[matches[2].toLowerCase()].totalDice
                : activeSkills[matches[2].toLowerCase()].ratingDice + activeSkills[matches[2].toLowerCase()].improvementOther;
            totalDice += (sign=='-' ? -1 : 1)*nDice;
        }
        
        // Handle attributes (short name)
        else if (attributes && matches[2] && matches[2].toUpperCase() in attributes) {
            totalDice += (sign=='-' ? -1 : 1)*attributes[matches[2]].totalValue;
        }

        // Handle attributes (full name)
        else if (attributes && matches[2] && matches[2].toLowerCase() in sr5attributeMap) {
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
function parseD6Roll(rollCode){
    let parserPattern = /([\+\-]?)\s*((\d+)d(\d+)|\d+)/gi;
    let regEx = new RegExp(parserPattern)
    let matches = regEx.exec(rollCode);
    let parser = new Parser();
    let rollData = {addDice: 0, subDice: 0, staticValue: 0};
    while (matches) {
        if (isNaN(matches[2])) {
            // main component is not just a number, so it is XdY
            let nDice = matches[3];
            let nSides = matches[4];
            let sign = matches[1]=='-' ? -1 : 1;
            
            if (nSides == 6) {
                if (sign > 0) {
                    rollData.addDice += parser.evaluate(nDice);
                } else {
                    rollData.subDice += parser.evaluate(nDice);
                }
            }
        } else {
            // main component is a number, so a constant
            rollData.staticValue = rollData.staticValue + parser.evaluate(matches[0]);
        }
        matches = regEx.exec(rollCode);
    }
    return rollData;
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

function printGeneralRollDetails(message,match,matchCleaned,rollTotal) {
    let outputLevel = getOutputLevel(message);
    
    let isVerbose = outputLevel >= outputLevels.verbose;
    let isRegular = outputLevel >= outputLevels.regular;

    let resultString = '**' + rollTotal + '**';
    let diceCodeString = match.replace(/ /g,'').replace(/\*/g,'\\*') + ' = ' + matchCleaned.replace(/ /g,'').replace(/\*/g,'\\*') + ' = ' + rollTotal;

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
function printKarmaInTheDarkRoll(message,roll) {
    let outputLevel = getOutputLevel(message);
    
    let diceOutcomes = roll.roll.join(',');
    let resultType = roll.resultType;
    let resultExplanation = 'You probably don\'t succeed, and you suffer consequences.';
    switch (resultType.toLowerCase())  {
        case 'critical success': 
            resultExplanation = 'You succeed with additional advantage!';
            break;
        case 'full success':
            resultExplanation = 'You succeed without incident!';
            break;
        case 'partial success':
            resultExplanation = 'You succeed, but not without consequences!';
            break;
        default:
            break;
    }
    let isVerbose = outputLevel >= outputLevels.verbose;
    let isRegular = outputLevel >= outputLevels.regular;

    let title = roll.result + " - " + resultType + '!';
    let description = joinOutputString(
        !isRegular ? '' : 'Roll: ' + diceOutcomes, 
        !isVerbose ? '' : resultExplanation
    );

    let embed = new Discord.RichEmbed();
    embed.setTitle(title);
    embed.setDescription(description);
    embed.setColor(15746887);
    message.reply({embed});
}
function printWitchcraftRoll(message,roll) {
    let outputLevel = getOutputLevel(message);
    
    let diceOutcomes = roll.roll.join(',');
    let successLevelName = roll.resultType;
    let successLevelCount = roll.successLevel;
    let modifier = roll.modifier;

    let isVerbose = outputLevel >= outputLevels.verbose;
    let isRegular = outputLevel >= outputLevels.regular;

    let title = roll.result + " - " + successLevelName + ' (Level ' + successLevelCount + ')';
    let description = joinOutputString(
        !isRegular ? '' : 'Roll: ' + diceOutcomes, 
        !isRegular ? '' : 'Modifier: ' + modifier, 
        !isVerbose ? '' : ''
    );

    let embed = new Discord.RichEmbed();
    embed.setTitle(title);
    embed.setDescription(description);
    embed.setColor(15746887);
    message.reply({embed});
}
/*
####################################################################################
# Printing functions
####################################################################################
*/
function printTable(message,title,desc,data,columns) {
    let embed = new Discord.RichEmbed()
    embed.setColor(15746887);
    embed.setTitle('__**' + title + '**__');
    embed.setDescription(desc);
    let knownPermissions = {};
    for (var ii=0;ii<data.length;ii++) { // Loop over main data entries
        if (isUsedInGame(message,data[ii]) && !data[ii].hidden) {
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
        embed.setDescription('Note: current setting below is underlined. You can change to a given value by using [gamesetting ' + settingName + ' "<value>"], replacing <value> with the appropriate value.');
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
function printSr5InitiativeDetails(message) {
    let channelId = message.channel.id;
    let gameId = getGameMode(message);
    if (gameHasInitiative(channelId,gameId)) {
        let embed = new Discord.RichEmbed();
        let characterData = bot.channel[channelId].game[gameId].init.character;
        let charFieldNames = Object.keys(characterData);
        if (charFieldNames.length > 0) {
            for (var ii=0;ii<charFieldNames.length;ii++) {
                let charName = characterData[charFieldNames[ii]].name;
                let rollCode = characterData[charFieldNames[ii]].rollCode;
                if (!charName.startsWith(internalFieldPrefix)) {
                    embed.addField(charName,rollCode,true);
                }
            }
        } else {
            embed.setDescription('There are currently no characters in the initiative tracker.');
        }

        embed.setColor(15746887);
        embed.setTitle('__**Characters in initiative tracker**__');
        message.reply({embed});
    }
}
function printSr5InitiativeTable(message) {
    let channelId = message.channel.id;
    let gameId = getGameMode(message);
    let initOrder = [];
    if (initHasCombat(channelId,gameId)) {
        let initData = bot.channel[channelId].game[gameId].init;
        let charFieldNames = Object.keys(initData);

        // If there is a log of previous actions, add them
        let log = bot.channel[channelId].game[gameId].init[activeCombatFieldName].log;
        let logLength = log ? log.length : 0;
        for (var ii=0;ii<logLength;ii++) {
            let logEntry = log[ii];
            initOrder.push({name: logEntry.name, init: logEntry.init, pass: logEntry.pass, acted: true, current: false});
        }

        // If there is a current character, add them
        let currCharKey = initData[activeCombatFieldName].currentCharacter;
        let currPass = initData[activeCombatFieldName].initiativePass;
        if (currCharKey) {
            let charName = initData.character[currCharKey].name;
            let init = initData.character[currCharKey].currentInit;
            initOrder.push({name: charName, init: init, pass: currPass, acted: false, current: true });
        }

        // Then, go through the characters, ignoring the current character and any who have already acted
        let actThisTurn = [];
        let charKeys = Object.keys(initData.character);
        for (var ii=0;ii<charKeys.length;ii++) {
            let charKey = charKeys[ii];
            let thisChar = initData.character[charKey];
            if (!thisChar.actedThisPass && !(charKey == currCharKey) && thisChar.currentInit > 0) {
                actThisTurn.push(thisChar);
            }
        }
        actThisTurn.sort(function(a,b){return sr5CompareInitiativeOrder(channelId,gameId,a,b)});
        for (var ii=0;ii<actThisTurn.length;ii++) {
            initOrder.push({name: actThisTurn[ii].name, init: actThisTurn[ii].currentInit, pass: currPass, acted: false, current: false});
        }

        // Then, go through all characters at successive -10 init for each pass through
        let penalty = 0;
        let passOffset = 0;
        let actComingTurn = ['dummy'];
        while (actComingTurn.length > 0) {
            passOffset += 1;
            penalty = 10*passOffset;
            actComingTurn = [];
            for (var ii=0;ii<charKeys.length;ii++) {
                let charKey = charKeys[ii];
                let thisChar = initData.character[charKey];
                let thisCharNextInit = thisChar.currentInit - penalty;
                if (thisCharNextInit > 0) {
                    actComingTurn.push(thisChar);
                }
            }
            actComingTurn.sort(function(a,b){return sr5CompareInitiativeOrder(channelId,gameId,a,b)});
            for (var ii=0;ii<actComingTurn.length;ii++) {
                initOrder.push({name: actComingTurn[ii].name, init: actComingTurn[ii].currentInit-penalty, pass: currPass+passOffset, acted: false, current: false});
            }
        }

        // TODO: Add in display of characters who have no remaining passes whatsoever

        let embed = new Discord.RichEmbed();
        if (initOrder.length > logLength) {
            // Every pass is a field in a richEmbed; initialize the first pass contents
            let passCounter = initOrder[ii].pass;
            let old = initOrder[ii].acted;
            let current = initOrder[ii].current;
            let desc = `${old ? '~~' : ''}${initOrder[0].init}: ${initOrder[0].name}${current ? ' <--- Acting now' : ''}${old ? '~~' : ''}\n`;
            for (var ii=1;ii<initOrder.length;ii++) {
                // If new pass, submit the previous field and start a new one
                if (initOrder[ii].pass != passCounter) {
                    embed.addField(`Pass ${passCounter}`,desc)
                    passCounter = initOrder[ii].pass;
                    desc = '';
                }

                // add initiative
                current = initOrder[ii].current;
                old = initOrder[ii].acted;
                desc +=  `${old ? '~~' : ''}${initOrder[ii].init}: ${initOrder[ii].name}${current ? ' <--- Acting now' : ''}${old ? '~~' : ''}\n`;
            }
            embed.addField(`Pass ${passCounter}`,desc);
            embed.setDescription('');
        } else {
            embed.setDescription('No characters have any remaining passes. Use [init new turn] to start a new combat turn.');
        }

        embed.setColor(15746887);
        embed.setTitle('__**Initiative order**__');
        message.reply({embed});
    } 
}
/*
####################################################################################
# Saving and loading information
####################################################################################
*/
function setupBot(args) {
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

    // Assign the character data to the user and channel
    let activeGame = getGameMode(message);
    let userId = message.author.id;
    let channelId = message.channel.id;
    alias = alias ? alias : chummerJson.character.alias[0]; // If no alias supplied, use alias from the character
    if (!messageAssert(message,alias,'either supply an alias for the character in the save file, or supply an alias in the chat command')) { return; }
    
    let charData = {
        'alias': alias,
        'initiative': initiative,
        'attributes': attributes,
        'activeSkills': activeSkills,
    }

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

function ensureBotData(message) {
    let gameId = getGameMode(message);
    let channelId = message.channel.id;
    if (gameId != '') {
        ensureGame(channelId, gameId);
    } else {
        ensureChannel(channelId);
    }
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
function ensureInitiative(channelId,gameId){
    ensureGame(channelId,gameId);
    if (!('init' in bot.channel[channelId].game[gameId])) {
        let init = {
            character: {}
        };
        bot.channel[channelId].game[gameId].init = init;
        return false;
    } else {
        if (!('character' in bot.channel[channelId].game[gameId].init)) { bot.channel[channelId].game[gameId].init.character = {}};
    }
    return true;
}

function botHasChannel(channelId) {
    return (channelId in bot.channel)
}
function channelHasGame(channelId,gameId) {
    if (botHasChannel(channelId)) {
        return (gameId in bot.channel[channelId].game);
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
function gameHasInitiative(channelId,gameId) {
    if (channelHasGame(channelId,gameId)) {
        return ('init' in bot.channel[channelId].game[gameId])
    } else {
        return false;
    }
}
function initHasCharacter(channelId,gameId,charFieldName) {
    if (gameHasInitiative(channelId,gameId)) {
        return (charFieldName in bot.channel[channelId].game[gameId].init.character);
    }
    return false;
}
function initHasCombat(channelId,gameId){
    if (gameHasInitiative(channelId,gameId)) {
        return (activeCombatFieldName in bot.channel[channelId].game[gameId].init);
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

function authorizedForCommand(message,command) {
    return !(command.permissions) || message.channel.guild.members.get(message.author.id).hasPermission(command.permission)
}
/*
####################################################################################
# SR5 initiative
####################################################################################
*/
function sr5InitiativeSetupCombat(message) {
    let channelId = message.channel.id;
    let gameId = getGameMode(message);
    
    // Initialize active combat struct
    bot.channel[channelId].game[gameId].init[activeCombatFieldName] = {
        combatTurn: 1,
        initiativePass: 1,
        currentCharacter: null,
        log: []
    }

    // Reset removed from combat
    let characterKeys = Object.keys(bot.channel[channelId].game[gameId].init.character);
    for (var ii=0;ii<characterKeys.length;ii++) {
        charKey = characterKeys[ii];
        bot.channel[channelId].game[gameId].init.character[charKey].removedFromCombat = false;
    }

    // Roll initiative
    sr5RollInitiative(message);

    // Show the initiative table
    printSr5InitiativeTable(message);
}
function sr5InitiativeNewTurn(message) {
    let channelId = message.channel.id;
    let gameId = getGameMode(message);
    
    // Reset action log
    bot.channel[channelId].game[gameId].init[activeCombatFieldName].log = [];

    // Reset initiative pass counter
    bot.channel[channelId].game[gameId].init[activeCombatFieldName].initiativePass = 1;

    // Increment combat turn counter
    bot.channel[channelId].game[gameId].init[activeCombatFieldName].combatTurn += 1;

    // Roll initiative for all characters
    sr5RollInitiative(message);

    // Print the current state
    printSr5InitiativeTable(message);

    // Reset flags for edge spending
    let characterKeys = Object.keys(bot.channel[channelId].game[gameId].init.character);
    for (var ii=0;ii<characterKeys.length;ii++) {
        let charKey = characterKeys[ii];
        bot.channel[channelId].game[gameId].init.character[charKey].blitz = false;
        bot.channel[channelId].game[gameId].init.character[charKey].seize = false;
    }
}
function sr5InitiativeNewPass(message){
    let channelId = message.channel.id;
    let gameId = getGameMode(message);
    let characterKeys = Object.keys(bot.channel[channelId].game[gameId].init.character);

    // Reduce initiative of all participants
    for (var ii=0;ii<characterKeys.length;ii++) {
        let charKey = characterKeys[ii];
        let currInit = bot.channel[channelId].game[gameId].init.character[charKey].currentInit;
        let newInit = currInit == null ? null : currInit - 10;
        bot.channel[channelId].game[gameId].init.character[charKey].currentInit = newInit;
    }

    // Reset actedThisPass
    for (var ii=0;ii<characterKeys.length;ii++) {
        charKey = characterKeys[ii];
        bot.channel[channelId].game[gameId].init.character[charKey].actedThisPass = false;
    }

    // Increment initiative pass
    bot.channel[channelId].game[gameId].init[activeCombatFieldName].initiativePass += 1;

    // Get the next character to act this pass
    sr5NextInitiativeCharacter(message);
}
function sr5InitiativeNextCharacter(message) {
    let channelId = message.channel.id;
    let gameId = getGameMode(message);

    // If there is a current character
    if (bot.channel[channelId].game[gameId].init[activeCombatFieldName].currentCharacter) {
        // Mark current character as having acted
        let currCharKey = bot.channel[channelId].game[gameId].init[activeCombatFieldName].currentCharacter;
        let currChar = bot.channel[channelId].game[gameId].init.character[currCharKey];
        let charName = currChar.name;
        let currInit = currChar.currentInit;
        let currPass = bot.channel[channelId].game[gameId].init[activeCombatFieldName].initiativePass;
        bot.channel[channelId].game[gameId].init.character[currCharKey].actedThisPass = true;
        bot.channel[channelId].game[gameId].init[activeCombatFieldName].log.push({name: charName, init: currInit, pass: currPass}); 
    
        // Get the next character to act this pass
        sr5NextInitiativeCharacter(message);

        // If no one is acting this pass, go to next initiative pass
        if (!bot.channel[channelId].game[gameId].init[activeCombatFieldName].currentCharacter) {
            sr5InitiativeNewPass(message);
        }
    }

    // Print the current state
    printSr5InitiativeTable(message);
}
function sr5RollInitiative(message) {
    // Roll initiative for all characters
    let channelId = message.channel.id;
    let gameId = getGameMode(message);
    let characterData = bot.channel[channelId].game[gameId].init.character;
    let characterKeys = Object.keys(characterData);
    for (var ii=0;ii<characterKeys.length;ii++) {
        let charKey = characterKeys[ii];
        let thisChar = characterData[charKey];
        let charName = thisChar.name;
        let rollCode = thisChar.rollCode;
        let blitz = thisChar.blitz;
        let surprise = thisChar.surprise;
        
        let rollData = parseD6Roll(rollCode);

        if (blitz) { rollData.addDice = 5 };
        if (surprise) { rollData.staticValue -= 10}

        bot.channel[channelId].game[gameId].init.character[charKey].actedThisPass = false;
        bot.channel[channelId].game[gameId].init.character[charKey].currentInit = XdY(rollData.addDice,6).sum - XdY(rollData.subDice,6).sum + rollData.staticValue;
        bot.channel[channelId].game[gameId].init.character[charKey].tiebreaker = Math.random();
    }

    // Set whoever shall act first
    sr5NextInitiativeCharacter(message);
}
function sr5NextInitiativeCharacter(message){
    // Find the highest prioritized character who has not acted
    let channelId = message.channel.id;
    let gameId = getGameMode(message);
    let combatData = bot.channel[channelId].game[gameId].init[activeCombatFieldName];
    let characterData = bot.channel[channelId].game[gameId].init.character;
    let characterKeys = Object.keys(characterData);
    let nextChar = null;
    let nextCharKey = null;
    for (var ii=0;ii<characterKeys.length;ii++) {
        let charKey = characterKeys[ii];
        let thisChar = characterData[charKey];
        if (!thisChar.actedThisPass && thisChar.currentInit > 0 && sr5CompareInitiativeOrder(channelId,gameId,thisChar,nextChar) < 0) {
            nextChar = thisChar;
            nextCharKey = charKey;
        }
    }
    if (nextCharKey && !nextChar.actedThisPass) {
        bot.channel[channelId].game[gameId].init[activeCombatFieldName].currentCharacter = nextCharKey;
    } else {
        bot.channel[channelId].game[gameId].init[activeCombatFieldName].currentCharacter = null;
    }
}
function sr5CompareInitiativeOrder(channelId,gameId,charA,charB,checkNextPass) {
    // return -1 if charA goes first, 1 if charB goes first, 0 if neither is valid
    if (!charA && !charB) { return 0; };
    if (!charA) { return 1; };
    if (!charB) { return -1; };

    if (!checkNextPass) {
        if (charA.actedThisPass && !charB.actedThisPass) { return 1; };
        if (!charA.actedThisPass && charB.actedThisPass) { return -1; };
    }

    let combatData = bot.channel[channelId].game[gameId].init[activeCombatFieldName];
    let combatTurn = combatData.combatTurn;
    let initPass = combatData.initiativePass;

    let hasPrioA = charA.seize || (charA.surge && combatTurn == 1 && initPass == 1 && !checkNextPass);
    let hasPrioB = charB.seize || (charB.surge && combatTurn == 1 && initPass == 1 && !checkNextPass);
    if (hasPrioA && !hasPrioB) { return -1; };
    if (!hasPrioA && hasPrioB) { return 1; };

    let initA = charA.currentInit + (checkNextPass && !charA.actedThisPass ? -10 : 0);
    let initB = charB.currentInit + (checkNextPass && !charB.actedThisPass ? -10 : 0);

    if (initA > initB) { return -1; };
    if (initA < initB) { return 1; };
    
    if (charA.edge > charB.edge) { return -1; };
    if (charA.edge < charB.edge) { return 1; };
    
    if (charA.reaction > charB.reaction) { return -1; };
    if (charA.reaction < charB.reaction) { return 1; };
    
    if (charA.intuition > charB.intuition) { return -1; };
    if (charA.intuition < charB.intuition) { return 1; };

    if (charA.tiebreaker > charB.tiebreaker) { return 1; };
    return -1;
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

function getHelpTopicDescription(message) {
    let game = getGameMode(message);
    return helpTopics = 
        {
            general: {
                title: () => `Fixer ${versionId}${bot.restrictedMode ? ` (restricted mode)` : ''}`,
                desc: () => `This channel is ${game ? `using the game system ${game}` : 'not using a game system'}. For more help, use the following command to get help on a specific topic.\n`
            },
            rolls: {
                title: () => `Roll commands${game ? ` for ${game}` : ''}`,
                desc: () => `The following commands can be used to roll dice${game ? ` for the current game system` : ''}.\n`
            },
            bot: {
                title: () => `Bot commands`,
                desc: () => `The following commands can be used to affect how Fixer works.\n`
            },
            misc: {
                title: () => `Miscellaneous commands`,
                desc: () => `These are commands not readily sorted in any other topic.\n`
            },
            character: {
                title: () => `Character commands`,
                desc: () => `These are commands to load characters into Fixer to support integrated use of character statistics.\n`
            },
            initiative: {
                title: () => `Initiative tracker`,
                desc: () => `These are commands to handle initiative tracking for characters.\n`
            },
            macros: {
                title: () => `Macro functionality`,
                desc: () => `These are commands to create macros to support aliasing in roll commands.\n`
            }
        }
}

function getChatCommandList(message) {
    let helpTopics = Object.keys(getHelpTopicDescription(message)).sort().join("\n");
    return [
        { // Help
            pattern: /^\s*help *([^\]]+)?\s*$/i,
            subpattern: '',
            example: ['[help <topic>]'],
            desc: [`Get help on one of the following topics:\n${helpTopics}`],
            game: [],
            func: function (message, match, cmd) {displayHelp(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['general']
        },
        { // Bot behaviour
            pattern: /^\s*(good|bad)\s*bot\s*$/i,
            subpattern: '',
            example: ['[goodbot], [badbot]'],
            desc: ['Tell the bot how it is behaving.'],
            game: [],
            func: function (message, match, cmd) {botBehaviour(message, match, cmd)},
            permission: '',
            hidden: true,
            topic: ['misc']
        },
        { // Export bot
            pattern: /^\s*export bot\s*$/i,
            subpattern: '',
            example: ['[export bot]'],
            desc: ['Export the entire data of the bot, so that it can be imported to another bot user.'],
            game: [],
            func: function (message, match, cmd) {exportBotData(message, match, cmd)},
            permission: 'ADMINISTRATOR',
            hidden: false,
            topic: ['bot']
        },
        { // Import bot
            pattern: /^\s*import bot *(.{8})\s*$/i,
            subpattern: '',
            example: ['[import bot <pasteId>]'],
            desc: ['Import data for the bot, overwriting any existing data.'],
            game: [],
            func: function (message, match, cmd) {importBotData(message, match, cmd)},
            permission: 'ADMINISTRATOR',
            hidden: false,
            topic: ['bot']
        }, 
        { // Import character sheet
            pattern: /^\s*import *(?:\"([^\"]+)\")? *(.{8})\s*$/i,
            subpattern: '',
            example: ['[import "<name>" <pasteId>]'],
            desc: ['Import a save file from the given paste ID, assigning the character the given name.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {importCharacterSaveFile(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['character']
        }, 
        { // Set which character you use
            pattern: /^\s*use *\"([^\"]+)\"\s*$/i,
            subpattern: '',
            example: ['[use "<character>"]'],
            desc: ['Change to using the given character.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {changeCharacter(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['character']
        }, 
        { // List saved characters
            pattern: /^\s*characterlist\s*$/i,
            subpattern: '',
            example: ['[characterlist]'],
            desc: ['List all characters you currently have saved'],
            game: [],
            func: function (message, match, cmd) {displayCharacterList(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['character']
        }, 
        { // Delete saved character
            pattern: /^\s*delete *(?:(all)|\"([^\"]+)\")\s*$/i,
            subpattern: '',
            example: ['[delete "<alias>"]'],
            desc: ['Delete your character with the given alias.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {removeCharacterData(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['character']
        }, 
        { // SR5 Initiative 
            //                   action type                                                                                       "name"             dice code                                  appended options                       
            pattern: /^\s*init\s+(add|add loaded|change|set|remove|blitz|seize|surge|start|next|new turn|end|clear|show|details)\s*(?:\"([^\"]+)\")?\s*((?:\s*[\+\-]?\s*(?:\d+d\d+|\d+))*\s*)?\s*((?:(?:surge|blitz|seize|surprised|astral?)\s*)+)?\s*$/i,
            subpattern: /([\+\-]?)\s*((\d+)d(\d+)|\d+)/gi,
            example: [
                 '[init add XdY+C], [init add "<name>" XdY+C]'
                ,'[init add loaded], [init add loaded astral], [init add loaded XdY+C]'
                ,'[... surge], [... blitz], [... seize], [... surprised]'
                ,'[init change XdY+C], [init change> "<name>" XdY+C]'
                ,'[init set ...]'
                ,'[init remove], [init remove "<name>"]'
                ,'[init blitz], [init blitz "<name>"]'
                ,'[init seize], [init seize "<name>"]'
                ,'[init surge], [init surge "<name>"]'
                ,'[init start]'
                ,'[init next]'
                ,'[init new turn]'
                ,'[init end]'
                ,'[init clear]'
                ,'[init show]'
                ,'[init details], [init details "<name>"]'
            ],
            desc: [
                  'Add a character to the initiative list with the given initiative dice pool. If the character name is omitted, it uses your user name.'
                , 'Add your currently loaded character to the initiative list. Adding the *astral* keyword uses the character\s astral initiative instead. Supply the initiative value to use that specific value. Matrix initiative from character files is not currently supported, so please enter the value manually.'
                , 'Append surge, blitz, seize, or surprised to any of the *[init add]* commands if you are using adrenaline surge, spending edge to blitz or seize the initiative, or if you are surprised'
                , 'Change the initiative of your character to the new value (e.g. 8+1d6), or by a modifier (e.g. +2d6), immediately affecting any current initiative score. If the character name is omitted, it uses your user name.'
                , 'Alias for [init change ...]. See description of that command for more details.'
                , 'Removes the character from the initiative tracker. If the character name is omitted, it uses your user name.'
                , 'Blitz for the next combat turn. Set the initiative dice of the character to +5d6 for one combat turn. If the character name is omitted, it uses your user name.'
                , 'Seize the initiative for the next combat turn. The character acts first in all initiative passes for one combat turn. If the character name is omitted, it uses your user name.'
                , 'Adrenaline surge. The character acts first in the first initiative pass in the first combat turn. If the character name is omitted, it uses your user name.'
                , 'Start combat. Initiative is rolled for all characters, and the initiative table is shown.'
                , 'Go to next character in the initiative. If no character has initiative score left you will be told to go to the next combat turn.'
                , 'Start a new combat turn. This rerolls the initiative for all characters.'
                , 'End the combat. This will prevent display of initiative order until a combat is started again.'
                , 'Clear the initiative tracker, removing all characters.'
                , 'Show the initiative table.'
                , 'List initiative statistics for all characters, or a specific character if the name is supplied.'
            ],
            game: ['SR5e'],
            func: function (message, match, cmd) {sr5Initiative(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['initiative']
        }, 
        { // SR5 Initiative - catch failed attempts 
            //                   action type            "name"            dice code
            pattern: /^\s*init\s*.*$/i,
            subpattern: '',
            example: [],
            desc: [],
            game: ['SR5e'],
            func: function (message, match, cmd) {sr5Initiative(message, match, cmd)},
            permission: '',
            hidden: true,
            topic: ['initiative']
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
            permission: '',
            hidden: false,
            topic: ['macros']
        }, 
        { // Check macros
            pattern: /^\s*macrolist *(all)?\s*$/i,
            subpattern: '',
            example: ['[macrolist], [macrolist all]'],
            desc: ['List all macros you have for the current game, or for all games.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {displayMacroList(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['macros']
        },
        { // Delete macros
            pattern: /^\s*delmacro *(?:(all)|\"([^\"]+)\")?\s*$/i,
            subpattern: '',
            example: ['[delmacro "<alias>"], [delmacro all]'],
            desc: ['Delete a specific macro, or all of your macros.'],
            game: ['SR5e'],
            func: function (message, match, cmd) {deleteMacro(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['macros']
        },
        { // Set or check game system
            pattern: /^\s*set *game *(\S*)?\s*$/i,
            subpattern: '',
            example: ['[setgame], [setgame <game>]'],
            desc: ['Set the channel\'s game to the selected game system. Use [setgame] to see current and available game systems.'],
            game: [],
            func: function (message, match, cmd) {setGameMode(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['bot']
        },
        { // Set or check game settings
            pattern: /^\s*gamesetting *(?:\s(\S*))? *(?:\s("[^\"]*"))? *$/i,
            subpattern: '',
            example: ['[gamesetting <setting> "<newValue>"], [gamesetting], [gamesetting <setting>]'],
            desc: ['Set the value of a setting for the current game. Omitt the value to check the current value. Also omitt the setting to check all settings.'],
            game: ['any'],
            func: function (message, match, cmd) {setGameSetting(message, match, cmd)},
            permission: 'ADMINISTRATOR',
            hidden: false,
            topic: ['bot']
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
            permission: 'ADMINISTRATOR',
            hidden: false,
            topic: ['bot']
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
            permission: '',
            hidden: false
        },
        { // Shadowrun extended rolls //TODO: Implement this
            pattern: /^\s*\[\s*$/i, 
            subpattern: '',
            example: ['[E]'],
            desc: ['Extend your previous roll'],
            game: ['SR5e'],
            func: function (message, match, cmd) {generalRoll(message, match, cmd)}, // TODO: Change command
            permission: '',
            hidden: false
        },*/
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
            permission: '',
            hidden: false,
            topic: ['rolls']
        },
        { // Blades in the Dark / Karma in the Dark rolls
            //            (nDice                                                    )    (limit                                                                   )    (e)    (type   )    (mDice                                                    )    (limit                                                                   )    (e)    (extraparam             )     
            //pattern: /^\s*([\+\-]?\s*(?:\d+|[A-z_]+)(?:\s*[\+\-]\s*(?:\d+|[A-z_]+))*)?\s*(\(\s*(?:[\+\-]?\s*(?:\d+|[A-z_]+)(?:\s*[\+\-]\s*(?:\d+|[A-z_]+))*)?\s*\))?\s*(!)?\s*(v|T|a|e)?\s*([\+\-]?\s*(?:\d+|[A-z_]+)(?:\s*[\+\-]\s*(?:\d+|[A-z_]+))*)?\s*(\(\s*(?:[\+\-]?\s*(?:\d+|[A-z_]+)(?:\s*[\+\-]\s*(?:\d+|[A-z_]+))*)?\s*\))?\s*(!)?\s*((?:\s*,\s*[^,\s][^,]*)+)?\s*$/i, 
              pattern: /^\s*([\+\-]?\s*(?:\d+)(?:\s*[\+\-]\s*\d+)*)\s*$/,
            //              (nDice                                )    (limit                                             )    (e)    (type   )    (mDice                              )    (limit                                               )    (e)    (extraparam             )     
            //pattern: /^\s*([\+\-\*]?\s*\d+(?:\s*[\+\-\*]\s*\d+)*)?\s*(\(\s*(?:[\+\-\*]?\s*\d+(?:\s*[\+\-]\s*\d+)*)?\s*\))?\s*(!)?\s*(v|T|a|e)?\s*([\+\-\*]?\s*\d+(?:\s*[\+\-]\s*\d+)*)?\s*(\(\s*(?:[\+\-\*]?\s*\d+(?:\s*[\+\-\*]\s*\d+)*)?\s*\))?\s*(!)?\s*((?:\s*,\s*[^,\s][^,]*)+)?\s*$/i, 
            subpattern: '',
            example: ['[1]',
                    '[2+1]'],
            desc: ['Roll a test using the given number of dice'],
            game: ['kitd'],
            func: function (message, match, cmd) {karmaInTheDarkRoll(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['rolls']
        },
        { // Witchcraft rolls
            pattern: /^\s*([\+\-\*]?\s*\d+(?:\s*[\+\-\*]\d+)*)\s*$/,
            subpattern: '',
            example: ['[x]'],
            desc: ['Roll a test with a modifier x. Allows arithmetic operations with +, -, and *.'],
            game: ['Witchcraft'],
            func: function (message, match, cmd) {witchcraftRoll(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['rolls']
        },
        { // General dice roll
            pattern: /^[\*\+\-\/\s\dd\(\)]*$/i,
            //pattern: /^\s*(?:([\+\-]?)\s*(\d+d\d+|\d+))(?:\s*([\+\-])\s*(\d+d\d+|\d+))*\s*$/i,
            subpattern: /(\d*)d(\d+)/gi,
            example: ['[XdY+C]'],
            desc: ['Roll any combination of dice and static modifiers.'],
            game: [],
            func: function (message, match, cmd) {generalRoll(message, match, cmd)},
            permission: '',
            hidden: false,
            topic: ['rolls']
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

const botBehaviourResponses = {
    good: [ ':blush:',
            ':heart:',
            'I\'m so happy to be of service',
            'anything for you!'
          ],
    bad:  [ ':middle_finger:',
            ':sob:',
            ':smiling_imp: ',
            'don\'t hit me! Please don\'t hit me!'
          ]
}

const witchcraftSuccessLevels = ['Failure','Adequate','Decent','Good','Very Good','Excellent','Extraordinary','Mind-boggling']

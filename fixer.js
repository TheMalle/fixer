const versionId = '0.3.0';
const Discord = require('discord.js');
var fetch = require('node-fetch');
var parseString = require('xml2js').parseString;
var PastebinAPI = require('better-pastebin');
const moment = require('moment');

// Define required and optional inputs
const reqArgs = ['token', 'paste', 'user', 'password', 'devkey'];
const optArgs = [];
var args = {};

const client = new Discord.Client();
const reConfirm = /^\[y\]$/i;
const reStop = /^\[\s*stop\s*\].*$/i;
const reHelp = /^\[\s*help(?:\:\s*([A-z][A-z ]*))?\].*$/i;
const reMacroDef = /^\[\s*macro\s*:\s*([A-z0-9]+)\s+\"([^\"]+)\"\s*\].*$/i;
const reMacroDel = /^\[\s*delmacro\s*:\s*([A-z0-9]+)\s*\].*$/i;
const reMacroDelAll = /^\[\s*delallmacros\s*\].*$/i;
const reMacroList = /^\[\s*macrolist\s*\].*$/i;
const reInitiativeRoll = /^\[\s*i(?:nit(?:iative)?)?\s*(meat|astral)?\s*(?:([\+\-])\s*(\d+)d6)?\s*(?:([\+\-])\s*(\d+))?\].*$/i;
//const reDamageTest = /^\[\d+(S|P)(?:(\+|\-)(\d+))b(\d+)a(\d+)(!)?\]$/;
const reClean = /^\[\s*clean\s*(\d+)?\s*\].*$/i;
const reNuke = /^\[\s*nuke\s*\].*$/i;
const reGetChar = /^\[\s*get(?:Char(?:acter)?)?\:\s?([A-z0-9]{8})\s*\].*$/i;
const reCheckChar = /^\[\s*check(?:Char(?:acter)?)?\s*\].*$/i;
const reUnloadChar = /^\[\s*unload(?:Char(?:acter)?)?\s*\].*$/i;
const reIsAttribute = /^(Body|Agility|Reaction|Strength|Charisma|Intuition|Logic|Willpower|Edge|Magic|Resonance|Depth)$/i
const reIsAdditionalCharacterStat = /^()$/i
const reRollFormat = /^\s*\[\s*(([A-z0-9: \+\-]*?)\s*(?:\[(\d+)\])?\s*(!)?\s*(?:(v|a|T)\s*(\d+))?\s*(?:\[(\d+)\])?\s*(!)?\s*(?:,\s*(\d+))?)\s*((?:\s*,\s*[A-z0-9]+=\s*[0-9]+)*)\s*\].*$/
const maxDiscordMessageLength = 2000;
const discordCodeBlockWrapper = '```';
var dataMap = {};
var awaitingConfirmation = {};
var restrictedMode = true;

const attributeMap = {
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

const attributeShortMap = {
    'BOD': 'body',
    'AGI': 'agility',
    'REA': 'reaction',
    'STR': 'strength',
    'CHA': 'charisma',
    'INT': 'intuition',
    'LOG': 'logic',
    'WIL': 'willpower',
    'EDG': 'edge',
    'MAG': 'magic',
    'RES': 'resonance',
    'DEP': 'depth'
}

const skillTable = {
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

// TODO: Implement armor as an attribute so you can roll body+armor
// TODO: Implement [!] to spend edge to reroll the latest roll
// TODO: Implement [push] to spend edge to push the limit on the previous roll
// TODO: Implement support for multiple characters
// TODO: Implement limit keywords
// TODO: Initiative tracker
// TODO: Extended tests [e]
// TODO: Damage rolls
// TODO: Essence as additional character statistic

/*
####################################################################################
#
# startup
#
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
    for (var i = 0; i < reqArgs.length; i++) {
        let reArg = new RegExp('\-\(' + reqArgs[i] + '\)\=([^\ ]+)');
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

// Action when ready
client.on('ready', () => {
    client.user.setGame((restrictedMode ? '(R) ' : '') + 'type [help] for help');
    console.log('I am ready!');
});

// Message parsing
client.on('message', message => {

    // If it's not a message from this bot
    if (message.author.id != client.user.id) {

        // If we are awaiting confirmation from the user, override any other commands
        if (message.author.id in awaitingConfirmation) {

        }

        // Then handle specific commands
        // Stop ongoing action
        else if (reStop.test(message.content)) {
            // This uses listeners to perform the correct action
        }

        // Help commands
        else if (reHelp.test(message.content)) {
            doDisplayHelp(message);
        }

        // Define macros
        else if (reMacroDef.test(message.content)) {
            doDefineMacro(message);
        }

        // List macros
        else if (reMacroList.test(message.content)) {
            doListMacros(message);
        }

        // Delete macros
        else if (reMacroDel.test(message.content)) {
            doDeleteMacro(message);
        }

        // Delete all macros
        else if (reMacroDelAll.test(message.content)) {
            doDeleteAllMacros(message);
        }

        // Clean
        else if (reClean.test(message.content)) {
            doClean(message);
        }

        // Nuke
        else if (reNuke.test(message.content)) {
            doCleanAll(message);
        }

        // Get character
        else if (reGetChar.test(message.content)) {
            doLoadCharacter(message);
        }

        // Check character
        else if (reCheckChar.test(message.content)) {
            doCheckCharacter(message);
        }

        // Unload character
        else if (reUnloadChar.test(message.content)) {
            doUnloadCharacter(message);
        }

        // Inititative roll (requires character)
        else if (reInitiativeRoll.test(message.content)) {
            doInitiativeRoll(message);
        }

        // General roll
        else if (reRollFormat.test(message.content)) {
            doGeneralRoll(message);
        }
    }
});

// Check access to pastebin before logging in
PastebinAPI.setDevKey(args.devkey);
PastebinAPI.login(args.user, args.password, function (success, data) {
    if (!success) {
        // Failed to log in -> run in restricted mode
        console.log('Failed to login to pastebin');
        discordLogin(args.token);
    }

    else {
        // Log in successful -> attempt to read designated paste
        console.log('Successfully logged in to pastebin as user:' + args.user);

        PastebinAPI.get(args.paste, function (success, pastedata) {
            if (!success) {
                // Failed to read paste -> run in restricted mode
                console.log('Could not establish connection to paste ' + args.paste);
                discordLogin(args.token);
            }

            else {
                // Successfully read paste -> get list of pastes to check against
                console.log('Successfully read paste ' + args.paste);
                let pasteLimit = 50;
                PastebinAPI.list(pasteLimit, function (success, data) {
                    // NOTE! If no pastes found, then the callback will come TWICE! Once with no data, once with a data of length 0.
                    if (!success) {
                        // Failed to list pastes -> run in restricted mode
                        console.log('Could not verify rights to paste');
                        discordLogin(args.token);
                    } else if (!data) {
                        // Failed to find any pastes -> DO NOTHING, leave that to the second callback
                    } else {
                        if (data.length == 0) {
                            // Failed to find any pastes -> run in restricted mode
                            console.log('Could not find any pastes belonging to the user');
                            discordLogin(args.token);
                        }

                        else {
                            // Successfully listed pastes -> check given paste against them
                            console.log('Successfully listed ' + data.length + ' paste' + (data.length > 1 ? 's' : '') + ' belonging to user');
                            let hasPaste = false;
                            data.forEach(function (e) {
                                if (e.paste_key == args.paste) {
                                    hasPaste = true;
                                }
                            });
                            if (!hasPaste) {
                                // User is not owner of designated paste -> run in restricted mode
                                console.log('Could not verify that paste belongs to user');
                                discordLogin(args.token);
                            }

                            else {
                                // User verified as owner of designated paste -> use data from paste and start regular mode
                                console.log('Successfully verified paste as belonging to user');
                                restrictedMode = false;
                                loadData(pastedata);
                                discordLogin(args.token);
                            }
                        }
                    };
                });
            }
        });
    }
});

/*
####################################################################################
#
# Logging in to discord
#
####################################################################################
*/
function discordLogin(token) {
    console.log('Starting up in ' + (restrictedMode ? 'restricted' : 'regular') + ' mode...');
    client.login(token);
}

/*
####################################################################################
#
# Saving and loading information
#
####################################################################################
*/

function saveData(message) {
    if (!restrictedMode) {
        // Login to pastebin
        PastebinAPI.login(args.user, args.password, function (success, data) {
            // Edit paste
            PastebinAPI.edit(args.paste, { contents: JSON.stringify(dataMap), expires: 'N' }, function (success, data) {
                if (!success) {
                    // If the save failed, notify user
                    message.reply('there was an error attempting to backup the data!')
                }

                else {
                    // Otherwise just print to the log
                    console.log('Saved data at ' + currentDateTime());
                }
            });
        });
    }
}

function loadData(json) {
    dataMap = JSON.parse(json);
}

/*
####################################################################################
#
# Macros
#
####################################################################################
*/
function doDefineMacro(message) {
    let macroDef = reMacroDef.exec(message.content);
    let macroName = macroDef[1];
    let macroText = macroDef[2];
    let author = message.author.id;
    let channel = message.channel.id;

    ensureUserHasData(author, channel);
    let alreadyDefined = macroName in dataMap[author][channel].macro;
    dataMap[author][channel].macro[macroName] = macroText;
    message.reply((alreadyDefined ? 'modified ' : 'created ') + 'macro "' + macroName + '" ' + (alreadyDefined ? 'to' : 'as') + ': "' + macroText + '"');
    saveData(message);
}

function doDeleteMacro(message) {
    let author = message.author.id;
    let channel = message.channel.id;
    let macroName = reMacroDel.exec(message.content)[1];
    str = 'macro "' + macroName + '" not found';
    if (!(author in dataMap)) { message.reply(str); return };
    if (!(channel in dataMap[author])) { message.reply(str); return };
    if (!('macro' in dataMap[author][channel])) { message.reply(str); return };
    if (!(macroName in dataMap[author][channel].macro)) { message.reply(str); return };
    delete dataMap[author][channel].macro[macroName];
    message.reply('deleted macro "' + macroName + '"');
    saveData(message);
}

function doDeleteAllMacros(message) {
    let author = message.author.id;
    let channel = message.channel.id;
    if (!(author in dataMap)) { message.reply(str); return };
    if (!(channel in dataMap[author])) { message.reply(str); return };
    if (!('macro' in dataMap[author][channel])) { message.reply(str); return };
    dataMap[author][channel].macro = {};
    message.reply('deleted all macros');
    saveData(message);
}

function doListMacros(message) {
    str = ['no macros found'];
    if (!(message.author.id in dataMap)) { }
    else if (!(message.channel.id in dataMap[message.author.id])) { }
    else if (!('macro' in dataMap[message.author.id][message.channel.id])) { }
    else if (Object.keys(dataMap[message.author.id][message.channel.id].macro).length == 0) { }
    else {
        let macroData = dataMap[message.author.id][message.channel.id].macro;
        let macroArray = [];
        let maxMacroNameLength = 0;
        Object.keys(macroData).forEach(function (macroName) {
            macroArray.push([macroName, macroData[macroName]]);
            maxMacroNameLength = Math.max(maxMacroNameLength, macroName.length);
        })
        macroArray.sort(function (a, b) {
            if (a[0] === b[0]) { return 0 };
            return a[0] < b[0] ? -1 : 1;
        });
        let macroHeader = discordCodeBlockWrapper + 'Macro' + ' '.repeat(Math.max(2, maxMacroNameLength + 2 - 5)) + 'Replaced by';
        str = [macroHeader];
        for (var ii = 0; ii < macroArray.length; ii++) {
            let macroName = macroArray[ii][0];
            let macroText = macroArray[ii][1];
            let macroDescription = '\n' + macroName + ' '.repeat(Math.max(7 - macroName.length, maxMacroNameLength + 2 - macroName.length)) + macroText;
            if (str[str.length - 1].length + macroDescription.length + discordCodeBlockWrapper.length < maxDiscordMessageLength) {
                // Append to current message
                str[str.length - 1] += macroDescription;
            } else {
                // Finish last message
                str[str.length - 1] += discordCodeBlockWrapper;

                // Start new message
                str.push(macroHeader + macroDescription);
            }
        }
        str[str.length - 1] += discordCodeBlockWrapper;
    }
    for (var ii = 0; ii < str.length; ii++) {
        message.reply(str[ii]);
    }
}

/*
####################################################################################
#
# Help
#
####################################################################################
*/
function doDisplayHelp(message) {
    let arg = reHelp.exec(message)[1];
    arg = arg ? stringCondenseLower(arg) : '';
    if (arg == '') {
        doDisplayGeneralHelp(message);
    }

    else if (arg == 'admin') {
        doDisplayAdminHelp(message);
    }

    else if (arg == 'character') {
        doDisplayCharacterHelp(message);
    }

    else if (arg == 'macros') {
        doDisplayMacroHelp(message);
    }

    else {
        message.reply('the help topic "' + arg + '" is not recognized');
    }
}

function doDisplayAdminHelp(message) {
    let helpmsg =
        '\n'
        + 'The following administration commands are available:\n'
        + '\t**[clean X]** remove the last X messages in the channel. Maximum of 50. Defaults to 10 if omitted.\n'
        + '\t**[nuke]** remove all messages from the channel (requires confirmation; can take significant amount of time).\n'
        + '\t**[y]** confirm a [nuke] request.\n'
        + '\t**[stop]** stop a scheduled or ongoing [nuke].\n'

    message.reply(helpmsg);
}

function doDisplayGeneralHelp(message) {
    let helpmsg =
        '\n'
        + 'This is Fixer ' + versionId + (restrictedMode ? ' (restricted mode)' : '') + '\n'
        + 'For administration commands, see **[help: admin]**\n'
        + 'For commands available for loaded characters, see **[help: character]**\n'
        + 'For macros, see **[help: macros]**\n'
        + '\n'
        + 'The following rolls are available without loading a character:\n'
        + '\t**[X]** simple test using X dice, e.g. [12]\n'
        + '\t**[XvY]** opposed test using X dice vs Y dice, e.g. [12v2]\n'
        + '\t**[XTY]** threshold test using X dice and threshold Y, e.g. [12T2]\n'
        + '\t**[XaY,C]** availability test using X dice, availability Y and cost C, e.g. [12a4,150]. The cost can be omitted.\n'
        + '\t**NOTE:** the following modifiers can be added to tests (in the listed order):\n'
        + '\t\t**[X]** to set the limit to X, e.g. [12[3]]\n'
        + '\t\t**!** to push the limit before the roll [12!]\n'
        + '\t\t**NOTE:** Opposed tests allow modifiers on both dice pools, e.g. [12[3]!v8!]\n'
        + '\t**[get: pastebinId]** load character from the give paste on pastebin.com, e.g. [get: LdJXHX5e], also available as [getChar: LdJXHX5e] and [getCharacter: LdJXHX5e]\n'
        + '\t**[check]** check if you have a character loaded, also available as [checkChar] and [checkCharacter]\n'
        + '\t**[unload]** unload a loaded character, also available as [unloadChar] and [unloadCharacter]\n'
        + '\n'
        + 'Loaded characters will ' + (restrictedMode ? '**not** ' : '') + 'remain accessible if the bot restarts' + (restrictedMode ? ' as it is in restricted mode' : '') + '.';
    /*
        + '\t**[dodge]** alias for [reaction+intuition[physical]]\n'
        + '\t**[judge]** alias for [intuition+charisma]\n'
        + '\t**[lift]** alias for [strength+body]\n'
        + '\t**[memory]** alias for [logic+willpower]\n'
        + '\t**[run]** alias for [running]\n'
        + '\t**[swim]** alias for [swimming]\n'

        + '\t**[perceive magic]** alias for [perception+intuition[mental]] (threshold is magic skill - force)\n'
        + '\t**[resist X drain]** roll resist drain dice and see how much drain you take\n'

        + '\t**[resist detection]** alias for [logic+willpower]\n'
        + '\t**[resist mana illusion]** alias for [logic+willpower]\n'
        + '\t**[resist physical illusion]** alias for [logic+intuition]\n'
        + '\t**[resist mental manipulation]** alias for [logic+willpower]\n'
        + '\t**[resist physical manipulation]** alias for [body+strength]\n'

        + '\t**[summon F]** alias for [summoning+magic[F] v F]\n'
        + '\t**[summon F R]** alias for [summoning+magic[R] v F]\n'
        + '\t**[bind F]** alias for [binding+magic[F] v Fx2]\n'
        + '\t**[banish F]** alias for [banishing+magic[astral] v F]\n'

        + '\t**[addiction physiological]** alias for [body+willpower]\n'
        + '\t**[addiction psychological]** alias for [logic+willpower]\n'

        + '\t**[recover stun]** alias for [body+willpower]\n'
        + '\t**[recover physical]** alias for [body+body]\n'

        + '\t**[brute force]** alias for [cybercombat+logic[attack]] (v willpower+firewall)\n'
        + '\t**[check os]** alias for [electronic warfare+logic[sleaze]v6]\n'
        + '\t**[crack file]** alias for [hacking + logic[attack]] (v 2xProtectionRating)\n'
        + '\t**[crash program]** alias for [cybercombat+logic[attack]] (v intuition+firewall)\n'
        + '\t**[data spike]** alias for [cybercombat+logic[attack]] (v intuition+firewall)\n'
        + '\t**[disarm data bomb]** alias for [software+intuition[firewall]] (v 2xDataBombRating)\n'
        + '\t**[edit file]** alias for [computer+logic[data processing]] (v intuition+firewall)\n'
        + '\t**[erase mark]** alias for [computer+logic[attack]] (v willpower+firewall)\n'
        + '\t**[erase matrix signature]** alias for [computer+resonance[attack]] (v 2xSignatureRating)\n'
        + '\t**[format device]** alias for [computer+logic[sleaze]] (v willpower+firewall)\n'
        + '\t**[hack on the fly]** alias for [hacking+logic[sleaze]] (v intuition+firewall)\n'
        + '\t**[hide]** alias for [electronic warfare+intuition[sleaze]] (v intuition+data processing)\n'
        + '\t**[jack out]** alias for [hardware+willpower[firewall]] (v logic+attack)\n'
        + '\t**[jam signals]** alias for [electronic warfare+logic[attack]] (v intuition+firewall)\n'
        + '\t**[jump in]** alias for [electronic warfare+logic[data processing]] (v willpower+firewall)\n'
        + '\t**[matrix perception]** alias for [computer+intuition[data processing]] (v logic+sleaze)\n'
        + '\t**[matrix search]** alias for [computer+íntuition[data processing]]\n'
        + '\t**[reboot device]** alias for [computer+logic[data processing]] (v willpower+firewall)\n'
        + '\t**[set data bomb]** alias for [software+logic[sleaze]] (v 2xDeviceRating)\n'
        + '\t**[snoop]** alias for [electronic warfare+intuition[sleaze]] (v logic+firewall)\n'
        + '\t**[spoof command]** alias for [hacking+intuition[sleaze]] (v logic+firewall)\n'
        + '\t**[trace icon]** alias for [computer+intuition[data processing]] (v willpower+sleaze)\n'
    */
    message.reply(helpmsg);
}

function doDisplayCharacterHelp(message) {
    helpmsg =
        '\n'
        + 'Loading a character allows you to do skills and attributes instead of fixed numbers for dice. If only a single skill and no attribute is used, the test includes the related attribute. '
        + ' If edge is used to push the limit, your edge dice are automatically added (as long as the roll contains at least one skill or attribute). Examples:\n'
        + '\t**[perception]** roll your perception + intuition\n'
        + '\t**[perception+willpower]** roll your perception + willpower\n'
        + '\t**[logic+willpower[4]T3]** roll logic and willpower with a limit of 4 against a threshold of 3\n'
        + '\t**[logic+willpower!T3]** roll logic and willpower while pushing the limit against a threshold of 3\n'
        + '\t**[logic+willpower!v8[3]]** roll logic and willpower while pushing the limit against a dice pool of 8 dice with a limit of 3\n'
        + '\n'
        + 'Loading a character also allows you to roll initiative:\n'
        + '\t**[i]** roll initiative (defaults to meat), also available as [init] or [initiative] \n'
        + '\t**[i meat]** roll meat initiative\n'
        + '\t**[i astral]** roll astral initiative\n'
        + '\t**NOTE:** you can add modifiers to your initiative, first giving a dice pool modifier (+/-Xd6) then a static modifier (+/-Y). Either modifier can be omitted. Examples:\n'
        + '\t\t**[i astral+2d6+4]** roll astral initiative with 2 extra initiative dice and a static bonus of 4\n'
        + '\n'
        + 'Loading a character also allows you to roll some additional special rolls:\n'
        + '\t**[aY,C]** omit your dice pool for an availability test to use your charisma + negotiation';
    message.reply(helpmsg);
}

function doDisplayMacroHelp(message) {
    helpmsg =
        '\n'
        + 'Macros are not connected to a specific character (but are still tracked separately in each channel). Macros work as aliases, replacing text in your roll specification.'
        + ' Macro names must consist of alphanumeric characters without spaces.\n'
        + '\n'
        + '**[macrolist]** shows all of your macros\n'
        + '**[macro: A "B"] creates the macro which replaces ":A" in all your rolls with "B"\n'
        + '**[delmacro: A] delete the macro A\n'
        + '**[delallmacros] delete all of your macros\n'
        + '\n'
        + 'Macros can include placeholders, which are declared by an underscore (_) followed by the placeholder name. They must then be given values when the macro is used.\n'
        + 'Examples:\n'
        + '\t[macro: summon "summoning + magic [_F] v _F"]\n'
        + '\t[:summon, F=6]'
        + '\n'
        + 'Example use:\n'
        + '\t[macro: resistDrain "willpower + charisma"] now :resistDrain will be interpreted as "willpower + charisma"\n'
        + '\t[:resistDrain + 3] roll your macro resistDrain with 3 additional dice';
    message.reply(helpmsg);
}

/*
####################################################################################
#
# Rolls
#
####################################################################################
*/
function doGeneralRoll(message) {
    // Get the replacement definitions from the original message
    let repDefs = reRollFormat.exec(message)[10] ? stringCondenseLower(reRollFormat.exec(message)[10]) : '';
    if (repDefs.length > 0) {
        if (repDefs.substr(0, 1) == ',') { repDefs = repDefs.substr(1) };
        repDefs = repDefs.split(/[,=]/g)

    } else {
        repDefs = [];
    }

    // Find macro definitions in message
    let macroDefs = getUserMacros(message);

    // Order them in descending macro name length (makes replacement easier)
    let macroArray = [];
    Object.keys(macroDefs).forEach(function (key) {
        macroArray.push([key, macroDefs[key]]);
    });
    macroArray.sort(function (a, b) {
        if (a[0].length === b[0].length) { return 0 };
        return a[0].length > b[0].length ? -1 : 1;
    });

    // Go through all the defined macros and replace any which are used in the message, after applying replacement definitions
    let msg = message.content;
    let hadMacros = false;
    for (var ii = 0; ii < macroArray.length; ii++) {
        let reReplaceMacro = new RegExp(':\s*' + macroArray[ii][0], 'g');
        let replaceString = stringCondenseLower(macroArray[ii][1])
        for (var jj = 0; jj < repDefs.length; jj += 2) {
            let reRepDef = new RegExp('_' + repDefs[jj], 'g');
            replaceString = replaceString.replace(reRepDef, repDefs[jj + 1]);
        }
        hadMacros = reReplaceMacro.test(msg) ? true : hadMacros;
        msg = msg.replace(reReplaceMacro, replaceString);
    }

    // Get roll parts
    let rollParts = reRollFormat.exec(msg);
    let rollString = rollParts[2] ? stringCondenseLower(rollParts[2]) : '';
    let limit = rollParts[3] ? parseInt(rollParts[3]) : '';
    let pushTheLimit = rollParts[4] ? rollParts[4] : '';
    let testType = rollParts[5] ? rollParts[5] : '';
    let secondaryDice = rollParts[6] ? rollParts[6] : '';
    let secondaryLimit = rollParts[7] ? rollParts[7] : '';
    let secondaryPush = rollParts[8] ? rollParts[8] : '';
    let secondaryValue = rollParts[9] ? rollParts[9] : '';

    // If any place holder is remaining in the roll string, alert and abort
    let placeholder = /_([A-z0-9])/.exec(rollString);
    if (placeholder) {
        if (!(placeholder[1] == '')) { message.reply('missing value for placeholder "' + placeholder[1] + '"'); return }
    }

    // Validate roll string and get roll statistics
    let rollStats = parseRollString(message, rollString, testType);
    if (!rollStats.valid) { return };
    let nDice = rollStats.dice;
    let edge = rollStats.edge;
    let parsedMessage = hadMacros ? '[' + reRollFormat.exec(msg)[1].trim() + ']' : '';

    // validate other inputs based on test type

    /*
    Simple test
    Require:
        RollString standard format
    Forbid:
        Secondary dice
        Secondary limit
        Secondary push
        Secondary value
    */
    if (stringCondenseLower(testType) === '') {

        if (!messageAssert(message, !secondaryDice, 'invalid input for a simple test (did not expect secondary dice pool)')) { return };
        if (!messageAssert(message, !secondaryLimit, 'invalid input for a simple test (did not expect secondary limit)')) { return };
        if (!messageAssert(message, !secondaryPush, 'invalid input for a simple test (did not expect secondary push the limit)')) { return };
        if (!messageAssert(message, !secondaryValue, 'invalid input for a simple test (did not expect secondary value)')) { return };
    }

    /*
    Threshold test
    Require:
        RollString standard format
        Secondary dice
    Forbid:
        Secondary limit
        Secondary push
        Secondary value
    */
    else if (stringCondenseLower(testType) === 't') {

        if (!messageAssert(message, secondaryDice, 'invalid input for a threshold test (expected secondary dice pool)')) { return };
        if (!messageAssert(message, !secondaryLimit, 'invalid input for a threshold test (did not expect secondary limit)')) { return };
        if (!messageAssert(message, !secondaryPush, 'invalid input for a threshold test (did not expect secondary push the limit)')) { return };
        if (!messageAssert(message, !secondaryValue, 'invalid input for a threshold test (did not expect secondary value)')) { return };
    }

    /*
    Opposed test
    Require:
        RollString standard format
        Secondary dice
    Forbid:
        Secondary value
    */
    else if (stringCondenseLower(testType) === 'v') {
        if (!messageAssert(message, secondaryDice, 'invalid input for an opposed test (expected secondary dice pool)')) { return };
        if (!messageAssert(message, !secondaryValue, 'invalid input for an opposed test (did not expect secondary value)')) { return };
    }

    /*
    Availability test
    Require:
        RollString standard format
        Secondary dice
    Forbid:
        Secondary limit
        Secondary push
    */
    else if (stringCondenseLower(testType) === 'a') {
        if (!messageAssert(message, secondaryDice, 'invalid input for an availability test (expected secondary dice pool)')) { return };
        if (!messageAssert(message, !secondaryLimit, 'invalid input for an availability test (did not expect secondary limit)')) { return };
        if (!messageAssert(message, !secondaryPush, 'invalid input for an availability test (did not expect secondary push the limit)')) { return };
    }

    // Not a valid test
    else {
        return;
    }

    // If no manual limit entered, and roll string gets limit from skill, then use that limit (pushing the limit is handled in the roll functions)
    if (!limit && rollStats.limit) { limit = rollStats.limit };

    // With validated inputs, perform the actual test type
    if (stringCondenseLower(testType) === '') { doSimpleTest(message, parsedMessage, nDice, limit, pushTheLimit, edge) }
    else if (stringCondenseLower(testType) === 't') { doThresholdTest(message, parsedMessage, nDice, limit, pushTheLimit, secondaryDice, edge) }
    else if (stringCondenseLower(testType) === 'v') { doOpposedTest(message, parsedMessage, nDice, limit, pushTheLimit, secondaryDice, secondaryLimit, secondaryPush, edge) }
    else if (stringCondenseLower(testType) === 'a') { doAvailabilityTest(message, parsedMessage, nDice, limit, pushTheLimit, secondaryDice, secondaryValue, edge) }
}

function doSimpleTest(message, parsedRollString, nDice, limit, pushTheLimit, edge) {
    var dc = new DiceCode(nDice, limit, pushTheLimit, (pushTheLimit ? edge : 0));
    var roll = rollDice(dc);
    message.reply((parsedRollString ? 'Rolled ' + parsedRollString + ' for ' : '') + '**' + roll.hits + '** hit' + (roll.hits == 1 ? '' : 's') + ' (' + roll.roll + (roll.limitUsed == true ? '; limit ' + roll.limit + ' exceeded' : '') + ')');
}

function doThresholdTest(message, parsedRollString, nDice, limit, pushTheLimit, secondaryDice, edge) {
    var dc = new DiceCode(nDice, limit, pushTheLimit, (pushTheLimit ? edge : 0));
    var roll = rollDice(dc);
    var threshold = secondaryDice;
    var margin = roll.hits - threshold;
    message.reply((parsedRollString ? 'Rolled ' + parsedRollString + ' for ' : '') + (margin >= 0 ? '**success**' : '**failure**') + ' (' + roll.roll + '; margin: **' + margin + '**)');
}

function doOpposedTest(message, parsedRollString, nDice, limit, pushTheLimit, secondaryDice, secondaryLimit, secondaryPush, edge) {
    var dc1 = new DiceCode(nDice, limit, pushTheLimit, (pushTheLimit ? edge : 0));
    var dc2 = new DiceCode(secondaryDice, secondaryLimit, secondaryPush, 0);
    var roll1 = rollDice(dc1);
    var roll2 = rollDice(dc2);
    var netHits = roll1.hits - roll2.hits;
    message.reply((parsedRollString ? 'Rolled ' + parsedRollString + ' for ' : '') + '**' + netHits + '** net hit' + (netHits == 1 ? '' : 's')
        + ' ('
        + '**' + roll1.hits + '** hit' + (roll1.hits == 1 ? '' : 's') + ' (' + roll1.roll + (roll1.limitUsed == true ? '; limit ' + roll1.limit + ' exceeded' : '') + ')'
        + ' vs '
        + '**' + roll2.hits + '** hit' + (roll2.hits == 1 ? '' : 's') + ' (' + roll2.roll + (roll2.limitUsed == true ? '; limit ' + roll2.limit + ' exceeded' : '') + ')'
        + ')');
}

function doAvailabilityTest(message, parsedRollString, nDice, limit, pushTheLimit, secondaryDice, secondaryValue, edge) {
    var dc1 = new DiceCode(nDice, limit, pushTheLimit, (pushTheLimit ? edge : 0));
    var dc2 = new DiceCode(secondaryDice, null, null, 0);
    var roll1 = rollDice(dc1);
    var roll2 = rollDice(dc2);
    var netHits = roll1.hits - roll2.hits;

    let availTime = getAvailabilityTime(netHits, secondaryValue);

    message.reply((parsedRollString ? 'Rolled ' + parsedRollString + ' for ' : 'item is ') + '**' + (availTime.available ? '' : 'un') + 'available** ' + (availTime.available ? 'in ' + availTime.string : '')
        + ' ('
        + '**' + roll1.hits + '** hit' + (roll1.hits == 1 ? '' : 's') + ' (' + roll1.roll + (roll1.limitUsed == true ? '; limit ' + roll1.limit + ' exceeded' : '') + ')'
        + ' vs '
        + '**' + roll2.hits + '** hit' + (roll2.hits == 1 ? '' : 's') + ' (' + roll2.roll + (roll2.limitUsed == true ? '; limit ' + roll2.limit + ' exceeded' : '') + ')'
        + ')');
}

function getAvailabilityTime(netHits, value) {
    let baseTime = null;
    if (!value) { }
    else if (value > 100000) { baseTime = 28 }
    else if (value > 10000) { baseTime = 7 }
    else if (value > 1000) { baseTime = 2 }
    else if (value > 100) { baseTime = 1 }
    else { baseTime = 0.25 };

    let timeFactor = 2;
    if (netHits < 0) { timeFactor = -1 }
    else if (netHits > 0) { timeFactor = 1 / netHits }

    let totalTime = null;
    if (baseTime && timeFactor) { totalTime = baseTime * timeFactor }

    let timeString = 'unavailable';
    if (!totalTime) {
        if (netHits == 0) { timeString = 'twice the base time' }
        else if (netHits == 1) { timeString = 'the base time' }
        else if (netHits == 2) { timeString = 'half the base time' }
        else if (netHits == 3) { timeString = 'a third of the base time' }
        else if (netHits == 4) { timeString = 'a quarter of the base time' }
        else if (netHits == 5) { timeString = 'a fifth of the base time' }
        else if (netHits > 5) { timeString = '1/' + netHits + ' of the base time' }
    } else {
        if (totalTime > 0) {
            timeString = '';
            remTime = totalTime;
            let firstString = true;
            if (remTime >= 28) {
                timeString += (firstString ? '' : ', ') + Math.floor(remTime / 28) + ' month' + (Math.floor(remTime / 28) > 1 ? 's' : '');
                remTime = remTime % 28;
                firstString = false;
            }
            if (remTime >= 7) {
                timeString += (firstString ? '' : ', ') + Math.floor(remTime / 7) + ' week' + (Math.floor(remTime / 7) > 1 ? 's' : '');
                remTime = remTime % 7;
                firstString = false;
            }
            if (remTime >= 1) {
                timeString += (firstString ? '' : ', ') + Math.floor(remTime) + ' day' + (Math.floor(remTime) > 1 ? 's' : '');
                remTime = remTime % 1;
                firstString = false;
            }
            if (remTime >= 1 / 24) {
                timeString += (firstString ? '' : ', ') + Math.floor(remTime * 24) + ' hour' + (Math.floor(remTime * 24) > 1 ? 's' : '');
                remTime = remTime % (1 / 24);
                firstString = false;
            }
            if (remTime >= 1e-4) {
                timeString += (firstString ? '' : ', ') + Math.floor(remTime * 24 * 60) + ' minute' + (Math.floor(remTime * 24 * 60) > 1 ? 's' : '');
                firstString = false;
            }
        }
    }

    let result = { 'factor': timeFactor, 'total': totalTime, 'string': timeString, 'available': timeFactor > 0 }
    return result;
}

function doInitiativeRoll(message) {
    // Check if user has a stored character
    if (!hasCharacter(message)) {
        message.reply('you must load a character before using initiative rolls.');
        return
    }

    // Get the generalized content
    let rollParts = reInitiativeRoll.exec(message.content);
    let initType = stringCondenseLower((rollParts[1]) ? rollParts[1] : 'meat');
    let bonusDice = parseInt(rollParts[2] + rollParts[3]) ? parseInt(rollParts[2] + rollParts[3]) : 0;
    let bonusMod = parseInt(rollParts[4] + rollParts[5]) ? parseInt(rollParts[4] + rollParts[5]) : 0;
    let characterData = getCharacterData(message);
    let baseDice = characterData.initiative[initType].dice;
    let baseMod = characterData.initiative[initType].base;

    let totalDice = Math.max(0, Math.min(5, baseDice + bonusDice));

    let dc = new DiceCode(totalDice, false, null, null);
    let roll = rollDice(dc);

    let totalMod = baseMod + bonusMod;
    let result = totalMod + roll.sum;

    message.reply('rolled **' + initType + ' initiative** for **' + result + '** (' + roll.roll + '; ' + (totalMod < 0 ? totalMod : '+' + totalMod) + ')');
}

function parseRollString(message, rollString, testType) {
    let stats = {
        'valid': false,
        'dice': null,
        'edge': 0
    }

    // Special case: availability test with blank rollstring. Handle as regular negotiation
    if (testType == 'a' && rollString == '') {
        rollString = 'negotiation';
    }

    /* 
    This shall go through the roll string and determine:
        Is this a valid roll string?
        How many dice should be used?
        Is it a skill test with an assosciated limit?
        If a character is loaded, what is the character's edge?
    */

    // To validate the roll string, find all atomic parts of the roll string
    let reRollAtoms = /\s*[\+\-]?\s*[A-z0-9:]+/g;
    let rollParts = rollString.match(reRollAtoms);

    /*
     Go through the atomic parts and verify that either:
        1. It is a dice pool modifier (e.g. +5, -2);
        2. There is a character loaded and it as a skill;
        3. There is a character loaded and it as an attribute; or
        4. There is a character loaded and it as an additional character stat (e.g. armor)
    */

    let nSkills = 0;
    let nAttributes = 0;
    let nStats = 0;
    let nDice = 0;
    let charData = getCharacterData(message);

    for (var ii = 0; ii < rollParts.length; ii++) {
        // Get the current term in the roll string
        let term = rollParts[ii];

        // Check if a sign was used (if so, remove it), otherwise just it as positive
        let sign = 1;
        if (term.substr(0, 1) == '+') {
            term = term.substr(1);
        } else if (term.substr(0, 1) == '-') {
            term = term.substr(1);
            sign = -1;
        } else if (ii > 0) {
            message.reply('missing or invalid sign for term "' + term + '"');
            return stats;
        }

        // Check if the term is a number
        if (parseInt(term)) {
            nDice += sign * parseInt(term);
        }

        // Otherwise, is it a skill?
        else if (isSkill(term)) {
            // Validate
            if (!messageAssert(message, hasCharacter(message), 'you need to load a character to use skill rolls (skill "' + term + '" detected in roll)')) { return stats };
            // Count up number of skills and accumulate dice from rating
            nSkills += 1;
            let skill = charData.activeSkills[term];
            nDice += sign * Math.max(0, skill.totalDice - skill.attributeTotal);
        }

        // Otherwise, is it an attribute?
        else if (isAttribute(term)) {
            if (!messageAssert(message, hasCharacter(message), 'you need to load a character to use attribute rolls (attribute "' + term + '" detected in roll)')) { return stats };
            nAttributes += 1;
            nDice += sign * charData.attributes[attributeMap[term]].totalValue;
        }

        // Otherwise, is it an additional character statistic?
        else if (isAdditionalCharacterStat(term)) {
            stats.missingCharacter = !hasCharacter(message);
            if (!messageAssert(message, hasCharacter(message), 'you need to load a character to use character statistic rolls (statistic "' + term + '" detected in roll)')) { return stats };
            nStats += 1;
            // TODO: Load additional statistics
            nDice += sign * 0;
        }

        // Otherwise, invalid
        else {
            message.reply('did not recognize the term "' + term + '" as an accessible character statistic');
            return stats;
        }
    }

    // Special case: skill only roll.
    if (nSkills == 1 && nAttributes == 0 && nStats == 0) {
        // Reset and go through the terms again
        nDice = 0;
        for (var ii = 0; ii < rollParts.length; ii++) {
            // Get the current term in the roll string
            let term = rollParts[ii];

            // Check if a sign was used (if so, remove it), otherwise just it as positive
            let sign = 1;
            if (term.substr(0, 1) == '+') {
                term = term.substr(1);
            } else if (term.substr(0, 1) == '-') {
                term = term.substr(1);
                sign = -1;
            }

            // If it is a static modifier, include it
            if (parseInt(term)) {
                nDice += sign * parseInt(term);
            }

            // If it is the skill, adjust by its total dice instead of just its rating
            else if (isSkill(term)) {
                let skill = charData.activeSkills[term];
                nDice += sign * Math.max(0, skill.totalDice);
            }

            // If it is anything else, error
            else {
                return stats;
            }
        }
    }

    stats.edge = (nSkills > 0 || nAttributes > 0) ? getCharacterData(message).attributes['EDG'].totalValue : 0;
    stats.dice = Math.max(0, nDice);
    stats.valid = true;

    return stats;
}

/*
####################################################################################
#
# Chat log cleaning
#
####################################################################################
*/
function nuke(message, abortListener) {
    if (!abortListener.ended) {
        message.channel.fetchMessages({ limit: 3 })
            .then(function (messages) { return messages })
            .then(messages => {
                let promises = [];
                let index = 0;
                messages.forEach(function (value, key, map) {
                    promises[index++] = messages.get(key).delete()
                });
                if (index > 0) {
                    // Messages remain to be deleted
                    Promise.all(promises)
                        .then(function (obj) {
                            message.channel.fetchMessages({ limit: 1 })
                                .then(messages => {
                                    messages.forEach(function (value, key, map) {
                                        nuke(messages.get(key), abortListener);;
                                    });
                                });
                        });
                } else {
                    // Nuke completed

                }
            });
    }
}

function doCleanAll(message) {
    let botCanManage = message.channel.guild.members.get(client.user.id).hasPermission('MANAGE_MESSAGES');
    let userCanManage = message.channel.guild.members.get(message.author.id).hasPermission('MANAGE_MESSAGES');

    if (!userCanManage) {
        message.reply('you need message management permissions to use the [nuke] command')
    } else if (!botCanManage) {
        message.reply('I need message management permissions to [nuke] for you')
    } else {
        // Ask for confirmation
        message.reply('are you sure you want to [nuke] the channel messages? [y/n]')
        awaitingConfirmation[message.author.id] = 'nuke';
        let confirmationListener = new Discord.MessageCollector(message.channel, function (newmsg) { return newmsg.author.id == message.author.id }, { max: 50, maxMatches: 1 });

        // Check the first message
        confirmationListener.on('collect', function (collectedMessage) {
            // Nuke confirmed if matching the confirmation pattern
            if (reConfirm.test(collectedMessage.content)) {
                // Inform the user
                let timeout = 30 * 1000;
                message.reply('the [nuke] will begin in ' + Math.round(timeout / 1000) + ' seconds. Any user with message management permissions can stop it by using [stop], but if it has started then any already deleted messaged are lost.')

                // Set up abort sequence listener
                let abortListener = new Discord.MessageCollector(message.channel, function (newmsg) {
                    let userCanManage = newmsg.channel.guild.members.get(newmsg.author.id).hasPermission('MANAGE_MESSAGES');
                    return userCanManage && reStop.test(newmsg.content);
                }, { maxMatches: 1 })

                // Set up the nuke countdown listener
                let countdownListener = new Discord.MessageCollector(message.channel, function () { return false }, { time: timeout });

                // If nuke countdown triggers on time, start the nuking procedure, checking the abort listener for it ending
                countdownListener.on('end', function (lastMessage, reason) {
                    if (reason == 'time') {
                        nuke(message, abortListener);
                    }
                });

                // If the abort listener collects a message, stop the countdown as aborted
                abortListener.on('collect', function (collectedMessage) {
                    message.reply('the ' + (countdownListener.ended ? 'ongoing ' : '') + '[nuke] was ' + (countdownListener.ended ? 'stopped' : 'aborted') + '.')
                    countdownListener.stop('aborted');
                });

            }

            // Nuke rejected if anything else
            else {
                message.reply('you aborted the [nuke]')
            }

            // In either case, mark as no longer awaiting confirmation
            delete awaitingConfirmation[message.author.id];
        });
    }
}

function doClean(message) {
    let botCanManage = message.channel.guild.members.get(client.user.id).hasPermission('MANAGE_MESSAGES');
    let userCanManage = message.channel.guild.members.get(message.author.id).hasPermission('MANAGE_MESSAGES');

    if (!userCanManage) {
        message.reply('you need message management permissions to use the [clean] command')
    } else if (!botCanManage) {
        message.reply('I need message management permissions to [clean] for you')
    } else {
        let nCleanMax = 50;
        let nClean = reClean.exec(message);
        nClean = nClean[1] ? nClean[1] : 10;
        nClean = Math.min(nCleanMax, nClean);
        nClean += nClean > 0 ? 1 : 0; // If cleaning anything, include the [clean X] message without counting it

        message.channel.fetchMessages({ limit: nClean })
            .then(messages => {
                messages.forEach(function (value, key, map) {
                    messages.get(key).delete()
                        .catch(console.error);
                });
            });
    }
}

/*
####################################################################################
#
# Character loading / unloading
#
####################################################################################
*/
function doLoadCharacter(message) {
    var res = reGetChar.exec(message.content);
    var pastebinId = res[1];
    PastebinAPI.get(pastebinId, function (success, data) {
        if (!success) {
            message.reply('failed to load character from paste ' + pastebinId);
        } else {
            parseString(data, function (err, result) {
                doStoreCharacter(message, result, pastebinId);
            });
        }
    })
    /*
    pastebin
        .getPaste(pastebinId)
        .then(function (data) {
            parseString(data,function (err, result) {
                doStoreCharacter(message, result, pastebinId);
            });
        })
        .fail(function (err) {
            console.log(err);
            message.reply('failed to load character from paste ' + pastebinId);
        });
    */
}

function doUnloadCharacter(message) {
    if (!hasCharacter(message)) {
        message.reply('you have no active character to unload');
        return
    }
    let alias = getCharacterAlias(message);
    message.reply('unloaded ' + (alias ? '"' + alias + '"' : 'character with no alias'));
    delete dataMap[message.author.id][message.channel.id].character[alias];
    saveData(message);
}

function doCheckCharacter(message) {
    let authorId = message.author.id;
    let channelId = message.channel.id;

    let str = 'no character found';
    let alias = getCharacterAlias(message);
    str = !hasCharacter(message) ? str : (alias ? 'alias "' + alias + '"' : 'character with no alias') + ' found';
    message.reply(str);
}

function doStoreCharacter(message, chummerJson, pastebinId) {
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
        let skillName = skillTable[activeSkillJson[id].suid].name;
        activeSkills[skillName] = {};
        activeSkills[skillName].base = parseInt(activeSkillJson[id].base[0]);
        activeSkills[skillName].karma = parseInt(activeSkillJson[id].karma[0]);

        // Get any related skill group effects
        activeSkills[skillName].groupName = skillTable[activeSkillJson[id].suid].group;

        if (activeSkills[skillName].groupName) {
            activeSkills[skillName].groupBase = skillGroup[activeSkills[skillName].groupName].base;
            activeSkills[skillName].groupKarma = skillGroup[activeSkills[skillName].groupName].karma;
        } else {
            activeSkills[skillName].groupBase = 0;
            activeSkills[skillName].groupKarma = 0;
        }

        // Get any related attribute effects
        activeSkills[skillName].attributeName = skillTable[activeSkillJson[id].suid].attribute;;
        activeSkills[skillName].attributeTotal = attributes[activeSkills[skillName].attributeName].totalValue;

        // Get defaulting status
        activeSkills[skillName].default = skillTable[activeSkillJson[id].suid].default;

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
        'owner': message.author.id,
        'channel': message.channel.id,
        'initiative': initiative,
        'attributes': attributes,
        'activeSkills': activeSkills,
    }

    // Export to pastebin
    /*
    Paste privacy:
        0 = Public, anonymous
        1 = Unlisted, anonymous
        2 = Private, user
        3 = Public, user
    */
    /*
    let pasteText = JSON.stringify(charData, null, 2);
    let pasteTitle = "pastebin-js";
    let pasteFormat = null;
    let pastePrivacy = 1;
    let pasteExpiration = '10M';

    pastebin
        .createPaste(
            pasteText, 
            pasteTitle, 
            pasteFormat, 
            pastePrivacy, 
            pasteExpiration
        )
        .then(function (data) {
            // paste succesfully created, data contains the id 
            message.reply('Character data stored in temporary paste at ' + data)
        })
        .fail(function (err) {
            // Something went wrong 
            console.log(err);
        });
    */

    // Assign the character data to the user and channel
    ensureUserHasData(charData.owner, charData.channel);
    dataMap[charData.owner][charData.channel].character[charData.alias] = charData;
    dataMap[charData.owner][charData.channel].currentAlias = charData.alias;

    message.reply('loaded ' + (chummerJson.character.alias[0] ? '"' + chummerJson.character.alias[0] + '" ' : 'character without alias ') + 'from paste ' + pastebinId);
    saveData(message);
}

/*
####################################################################################
#
# Utility functions
#
####################################################################################
*/
function isSkill(str) {
    let parsedStr = stringCondenseLower(str);
    var flag = false;
    Object.keys(skillTable).forEach(function (id) {
        if (parsedStr == skillTable[id].name) {
            flag = true;
        }
    });
    return flag;
}

function isAttribute(str) {
    return reIsAttribute.test(str);
}

function isAdditionalCharacterStat(str) {
    return reIsAdditionalCharacterStat.test(str);
}

function stringCondenseLower(str) {
    return str.replace(/ /g, '').toLowerCase();
}

function hasCharacter(message) {
    if (!(message.author.id in dataMap)) { return false };
    if (!(message.channel.id in dataMap[message.author.id])) { return false };
    let userData = dataMap[message.author.id][message.channel.id];
    if (!('currentAlias' in userData)) { return false };
    if (!(userData.currentAlias in userData.character)) { return false };
    return true;
}

function messageAssert(message, condition, str) {
    if (!condition) {
        message.reply(str);
    }
    return condition;
}

function DiceCode(dice, limit, pushTheLimit, edgeDice) {
    this.dice = dice;
    this.limit = null;
    this.ruleOfSix = null;
    if (limit && !pushTheLimit) {
        this.limit = limit;
    }
    if (pushTheLimit) {
        this.ruleOfSix = pushTheLimit;
        if (edgeDice) {
            this.dice += edgeDice;
        }
    }
}

function rollDice(dc) {
    var roll = new Array(dc.dice);
    var hits = 0;
    var additionalDice = 0;
    var rollSum = 0;
    for (var iDice = 0; iDice < parseInt(dc.dice) + additionalDice; iDice++) {
        roll[iDice] = getRandomInt(1, 6);
        hits += roll[iDice] >= 5 ? 1 : 0;
        rollSum += roll[iDice];
        if (roll[iDice] == 6 && dc.ruleOfSix) {
            additionalDice += 1;
        }
    }

    var result = [];
    result.limit = dc.limit;
    result.limitUsed = (hits > dc.limit && dc.limit) ? true : false;
    result.hits = result.limitUsed ? dc.limit : hits;
    result.roll = roll;
    result.sum = rollSum;

    return result;
}

function currentDateTime() {
    return moment().format('YYYY-MM-DD hh:mm:ss')
}

function getCharacterAlias(message) {
    let authorId = message.author.id;
    let channelId = message.channel.id;
    // TODO: Check content of message for overriding alias definition
    if (!(authorId in dataMap)) { return false };
    if (!(channelId in dataMap[authorId])) { return false };
    return dataMap[authorId][channelId].currentAlias;
}

function getCharacterData(message) {
    let authorId = message.author.id;
    let channelId = message.channel.id;
    let alias = getCharacterAlias(message);
    if (alias === false) { return {} };
    if (!(alias in dataMap[authorId][channelId].character)) { return {} }
    return dataMap[authorId][channelId].character[alias];
}

function ensureUserHasData(owner, channel, alias) {
    if (!(owner in dataMap)) { dataMap[owner] = {} };
    if (!(channel in dataMap[owner])) { dataMap[owner][channel] = {} };
    let userData = dataMap[owner][channel];
    if (!('currentAlias' in userData)) { dataMap[owner][channel].currentAlias = false };
    if (!('character' in userData)) { dataMap[owner][channel].character = {} };
    if (!('macro' in userData)) { dataMap[owner][channel].macro = {} };
}

function getUserMacros(message) {
    if (!(message.author.id) in dataMap) { return {} };
    if (!(message.channel.id) in dataMap[message.author.id]) { return {} };
    return dataMap[message.author.id][message.channel.id].macro;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
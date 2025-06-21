const { Client, GatewayIntentBits, Partials, Events, REST, Routes } = require('discord.js');
require('dotenv').config();
const commands = require('./commands/commands');
const { loadContractMessageInfo } = require('./utils/contractHelpers');
const { handleCompleteButton } = require('./handlers/buttonHandlers');
const { 
    handleClaimCommand,
    handleCompleteCommand,
    handleAddTaskCommand,
    handleSetupContractsCommand,
    handleReopenCommand,
    handleAddFieldCommand,
    handleDeleteFieldCommand,
    handleDeleteTaskCommand,
    handleCancelCommand
} = require('./handlers/commandHandlers');
const { handleAutocomplete } = require('./handlers/autocompleteHandlers');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const PAYOUT_ROLE_ID = process.env.PAYOUT_ROLE_ID;
const CONTRACT_CHANNEL_ID = process.env.CONTRACT_CHANNEL_ID;

let contractMessageId = null;
let contractMessageChannelId = null;

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    // Register slash commands for the guilds the bot is in
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    const guilds = client.guilds.cache.map(g => g.id);
    for (const guildId of guilds) {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, guildId),
            { body: commands }
        );
    }
    // Load contract message info
    const info = loadContractMessageInfo();
    if (info) {
        contractMessageId = info.messageId;
        contractMessageChannelId = info.channelId;
    }
});

client.on(Events.InteractionCreate, async interaction => {
    
    // Handle button interactions
    if (interaction.isButton() && interaction.customId.startsWith('complete_private_')) {
        const result = await handleCompleteButton(interaction, PAYOUT_ROLE_ID, CONTRACT_CHANNEL_ID, contractMessageId, contractMessageChannelId);
        contractMessageId = result.contractMessageId;
        contractMessageChannelId = result.contractMessageChannelId;
        return;
    }

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        let result;

        switch (commandName) {
            case 'claim':
                result = await handleClaimCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
                break;
            case 'complete':
                result = await handleCompleteCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID, PAYOUT_ROLE_ID);
                break;
            case 'addtask':
                result = await handleAddTaskCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
                break;
            case 'setupcontracts':
                result = await handleSetupContractsCommand(interaction, contractMessageId, contractMessageChannelId);
                break;
            case 'reopen':
                result = await handleReopenCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
                break;
            case 'addfield':
                result = await handleAddFieldCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
                break;
            case 'deletefield':
                result = await handleDeleteFieldCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
                break;
            case 'deletetask':
                result = await handleDeleteTaskCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
                break;
            case 'cancel':
                result = await handleCancelCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
                break;
        }

        if (result) {
            contractMessageId = result.contractMessageId;
            contractMessageChannelId = result.contractMessageChannelId;
        }
        return;
    }

    // Handle autocomplete
    if (interaction.isAutocomplete()) {
        await handleAutocomplete(interaction);
        return;
    }
});

client.login(process.env.BOT_TOKEN); 
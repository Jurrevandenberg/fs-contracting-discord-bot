const { Client, GatewayIntentBits, Partials, Collection, Events, REST, Routes, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

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

const CONTRACTS_FILE = './contracts.json';
const PAYOUT_ROLE_ID = process.env.PAYOUT_ROLE_ID;
const CONTRACT_CHANNEL_ID = process.env.CONTRACT_CHANNEL_ID;
let contractMessageId = null; // Will store the message ID of the contract list

// Helper to read contracts
function readContracts() {
    if (!fs.existsSync(CONTRACTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(CONTRACTS_FILE, 'utf8'));
}

// Helper to write contracts
function writeContracts(contracts) {
    fs.writeFileSync(CONTRACTS_FILE, JSON.stringify(contracts, null, 2));
}

// Helper to build the contract list embed (modern, compact, table-like UX)
function buildContractEmbed(contracts, userId = null) {
    const embed = new EmbedBuilder()
        .setTitle('Farming Simulator Contracts')
        .setDescription('**Legend:** 🟢 Available | 🟡 Claimed | ✅ Completed\nOne contract task per farm at a time.')
        .setColor(0x4caf50)
        .setTimestamp();
    contracts.forEach((contract, cIdx) => {
        let lines = [];
        contract.tasks.forEach((task, idx) => {
            let status = task.status === 'available' ? '🟢' : task.status === 'claimed' ? '🟡' : '✅';
            let reward = `**${task.reward.toLocaleString()} €**`;
            let claimed = (task.status === 'claimed' && task.claimedBy) ? ` (claimed by <@${task.claimedBy}>)` : '';
            lines.push(`${status} **${task.name}** — ${reward}${claimed}`);
            // Add a blank line after each task except the last
            if (idx < contract.tasks.length - 1) {
                lines.push('');
            }
        });
        let value = lines.join('\n');
        // Add extra space after each field except the last
        if (cIdx < contracts.length - 1) {
            value += '\n\u200B';
        }
        embed.addFields({
            name: `Field ${contract.field} (${contract.area}ha)`,
            value: value
        });
    });
    return embed;
}

// Helper to update the contract list message
async function updateContractMessage(guild, userId = null) {
    const contracts = readContracts();
    const channel = await guild.channels.fetch(CONTRACT_CHANNEL_ID);
    if (!channel) return;
    let message;
    if (contractMessageId) {
        try {
            message = await channel.messages.fetch(contractMessageId);
            await message.edit({ embeds: [buildContractEmbed(contracts, userId)], components: buildContractButtons(contracts, userId) });
        } catch (e) {
            // If message not found, send a new one
            message = await channel.send({ embeds: [buildContractEmbed(contracts, userId)], components: buildContractButtons(contracts, userId) });
            contractMessageId = message.id;
        }
    } else {
        message = await channel.send({ embeds: [buildContractEmbed(contracts, userId)], components: buildContractButtons(contracts, userId) });
        contractMessageId = message.id;
    }
}

// Helper to build contract buttons (single dropdown for all available tasks, complete buttons for claimed)
function buildContractButtons(contracts, userId = null) {
    const rows = [];
    // Only show 'Complete' buttons for any tasks the user has claimed
    if (userId) {
        contracts.forEach((contract, cIdx) => {
            contract.tasks.forEach((task, tIdx) => {
                if (task.status === 'claimed' && task.claimedBy === userId) {
                    const button = new ButtonBuilder()
                        .setCustomId(`complete_${cIdx}_${tIdx}`)
                        .setLabel(`Complete: Field ${contract.field} - ${task.name}`)
                        .setStyle(ButtonStyle.Success);
                    rows.push(new ActionRowBuilder().addComponents(button));
                }
            });
        });
    }
    // Discord only allows up to 5 ActionRows per message
    return rows.slice(0, 5);
}

// Slash command registration
const commands = [
    {
        name: 'addcontract',
        description: 'Add a new contract field',
        options: [
            { name: 'field', type: 4, description: 'Field number', required: true },
            { name: 'area', type: 10, description: 'Area in hectares', required: true },
            { name: 'notes', type: 3, description: 'Notes (optional)', required: false }
        ]
    },
    {
        name: 'addtask',
        description: 'Add a task to a contract field',
        options: [
            { name: 'field', type: 4, description: 'Field number', required: true },
            { name: 'name', type: 3, description: 'Task name', required: true },
            { name: 'reward', type: 10, description: 'Reward in euros', required: true }
        ]
    },
    {
        name: 'setupcontracts',
        description: 'Post the contract list message in this channel',
        options: []
    },
    {
        name: 'claim',
        description: 'Claim an available contract task',
        options: [
            {
                name: 'field',
                type: 4, // INTEGER
                description: 'Field number',
                required: true,
                autocomplete: true
            },
            {
                name: 'task',
                type: 3, // STRING
                description: 'Task name',
                required: true,
                autocomplete: true
            }
        ]
    },
    {
        name: 'complete',
        description: 'Complete your currently claimed contract task',
        options: []
    }
];

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
});

client.on(Events.InteractionCreate, async interaction => {
    // Autocomplete for /claim field and task
    if (interaction.isAutocomplete()) {
        const focusedOption = interaction.options.getFocused(true);
        const contracts = readContracts();
        if (interaction.commandName === 'claim') {
            if (focusedOption.name === 'field') {
                // Suggest all fields with available tasks
                const choices = contracts.filter(c => c.tasks.some(t => t.status === 'available'));
                await interaction.respond(
                    choices.map(c => ({ name: `Field ${c.field}`, value: c.field })).slice(0, 25)
                );
            } else if (focusedOption.name === 'task') {
                const field = interaction.options.getInteger('field');
                const contract = contracts.find(c => c.field === field);
                if (!contract) return interaction.respond([]);
                const choices = contract.tasks
                    .map(t => t.status === 'available' ? t.name : null)
                    .filter(Boolean);
                await interaction.respond(
                    choices.map(name => ({ name, value: name })).slice(0, 25)
                );
            }
        }
        return;
    }

    // Handle slash commands
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;
        // Only allow users with MANAGE_GUILD permission
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }
        if (commandName === 'addcontract') {
            const field = interaction.options.getInteger('field');
            const area = interaction.options.getNumber('area');
            const notes = interaction.options.getString('notes') || '';
            let contracts = readContracts();
            if (contracts.find(c => c.field === field)) {
                await interaction.reply({ content: `Field ${field} already exists.`, ephemeral: true });
                return;
            }
            contracts.push({ field, area, notes, tasks: [] });
            writeContracts(contracts);
            await interaction.reply({ content: `Added contract for field ${field}.`, ephemeral: true });
            // Optionally update contract message
            if (interaction.guild) await updateContractMessage(interaction.guild);
        } else if (commandName === 'addtask') {
            const field = interaction.options.getInteger('field');
            const name = interaction.options.getString('name');
            const reward = interaction.options.getNumber('reward');
            let contracts = readContracts();
            const contract = contracts.find(c => c.field === field);
            if (!contract) {
                await interaction.reply({ content: `Field ${field} not found.`, ephemeral: true });
                return;
            }
            contract.tasks.push({ name, reward, status: 'available', claimedBy: null });
            writeContracts(contracts);
            await interaction.reply({ content: `Added task to field ${field}.`, ephemeral: true });
            if (interaction.guild) await updateContractMessage(interaction.guild);
        } else if (commandName === 'setupcontracts') {
            // Post the contract list message in this channel
            const contracts = readContracts();
            const message = await interaction.channel.send({ embeds: [buildContractEmbed(contracts)], components: buildContractButtons(contracts) });
            contractMessageId = message.id;
            await interaction.reply({ content: 'Contract list posted!', ephemeral: true });
        } else if (commandName === 'claim') {
            const field = interaction.options.getInteger('field');
            const taskName = interaction.options.getString('task');
            let contracts = readContracts();
            const contract = contracts.find(c => c.field === field);
            if (!contract) {
                await interaction.reply({ content: `Field ${field} not found.`, ephemeral: true });
                return;
            }
            const task = contract.tasks.find(t => t.name === taskName && t.status === 'available');
            if (!task) {
                await interaction.reply({ content: `Task not found or not available.`, ephemeral: true });
                return;
            }
            // Check if user already has a claimed task in any contract
            const alreadyClaimed = contracts.some(c => c.tasks.some(t => t.claimedBy === interaction.user.id && t.status === 'claimed'));
            if (alreadyClaimed) {
                await interaction.reply({ content: 'You already have a claimed contract task. Complete it before claiming another.', ephemeral: true });
                return;
            }
            task.status = 'claimed';
            task.claimedBy = interaction.user.id;
            writeContracts(contracts);
            if (interaction.guild) await updateContractMessage(interaction.guild, interaction.user.id);
            await interaction.reply({ content: `You have claimed: Field ${contract.field} - ${task.name}`, ephemeral: true });
            return;
        } else if (commandName === 'complete') {
            let contracts = readContracts();
            let found = false;
            for (const [cIdx, contract] of contracts.entries()) {
                for (const [tIdx, task] of contract.tasks.entries()) {
                    if (task.status === 'claimed' && task.claimedBy === interaction.user.id) {
                        task.status = 'completed';
                        task.claimedBy = null;
                        writeContracts(contracts);
                        if (interaction.guild) await updateContractMessage(interaction.guild, interaction.user.id);
                        // Notify payout role
                        const payoutRole = interaction.guild.roles.cache.get(PAYOUT_ROLE_ID);
                        const payoutMention = payoutRole ? `<@&${PAYOUT_ROLE_ID}>` : 'Payout team';
                        await interaction.reply({ content: `Task completed! ${payoutMention} please pay out for Field ${contract.field} - ${task.name} (${task.reward.toLocaleString()} €)`, allowedMentions: { roles: [PAYOUT_ROLE_ID] } });
                        found = true;
                        break;
                    }
                }
                if (found) break;
            }
            if (!found) {
                await interaction.reply({ content: 'You have no claimed contract task to complete.', ephemeral: true });
            }
            return;
        }
        return;
    }

    // Handle button interactions
    if (interaction.isButton()) {
        const [action, cIdx, tIdx] = interaction.customId.split('_');
        let contracts = readContracts();
        const contract = contracts[parseInt(cIdx)];
        if (!contract) {
            await interaction.reply({ content: 'Contract not found.', ephemeral: true });
            return;
        }
        const task = contract.tasks[parseInt(tIdx)];
        if (!task) {
            await interaction.reply({ content: 'Task not found.', ephemeral: true });
            return;
        }
        if (action === 'claim') {
            if (task.status !== 'available') {
                await interaction.reply({ content: 'This task is not available to claim.', ephemeral: true });
                return;
            }
            // Check if user already has a claimed task in any contract
            const alreadyClaimed = contracts.some(c => c.tasks.some(t => t.claimedBy === interaction.user.id && t.status === 'claimed'));
            if (alreadyClaimed) {
                await interaction.reply({ content: 'You already have a claimed contract task. Complete it before claiming another.', ephemeral: true });
                return;
            }
            task.status = 'claimed';
            task.claimedBy = interaction.user.id;
            writeContracts(contracts);
            if (interaction.guild) await updateContractMessage(interaction.guild, interaction.user.id);
            await interaction.reply({ content: `You have claimed: Field ${contract.field} - ${task.name}`, ephemeral: true });
        } else if (action === 'complete') {
            if (task.status !== 'claimed' || task.claimedBy !== interaction.user.id) {
                await interaction.reply({ content: 'You can only complete tasks you have claimed.', ephemeral: true });
                return;
            }
            task.status = 'completed';
            task.claimedBy = null;
            writeContracts(contracts);
            if (interaction.guild) await updateContractMessage(interaction.guild, interaction.user.id);
            // Notify payout role
            const payoutRole = interaction.guild.roles.cache.get(PAYOUT_ROLE_ID);
            const payoutMention = payoutRole ? `<@&${PAYOUT_ROLE_ID}>` : 'Payout team';
            await interaction.reply({ content: `Task completed! ${payoutMention} please pay out for Field ${contract.field} - ${task.name} (${task.reward.toLocaleString()} €)`, allowedMentions: { roles: [PAYOUT_ROLE_ID] } });
        } else {
            await interaction.reply({ content: 'This button is not active.', ephemeral: true });
        }
    }

    // Handle select menu interactions for claiming tasks (single dropdown for all fields)
    if (interaction.isStringSelectMenu()) {
        const [action, all] = interaction.customId.split('_');
        if (action !== 'claimselect') return;
        const [cIdx, tIdx] = interaction.values[0].split('_').map(Number);
        let contracts = readContracts();
        const contract = contracts[cIdx];
        if (!contract) {
            await interaction.reply({ content: 'Contract not found.', ephemeral: true });
            return;
        }
        const task = contract.tasks[tIdx];
        if (!task) {
            await interaction.reply({ content: 'Task not found.', ephemeral: true });
            return;
        }
        if (task.status !== 'available') {
            await interaction.reply({ content: 'This task is not available to claim.', ephemeral: true });
            return;
        }
        // Check if user already has a claimed task in any contract
        const alreadyClaimed = contracts.some(c => c.tasks.some(t => t.claimedBy === interaction.user.id && t.status === 'claimed'));
        if (alreadyClaimed) {
            await interaction.reply({ content: 'You already have a claimed contract task. Complete it before claiming another.', ephemeral: true });
            return;
        }
        task.status = 'claimed';
        task.claimedBy = interaction.user.id;
        writeContracts(contracts);
        if (interaction.guild) await updateContractMessage(interaction.guild, interaction.user.id);
        await interaction.reply({ content: `You have claimed: Field ${contract.field} - ${task.name}`, ephemeral: true });
        return;
    }
});

client.login(process.env.BOT_TOKEN); 
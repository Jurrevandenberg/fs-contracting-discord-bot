const { PermissionsBitField } = require('discord.js');
const { readContracts, writeContracts, saveContractMessageInfo } = require('../utils/contractHelpers');
const { updateContractMessage } = require('../utils/messageHelpers');
const { buildContractEmbed, buildContractButtons, createCompleteButton } = require('../utils/embedHelpers');

async function handleClaimCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID) {
    const field = interaction.options.getInteger('field');
    const taskName = interaction.options.getString('task');
    let contracts = readContracts();
    const cIdx = contracts.findIndex(c => c.field === field);
    const contract = contracts[cIdx];
    if (!contract) {
        await interaction.reply({ content: `Field ${field} not found.`, ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    const tIdx = contract.tasks.findIndex(t => t.name === taskName && t.status === 'available');
    const task = contract.tasks[tIdx];
    if (!task) {
        await interaction.reply({ content: `Task not found or not available.`, ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    // Check if user already has a claimed task in any contract
    const alreadyClaimed = contracts.some(c => c.tasks.some(t => t.claimedBy === interaction.user.id && t.status === 'claimed'));
    if (alreadyClaimed) {
        await interaction.reply({ content: 'You already have a claimed contract task. Complete it before claiming another.', ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    task.status = 'claimed';
    task.claimedBy = interaction.user.id;
    writeContracts(contracts);
    
    if (interaction.guild) {
        const result = await updateContractMessage(interaction.guild, interaction.user.id, null, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
        contractMessageId = result.contractMessageId;
        contractMessageChannelId = result.contractMessageChannelId;
    }
    
    // Send ephemeral message with 'Complete' button using indices
    const row = createCompleteButton(cIdx, tIdx, contract, task);
    await interaction.reply({
        content: `You have claimed: Field ${contract.field} - ${task.name}`,
        components: [row],
        ephemeral: true
    });
    
    return { contractMessageId, contractMessageChannelId };
}

async function handleCompleteCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID, PAYOUT_ROLE_ID) {
    let contracts = readContracts();
    let found = false;
    for (const [cIdx, contract] of contracts.entries()) {
        for (const [tIdx, task] of contract.tasks.entries()) {
            if (task.status === 'claimed' && task.claimedBy === interaction.user.id) {
                task.status = 'completed';
                task.completedBy = interaction.user.id;
                task.claimedBy = null;
                writeContracts(contracts);
                
                if (interaction.guild) {
                    const result = await updateContractMessage(interaction.guild, interaction.user.id, interaction.guild, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
                    contractMessageId = result.contractMessageId;
                    contractMessageChannelId = result.contractMessageChannelId;
                }
                
                // Notify payout role, include user mention
                const payoutRole = interaction.guild.roles.cache.get(PAYOUT_ROLE_ID);
                const payoutMention = payoutRole ? `<@&${PAYOUT_ROLE_ID}>` : 'Payout team';
                
                // Send completion message to the contract channel instead of as ephemeral
                const channel = await interaction.guild.channels.fetch(CONTRACT_CHANNEL_ID);
                if (channel) {
                    await channel.send({ 
                        content: `Task completed by <@${interaction.user.id}>! ${payoutMention} please pay out for Field ${contract.field} - ${task.name} (${task.reward.toLocaleString()} €)`, 
                        allowedMentions: { roles: [PAYOUT_ROLE_ID], users: [interaction.user.id] }
                    });
                }
                
                found = true;
                break;
            }
        }
        if (found) break;
    }
    if (!found) {
        await interaction.reply({ content: 'You have no claimed contract task to complete.', ephemeral: true });
    }
    
    return { contractMessageId, contractMessageChannelId };
}

async function handleAddTaskCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }

    const field = interaction.options.getInteger('field');
    const name = interaction.options.getString('name');
    const reward = interaction.options.getNumber('reward');
    let contracts = readContracts();
    const contract = contracts.find(c => c.field === field);
    if (!contract) {
        await interaction.reply({ content: `Field ${field} not found.`, ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    contract.tasks.push({ name, reward, status: 'available', claimedBy: null });
    writeContracts(contracts);
    await interaction.reply({ content: `Added task to field ${field}.`, ephemeral: true });
    
    if (interaction.guild) {
        const result = await updateContractMessage(interaction.guild, null, null, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
        contractMessageId = result.contractMessageId;
        contractMessageChannelId = result.contractMessageChannelId;
    }
    
    return { contractMessageId, contractMessageChannelId };
}

async function handleSetupContractsCommand(interaction, contractMessageId, contractMessageChannelId) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }

    // Post the contract list message in this channel
    const contracts = readContracts();
    const message = await interaction.channel.send({ embeds: [buildContractEmbed(contracts)], components: buildContractButtons(contracts) });
    contractMessageId = message.id;
    contractMessageChannelId = interaction.channel.id;
    saveContractMessageInfo(interaction.channel.id, message.id);
    await interaction.reply({ content: 'Contract list posted!', ephemeral: true });
    
    return { contractMessageId, contractMessageChannelId };
}

async function handleReopenCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    const field = interaction.options.getInteger('field');
    const taskName = interaction.options.getString('task');
    let contracts = readContracts();
    const contract = contracts.find(c => c.field === field);
    if (!contract) {
        await interaction.reply({ content: `Field ${field} not found.`, ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    const task = contract.tasks.find(t => t.name === taskName && t.status === 'completed');
    if (!task) {
        await interaction.reply({ content: `Task not found or not completed.`, ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    task.status = 'available';
    task.claimedBy = null;
    task.completedBy = null;
    writeContracts(contracts);
    
    if (interaction.guild) {
        const result = await updateContractMessage(interaction.guild, null, null, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
        contractMessageId = result.contractMessageId;
        contractMessageChannelId = result.contractMessageChannelId;
    }
    
    await interaction.reply({ content: `Task reopened: Field ${contract.field} - ${task.name}`, ephemeral: true });
    
    return { contractMessageId, contractMessageChannelId };
}

async function handleAddFieldCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    const field = interaction.options.getInteger('field');
    const area = interaction.options.getNumber('area');
    const notes = interaction.options.getString('notes') || '';
    let contracts = readContracts();
    if (contracts.find(c => c.field === field)) {
        await interaction.reply({ content: `Field ${field} already exists.`, ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    contracts.push({ field, area, notes, tasks: [] });
    writeContracts(contracts);
    
    if (interaction.guild) {
        const result = await updateContractMessage(interaction.guild, null, null, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
        contractMessageId = result.contractMessageId;
        contractMessageChannelId = result.contractMessageChannelId;
    }
    
    await interaction.reply({ content: `Added contract field ${field}.`, ephemeral: true });
    
    return { contractMessageId, contractMessageChannelId };
}

async function handleDeleteFieldCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    const field = interaction.options.getInteger('field');
    let contracts = readContracts();
    const idx = contracts.findIndex(c => c.field === field);
    if (idx === -1) {
        await interaction.reply({ content: `Field ${field} not found.`, ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    contracts.splice(idx, 1);
    writeContracts(contracts);
    
    if (interaction.guild) {
        const result = await updateContractMessage(interaction.guild, null, null, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
        contractMessageId = result.contractMessageId;
        contractMessageChannelId = result.contractMessageChannelId;
    }
    
    await interaction.reply({ content: `Deleted field ${field}.`, ephemeral: true });
    
    return { contractMessageId, contractMessageChannelId };
}

async function handleDeleteTaskCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID) {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    const field = interaction.options.getInteger('field');
    const name = interaction.options.getString('name');
    let contracts = readContracts();
    const contract = contracts.find(c => c.field === field);
    if (!contract) {
        await interaction.reply({ content: `Field ${field} not found.`, ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    const idx = contract.tasks.findIndex(t => t.name === name);
    if (idx === -1) {
        await interaction.reply({ content: `Task '${name}' not found in field ${field}.`, ephemeral: true });
        return { contractMessageId, contractMessageChannelId };
    }
    contract.tasks.splice(idx, 1);
    writeContracts(contracts);
    
    if (interaction.guild) {
        const result = await updateContractMessage(interaction.guild, null, null, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
        contractMessageId = result.contractMessageId;
        contractMessageChannelId = result.contractMessageChannelId;
    }
    
    await interaction.reply({ content: `Deleted task '${name}' from field ${field}.`, ephemeral: true });
    
    return { contractMessageId, contractMessageChannelId };
}

async function handleCancelCommand(interaction, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID) {
    let contracts = readContracts();
    let found = false;
    for (const [cIdx, contract] of contracts.entries()) {
        for (const [tIdx, task] of contract.tasks.entries()) {
            if (task.status === 'claimed' && task.claimedBy === interaction.user.id) {
                task.status = 'available';
                task.claimedBy = null;
                writeContracts(contracts);
                
                if (interaction.guild) {
                    const result = await updateContractMessage(interaction.guild, interaction.user.id, null, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
                    contractMessageId = result.contractMessageId;
                    contractMessageChannelId = result.contractMessageChannelId;
                }
                
                await interaction.reply({ content: `You have cancelled your claim for Field ${contract.field} - ${task.name}.`, ephemeral: true });
                found = true;
                break;
            }
        }
        if (found) break;
    }
    if (!found) {
        await interaction.reply({ content: 'You have no claimed contract task to cancel.', ephemeral: true });
    }
    
    return { contractMessageId, contractMessageChannelId };
}

module.exports = {
    handleClaimCommand,
    handleCompleteCommand,
    handleAddTaskCommand,
    handleSetupContractsCommand,
    handleReopenCommand,
    handleAddFieldCommand,
    handleDeleteFieldCommand,
    handleDeleteTaskCommand,
    handleCancelCommand
}; 
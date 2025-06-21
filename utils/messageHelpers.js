const { readContracts, saveContractMessageInfo } = require('./contractHelpers');
const { buildContractEmbed, buildContractButtons } = require('./embedHelpers');

// Helper to update the contract list message
async function updateContractMessage(guild, userId = null, guildForEmbed = null, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID) {
    const contracts = readContracts();
    let channel;
    if (contractMessageChannelId) {
        try {
            channel = await guild.channels.fetch(contractMessageChannelId);
        } catch {
            channel = await guild.channels.fetch(CONTRACT_CHANNEL_ID);
        }
    } else {
        channel = await guild.channels.fetch(CONTRACT_CHANNEL_ID);
    }
    if (!channel) return { contractMessageId, contractMessageChannelId };
    
    let message;
    if (contractMessageId) {
        try {
            message = await channel.messages.fetch(contractMessageId);
            await message.edit({ embeds: [buildContractEmbed(contracts, userId, guildForEmbed)], components: buildContractButtons(contracts, userId) });
        } catch (e) {
            // If message not found, send a new one
            message = await channel.send({ embeds: [buildContractEmbed(contracts, userId, guildForEmbed)], components: buildContractButtons(contracts, userId) });
            contractMessageId = message.id;
            contractMessageChannelId = channel.id;
            saveContractMessageInfo(channel.id, message.id);
        }
    } else {
        message = await channel.send({ embeds: [buildContractEmbed(contracts, userId, guildForEmbed)], components: buildContractButtons(contracts, userId) });
        contractMessageId = message.id;
        contractMessageChannelId = channel.id;
        saveContractMessageInfo(channel.id, message.id);
    }
    
    return { contractMessageId, contractMessageChannelId };
}

module.exports = {
    updateContractMessage
}; 
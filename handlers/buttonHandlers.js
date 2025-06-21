const { readContracts, writeContracts } = require('../utils/contractHelpers');
const { updateContractMessage } = require('../utils/messageHelpers');

async function handleCompleteButton(interaction, PAYOUT_ROLE_ID, CONTRACT_CHANNEL_ID, contractMessageId, contractMessageChannelId) {
    try {
        const [, , cIdx, tIdx] = interaction.customId.split('_');
        let contracts = readContracts();
        const contract = contracts[parseInt(cIdx)];

        if (!contract) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Contract not found.', ephemeral: true });
            }
            return { contractMessageId, contractMessageChannelId };
        }

        const task = contract.tasks[parseInt(tIdx)];
        if (!task || task.status !== 'claimed' || task.claimedBy !== interaction.user.id) {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'You can only complete tasks you have claimed.', ephemeral: true });
            }
            return { contractMessageId, contractMessageChannelId };
        }

        task.status = 'completed';
        task.completedBy = interaction.user.id;
        task.claimedBy = null;
        writeContracts(contracts);

        if (interaction.guild) {
            const result = await updateContractMessage(interaction.guild, interaction.user.id, interaction.guild, contractMessageId, contractMessageChannelId, CONTRACT_CHANNEL_ID);
            contractMessageId = result.contractMessageId;
            contractMessageChannelId = result.contractMessageChannelId;
        }

        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferUpdate();
        }

        // Notify payout role
        const payoutRole = interaction.guild.roles.cache.get(PAYOUT_ROLE_ID);
        const payoutMention = payoutRole ? `<@&${PAYOUT_ROLE_ID}>` : 'Payout team';

        const channel = await interaction.guild.channels.fetch(CONTRACT_CHANNEL_ID);
        if (channel) {
            await channel.send({ 
                content: `Task completed by <@${interaction.user.id}>! ${payoutMention} please pay out for Field ${contract.field} - ${task.name} (${task.reward.toLocaleString()} €)`, 
                allowedMentions: { roles: [PAYOUT_ROLE_ID], users: [interaction.user.id] }
            });
        }

        return { contractMessageId, contractMessageChannelId };

    } catch (error) {
        console.error('Error handling task completion interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'There was an error completing the task. Please try again.', ephemeral: true });
        }
        return { contractMessageId, contractMessageChannelId };
    }
}

module.exports = {
    handleCompleteButton
}; 
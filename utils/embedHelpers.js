const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');

// Helper to build the contract list embed (modern, compact, table-like UX)
function buildContractEmbed(contracts, userId = null, guild = null) {
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
            let extra = '';
            if (task.status === 'claimed' && task.claimedBy) {
                extra = ` (claimed by <@${task.claimedBy}>)`;
            } else if (task.status === 'completed' && task.completedBy) {
                extra = ` (completed by <@${task.completedBy}>)`;
            }
            lines.push(`${status} **${task.name}** — ${reward}${extra}`);
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

// Helper to build contract buttons (single dropdown for all available tasks, complete buttons for claimed)
function buildContractButtons(contracts, userId = null) {
    // No public 'Complete' buttons anymore
    return [];
}

// Helper to create a complete button for private use
function createCompleteButton(cIdx, tIdx, contract, task) {
    const button = new ButtonBuilder()
        .setCustomId(`complete_private_${cIdx}_${tIdx}`)
        .setLabel(`Complete: Field ${contract.field} - ${task.name}`)
        .setStyle(ButtonStyle.Success);
    return new ActionRowBuilder().addComponents(button);
}

module.exports = {
    buildContractEmbed,
    buildContractButtons,
    createCompleteButton
}; 
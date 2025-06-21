const { readContracts } = require('../utils/contractHelpers');

async function handleAutocomplete(interaction) {
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
    } else if (interaction.commandName === 'reopen') {
        if (focusedOption.name === 'field') {
            // Suggest all fields with completed tasks
            const choices = contracts.filter(c => c.tasks.some(t => t.status === 'completed'));
            await interaction.respond(
                choices.map(c => ({ name: `Field ${c.field}`, value: c.field })).slice(0, 25)
            );
        } else if (focusedOption.name === 'task') {
            const field = interaction.options.getInteger('field');
            const contract = contracts.find(c => c.field === field);
            if (!contract) return interaction.respond([]);
            const choices = contract.tasks
                .map(t => t.status === 'completed' ? t.name : null)
                .filter(Boolean);
            await interaction.respond(
                choices.map(name => ({ name, value: name })).slice(0, 25)
            );
        }
    } else if (["addtask", "deletefield", "deletetask"].includes(interaction.commandName)) {
        if (focusedOption.name === 'field') {
            await interaction.respond(
                contracts.map(c => ({ name: `Field ${c.field}`, value: c.field })).slice(0, 25)
            );
            return;
        }
    }
    
    if (interaction.commandName === 'deletetask' && focusedOption.name === 'name') {
        const field = interaction.options.getInteger('field');
        const contract = contracts.find(c => c.field === field);
        if (!contract) return interaction.respond([]);
        await interaction.respond(
            contract.tasks.map(t => ({ name: t.name, value: t.name })).slice(0, 25)
        );
        return;
    }
}

module.exports = {
    handleAutocomplete
};
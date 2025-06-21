// Slash command registration
module.exports = [
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
    },
    {
        name: 'reopen',
        description: 'Reopen a completed contract task (admin only)',
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
        name: 'addfield',
        description: 'Add a new contract field (admin only)',
        options: [
            { name: 'field', type: 4, description: 'Field number', required: true },
            { name: 'area', type: 10, description: 'Area in hectares', required: true },
            { name: 'notes', type: 3, description: 'Notes (optional)', required: false }
        ]
    },
    {
        name: 'addtask',
        description: 'Add a task to a contract field (admin only)',
        options: [
            { name: 'field', type: 4, description: 'Field number', required: true, autocomplete: true },
            { name: 'name', type: 3, description: 'Task name', required: true },
            { name: 'reward', type: 10, description: 'Reward in euros', required: true }
        ]
    },
    {
        name: 'deletefield',
        description: 'Delete a contract field (admin only)',
        options: [
            { name: 'field', type: 4, description: 'Field number', required: true, autocomplete: true }
        ]
    },
    {
        name: 'deletetask',
        description: 'Delete a task from a contract field (admin only)',
        options: [
            { name: 'field', type: 4, description: 'Field number', required: true, autocomplete: true },
            { name: 'name', type: 3, description: 'Task name', required: true, autocomplete: true }
        ]
    },
    {
        name: 'cancel',
        description: 'Cancel your currently claimed contract task',
        options: []
    }
];
const fs = require('fs');

const CONTRACTS_FILE = './contracts.json';
const CONTRACT_MESSAGE_FILE = './contract_message.json';

// Helper to read contracts
function readContracts() {
    if (!fs.existsSync(CONTRACTS_FILE)) return [];
    return JSON.parse(fs.readFileSync(CONTRACTS_FILE, 'utf8'));
}

// Helper to write contracts
function writeContracts(contracts) {
    fs.writeFileSync(CONTRACTS_FILE, JSON.stringify(contracts, null, 2));
}

// Helper to save contract message info
function saveContractMessageInfo(channelId, messageId) {
    fs.writeFileSync(CONTRACT_MESSAGE_FILE, JSON.stringify({ channelId, messageId }, null, 2));
}

// Helper to load contract message info
function loadContractMessageInfo() {
    if (!fs.existsSync(CONTRACT_MESSAGE_FILE)) return null;
    try {
        return JSON.parse(fs.readFileSync(CONTRACT_MESSAGE_FILE, 'utf8'));
    } catch {
        return null;
    }
}

module.exports = {
    readContracts,
    writeContracts,
    saveContractMessageInfo,
    loadContractMessageInfo
}; 
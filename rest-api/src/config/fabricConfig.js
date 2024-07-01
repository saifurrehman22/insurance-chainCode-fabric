const path = require('path');

const channelName = process.env.CHANNEL_NAME || 'mychannel';
const chaincodeName = process.env.CHAINCODE_NAME || 'insurance';
const mspId = process.env.MSP_ID || 'Org1MSP';

const cryptoPath = process.env.CRYPTO_PATH || path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'test-network',
    'organizations',
    'peerOrganizations',
    'org1.example.com'
);

const keyDirectoryPath = process.env.KEY_DIRECTORY_PATH || path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');
const certDirectoryPath = process.env.CERT_DIRECTORY_PATH || path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts');
const tlsCertPath = process.env.TLS_CERT_PATH || path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt');
const peerEndpoint = process.env.PEER_ENDPOINT || 'localhost:7051';
const peerHostAlias = process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com';

module.exports = {
    channelName,
    chaincodeName,
    mspId,
    keyDirectoryPath,
    certDirectoryPath,
    tlsCertPath,
    peerEndpoint,
    peerHostAlias
};

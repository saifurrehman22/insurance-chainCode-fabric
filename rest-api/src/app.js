const express = require('express');
const bodyParser = require('body-parser');
const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { TextDecoder } = require('node:util');

const channelName = envOrDefault('CHANNEL_NAME', 'mychannel');
const chaincodeName = envOrDefault('CHAINCODE_NAME', 'insurance');
const mspId = envOrDefault('MSP_ID', 'Org1MSP');

// Path to crypto materials.
const cryptoPath = envOrDefault(
    'CRYPTO_PATH',
    path.resolve(
        __dirname,
        '..',
        '..',
        '..',
        'test-network',
        'organizations',
        'peerOrganizations',
        'org1.example.com'
    )
);

// Path to crypto materials.

// Path to user private key directory.
const keyDirectoryPath = process.env.KEY_DIRECTORY_PATH || path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'keystore');

// Path to user certificate directory.
const certDirectoryPath = process.env.CERT_DIRECTORY_PATH || path.resolve(cryptoPath, 'users', 'User1@org1.example.com', 'msp', 'signcerts');

// Path to peer tls certificate.
const tlsCertPath = envOrDefault(
    'TLS_CERT_PATH',
    path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt')
);
// Gateway peer endpoint.
const peerEndpoint = process.env.PEER_ENDPOINT || 'localhost:7051';

// Gateway peer SSL host name override.
const peerHostAlias = process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com';

const utf8Decoder = new TextDecoder();
const app = express();
app.use(bodyParser.json());

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
}

function envOrDefault(key, defaultValue) {
    return process.env[key] || defaultValue;
}

async function newIdentity() {
    const certPath = await getFirstDirFileName(certDirectoryPath);
    const credentials = await fs.readFile(certPath);
    return { mspId, credentials };
}

async function getFirstDirFileName(dirPath) {
    const files = await fs.readdir(dirPath);
    const file = files[0];
    if (!file) {
        throw new Error(`No files in directory: ${dirPath}`);
    }
    return path.join(dirPath, file);
}

async function newSigner() {
    const keyPath = await getFirstDirFileName(keyDirectoryPath);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

app.post('/initLedger', async (req, res) => {
    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
    });

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        await contract.submitTransaction('InitLedger');
        res.status(200).send('Ledger initialized successfully');
    } catch (error) {
        res.status(500).send(`Failed to initialize ledger: ${error}`);
    } finally {
        gateway.close();
        client.close();
    }
});

app.get('/installmentNo', async (req, res) => {
    console.log('Received request for /installmentNo');

    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
    });

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        console.log('Submitting transaction to get installment number');
        const resultBytes = await contract.evaluateTransaction('GetInstallmentNo');
        const resultJson = utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);

        console.log('Transaction successful, returning result');
        res.status(200).json(result);
    } catch (error) {
        console.error(`Failed to get installment number: ${error}`);
        res.status(500).send(`Failed to get installment number: ${error}`);
    } finally {
        gateway.close();
        client.close();
    }
});


app.post('/createLifeInsurancePolicy', async (req, res) => {
    const { holderName, premium, coverage, effectiveDate, expirationDate } = req.body;

    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
    });

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        await contract.submitTransaction('CreateLifeInsurancePolicy', holderName, premium.toString(), coverage.toString(), effectiveDate, expirationDate);
        res.status(200).send('Life insurance policy created successfully');
    } catch (error) {
        res.status(500).send(`Failed to create life insurance policy: ${error}`);
    } finally {
        gateway.close();
        client.close();
    }
});

app.post('/payPremium', async (req, res) => {
    const { id, amount } = req.body;

    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
    });

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        await contract.submitTransaction('PayPremium', id.toString(), amount.toString());
        res.status(200).send('Premium paid successfully');
    } catch (error) {
        res.status(500).send(`Failed to pay premium: ${error}`);
    } finally {
        gateway.close();
        client.close();
    }
});

app.get('/policy/:id', async (req, res) => {
    const id = req.params.id;

    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
    });

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        const resultBytes = await contract.evaluateTransaction('ReadPolicy', id);
        const resultJson = utf8Decoder.decode(resultBytes);
        const result = JSON.parse(resultJson);

        res.status(200).json(result);
    } catch (error) {
        res.status(500).send(`Failed to read policy: ${error}`);
    } finally {
        gateway.close();
        client.close();
    }
});

app.post('/claimCoverage', async (req, res) => {
    const { id } = req.body;

    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
    });

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        await contract.submitTransaction('ClaimCoverage', id.toString());
        res.status(200).send('Coverage claimed successfully');
    } catch (error) {
        res.status(500).send(`Failed to claim coverage: ${error}`);
    } finally {
        gateway.close();
        client.close();
    }
});

app.post('/cancelPolicy', async (req, res) => {
    const { id } = req.body;

    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
    });

    try {
        const network = gateway.getNetwork(channelName);
        const contract = network.getContract(chaincodeName);

        await contract.submitTransaction('Cancel', id.toString());
        res.status(200).send('Policy cancelled successfully');
    } catch (error) {
        res.status(500).send(`Failed to cancel policy: ${error}`);
    } finally {
        gateway.close();
        client.close();
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

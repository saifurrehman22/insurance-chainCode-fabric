const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { TextDecoder } = require('util');
const config = require('../config/fabricConfig');

const utf8Decoder = new TextDecoder();

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(config.tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(config.peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': config.peerHostAlias,
    });
}

async function newIdentity() {
    const certPath = await getFirstDirFileName(config.certDirectoryPath);
    const credentials = await fs.readFile(certPath);
    return { mspId: config.mspId, credentials };
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
    const keyPath = await getFirstDirFileName(config.keyDirectoryPath);
    const privateKeyPem = await fs.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    return signers.newPrivateKeySigner(privateKey);
}

async function submitTransaction(transactionName, ...args) {
    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
    });

    try {
        const network = gateway.getNetwork(config.channelName);
        const contract = network.getContract(config.chaincodeName);
        await contract.submitTransaction(transactionName, ...args);
    } finally {
        gateway.close();
        client.close();
    }
}

async function evaluateTransaction(transactionName, ...args) {
    const client = await newGrpcConnection();
    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
    });

    try {
        const network = gateway.getNetwork(config.channelName);
        const contract = network.getContract(config.chaincodeName);
        const resultBytes = await contract.evaluateTransaction(transactionName, ...args);
        const resultJson = utf8Decoder.decode(resultBytes);
        return JSON.parse(resultJson);
    } finally {
        gateway.close();
        client.close();
    }
}

async function initLedger(req, res) {
    try {
        await submitTransaction('InitLedger');
        res.status(200).send('Ledger initialized successfully');
    } catch (error) {
        res.status(500).send(`Failed to initialize ledger: ${error}`);
    }
}

async function getInstallmentNo(req, res) {
    try {
        const result = await evaluateTransaction('GetInstallmentNo');
        res.status(200).json(result);
    } catch (error) {
        res.status(500).send(`Failed to get installment number: ${error}`);
    }
}

async function createLifeInsurancePolicy(req, res) {
    const { holderName, premium, coverage, effectiveDate, expirationDate } = req.body;
    try {
        await submitTransaction('CreateLifeInsurancePolicy', holderName, premium.toString(), coverage.toString());
        console.log("created Life Insurance Policy " );
        res.status(200).send('Life insurance policy created successfully');
    } catch (error) {
        res.status(500).send(`Failed to create life insurance policy: ${error}`);
    }
}

async function payPremium(req, res) {
    const { id, amount } = req.body;
    console.log(`Received request to pay premium for policy ID: ${id}, amount: ${amount}`);

    try {
        await submitTransaction('PayPremium', id.toString(), amount.toString());
        console.log(`Premium paid successfully for policy ID: ${id}`);
        res.status(200).send('Premium paid successfully');
    } catch (error) {
        console.error(`Failed to pay premium for policy ID: ${id} - Error: ${error}`);
        res.status(500).send(`Failed to pay premium: ${error}`);
    }
}

async function getPolicy(req, res) {
    const id = req.params.id;
    console.log(`Received request to read policy with ID: ${id}`);
    try {
        const result = await evaluateTransaction('ReadPolicy', id);
        console.log(`Successfully read policy with ID: ${id}`);
        res.status(200).json(result);
    } catch (error) {
        console.error(`Failed to read policy with ID: ${id} - Error: ${error}`);
        res.status(500).send(`Failed to read policy: ${error}`);
    }
}

async function claimCoverage(req, res) {
    const { id } = req.body;
    try {
        await submitTransaction('ClaimCoverage', id.toString());
        res.status(200).send('Coverage claimed successfully');
    } catch (error) {
        res.status(500).send(`Failed to claim coverage: ${error}`);
    }
}

async function cancelPolicy(req, res) {
    const { id } = req.body;
    try {
        await submitTransaction('Cancel', id.toString());
        res.status(200).send('Policy cancelled successfully');
    } catch (error) {
        res.status(500).send(`Failed to cancel policy: ${error}`);
    }
}

module.exports = {
    initLedger,
    getInstallmentNo,
    createLifeInsurancePolicy,
    payPremium,
    getPolicy,
    claimCoverage,
    cancelPolicy
};

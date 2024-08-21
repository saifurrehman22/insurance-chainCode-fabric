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
    const { id } = req.params;
    try {
        const result = await evaluateTransaction('GetInstallmentNo', id.toString());
        res.status(200).json(result);
    } catch (error) {
        res.status(500).send(`Failed to get installment number: ${error}`);
    }
}

async function setInstallmentNo(req, res) {
    const { id, newInstallmentNo } = req.body;
    console.log(`Received request to set new installment number for policy ID ${id} to: ${newInstallmentNo}`);

    try {
        await submitTransaction('SetInstallmentNo', id.toString(), newInstallmentNo.toString());
        console.log(`Successfully set new installment number for policy ID ${id} to: ${newInstallmentNo}`);
        res.status(200).send(`Installment number for policy ID ${id} set to ${newInstallmentNo}`);
    } catch (error) {
        console.error(`Failed to set installment number for policy ID ${id}: ${error}`);
        res.status(500).send(`Failed to set installment number: ${error}`);
    }
}

async function createLifeInsurancePolicy  (req, res)  {
    const { holderName, age, location, companyName, packageName, premium, coverage, installmentNo, totalPremiumToPay, profitPercentage } = req.body;
    try {
        await submitTransaction(
            'CreateLifeInsurancePolicy',
            holderName,
            age.toString(),
            location,
            companyName,
            packageName,
            premium.toString(),
            coverage.toString(),
            installmentNo.toString(),
            totalPremiumToPay.toString(),
            profitPercentage.toString()
        );
        res.status(201).send('Life insurance policy created successfully');
    } catch (error) {
        res.status(500).send(`Failed to create life insurance policy: ${error.message}`);
    }
};

async function createHealthInsurancePolicy(req, res) {
    const { holderName, age, premium, coverage, installmentNo, totalPremiumToPay } = req.body;
    try {
        await submitTransaction('CreateHealthInsurancePolicy', holderName, age.toString(), premium.toString(), coverage.toString(), installmentNo.toString(), totalPremiumToPay.toString());
        console.log("Created Health Insurance Policy");
        res.status(200).send('Health insurance policy created successfully');
    } catch (error) {
        res.status(500).send(`Failed to create health insurance policy: ${error}`);
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
        const result = await evaluateTransaction('ReadPolicy', id.toString());
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

async function deletePolicy(req, res) {
    const { id } = req.body; // Extract id from req.body
    console.log(`Received request to delete policy with ID: ${id}`);

    try {
        await submitTransaction('DeletePolicy', id.toString());
        console.log(`Successfully deleted policy with ID: ${id}`);
        res.status(200).send(`Policy with ID ${id} has been deleted`);
    } catch (error) {
        console.error(`Failed to delete policy with ID: ${id} - Error: ${error}`);
        res.status(500).send(`Failed to delete policy: ${error}`);
    }
}

async function getAllPolicies(req, res) {
    console.log(`Received request to get all policies`);
    try {
        const result = await evaluateTransaction('GetAllPolicies');
        console.log(`Successfully retrieved all policies`);
        res.status(200).json(result);
    } catch (error) {
        console.error(`Failed to retrieve all policies - Error: ${error}`);
        res.status(500).send(`Failed to retrieve all policies: ${error}`);
    }
}
async function calculateMaturity(req, res) {
    const { premium, installmentNo, profitPercentage } = req.body;

    try {
        // Validate inputs
        if (typeof premium !== 'number' || typeof installmentNo !== 'number') {
            throw new Error('Premium and installmentNo must be numbers');
        }

        // Fetch default profit percentage if necessary
        let defaultProfitPercentage;
        try {
            defaultProfitPercentage  = await evaluateTransaction('GetProfitPercentageDefault');
            if (typeof defaultProfitPercentage !== 'number') {
                throw new Error('Default profit percentage is not a number');
            }
        } catch (error) {
            throw new Error(`Failed to get profit percentage default: ${error.message}`);
        }

        // Use the default profit percentage if the provided one is 0 or less
        const effectiveProfitPercentage = profitPercentage > 0 ? profitPercentage : defaultProfitPercentage;

        // Initialize matured balance
        let maturedBalance = 0;

        // Calculate the matured balance by summing up the compounded amounts for each installment
        for (let k = 0; k < installmentNo; k++) {
            const yearsRemaining = installmentNo - k;
            maturedBalance += premium * Math.pow((1 + effectiveProfitPercentage / 100), yearsRemaining);
        }

        // Return the calculated matured balance
        res.status(200).json({ maturedBalance });
    } catch (error) {
        res.status(500).send(`Failed to calculate maturity: ${error.message}`);
    }
}


async function getProfitPercentageDefault(req, res) {
    console.log('Received request to get default profit percentage');

    try {
        const result = await evaluateTransaction('GetProfitPercentageDefault');

        // Log the result for debugging
        console.log('Result from evaluateTransaction:', result);

        // Ensure the result is a number
        if (typeof result !== 'number') {
            throw new Error('Invalid data type received for default profit percentage');
        }

        // Return the result as JSON
        res.status(200).json({ defaultProfitPercentage: result });
    } catch (error) {
        // Log the error message for debugging
        console.error('Error in getProfitPercentageDefault:', error.message);

        // Send a structured error response
        res.status(500).json({
            error: `Failed to get default profit percentage: ${error.message}`
        });
    }
}





async function updateProfitPercentageDefault(req, res) {
    const { newProfitPercentage } = req.body;

    try {
        const parsedPercentage = newProfitPercentage.toString();
        if (isNaN(parsedPercentage) || parsedPercentage <= 0) {
            throw new Error('New profit percentage must be a number greater than 0');
        }

        await submitTransaction('UpdateProfitPercentageDefault', parsedPercentage);
        res.status(200).send('Profit percentage default updated successfully');
    } catch (error) {
        res.status(500).send(`Failed to update profit percentage default: ${error.message}`);
    }
}

module.exports = {
    initLedger,
    getInstallmentNo,
    setInstallmentNo,
    createLifeInsurancePolicy,
    createHealthInsurancePolicy,
    payPremium,
    getPolicy,
    claimCoverage,
    cancelPolicy,
    deletePolicy,
    getAllPolicies,
    updateProfitPercentageDefault,
    getProfitPercentageDefault,
    calculateMaturity
};

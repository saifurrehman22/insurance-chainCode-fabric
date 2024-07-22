
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

// Path to user private key directory.
const keyDirectoryPath = envOrDefault(
    'KEY_DIRECTORY_PATH',
    path.resolve(
        cryptoPath,
        'users',
        'User1@org1.example.com',
        'msp',
        'keystore'
    )
);

// Path to user certificate directory.
const certDirectoryPath = envOrDefault(
    'CERT_DIRECTORY_PATH',
    path.resolve(
        cryptoPath,
        'users',
        'User1@org1.example.com',
        'msp',
        'signcerts'
    )
);

// Path to peer tls certificate.
const tlsCertPath = envOrDefault(
    'TLS_CERT_PATH',
    path.resolve(cryptoPath, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt')
);

// Gateway peer endpoint.
const peerEndpoint = envOrDefault('PEER_ENDPOINT', 'localhost:7051');

// Gateway peer SSL host name override.
const peerHostAlias = envOrDefault('PEER_HOST_ALIAS', 'peer0.org1.example.com');

const utf8Decoder = new TextDecoder();
const assetId = `asset${String(Date.now())}`;

async function main() {
    displayInputParameters();

    // The gRPC client connection should be shared by all Gateway connections to this endpoint.
    const client = await newGrpcConnection();

    const gateway = connect({
        client,
        identity: await newIdentity(),
        signer: await newSigner(),
        // Default timeouts for different gRPC calls
        evaluateOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        endorseOptions: () => {
            return { deadline: Date.now() + 15000 }; // 15 seconds
        },
        submitOptions: () => {
            return { deadline: Date.now() + 5000 }; // 5 seconds
        },
        commitStatusOptions: () => {
            return { deadline: Date.now() + 60000 }; // 1 minute
        },
    });

    try {
        // Get a network instance representing the channel where the smart contract is deployed.
        const network = gateway.getNetwork(channelName);

        // Get the smart contract from the network.
        const contract = network.getContract(chaincodeName);

        // Initialize a set of asset data on the ledger using the chaincode 'InitLedger' function.
        await initLedger(contract);

        // Return all the InstallmentNo on the ledger.
        await GetInstallmentNo(contract);

        // Create a new Life Insurance Policy on the ledger.
        await CreateLifeInsurancePolicy(contract);

        // User pay PayPremium for policy.
         await PayPremium(contract);

        // Get the Policy details by ID.
         await ReadPolicy(contract);

        // Claim the policy.
        //await Cancel(contract);

        // Claim the policy.
        // await ClaimCoverage(contract);

        //await ReadPolicy(contract);

    } finally {
        gateway.close();
        client.close();
    }
}

main().catch((error) => {
    console.error('******** FAILED to run the application:', error);
    process.exitCode = 1;
});

async function newGrpcConnection() {
    const tlsRootCert = await fs.readFile(tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
    return new grpc.Client(peerEndpoint, tlsCredentials, {
        'grpc.ssl_target_name_override': peerHostAlias,
    });
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

/**
 * This type of transaction would typically only be run once by an application the first time it was started after its
 * initial deployment. A new version of the chaincode deployed later would likely not need to run an "init" function.
 */
async function initLedger(contract) {
    console.log(
        '\n--> Submit Transaction: InitLedger, function creates the initial set of assets on the ledger'
    );

    await contract.submitTransaction('InitLedger');

    console.log('*** Transaction committed successfully');
}

/**
 * Evaluate a transaction to query ledger state.
 */
async function GetInstallmentNo(contract) {
    console.log(
        '\n--> Evaluate Transaction: GetInstallmentNo, function returns all the current assets on the ledger'
    );

    const resultBytes = await contract.evaluateTransaction('GetInstallmentNo');

    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** No of installment are :', result);
}

/**
 * Submit a transaction synchronously, blocking until it has been committed to the ledger.
 */
async function CreateLifeInsurancePolicy(contract) {
    console.log(
        '\n--> Submit Transaction: CreateLifeInsurancePolicy, creates new Life Insurance Policy'
    );

    await contract.submitTransaction(
        'CreateLifeInsurancePolicy',
        'saif',
        '10000',
        '5000000',
        '2023-01-01',
        '2024-01-01'
    );

    console.log('*** Transaction committed successfully');
}

/**
 * Submit transaction asynchronously, allowing the application to process the smart contract response (e.g. update a UI)
 * while waiting for the commit notification.
 */
async function PayPremium(contract) {
    console.log(
        '\n--> Async Submit Transaction: PayPremium'
    );

    await contract.submitTransaction(
        'PayPremium',
        '1',
        '10000',
    );

    console.log('*** Transaction committed successfully');
}

async function ReadPolicy(contract) {
    console.log(
        '\n--> Evaluate Transaction: ReadPolicy'
    );

    const resultBytes = await contract.evaluateTransaction(
        'ReadPolicy',
        '1'
    );

    const resultJson = utf8Decoder.decode(resultBytes);
    const result = JSON.parse(resultJson);
    console.log('*** Result:', result);
}

/**
 * submitTransaction() will throw an error containing details of any error responses from the smart contract.
 */
async function ClaimCoverage(contract) {
    console.log(
        '\n--> Submit Transaction: ClaimCoverage '
    );

    try {
        await contract.submitTransaction(
            'ClaimCoverage',
            '1',
        );
        console.log('******** FAILED to return an error');
    } catch (error) {
        console.log('*** Successfully caught the error: \n', error);
    }
}

async function Cancel(contract) {
    console.log(
        '\n--> Submit Transaction: Cancel '
    );

    try {
        await contract.submitTransaction(
            'Cancel',
            '1',
        );
        console.log('******** Policy Cancelled');
    } catch (error) {
        console.log('*** Successfully caught the error: \n', error);
    }
}

/**
 * envOrDefault() will return the value of an environment variable, or a default value if the variable is undefined.
 */
function envOrDefault(key, defaultValue) {
    return process.env[key] || defaultValue;
}

/**
 * displayInputParameters() will print the global scope parameters used by the main driver routine.
 */
function displayInputParameters() {
    console.log(`channelName:       ${channelName}`);
    console.log(`chaincodeName:     ${chaincodeName}`);
    console.log(`mspId:             ${mspId}`);
    console.log(`cryptoPath:        ${cryptoPath}`);
    console.log(`keyDirectoryPath:  ${keyDirectoryPath}`);
    console.log(`certDirectoryPath: ${certDirectoryPath}`);
    console.log(`tlsCertPath:       ${tlsCertPath}`);
    console.log(`peerEndpoint:      ${peerEndpoint}`);
    console.log(`peerHostAlias:     ${peerHostAlias}`);
}

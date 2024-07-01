const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');

router.post('/initLedger', policyController.initLedger);
router.get('/installmentNo', policyController.getInstallmentNo);
router.post('/createLifeInsurancePolicy', policyController.createLifeInsurancePolicy);
router.post('/payPremium', policyController.payPremium);
router.get('/policy/:id', policyController.getPolicy);
router.post('/claimCoverage', policyController.claimCoverage);
router.post('/cancelPolicy', policyController.cancelPolicy);

module.exports = router;

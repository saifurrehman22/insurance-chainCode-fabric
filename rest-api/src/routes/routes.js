const express = require('express');
const router = express.Router();
const policyController = require('../controllers/policyController');

router.post('/initLedger', policyController.initLedger);
router.get('/installmentNo/:id', policyController.getInstallmentNo);
router.post('/createLifeInsurancePolicy', policyController.createLifeInsurancePolicy);
router.post('/createHealthInsurancePolicy', policyController.createHealthInsurancePolicy);
router.post('/payPremium', policyController.payPremium);
router.get('/policy/:id', policyController.getPolicy);
router.post('/claimCoverage', policyController.claimCoverage);
router.post('/cancelPolicy', policyController.cancelPolicy);
router.post('/deletePolicy', policyController.deletePolicy);
router.post('/setInstallmentNo', policyController.setInstallmentNo);
router.get('/getAll', policyController.getAllPolicies);


module.exports = router;

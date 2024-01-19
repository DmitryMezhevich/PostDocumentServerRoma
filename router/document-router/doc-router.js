const Router = require('express').Router;

const documentController = require('../../controllers/document-controller');

const router = new Router();

router.post(
    '/createShipment',
    documentController.downloadFile,
    documentController.convertXLSXtoJSON,
    documentController.generateBarcode,
    documentController.generateLabels,
    documentController.generateWarranty,
    documentController.generateMailList,
    documentController.generateBarcodeSpin,
    documentController.uploadFile
);

module.exports = router;

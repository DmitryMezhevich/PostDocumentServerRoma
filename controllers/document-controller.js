const formidable = require('formidable');

const OrderModel = require('../models/orderModel');
const documentHalper = require('../helpers/document-helpers');
const writerFiles = require('../helpers/writerFiles-helper');
const logger = require('../logger');

class DocumentController {
    // Загрузка исходной таблицы
    async downloadFile(req, res, next) {
        try {
            const optionsFormidable = {
                uploadDir: `${__dirname}/../buffer`,
                keepExtensions: true,
                maxFileSize: 10 * 1024 * 1024,
                multiples: false,
            };

            const nameFolder = await documentHalper.createFolder();
            req.nameFolder = nameFolder;

            const form = formidable(optionsFormidable);

            form.parse(req, (err, _, files) => {
                req.nameBufferFile = files.table.newFilename;
                writerFiles.write(err, files, nameFolder);
                next();
            });
        } catch (error) {
            logger.error(error, `Ошибка во время загрузки файла xlsx`);
            await documentHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(`Ошибка во время загрузки файла xlsx`);
        }
    }

    // Перобразование файла xlsx в JSON
    async convertXLSXtoJSON(req, res, next) {
        try {
            const jsonData = await documentHalper.xlsxToJSON(req.nameFolder);

            const orderModels = jsonData.map((value) => {
                return new OrderModel(value);
            });

            req.orderModels = orderModels;

            next();
        } catch (error) {
            logger.error(
                error,
                `Ошибка во время перобразование файла xlsx в JSON`
            );
            await documentHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(
                `Ошибка во время перобразование файла xlsx в JSON`
            );
        }
    }

    // Генерирование штрихкодов
    async generateBarcode(req, res, next) {
        try {
            const orderModels = req.orderModels;

            const tempOrderModels = await Promise.all(
                orderModels.map(async (value) => {
                    value.post.barcode.fullCode =
                        documentHalper.generateFullBarcode(
                            value.post.barcode.incompleteCode
                        );
                    value.post.barcode.svg =
                        await documentHalper.generateBarcode(
                            value.post.barcode.fullCode
                        );
                    return value;
                })
            );

            req.orderModels = orderModels;

            // Преобразуем json для формирования разных ярлыков и списков для почты
            req.orderModelsForPost =
                documentHalper.conversionJSONForPost(orderModels);

            next();
        } catch (error) {
            logger.error(error, `Ошибка во время генерировании штрихкодов`);
            await documentHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(`Ошибка во время генерировании штрихкодов`);
        }
    }

    // Создание xlsx файла с генерироваными трек-номерами
    async generateBarcodeSpin(req, res, next) {
        try {
            await documentHalper.createBarcodeSpin(
                req.orderModels,
                req.nameFolder
            );

            next();
        } catch (error) {
            logger.error(
                error,
                `Ошибка во время генерировании обратных штрихкодов`
            );
            await documentHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(
                `Ошибка во время генерировании обратных штрихкодов`
            );
        }
    }

    // Генерация ярлыков
    async generateLabels(req, res, next) {
        try {
            const nameFolder = req.nameFolder;
            const models = req.orderModelsForPost;

            req.nameFolder = nameFolder;

            await documentHalper.createLabels(nameFolder, models);

            next();
        } catch (error) {
            logger.error(error, `Ошибка во время генерация ярлыков`);
            await documentHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(`Ошибка во время генерация ярлыков`);
        }
    }

    // Генерация гарантий
    async generateWarranty(req, res, next) {
        try {
            const warrantyModels = await documentHalper.createWarranty(
                req.orderModelsForPost,
                req.nameFolder
            );

            next();
        } catch (error) {
            console.log(error);
            logger.error(error, `Ошибка во время генерация гарантий`);
            await documentHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(`Ошибка во время генерация гарантий`);
        }
    }

    // Генерация электронных списков для почты
    async generateMailList(req, res, next) {
        try {
            await documentHalper.createMailList(
                req.orderModelsForPost,
                req.nameFolder
            );

            next();
        } catch (error) {
            logger.error(
                error,
                `Ошибка во время генерация электронных списков для почты`
            );
            await documentHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(
                `Ошибка во время генерация электронных списков для почты`
            );
        }
    }

    // Собираем все нужные файлы в zip и отдаем на клиент
    async uploadFile(req, res, next) {
        try {
            const nameFolder = req.nameFolder;
            await documentHalper.createZIP(nameFolder);

            res.download(
                `${__dirname}/../tempFiles/${nameFolder}/result.zip`,
                'result.zip',
                (_) => {
                    documentHalper.removeFolder(nameFolder);
                }
            );
        } catch (error) {
            logger.error(
                error,
                `Ошибка во время сбора файлов в архив и отправки на клиент`
            );
            await documentHalper.removeTempFiles(
                req.nameFolder,
                req.nameBufferFile
            );
            res.status(500).send(
                `Ошибка во время сбора файлов в архив и отправки на клиент`
            );
        }
    }
}

module.exports = new DocumentController();

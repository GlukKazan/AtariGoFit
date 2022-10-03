"use strict";

const fs = require('fs'); 
const readline = require('readline'); 

const ml = require('./model');
const game = require('./game');

const SIZE  = 9;
const BATCH = 1; //4096;

let model = null;

var winston = require('winston');
require('winston-daily-rotate-file');

const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'HH:mm:ss'
    }),
    winston.format.printf(
        info => `${info.level}: ${info.timestamp} - ${info.message}`
    )
);

var transport = new winston.transports.DailyRotateFile({
    dirname: '',
    filename: 'go-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
});

var logger = winston.createLogger({
    format: logFormat,
    transports: [
      transport
    ]
});

async function proceed() {
    model = await ml.create(SIZE, logger);
    const rl = readline.createInterface({
        input: fs.createReadStream('data/go.txt'), 
        console: false 
    });
    for await (const line of rl) {
        console.log(line);
        logger.info(line);
        await game.proceed(model, SIZE, BATCH, line, logger);
    }
    await ml.save(model, 'go.json');
}

async function run() {
    await proceed();
}

(async () => { await run(); })();
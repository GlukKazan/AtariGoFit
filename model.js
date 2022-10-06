"use strict";

const _ = require('underscore');
const tf = require('@tensorflow/tfjs-node-gpu');

const PLANE_COUNT = 1; // TODO: 4-8
const BATCH_SIZE  = 1024;
const EPOCH_COUNT = 1;
const LEARNING_RATE = 0.001;

const FILE_PREFIX = 'file:///users/valen';

async function init() {
    await tf.ready();
    await tf.enableProdMode();
    console.log(tf.getBackend());
}

async function load(url, logger) {
    const t0 = Date.now();
    await init();
    const model = await tf.loadLayersModel(url);
    const opt = tf.train.sgd(LEARNING_RATE);
    model.compile({optimizer: opt, loss: ['categoricalCrossentropy', 'meanSquaredError'], metrics: ['accuracy']});
    const t1 = Date.now();
    console.log('Model [' + url + '] loaded: ' + (t1 - t0));
    if (!_.isUndefined(logger)) {
        logger.info('Model [' + url + '] loaded: ' + (t1 - t0));
    }
    return model;
}

async function create(size, logger) {
    const t0 = Date.now();
    await init();

    const shape = [PLANE_COUNT, size, size];

    const input = tf.input({shape: shape});
    const z1 = tf.layers.zeroPadding2d({padding: 3, dataFormat: 'channelsFirst'}).apply(input);
    const c1 = tf.layers.conv2d({filters: 48, kernelSize: [7, 7], dataFormat: 'channelsFirst', activation: 'relu'}).apply(z1);

    const z2 = tf.layers.zeroPadding2d({padding: 2, dataFormat: 'channelsFirst'}).apply(c1);
    const c2 = tf.layers.conv2d({filters: 32, kernelSize: [5, 5], dataFormat: 'channelsFirst', activation: 'relu'}).apply(z2);

    const z3 = tf.layers.zeroPadding2d({padding: 2, dataFormat: 'channelsFirst'}).apply(c2);
    const c3 = tf.layers.conv2d({filters: 32, kernelSize: [5, 5], dataFormat: 'channelsFirst', activation: 'relu'}).apply(z3);

    const z4 = tf.layers.zeroPadding2d({padding: 2, dataFormat: 'channelsFirst'}).apply(c3);
    const c4 = tf.layers.conv2d({filters: 32, kernelSize: [5, 5], dataFormat: 'channelsFirst', activation: 'relu'}).apply(z4);

    const fl = tf.layers.flatten().apply(c4);
    const out = tf.layers.dense({units: 512, activation: 'relu'}).apply(fl);

    const ph = tf.layers.dense({units: 512, activation: 'relu'}).apply(out);
    const policy = tf.layers.dense({units: size * size, activation: 'softmax'}).apply(ph);

    const vh = tf.layers.dense({units: 512, activation: 'relu'}).apply(out);
    const value = tf.layers.dense({units: 1, activation: 'tanh'}).apply(vh);

    const model = tf.model({inputs: input, outputs: [policy, value]});

    const opt = tf.train.sgd(LEARNING_RATE);
    model.compile({optimizer: opt, loss: ['categoricalCrossentropy', 'meanSquaredError'], metrics: ['accuracy']});
   
    const t1 = Date.now();
    console.log('Model created: ' + (t1 - t0));
    if (!_.isUndefined(logger)) {
        logger.info('Model created: ' + (t1 - t0));
    }
    return model;
}

async function fit(model, size, x, y, z, batch, logger) {
    const xshape = [batch, PLANE_COUNT, size, size];
    const xs = tf.tensor4d(x, xshape, 'float32');
    const yshape = [batch, size * size];
    const ys =  tf.tensor2d(y, yshape, 'float32');
    const zshape = [batch, 1];
    const zs =  tf.tensor2d(z, zshape, 'float32');

    const t0 = Date.now();
    const h = await model.fit(xs, [ys, zs], {
        batchSize: BATCH_SIZE,
        epochs: EPOCH_COUNT
    });    

//  console.log(h);
    for (let i = 0; i < EPOCH_COUNT; i++) {
        console.log('epoch = ' + i + ', acc = [' + h.history.dense_Dense3_acc[i] + ' ,' + h.history.dense_Dense5_acc[i] + '], loss = [' + h.history.dense_Dense3_loss[i] + ' ,' + h.history.dense_Dense5_loss[i] + ' ,' + h.history.loss[i] + ']');
        if (!_.isUndefined(logger)) {
            logger.info('epoch = ' + i + ', acc = [' + h.history.dense_Dense3_acc[i] + ' ,' + h.history.dense_Dense5_acc[i] + '], loss = [' + h.history.dense_Dense3_loss[i] + ' ,' + h.history.dense_Dense5_loss[i] + ' ,' + h.history.loss[i] + ']');
        }
    }
    const t1 = Date.now();
    console.log('Fit time: ' + (t1 - t0));
    if (!_.isUndefined(logger)) {
        logger.info('Fit time: ' + (t1 - t0));
    }

    xs.dispose();
    ys.dispose();
    zs.dispose();
}

async function predict(model, size, x, batch, logger) {
    const shape = [batch, PLANE_COUNT, size, size];
    const xs = tf.tensor4d(x, shape, 'float32');

    const t0 = Date.now();
    const ys = await model.predict(xs);
    const y = await ys.data();
    const t1 = Date.now();
    console.log('Predict time: ' + (t1 - t0));
    if (!_.isUndefined(logger)) {
        logger.info('Predict time: ' + (t1 - t0));
    }

    xs.dispose();
    ys.dispose();

    return y;
}

async function save(model, fileName) {
    await model.save(`${FILE_PREFIX}/${fileName}`);
}

module.exports.PLANE_COUNT = PLANE_COUNT;
module.exports.create = create;
module.exports.load = load;
module.exports.fit = fit;
module.exports.predict = predict;
module.exports.save = save;

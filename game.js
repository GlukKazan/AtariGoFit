"use strict";

const _ = require('underscore');
const ml = require('./model');

const LETTERS = 'ABCDEFGHIabcdefghi';

let X = null;
let Y = null;
let Z = null;

let C = 0;
let offset = 0;

let cnt = 0;

function dump(board, size, offset, moves) {
    for (let y = 0; y < size; y++) {
        let s = '';
        for (let x = 0; x < size; x++) {
            const pos = y * size + x;
            if (board[offset + pos] > 0) {
                s = s + '* ';
            } else if (board[offset + pos] < 0) {
                s = s + 'o ';
            }  else if (!_.isUndefined(moves) && (moves[offset + pos] > 1 / (size * size))) {
                s = s + '+ ';
            }  else if (!_.isUndefined(moves) && (moves[offset + pos] < -1 / (size * size))) {
                s = s + 'X ';
            }  else {
                s = s + '. ';
            }
        }
        console.log(s);
    }
    console.log('');
}

function flipX(pos, size) {
    const x = pos % size;
    pos -= x;
    return pos + (size - x - 1);
}

function flipY(pos, size) {
    const y = (pos / size) | 0;
    pos -= y * size;
    return (size - y - 1) * size + pos;
}

function toRight(pos, size) {
    const x = pos % size;
    const y = (pos / size) | 0;
    return x * size + (size - y - 1);
}

function toLeft(pos, size) {
    const x = pos % size;
    const y = (pos / size) | 0;
    return (size - x - 1) * size + y;
}

function rotate(pos, size, ix) {
    switch (ix) {
        case 1:
            pos = flipX(pos, size);
            break;
        case 2:
            pos = flipY(pos, size);
            break;
        case 3:
            pos = flipX(pos, size);
            pos = flipY(pos, size);
            break;
        case 4:
            pos = toRight(pos, size);
            break;
        case 5:
            pos = toLeft(pos, size);
            break;
        case 6:
            pos = toRight(pos, size);
            pos = flipX(pos, size);
            break;
        case 7:
            pos = toLeft(pos, size);
            pos = flipX(pos, size);
            break;
    }
    return pos;
}

async function proceed(model, size, batch, data, logger) {
    if (data.length % 2 != 0) return;
    let board = new Float32Array(size * size);
    let winner = (data.length % 4 != 0) ? 1 : -1;
    let player = 1;
    for (let pos = 0; pos < data.length - 1; pos += 2, player = -player) {
        const x = _.indexOf(LETTERS, data[pos]);
        if ((x < 0) || (x >= size)) return;
        const y = _.indexOf(LETTERS, data[pos + 1].toUpperCase());
        if ((y < 0) || (y >= size)) return;
        const move = y * size + x;
        for (let ix = 0; ix < 8; ix++) {
            if ((X === null) || (C >= batch)) {
                if (X !== null) {
                    await ml.fit(model, size, X, Y, Z, C, logger);
                    cnt++;
                    if ((cnt % 1000) == 0) {
                        await ml.save(model, 'go-' + cnt + '.json');
                        console.log('Save [' + cnt + ']: ' + data);
                        logger.info('Save [' + cnt + ']: ' + data);
                    }
                }
                offset = 0;
                X = new Float32Array(batch * size * size);
                Y = new Float32Array(batch * size * size);
                Z = new Float32Array(batch);
                C = 0;
            }
            for (let i = 0; i < size * size; i++) {
                X[offset + rotate(i, size, ix)] = board[i] * player;
            }
            Y[offset + rotate(move, size, ix)] = (player * winner > 0) ? 1 : 0; // R - V
            Z[offset] = player * winner; // R
//          dump(X, size, offset, Y);
            C++;
            offset += size * size;
        }
        board[move] = player;
    }
}

function decode(fen, board, size, offset, player) {
    let pos = 0;
    for (let i = 0; i < fen.length; i++) {
        const c = fen[i];
        if (c != '/') {
            if ((c >= '0') && (c <= '9')) {
                pos += +c;
            } else {
                let ix = _.indexOf(LETTERS, c);
                if (ix >= 0) {
                    let p = 1;
                    if (ix >= 14) {
                        p = -p;
                        ix -= 14;
                    }
                    ix++;
                    for (; ix > 0; ix--) {
                        board[offset + pos] = p * player;
                        pos++;
                    }
                }
            }
            if (pos >= size * size) break;
        } 
    }
}

module.exports.dump = dump;
module.exports.proceed = proceed;
module.exports.decode = decode;

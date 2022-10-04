"use strict";

const _ = require('underscore');
const ml = require('./model');

const LETTERS = 'ABCDEFGHIabcdefghi';

const N = 0;
const E = 1;
const W = 2;
const S = 3;

let dirs = null;

let X = null;
let Y = null;
let Z = null;

let C = 0;
let xo = 0;
let yo = 0;

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

function getDir(ix, size) {
    if (dirs === null) {
        dirs = [
            -size, // N
            1,     // E
            -1,    // W
            size   // S
        ];
    }
    return dirs[ix];
}

function navigate(size, pos, ix) {
    const x = pos % size;
    const y = (pos / size) | 0;
    if ((ix == N) && (y == 0)) return null;
    if ((ix == E) && (x == size - 1)) return null;
    if ((ix == W) && (x == 0)) return null;
    if ((ix == S) && (y == size - 1)) return null;
    return pos + getDir(ix, size);
}

function expanse(board, size, player, group) {
    let dame = [];
    for (let ix = 0; ix < group.length; ix++) {
        _.each([N, E, W, S], function(dir) {
            const p = navigate(size, group[ix], dir);
            if (p === null) return;
            if (_.indexOf(group, p) >= 0) return;
            if (Math.abs(board[p]) < 0.01) {
                dame.push(p);
                return;
            }
            if (board[p] * player < -0.01) return;
            group.push(p);
        });
    }
    return dame;
}

function analyze(board, size) {
    let r = []; let done = [];
    for (let pos = 0; pos < size * size; pos++) {
        if (_.indexOf(done, pos) >= 0) continue;
        if (Math.abs(board[pos]) < 0.01) continue;
        const p = board[pos];
        let g = [pos];
        const d = expanse(board, size, p, g);
        r.push({
            player: p,
            group: g,
            dame: d.length
        });
        done = _.union(done, g);
    }
    return r;
}

function encode(board, size, player, offset, X, ix) {
    if (ml.PLANE_COUNT == 1) {
        for (let pos = 0; pos < size * size; pos++) {
            X[offset + rotate(pos, size, ix)] = board[pos] * player;
        }
    } else if (ml.PLANE_COUNT == 2) {
        const po = size * size;
        for (let pos = 0; pos < size * size; pos++) {
            if (board[pos] * player > 0.01) {
                X[offset + rotate(pos, size, ix)] = 1;
            }
            if (board[pos] * player < -0.01) {
                X[offset + po + rotate(pos, size, ix)] = 1;
            }
        }
    } else {
        const po = size * size * (ml.PLANE_COUNT >> 1);
        const stat = analyze(board, size);
        for (let i = 0; i < stat.length; i++) {
            if (stat[i].player * player > 0.01) {
                if (stat[i].dame == 1) {
                    for (let j = 0; j < stat[i].group.length; j++) {
                        X[offset + rotate(stat[i].group[j], size, ix)] = 1;
                    }
                    continue;
                }
                let fs = size * size;
                if ((ml.PLANE_COUNT == 4) || (stat[i].dame == 2)) {
                    for (let j = 0; j < stat[i].group.length; j++) {
                        X[offset + fs + rotate(stat[i].group[j], size, ix)] = 1;
                    }
                    continue;
                }
                fs += size * size;
                if (stat[i].dame == 3) {
                    for (let j = 0; j < stat[i].group.length; j++) {
                        X[offset + fs + rotate(stat[i].group[j], size, ix)] = 1;
                    }
                    continue;
                }
                fs += size * size;
                for (let j = 0; j < stat[i].group.length; j++) {
                    X[offset + fs + rotate(stat[i].group[j], size, ix)] = 1;
                }
            } else {
                if (stat[i].dame == 1) {
                    for (let j = 0; j < stat[i].group.length; j++) {
                        X[offset + po + rotate(stat[i].group[j], size, ix)] = 1;
                    }
                    continue;
                }
                let fs = size * size;
                if ((ml.PLANE_COUNT == 4) || (stat[i].dame == 2)) {
                    for (let j = 0; j < stat[i].group.length; j++) {
                        X[offset + po + fs + rotate(stat[i].group[j], size, ix)] = 1;
                    }
                    continue;
                }
                fs += size * size;
                if (stat[i].dame == 3) {
                    for (let j = 0; j < stat[i].group.length; j++) {
                        X[offset + po + fs + rotate(stat[i].group[j], size, ix)] = 1;
                    }
                    continue;
                }
                fs += size * size;
                for (let j = 0; j < stat[i].group.length; j++) {
                    X[offset + po + fs + rotate(stat[i].group[j], size, ix)] = 1;
                }
            }
        }
    }
}

function isDigit(c) {
    if (c == '-') return true;
    return (c >= '0') && (c <= '9');
}

async function proceed(model, size, batch, data, logger) {
    if (data.length % 2 != 0) return;
    let board = new Float32Array(size * size);
    let R = (data.length % 4 != 0) ? 1 : -1;
    let player = 1;
    let pos = 0;
    while (pos < data.length - 1) {
        let V = 0; let s = 0.1;
        while ((pos < data.length) && isDigit(data[pos])) {
            if (data[pos] == '-') {
                V = -V;
                continue;
            }
            V += +data[pos] * s;
            s = s / 10;
        }
        const x = _.indexOf(LETTERS, data[pos]);
        if ((x < 0) || (x >= size)) return;
        const y = _.indexOf(LETTERS, data[pos + 1].toUpperCase());
        if ((y < 0) || (y >= size)) return;
        pos += 2;
        const move = y * size + x;
        for (let ix = 0; ix < 8; ix++) {
            if ((X === null) || (C >= batch)) {
                if (X !== null) {
                    await ml.fit(model, size, X, Y, Z, C, logger);
                    cnt++;
                    if ((cnt % 1000) == 0) {
                        await ml.save(model, 'go-' + ml.PLANE_COUNT + '-' + cnt + '.json');
                        console.log('Save [' + cnt + ']: ' + data);
                        logger.info('Save [' + cnt + ']: ' + data);
                    }
                }
                xo = 0; yo = 0;
                X = new Float32Array(ml.PLANE_COUNT * batch * size * size);
                Y = new Float32Array(batch * size * size);
                Z = new Float32Array(batch);
                C = 0;
            }
            encode(board, size, player, xo, X, ix);
            Y[yo + rotate(move, size, ix)] = (R - V) * player
            Z[C] = R * player;
//          dump(X, size, offset, Y);
            xo += size * size * ml.PLANE_COUNT;
            yo += size * size;
            C++;
        }
        board[move] = player;
        player = -player;
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

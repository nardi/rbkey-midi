#!/usr/bin/env node

var _ = require('underscore');
var RBKeyboard = require('./rbkey');
var midi = require('midi');
var readline = require('readline');

var version = require('./package.json').version;

readline.open = function(input, output) {
    return this.createInterface({
        input: input || process.stdin,
        output: output || process.stdout
    });
};

// Lazy error handling
process.on('uncaughtException', function(error) {
    console.error('Error: ' + error.message + '\n');
    process.exit();
});

console.log('\nWelcome to the Rock Band Keyboard to MIDI bridge version ' + version + '!');

var kb = new RBKeyboard();
var octave = 0;
var octaveData = {};
var output = new midi.output();
var touch = { on: false, mode: 'PB' };

kb.onNoteOn = function(note, velocity) {
    console.log('Pressed note ' + note + ' with velocity ' + velocity);
    octaveData[note] = octave;
    output.sendMessage([0x90, 60 + 12 * octave + note, velocity]);
}

kb.onNoteOff = function(note, velocity) {
    console.log('Released note ' + note);
    output.sendMessage([0x80, 60 + 12 * octaveData[note] + note, velocity]);
    octaveData[note] = undefined;
}

kb.onLeft = function(press) {
    console.log((press ? 'Pressed' : 'Released') + ' left on D-Pad');
    if (press)
        octave -= octave > -5 ? 1 : 0;
}

kb.onRight = function(press) {
    console.log((press ? 'Pressed' : 'Released') + ' right on D-Pad');
    if (press)
        octave += octave < 4 ? 1 : 0;
}

kb.on1 = function(press) {
    console.log((press ? 'Pressed' : 'Released') + ' the 1 button');
    output.sendMessage([0xB0, 16, press ? 127 : 0]);
}

kb.on2 = function(press) {
    console.log((press ? 'Pressed' : 'Released') + ' the 2 button');
    output.sendMessage([0xB0, 17, press ? 127 : 0]);
}

kb.onA = function(press) {
    console.log((press ? 'Pressed' : 'Released') + ' the A button');
    output.sendMessage([0xB0, 18, press ? 127 : 0]);
}

kb.onB = function(press) {
    console.log((press ? 'Pressed' : 'Released') + ' the B button');
    output.sendMessage([0xB0, 19, press ? 127 : 0]);
}

kb.onTouchOn = function(percentage) {
    console.log('Touched touch strip at ' + percentage + '%');
    if (touch.mode == 'PB')
        output.sendMessage([0xE0, 0, (1.27 * percentage) | 0]);
    else if (touch.mode == 'Mod')
        output.sendMessage([0xB0, 1, (1.27 * percentage) | 0]);
    touch.on = true;
}

kb.onTouchOff = function(percentage) {
    console.log('Let go of touch strip');
    if (touch.mode == 'PB')
        output.sendMessage([0xE0, 0, 64]);
    touch.on = false;
}

kb.onTouchButton = function(press) {
    console.log((press ? 'Pressed' : 'Released') + ' touch strip button');
    if (press && !touch.on)
        touch.mode = touch.mode == 'PB' ? 'Mod' : 'PB';
}

console.log('Available MIDI output ports:');
for (var i = 0; i < output.getPortCount(); i++)
    console.log('\tPort ' + i + ': ' + output.getPortName(i));

function pickPort() {
    var rl = readline.open();
    rl.question('Which port should I send the MIDI data to? Port ', function(port) {
        rl.close();
        port = parseInt(port);
        try { output.openPort(port); }
        catch (e) {
            console.log('Error opening port: ' + e.message);
            rl.close();
            pickPort();
            return;
        }
        console.log('Now sending data to ' + output.getPortName(port) + '...\n');
        console.log('While playing use left and right on the D-Pad to switch octaves, and press the '
            + 'button next to the touch strip to toggle between pitch bend and modulation.\n');
        kb.start();
    });
}
pickPort();

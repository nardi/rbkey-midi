var _ = require('underscore');
var HID = require('node-hid');
var util = require('util');

_.mixin({
    sum: function(obj) {
        if (!_.isArray(obj) || obj.length == 0) return 0;
        return _.reduce(obj, function(sum, n) {
            return sum += n;
        });
    }
});

module.exports = function RBKeyboard() {
    var devices = HID.devices();
    var validDevs = _.filter(devices,
        function(d) { return d.vendorId == 7085 && d.productId == 13104; });
    if (!validDevs.length)
        throw new Error('No usable devices found.');

    var device = new HID.HID(validDevs[0].path);
    var noteData = [];
    for (var i = 0; i < 25; i++) noteData[i] = false;
    var dpadData = {};
    var dirs = { Left: 6, Right: 2, Up: 0, Down: 4 };
    _.each(dirs, function(v, k) { dpadData[k] = false });
    var touchData = 0;
    var touchButtonData = false;

    function processData(data) {
        // Uncomment these lines to print the raw data, useful for development
        //_.each(data, function(d) { util.print(d + ' '); });
        //console.log();

        var dpad = data[2];
        _.each(dirs, function(dir, name) {
            var pressed = dpad == dir;
            if (dpadData[name] != pressed) {
                this.call('on' + name, pressed);
                dpadData[name] = pressed;
            }
        }, this);

        // Code for 1, 2, A, B
        
        var touch = data[15];
        if (touchData != touch) {
            touch != 0 ? this.call('onTouchOn', touch) : this.call('onTouchOff');
            touchData = touch;
        }
        
        var touchButton = data[13] != 0;
        if (touchButtonData != touchButton) {
            this.call('onTouchButton', touchButton);
            touchButtonData = touchButton;
        }

        var note = 0;
        for (var i = 5; i <= 8; i++) {
            note += data[i] << (8 * (8 - i));
        }
        data[8] = data[8] & 0x7F;
        var velocityData = _.filter(data.slice(8, 13), function(v) { return v != 0; });
        for (var i = 0; i < 25; i++) {
            if (noteData[i] && velocityData.length) {
                noteData[i] = velocityData[0];
                velocityData = velocityData.slice(1);
            }

            var mask = 0x80000000 >>> i;
            var noteOn = (note & mask) != 0;
            if ((noteData[i] != 0) != noteOn) {
                var velocity = 0;
                if (noteOn) {
                    if (velocityData.length) {
                        velocity = velocityData[0];
                        velocityData = velocityData.slice(1);
                    }
                    else {
                        var curVelocities = _.chain(noteData).filter(function(v) { return v != 0; }).values();
                        velocity = (curVelocities.sum().value() / curVelocities.value().length) | 0;
                    }
                }
                noteOn ? this.call('onNoteOn', i, velocity) : this.call('onNoteOff', i, noteData[i]);
                noteData[i] = velocity;
            }
        }
    };

    var onRead = _.bind(function(error, data) {
        if (error) throw error;
        processData.call(this, data);
        data = null;
        device.read(onRead);
    }, this);

    this.start = function() {
        device.read(onRead);
    };
    
    this.close = function() {
        device.close();
    };
    
    this.call = function(name) {
        if (typeof this[name] === 'function') {
            this[name].apply(this, Array.prototype.slice.call(arguments, 1));
        }
    };
}
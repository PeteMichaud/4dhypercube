/*
 * 4D Hypercube
 */

(function(Hypercube) {

    //constants
    DEFAULT_STARTING_SCALE = 2;
    MIN_SCALE = 1.5;
    MAX_SCALE = 10;
    DEFAULT_STARTING_LINE_WIDTH = 4;

    Hypercube.Shape = function() {
        return new Shape(Array.prototype.slice.call(arguments, 0));
    };

    function Shape(args) {
        var self        = this;
        var vertices    = args[0];
        var edges       = args[1];

        // Rotate relative to the original shape to avoid rounding errors, also dragons
        var rotatedVertices = new Array(vertices.length);
        clone_vertices();

        // This is where we store the current rotations about each axis.
        var rotations = { xy: 0, xz: 0, xw: 0, yz: 0, yw: 0, zw: 0 };

        var rotation_order = {
            yz: 1,
            xw: 1,
            yw: 1,
            zw: 1,
            xy: 1,
            xz: 1,
        };

        // Multiplication by vector rotation matrices of dimension 4
        var rotate_vertex= {
            xy: function(v, s, c) {
                tmp = c * v.x + s * v.y;
                v.y = -s * v.x + c * v.y;
                v.x = tmp;
            },
            xz: function(v, s, c) {
                tmp = c * v.x + s * v.z;
                v.z = -s * v.x + c * v.z;
                v.x = tmp;
            },
            xw: function(v, s, c) {
                tmp = c * v.x + s * v.w;
                v.w = -s * v.x + c * v.w;
                v.x = tmp;
            },
            yz: function(v, s, c) {
                tmp = c * v.y + s * v.z;
                v.z = -s * v.y + c * v.z;
                v.y = tmp;
            },
            yw: function(v, s, c) {
                tmp = c * v.y - s * v.w;
                v.w = s * v.y + c * v.w;
                v.y = tmp;
            },
            zw: function(v, s, c) {
                tmp = c * v.z - s * v.w;
                v.w = s * v.z + c * v.w;
                v.z = tmp;
            }
        };

        var eventCallbacks = {};

        self.getVertices = function() {
            return rotatedVertices;
        };

        self.getEdges = function() {
            return edges;
        };

        self.getRotations = function() {
            return rotations;
        };

        // This will copy the original shape and put a rotated version into rotatedVertices
        self.rotate = function(axis, theta)  {
            addToRotation(axis, theta);
            apply_rotations();
            triggerEventCallbacks('rotate');
        };

        self.on = function(eventName, callback) {
            if (eventCallbacks[eventName] === undefined) {
                eventCallbacks[eventName] = [];
            }
            eventCallbacks[eventName].push(callback);
        };

        function triggerEventCallbacks(eventName) {
            if (eventCallbacks[eventName] !== undefined) {
                for (index in eventCallbacks[eventName]) {
                    eventCallbacks[eventName][index].call(self);
                }
            }
        }

        function addToRotation(axis, theta) {
            rotations[axis] = (rotations[axis] + theta) % (2 * Math.PI);
        }

        function apply_rotations() {
            clone_vertices();

            for (var axis in rotation_order) {

                var s = Math.sin(rotations[axis]);
                var c = Math.cos(rotations[axis]);

                for (var i in vertices)
                {
                    rotate_vertex[axis](rotatedVertices[i], s, c);
                }
            }
        }

        function clone_vertices() {
            for (var i in vertices) {
                rotatedVertices[i] = {
                    x: vertices[i].x,
                    y: vertices[i].y,
                    z: vertices[i].z,
                    w: vertices[i].w
                };
            }
        }
    }

    Hypercube.Viewport = function() {
        return new Viewport(Array.prototype.slice.call(arguments, 0));
    };

    function Viewport(args) {
        var self    = this;
        var shape   = args[0];
        var canvas  = args[1][0];
        var options = args[2];

        options = options || {};

        var scale = options.scale || DEFAULT_STARTING_SCALE;
        var bound = Math.min(canvas.width, canvas.height) / 2;

        var context = canvas.getContext('2d');
        context.lineWidth = options.lineWidth || DEFAULT_STARTING_LINE_WIDTH;
        context.lineJoin = 'round';

        var start_mouse;

        self.render = function() {
            var vertices = shape.getVertices();
            var edges = shape.getEdges();

            context.clearRect(0, 0, canvas.width, canvas.height);

            //calculate vertices
            var transformed = [];
            for (var i in vertices) {
                var z_ratio = vertices[i].z / scale;
                transformed[i] = {
                    x: Math.floor(canvas.width / 2 + (0.90 + z_ratio * 0.30) * bound * (vertices[i].x / scale)) + 0.5,
                    y: Math.floor(canvas.height / 2 - (0.90 + z_ratio * 0.30) * bound * (vertices[i].y / scale)) + 0.5,
                    z: 0.60 + 0.40 * z_ratio,
                    w: 96 + Math.floor(96 * vertices[i].w / scale)
                };
            }

            //render edges
            for (var i in edges) {
                var x = [transformed[edges[i][0]].x, transformed[edges[i][1]].x];
                var y = [transformed[edges[i][0]].y, transformed[edges[i][1]].y];
                var z = [transformed[edges[i][0]].z, transformed[edges[i][1]].z];
                var w = [transformed[edges[i][0]].w, transformed[edges[i][1]].w];
                context.beginPath();
                context.moveTo(x[0], y[0]);
                context.lineTo(x[1], y[1]);
                context.closePath();
                var gradient = context.createLinearGradient(x[0], y[0], x[1], y[1]);
                gradient.addColorStop(0, 'rgba(0, ' + w[0] + ', 0, 1)'); //could use z for alpha
                gradient.addColorStop(1, 'rgba(0, ' + w[1] + ', 0, 1)');
                context.strokeStyle = gradient;
                context.stroke();
            }

        };

        //Bind Events
        $(document).mousemove(function(e) {

            if (start_mouse == null) {
                start_mouse = mouseCoords(e, canvas);
                start_mouse.x -= Math.floor(canvas.width / 2);
                start_mouse.y = Math.floor(canvas.height / 2) - start_mouse.y;
            }

            var current_mouse = mouseCoords(e, canvas);
            current_mouse.x -= Math.floor(canvas.width / 2);
            current_mouse.y = Math.floor(canvas.height / 2) - current_mouse.y;
            var motion = { 'x': current_mouse.x - start_mouse.x, 'y': current_mouse.y - start_mouse.y };

            if (e.shiftKey && (e.altKey || e.ctrlKey)) {
                shape.rotate('xy', Math.PI * motion.x / bound);
                shape.rotate('zw', Math.PI * motion.y / bound);
            }
            else if (e.shiftKey) {
                shape.rotate('xw', Math.PI * motion.x / bound);
                shape.rotate('yw', Math.PI * motion.y / bound);
            }
            else {
                shape.rotate('xz', Math.PI * motion.x / bound);
                shape.rotate('yz', Math.PI * motion.y / bound);
            }

            start_mouse = current_mouse;

            self.render();
        });


        $(canvas)
            //when the mousewheel spins reset scale and line width for a "zoom" effect
            .mousewheel(function(event, delta) {
                scale += (delta / 10.0);
                if (scale < MIN_SCALE)
                    scale = MIN_SCALE;
                else if (scale > MAX_SCALE)
                    scale = MAX_SCALE;

                context.lineWidth = 8 / scale;

                self.render();
            });

        var $window = $(window);

        function wResize(){
            canvas.width = $window.width();
            canvas.height = $window.height();
            bound = Math.min(canvas.width, canvas.height) / 2;

            self.render();
        }

        $window.resize(wResize);
        wResize();

        function mouseCoords(e, element) { // http://answers.oreilly.com/topic/1929-how-to-use-the-canvas-and-draw-elements-in-html5/
            var x;
            var y;
            if (e.pageX || e.pageY) {
                x = e.pageX;
                y = e.pageY;
            }
            else {
                x = e.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
                y = e.clientY + document.body.scrollTop + document.documentElement.scrollTop;
            }
            x -= element.offsetLeft;
            y -= element.offsetTop;
            return { 'x': x, 'y': y };
        }
    }

})(window.Hypersolid = window.Hypersolid || {});

$(document).ready(function(){
    $('#instructions, #link-back').fadeIn(2000);

    Hypersolid.Viewport(
        Hypersolid.Hypercube(),
        $('#hypercube-canvas'))
        .render();

});


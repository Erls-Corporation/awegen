var sys = require("sys")
  , fs = require('fs')
  , express = require('express')
  , io = require('socket.io')
  , Canvas = require('canvas')
  , Image = Canvas.Image
  , exec = require("child_process").exec
  , form = require('connect-form');

var app = express.createServer(form({ keepFilename: true, keepExtensions: true, uploadDir: __dirname + '/images' }));
var server = io.listen(app);

require('nko')('o5nIpNA2L1YuKWrV');

// Serve static files
app.use("/css", express.static(__dirname + '/public/css'));
app.use("/js", express.static(__dirname + '/public/js'));

app.get('/', function(request, response) {
    response.sendfile(__dirname + '/public/index.html');
});

app.post('/upload', function(request, response, next) {
    request.form.complete(function(err, fields, files) {
        if (err) {
            console.log('Error: Unable to save image');
        } else {
            console.log('\nuploaded %s to %s', files.image.filename, files.image.path);
            response.redirect('back');
        }
    });
});

/*
 * Reponse with error for client Ajax Requests
 */
var errorResponse = function(response, message) {
    response.writeHead(200, {"Content-Type": "text/html"});
    response.write(JSON.stringify({'error':message}));
    response.end();
};

server.sockets.on('connection', function (socket) {

  // Send image list to client
  socket.on('client-connect', function (data) {
    console.log('Sending image list to client');

    fs.readdir(__dirname + '/images', function(err, files) {
      if (err) throw err;

      console.log(sys.inspect(files));
      socket.emit('image-list', JSON.stringify(files));
    });
  });

  // Listen for sourcecode events from client
  socket.on('sourcecode', function(data) {
    console.log('Receiving sourcecode: \n' + data);

    var json_message = JSON.parse(data).sourcecode;
    var imageName = json_message.split(' ')[0]
    var json_message = "images/" + json_message
    var imageOutput = "images_output/" + new Date().getTime() + imageName
    var convert_params = json_message + " " + imageOutput

    console.log(convert_params);
    child = exec("convert " + convert_params, function (error, stdout, stderr) {
      console.log("stdout: " + stdout);
      console.log("stderr: " + stderr);
      console.log("error: " + error)

      var output_image = null;
      var original_image = null;

      original_image = fs.readFileSync(__dirname + '/images/' + imageName);
      if (error !== null) {
        socket.emit('error');
        console.log("stdout: " + stdout);
      } else {
        output_image = fs.readFileSync(__dirname + '/' + imageOutput);
      }

      var image = new Image;
      if (output_image !== null) {
        image.src = output_image;
      } else {
        image.src = original_image;
      }
      var canvas = new Canvas(image.width, image.height);
      var ctx = canvas.getContext('2d');
      try {
        ctx.drawImage(image, 0, 0, image.width, image.height);
      } catch (err) {
        image.src = original_image;
        canvas = new Canvas(image.width, image.height);
        ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, image.width, image.height);
        socket.emit('error');
      }

      var data = {'data':canvas.toDataURL(), 'width':image.width, 'height':image.height};
      socket.emit('image', data);
    });
  });
});

app.listen(process.env.NODE_ENV === 'production' ? 80 : 8000, function() {
  console.log('Ready');

  // if run as root, downgrade to the owner of this file
  if (process.getuid() === 0)
    require('fs').stat(__filename, function(err, stats) {
      if (err) return console.log(err)
      process.setuid(stats.uid);
    });
});

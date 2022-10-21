const NodeMediaServer = require('node-media-server');
const express = require('express');
const util = require('./utils')
const RoomInfo = require('./RoomInfo')
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);


server.listen(3000, () => {
    console.log('listening on *:3000');
});


const config = {
  logType: 3,
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8000,
    mediaroot: './media',
    allow_origin: '*'
  },
  https: {
    port: 8443,
    key:'./privatekey.pem',
    cert:'./certificate.pem',
  },
  trans: {
    ffmpeg: '/opt/homebrew/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=5:hls_flags=delete_segments]',
        hlsKeep: true, // to prevent file delete after end the stream
      }
    ]
  }
};


var nms = new NodeMediaServer(config)
nms.run();


// socketio

var roomList = {} // key la roomid, value la RoomInfo


// connect vao Room dc chon
io.on('connection', (socket) => {

    //console.log('socket connect info: ' + JSON.stringify(socket.handshake))
    // room id dc tao truoc do qua ham open room
    console.log('roomid: ' + socket.handshake.query.roomId)

    // get room id and join it
    let roomId = socket.handshake.query.roomId
    if (roomId) {
        if (roomList[roomId] != undefined) {
            socket.join(roomId)
            console.log('join ' + roomId)
        } else {
            console.log('Room is not open')
        }
    }

    socket.on('disconnect', () => {
        console.log('user disconnected');
    })

    // chat in room
    socket.on('send_message', (message, senderName) => {
        console.log('gui tin nhan in room: ' + roomId)
        socket.to(roomId).emit('receive_message', message, senderName)
    })

    // client dc nhan request sau khi accept se bat dau bao tin hieu doi host
    socket.on('will_change_state', (roomId, state) => {
        updateRoomState(socket, roomId, RoomStreamState.Wating)
    })

    // update host uid khi doi host
    socket.on('sv_change_hostUID', (roomId, uid) => {
        console.log('changeHostUID')
        let roomInfo = roomList[roomId]
        if (roomInfo) {
            updateRoomHost(socket, roomId, uid)
        }
    })

   

});
addCallback(nms)

const RoomStreamState = {
    Wating: 'Wating',
    Streaming: 'Streaming',
    Stopped: 'Stopped',
 }

 // update room state in db and broadcast to audience
function updateRoomState(roomId, state) {
    let info = roomList[roomId]
    if (info) {
        if (info.roomState == state) return
        if (state === RoomStreamState.Wating) {
            console.log('wating streamer')
            info.roomState = RoomStreamState.Wating
            io.in(roomId).emit('receive_state', 0)
       } else if (state === RoomStreamState.Streaming) {
            console.log('streaming')
            info.roomState = RoomStreamState.Streaming
            io.in(roomId).emit('receive_state', 1)
       } else {
            console.log('stopped')
            info.staroomStatete = RoomStreamState.Stopped
            io.in(roomId).emit('receive_state', -1)
       }
       console.log('update roomid:' + roomId + ' with state: ' + info.roomState)
    }
}

function updateRoomHost(socket, roomId, hostUID) {
    let info = roomList[roomId]
    if (info) {
        info.currentHostUID = hostUID
        socket.to(roomId).emit('client_change_hostUID', hostUID)
    }
}


/////////// node media callback
function addCallback(nms, socket) {
    nms.on('postConnect', (id, args) => {
        console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
      });
      
      nms.on('doneConnect', (id, args) => {
        console.log('[NodeEvent on doneConnect]', `id=${id} args=${JSON.stringify(args)}`);
      });
      
      nms.on('prePublish', (id, StreamPath, args) => {
        console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
        // let session = nms.getSession(id);
        // session.reject();
      });
      
      // event khi user da publish stream
      nms.on('postPublish', (id, StreamPath, args) => {
        console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
        // update roomState 
        let streamKey = StreamPath.substring(StreamPath.lastIndexOf('/') + 1)
        console.log('streamKey is: ' + streamKey)
        updateRoomState(streamKey, RoomStreamState.Streaming)
      });
      
      nms.on('donePublish', (id, StreamPath, args) => {
       console.log('in done publish')
        console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
        let streamKey = StreamPath.substring(StreamPath.lastIndexOf('/') + 1)
        console.log('done publish')
        updateRoomState(streamKey, RoomStreamState.Wating)
      });
      
      nms.on('prePlay', (id, StreamPath, args) => {
        console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
        // let session = nms.getSession(id);
        // session.reject();
      });
      
      nms.on('postPlay', (id, StreamPath, args) => {
        console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
      });
      
      nms.on('donePlay', (id, StreamPath, args) => {
        console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
      });


    }


// API route

// mo room livestream 
app.get('/openRoom', (req, res)=> {
    console.log('openRoom')
    let key = openRoom()
    res.json({ streamKey: key })
})

function openRoom() {
    // generate streamkey
    let streamkey =  util.uuid()
    let info = new RoomInfo(streamkey,RoomStreamState.Wating)
    roomList[streamkey] = info
    return streamkey
}
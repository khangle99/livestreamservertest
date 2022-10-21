// RoomInfo class
'use strict'
module.exports = class RoomInfo {
    constructor(roomId, roomState, currentHostUID) { // roomId la cung la streamkey
      this.roomId = roomId
      this.roomState = roomState
      this.memberCount = 1
      //this.friends = obj.friends != null ? obj.friends : []
      this.members = {} // key la user id, value la socketid , dung members de gui streamkey den cho member
      this.currentHostUID = currentHostUID
    }
  }

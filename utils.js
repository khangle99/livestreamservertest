const uuid = require('uuid');

function uuidv4() {
    return  uuid.v4()
}

module.exports = {
    uuid : uuidv4
}
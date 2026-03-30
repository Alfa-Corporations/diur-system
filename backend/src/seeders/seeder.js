
const db = require("../utils/database");
const initModels = require("../models/initModels");
const { } = require("../models");

initModels();

const users = [
    { },
    { },
]

db.sync({ force: true })
    .then(() => {
        console.log("Iniciando la plantación de Información");
        
        setTimeout(() => users.forEach(user => Users.create(user)), 1000);
    })
    .then(() => console.log("Implantation complete"))
    .catch((error) => console.log(error))

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var ParseDashboard = require('parse-dashboard');
var dotenv = require('dotenv');
var Wompi = require('./cloud/wompi');
dotenv.config();

const { PORT, PARSE_MONGODB_URI, PARSE_APPID, PARSE_MASTERKEY, PARSE_SERVER_URL, PARSE_USERNAME, PARSE_PASSWORD, WOMPI_PRVKEY, WOMPI_SNBKEY, API_WEBHOOK } = process.env

var paymentMethods = {}

if (WOMPI_PRVKEY) {
    paymentMethods['wompi'] = new Wompi("https://production.wompi.co/v1", WOMPI_PRVKEY)
}

if (WOMPI_SNBKEY) {
    paymentMethods['wompiSandbox'] = new Wompi("https://sandbox.wompi.co/v1", WOMPI_SNBKEY)
}

var api = new ParseServer({
    databaseURI: PARSE_MONGODB_URI,
    cloud: './cloud/main.js',
    appId: PARSE_APPID,
    masterKey: PARSE_MASTERKEY,
    serverURL: PARSE_SERVER_URL
});

var options = { allowInsecureHTTP: false };

var dashboard = new ParseDashboard({
    "apps": [
        {
            "serverURL": PARSE_SERVER_URL,
            "appId": PARSE_APPID,
            "masterKey": PARSE_MASTERKEY,
            "appName": "Payment"
        }
    ],
    "users": [
        {
            "user": PARSE_USERNAME,
            "pass": PARSE_PASSWORD
        },
    ]
});

var app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post('/getLink', async (req, res) => {
    // Validar parámetros

    if (!req.body) return res.json(error)
    // Desestructurar parámetros
    const { title, description, id, price, method, application } = req.body
    if (!title || !description || !id || !price || !method || !application) return res.json(error)
    // Verificar que el método de pago exista
    if (!paymentMethods[method]) return res.json({ success: false, message: "Método no soportado" })
    // Verificar que la aplicación exista
    const app = await new Parse.Query("Application").get(application, { useMasterKey: true })
    if (!app) return res.json({ success: false, message: "Aplicación no encontrada" })
    // Generar el link de pago
    const result = await paymentMethods[method].getLink(title, description, id, price)
    // Si se generó correctamente, guardar el ID en la base de datos
    if (result.success) {
        const link = new Parse.Object("Link");
        link.set("code", result.data.id);
        link.set("app", app);
        const acl = new Parse.ACL();
        acl.setPublicReadAccess(false);
        acl.setPublicWriteAccess(false);
        link.setACL(acl);
        await link.save(null, { useMasterKey: true });
    }
    res.json(result)
})

app.post(API_WEBHOOK || '/webhook', async (req, res) => {
    const error = { success: false, message: "Faltan parámetros" }
    if (!req.body) return res.json(error);
    const data = req.body;
    //Identificar de donde estan llamando la petición
    const id = data.data.transaction.payment_link_id
    const link = await new Parse.Query("Link").equalTo("code", id).include("app").first({ useMasterKey: true });
    if (!link) return res.send({ success: false, message: "Link no encontrado" });
    const app = link.get("app");
    let headers = {
        'Content-Type': 'application/json',
        'X-Parse-Application-Id': app.get("appid"),
    };
    if(app.get("restkey")){
        headers['X-Parse-REST-API-Key'] = app.get("restKey");
    }
    await fetch(`${link.get("app").get("url")}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
    });
    return res.json({ success: true });
})
const init = async () => {
    await api.start();
    app.use('/parse', api.app);
    app.use('/dashboard', dashboard);
    app.listen(PORT, () => {
        console.log('Servidor iniciado para http');
    });
}

init();
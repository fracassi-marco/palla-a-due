// La versione dell'app è quella del tag git (v1.2.3 -> 1.2.3), passata dalla CI in APP_VERSION.
// In locale resta quella di app.json.
module.exports = ({ config }) => ({
  ...config,
  version: process.env.APP_VERSION || config.version,
});

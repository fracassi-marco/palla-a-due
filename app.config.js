// La versione dell'app è quella del tag git (v1.2.3 -> 1.2.3), passata dalla CI in APP_VERSION.
// In locale resta quella di app.json.
// Il versionCode Android deve crescere a ogni upload su Play: la CI lo passa in APP_VERSION_CODE
// (numero di run), in locale resta quello di app.json (o 1).
module.exports = ({ config }) => ({
  ...config,
  version: process.env.APP_VERSION || config.version,
  android: {
    ...config.android,
    versionCode: Number(process.env.APP_VERSION_CODE) || config.android?.versionCode || 1,
  },
  plugins: [...(config.plugins ?? []), "./plugins/withReleaseSigning"],
});

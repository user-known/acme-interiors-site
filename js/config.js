/* Acme Interiors — site configuration. This file is public; never put tokens or keys in it. */
window.ACME_CONFIG = {
  // Repository the admin page commits to. Leave owner/repo empty to auto-detect them on
  // https://<owner>.github.io/<repo>/ (the admin can also set them in Admin → Settings).
  github: { owner: '', repo: '', branch: 'main' },

  // Google Apps Script web-app URL that stores form submissions (see apps-script/README section in README.md).
  // While this is empty, forms show a "preview only" message and nothing is sent.
  formsEndpoint: '',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      const al = (request.headers.get('accept-language') ?? '').toLowerCase();
      const en = al.indexOf('en');
      const pt = al.indexOf('pt');
      const lang = en !== -1 && (pt === -1 || en < pt) ? 'en' : 'pt';
      return Response.redirect(`${url.origin}/${lang}/`, 302);
    }
    return env.ASSETS.fetch(request);
  },
};

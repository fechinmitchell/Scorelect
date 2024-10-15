const { SitemapStream, streamToPromise } = require('sitemap');
const fs = require('fs');

async function generateSitemap() {
  const links = [
    { url: '/', changefreq: 'daily', priority: 1.0 },
    { url: '/about', changefreq: 'weekly', priority: 0.8 },
    { url: '/contact', changefreq: 'monthly', priority: 0.7 },
    // Add more URLs based on the routes in your React app
  ];

  const stream = new SitemapStream({ hostname: 'https://www.scorelect.com' });

  links.forEach(link => {
    stream.write(link);
  });

  stream.end();

  const sitemap = await streamToPromise(stream);
  fs.writeFileSync('./public/sitemap.xml', sitemap.toString());
  console.log('Sitemap successfully generated at ./public/sitemap.xml');
}

generateSitemap();

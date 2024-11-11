// generate-sitemap.js

const { SitemapStream, streamToPromise } = require('sitemap');
const fs = require('fs');

// Define your domain
const hostname = 'https://www.scorelect.com/'; // Replace with your actual domain

// List all the routes in your React application
const links = [
  { url: '/', changefreq: 'daily', priority: 1.0 },
  { url: '/about', changefreq: 'monthly', priority: 0.8 },
  { url: '/contact', changefreq: 'monthly', priority: 0.8 },
  { url: '/profile', changefreq: 'weekly', priority: 0.9 },
  { url: '/analysis', changefreq: 'weekly', priority: 0.9 },
  { url: '/sports-datahub', changefreq: 'weekly', priority: 0.9 },
  { url: '/howto', changefreq: 'weekly', priority: 0.9 },
  { url: '/saved-games', changefreq: 'weekly', priority: 0.9 },
  { url: '/profile', changefreq: 'weekly', priority: 0.9 },
  // Add all other routes here
];

// Create a stream to write to
const sitemap = new SitemapStream({ hostname });

// Write each link to the stream
links.forEach((link) => {
  sitemap.write(link);
});

// Close the stream
sitemap.end();

// Stream the sitemap to a file
streamToPromise(sitemap)
  .then((data) => {
    fs.writeFileSync('./public/sitemap.xml', data.toString());
    console.log('Sitemap generated at public/sitemap.xml');
  })
  .catch((error) => {
    console.error('Error generating sitemap', error);
  });

// sitemap-generator.js

require('@babel/register')({
    presets: ['@babel/preset-env', '@babel/preset-react']
  });
  
  const Sitemap = require('react-router-sitemap').default;
  const router = require('./src/App').default; // Adjust the path to your main router component
  
  new Sitemap(router)
    .build('https://www.scorelect.com/') // Replace with your actual domain
    .save('./public/sitemap.xml'); // The sitemap will be saved in the public directory
  
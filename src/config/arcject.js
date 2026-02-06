import arcjet, { shield, detectBot, slidingWindow } from '@arcjet/node';



const aj = arcjet({
  // Get your site key from https://app.arcjet.com and set it as an environment
  // variable rather than hard coding.
  key: process.env.ARCJET_KEY,
  characteristics: ['ip.src'],
  rules: [
    shield({ mode: 'LIVE' }),
    detectBot({
      mode: process.env.NODE_ENV === 'production' ? 'LIVE' : 'DRY_RUN',
      allow: [
        'CATEGORY:SEARCH_ENGINE',
        'CATEGORY:PREVIEW',
        'CATEGORY:MONITOR',
      ],
    }),
  ],
});

export default aj;

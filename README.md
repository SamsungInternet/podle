# PODLE

Detailed write up to come:

## Architecture

Front End is written as Moustache Templates in `/views`

Front end assets are in `/static`

Search is powered by the Digital Podcast Search Service. See `lib/search.js`

Podcast files can be played in the browser's audio tags by being proxied through the server. See `lib/audio-proxy.js`


const request = require('request');
const notifier = require('node-notifier');

const { SKUS, SKUS_AUSTRALIA, COUNTRIES } = require('./constants');
const args = process.argv.slice(2);

let favorites = ['MK233LL/A', 'MMQW3LL/A'];
// Australia uses different SKUs, if passing in AU as the country code,
// this favorites list will be used instead of the default
let favoritesAustralia = ['MMQX3X/A', 'MKH53X/A', 'MMQW3X/A', 'MK233X/A'];

const control = 'MYD92LL/A';
let storeNumber = 'R172';
let state = 'CO';
let countryCode = '';
let skuList = SKUS;

if (args.length > 0) {
  const passedStore = args[0];
  const passedCountry = args[1] ?? 'US';
  if (passedStore.charAt(0) === 'R') {
    // All retail store numbers start with R
    storeNumber = passedStore;
    state = null;
  }
  countryCode = COUNTRIES[passedCountry];
  if (countryCode === '/au') {
    skuList = SKUS_AUSTRALIA;
    favorites = favoritesAustralia;
  }
}

const query =
  Object.keys(skuList)
    .map((k, i) => `parts.${i}=${encodeURIComponent(k)}`)
    .join('&') + `&searchNearby=true&store=${storeNumber}`;

let options = {
  method: 'GET',
  url: `https://www.apple.com${countryCode}/shop/fulfillment-messages?` + query,
};

request(options, function (error, response) {
  if (error) throw new Error(error);

  const body = JSON.parse(response.body);
  const storesArray = body.body.content.pickupMessage.stores;
  let skuCounter = {};
  let hasStoreSearchError = false;

  // Reset = "\x1b[0m"
  // Bright = "\x1b[1m"
  // Dim = "\x1b[2m"
  // Underscore = "\x1b[4m"
  // Blink = "\x1b[5m"
  // Reverse = "\x1b[7m"
  // Hidden = "\x1b[8m"

  // FgBlack = "\x1b[30m"
  // FgRed = "\x1b[31m"
  // FgGreen = "\x1b[32m"
  // FgYellow = "\x1b[33m"
  // FgBlue = "\x1b[34m"
  // FgMagenta = "\x1b[35m"
  // FgCyan = "\x1b[36m"
  // FgWhite = "\x1b[37m"

  // BgBlack = "\x1b[40m"
  // BgRed = "\x1b[41m"
  // BgGreen = "\x1b[42m"
  // BgYellow = "\x1b[43m"
  // BgBlue = "\x1b[44m"
  // BgMagenta = "\x1b[45m"
  // BgCyan = "\x1b[46m"
  // BgWhite = "\x1b[47m"

  switch (storeNumber) {
    case 'R437':
      console.log('\x1b[34m', `Houston area inventory`);
      break;
    case 'R151':
      console.log('\x1b[33m', `Southlake area inventory`);
      break;
    default:
      console.log(`Other area inventory`);
  }

  console.log('\x1b[0m\x1b[2m', '---------');
  const statusArray = storesArray
    .flatMap((store) => {
      if (state && state !== store.state) return null;

      const name = store.storeName;
      let productStatus = [];

      for (const [key, value] of Object.entries(skuList)) {
        const product = store.partsAvailability[key];

        hasStoreSearchError = product.storeSearchEnabled !== true;

        if (key === control && hasStoreSearchError !== true) {
          hasStoreSearchError = product.pickupDisplay !== 'available';
        } else {
          productStatus.push(`${value}: ${product.pickupDisplay}`);

          if (product.pickupDisplay !== 'unavailable') {
            console.log(`\x1b[32m`, `${value} in stock at ${store.storeName}`);
            let count = skuCounter[key] ?? 0;
            count += 1;
            skuCounter[key] = count;
          }
        }
      }

      return {
        name: name,
        products: productStatus,
      };
    })
    .filter((n) => n);

  let hasError = hasStoreSearchError;

  const inventory = Object.entries(skuCounter)
    .map(([key, value]) => `${skuList[key]}: ${value}`)
    .join('\n');

  let hasFavorites = Object.keys(skuCounter).some(
    (r) => favorites.indexOf(r) >= 0
  );
  let notificationMessage;

  if (inventory) {
    // console.log('\nInventory counts');
    // console.log('----------------');
    // console.log(inventory);

    notificationMessage = `${
      hasFavorites ? 'FOUND ULTIMATE! ' : ''
    }Some models found: ${inventory}`;
  } else {
    notificationMessage = 'No models found.';
    console.log('\x1b[2m', notificationMessage);
  }

  if (hasFavorites) {
    const message = hasError ? 'Possible error?' : notificationMessage;
    notifier.notify({
      title: 'MacBook Pro Availability',
      message: message,
      sound: hasError || inventory,
      timeout: false,
    });
  }
  // Log time at end
  console.log(`\nGenerated: ${new Date().toLocaleString()}`);
});

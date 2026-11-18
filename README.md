# HSBA site script

`hsba-site.js` and `hsba-site.css` are the custom code that runs on every page of [hsba.org](https://hsba.org). What they do is described at the top of each file.

## How the site loads them

Both tags go at the bottom of the page, before the site's Google Maps script:

```html
<link rel="stylesheet" href="https://bronsonavila.github.io/hsba-site-script/hsba-site.css">
<script src="https://bronsonavila.github.io/hsba-site-script/hsba-site.js" defer></script>
```

The browser does not use a stylesheet until it has run the scripts above it. After the Google Maps script, the hidden parts showed for about 3 seconds on a slow phone. Before it, they showed for about 0 seconds.

## Updates

The files are served by GitHub Pages from the `main` branch. A change pushed here reaches the site after GitHub Pages publishes it (usually within a few minutes; browsers may keep the old copy for up to 10 minutes). The tags above do not change.

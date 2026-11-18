# HSBA site script

`hsba-site.js` is the custom script that runs on every page of [hsba.org](https://hsba.org). It is loaded by one script tag in the site-wide footer:

```html
<script src="https://bronsonavila.github.io/hsba-site-script/hsba-site.js" defer></script>
```

The file is served by GitHub Pages from the `main` branch. A change pushed here reaches the site after GitHub Pages publishes it (usually within a few minutes; browsers may keep the old copy for up to 10 minutes).

What the script does is described at the top of `hsba-site.js`.

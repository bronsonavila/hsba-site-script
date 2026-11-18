# HSBA site script

`hsba-site.js` and `hsba-site.css` are the custom code that runs on every page of [hsba.org](https://hsba.org). What they do is described at the top of each file.

## How the site loads them

**If the page's `<head>` can hold tags (best: nothing flashes before it is hidden):**

```html
<link rel="stylesheet" href="https://bronsonavila.github.io/hsba-site-script/hsba-site.css">
<script src="https://bronsonavila.github.io/hsba-site-script/hsba-site.js" defer></script>
```

**If only the footer can hold a tag:**

```html
<script src="https://bronsonavila.github.io/hsba-site-script/hsba-site.js" defer></script>
```

The script loads `hsba-site.css` itself when the page does not. Hidden parts can show for a moment before the files load, mostly on the first page a member opens.

## Updates

The files are served by GitHub Pages from the `main` branch. A change pushed here reaches the site after GitHub Pages publishes it (usually within a few minutes; browsers may keep the old copy for up to 10 minutes). The tags above do not change.

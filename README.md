igv-web
=======

Lightweight HTML-5 versison of the Integrative Genomics Viewer (http://www.broadinstitute.org/igv).

To get started make sure you have `grunt-cli` installed. Development dependencies are installed via `npm install`.

Use `grunt concat` to build `dist/igv.js`.

Use `grunt uglify` to create the minified `dist/igv.min.js`.

Use `grunt md2html` to generate documentation in the `docs` directory.

Use `grunt serve` and open up a web browser to [http://localhost:9000/examples/ga4gh.html](http://localhost:9000/examples/ga4gh.html).
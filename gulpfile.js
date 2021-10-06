const {dest, src, watch, series, task, parallel} = require('gulp');
const pug = require('gulp-pug');
const {Transform} = require('stream');
const File = require('vinyl');
const rename = require("gulp-rename");

const browserSync = require('browser-sync').create();

task('browser-sync', done => {
    browserSync.init({
        server: {
            baseDir: "./dist/"
        }
    });
    done();
});

task('browser-reload', done => {
    browserSync.reload();
    done();
});

task('watch-browser', () => watch('dist/**/*', task('browser-reload')))

task('build-pug', () => {
    return src(['./src/**/*.pug', '!./src/**/_*.pug'])
        .pipe(pug())
        .pipe(rename((name) => {
            const match = name.basename.match(/\.([a-z]{2})$/)
            if (match) {
                name.dirname = `${match[1]}/${name.dirname}`
                name.basename = name.basename.substring(0, name.basename.length-3);
            }
        }))
        .pipe(new RedirectPageGenerator())
        .pipe(dest('./dist'));
});
task('watch-pug', () => watch('src/**/*', task('build-pug')));

task('watch', parallel(task('watch-pug'), task('watch-browser')));

task('build-bootstrap-css', () => src('node_modules/bootstrap/dist/css/bootstrap.min.css').pipe(dest('dist/css/')))
task('build-bootstrap-js', () => src('node_modules/bootstrap/dist/js/bootstrap.bundle.min.js').pipe(dest('dist/js/')))
task('build-CNAME', () => src('CNAME').pipe(dest('dist/')))

task('build', series([
    task('build-pug'),
    task('build-bootstrap-css'),
    task('build-bootstrap-js'),
    task('build-CNAME'),
]))

task('default', series([
    task('build'),
    task('browser-sync'),
    task('watch'),
]));

class RedirectPageGenerator extends Transform {
    constructor() {
        super({objectMode: true});
    }
    /**
     * @param file {File}
     * @param encoding
     * @param callback
     * @private
     */
    _transform(file, encoding, callback) {
        function encodeURL(path) {
            return path.split(/[\/\\]/g)
                .map(encodeURIComponent)
                .join('/');
        }
        function encodeHTML(body) {
            return body.replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
        }


        if (file.relative.match(/^[a-z]{2}\//)) {
            const relative = file.relative.substring(3);
            const relativeUrl = relative.replace(/(?<=\/|\\|^)index\.html$/, '');
            const html = `<!doctype html><head><title>Redirecting by Locale...</title><script>`
                +`const findLanguage = (langs) => {`
                +`for (let locale of navigator.languages)`
                +`for (let lang of langs)`
                +`if (locale.startsWith(lang)) return lang;`
                +`return langs[0]`
                +`};`
                +`location.href = '/' + findLanguage(['en', 'ja']) + '/' + ${JSON.stringify(encodeURL(relativeUrl))};`
                +`</script><body>`
                +`<noscript>`
                +`JavaScript is disabled. Please go to page depends on your language.`
                +`<ul>`
                +`<li><a href="${encodeHTML(`/en/${relativeUrl}`)}">english</a></li>`
                +`<li><a href="${encodeHTML(`/ja/${relativeUrl}`)}">japanese</a></li>`
                +`</ul>`
                +`</noscript>`
            const redirectFile = new File({
                cwd: file.cwd,
                base: file.base,
                path: `${file.base}/${relative}`,
                contents: Buffer.from(html),
            });
            this.push(redirectFile);
        }
        callback(null, file.clone({contents: false}));
    }
}

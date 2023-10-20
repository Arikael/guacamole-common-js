import gulp from 'gulp'
import concat from 'gulp-concat'
import insert from 'gulp-insert'
import fs from 'node:fs'
import xml2js from 'xml2js'
import uglify from 'gulp-uglify'
import rename from 'gulp-rename'
import https from 'node:https'
import url from 'node:url'
import tar from 'tar'

const zipFile = './tmp/guacamole.tar.gz'
const packageJsonFile = 'package.json'
const tmpGitDir = './tmp/guacamole-client-master'
const distDir = './dist'

// thanks to https://github.com/nodejs/help/issues/2377#issuecomment-569537291
gulp.task('getGuacamole', function (callback) {
    fs.mkdirSync(tmpGitDir, {recursive: true})
    const file = fs.createWriteStream(zipFile);
    https.get('https://github.com/apache/guacamole-client/archive/refs/heads/master.tar.gz', (response) => {
        if (response.statusCode > 300 && response.statusCode < 400 && response.headers.location) {
            if (url.parse(response.headers.location).hostname) {
                https.get(response.headers.location, (data) => {
                    data.pipe(file);
                });
            } else {
                https.get(url.resolve(url.parse(url).hostname, response.headers.location), (data) => {
                    data.pipe(file);
                });
            }
        } else {
            response.pipe(file);
        }
    }).on('error', (error) => {
        console.error(error);
    });

    file.on('finish', () => {
        const comp = fs.createReadStream(zipFile);
        tar.extract({
            cwd: './tmp',
            file: comp.path,
            sync: true
        });

        callback()
    });
})

gulp.task('updateVersion', function (callback) {
    const xmlFile = fs.readFileSync(`${tmpGitDir}/guacamole-common-js/pom.xml`);
    xml2js.parseString(xmlFile, function (parseErr, result) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'))
        packageJson.version = result['project']['version'][0]
        fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2))
        callback()
    }, null)
})

function createJs(format, exportCode) {
    const dir = `${distDir}/${format}`

    return gulp.src(`${tmpGitDir}/guacamole-common-js/src/main/webapp/modules/*.js`)
        .pipe(concat('index.js'))
        .pipe(insert.append(exportCode))
        .pipe(gulp.dest(dir))
        .pipe(uglify())
        .pipe(rename('index.min.js'))
        .pipe(gulp.dest(dir));
}

gulp.task('createEsm', function () {
    return createJs('esm', 'export default Guacamole;')
});

gulp.task('createCjs', function () {
    return createJs('cjs', 'module.exports = Guacamole;')

});

gulp.task('default', gulp.series('getGuacamole', 'updateVersion', 'createEsm', 'createCjs'))
import gulp from 'gulp'
import concat from 'gulp-concat'
import insert from 'gulp-insert'
import fs from 'node:fs'
import xml2js from 'xml2js'
import uglify from 'gulp-uglify'
import rename from 'gulp-rename'
import axios from 'axios'
import {extract} from 'tar'

const tmpDir = './tmp'
const zipFile = `${tmpDir}/guacamole.tar.gz`
const packageJsonFile = 'package.json'
const distDir = './dist'
let taggedDir = ''

gulp.task('getGuacamole', async function () {
    return new Promise(async function(resolve, _) {
        fs.mkdirSync(tmpDir, {recursive: true})
        const file = fs.createWriteStream(zipFile);
        const tagResult = await axios.get('https://api.github.com/repos/apache/guacamole-client/tags')
        const tag = tagResult.data[0].name
        taggedDir = `${tmpDir}/guacamole-client-${tag}`
        const fileResult = await axios.get(`https://github.com/apache/guacamole-client/archive/refs/tags/${tag}.tar.gz`, {
            responseType: 'stream'
        })

        fileResult.data.pipe(file)
        file.on('finish', () => {
            const comp = fs.createReadStream(zipFile);
            extract({
                cwd: './tmp',
                file: comp.path,
                sync: true
            });

            resolve()
        });
    })
})

gulp.task('clean', function(callback) {
    if(fs.existsSync(distDir)) {
        fs.rmSync(distDir, {recursive: true})
    }

    if(fs.existsSync(tmpDir)) {
        fs.rmSync(tmpDir, {recursive: true, force: true})
    }

    callback()
})

gulp.task('updateVersion', function (callback) {
    const xmlFile = fs.readFileSync(`${taggedDir}/guacamole-common-js/pom.xml`);
    xml2js.parseString(xmlFile, function (parseErr, result) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'))
        packageJson.version = result['project']['version'][0]
        fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2))
        callback()
    }, null)
})

function createJs(format, exportCode) {
    const dir = `${distDir}/${format}`

    return gulp.src(`${taggedDir}/guacamole-common-js/src/main/webapp/modules/*.js`)
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

gulp.task('createPlainJs', function () {
    return createJs('js', '')
});

gulp.task('default', gulp.series('clean', 'getGuacamole', 'updateVersion', 'createEsm', 'createCjs', 'createPlainJs'))
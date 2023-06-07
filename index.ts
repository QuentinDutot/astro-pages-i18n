import fs from 'node:fs/promises'
import path from 'node:path'
// import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import chokidar from 'chokidar'

// const __filename = fileURLToPath(import.meta.url)
// const __dirname = path.dirname(__filename)

const consoleLog: typeof console.log = (...args) => console.log('[pages-i18n]', ...args)

const getDirectoryFiles = async (dirPath: string) => {
  const entries = await fs.readdir(dirPath)

  const files: string[] = []

  for (const entry of entries) {
    const isDirectory = !path.extname(entry)

    if (isDirectory) {
      const nestedFiles = await getDirectoryFiles(path.join(dirPath, entry))
      const cleanedFiles = nestedFiles.map((nestedFile) => `${entry}/${nestedFile}`)
      files.push(...cleanedFiles)
    } else {
      files.push(entry)
    }
  }

  return files
}

const getPathTranslation = (path: string, translations: object): string => {
  const [firstKey = '', ...otherKeys] = path.split('/')

  // if it's a nested path explore it recursively
  if (otherKeys.length > 0) {
    const firstTranslated = getPathTranslation(firstKey, translations)
    const otherTranslated = getPathTranslation(otherKeys.join('/'), translations[firstKey] ?? {})
    return `${firstTranslated}/${otherTranslated}`
  }

  let translated: string | object | undefined = translations[firstKey]

  if (typeof translated === 'string') {
    return translated
  }

  if (typeof translated === 'object' && 'index' in translated && typeof translated.index === 'string') {
    return translated.index
  }

  return path
}

interface I18nIntegration {
  langs: string[]
  routes?: object
}

const i18n = ({ langs, routes = {} }: I18nIntegration): AstroIntegration => ({
  name: 'astro-pages-i18n',
  hooks: {
    'astro:config:setup': async ({ config, injectRoute }) => {
      consoleLog('Initializing...')
      // consoleLog('srcDir', config.srcDir)
      // consoleLog('trailingSlash', config.trailingSlash)
      const targetDir = './src/pages-i18n'

      const files = await getDirectoryFiles(targetDir)
      consoleLog('Files detected', files)

      files.forEach((filePath) => {
        const fileWithoutExtension = filePath.replace(path.extname(filePath), '')
        const fileWithoutIndex = fileWithoutExtension.replace('/index', '').replace('index', '')
        // consoleLog('Original', fileWithoutIndex)

        langs.forEach((lang) => {
          const langRoutes = routes[lang] ?? {}
          const pathTranslation = getPathTranslation(fileWithoutIndex, langRoutes)
          // consoleLog('Translated', lang, pathTranslation)

          let pathWithLang = `/${lang}/`
          if (pathTranslation) pathWithLang += pathTranslation
          if (pathTranslation && !pathTranslation.includes('.')) pathWithLang += '/'
          consoleLog('Route injected', pathWithLang)

          injectRoute({
            pattern: pathWithLang,
            entryPoint: `${targetDir}/${filePath}`,
          })
        })
      })

      const watcher = chokidar.watch(targetDir, { ignoreInitial: true })

      watcher.on('change', async (filePath) => {
        consoleLog('File changed', filePath)
        consoleLog('🔍', 'Refresh the page in browser to see the changes. No HMR support yet.')
      })

      watcher.on('add', async (filePath) => {
        consoleLog('File added', filePath)
        consoleLog('🚧', 'Restart needed to rescan files.')
        process.exit(1)
      })

      watcher.on('unlink', async (filePath) => {
        consoleLog('File deleted', filePath)
        consoleLog('🚧', 'Restart needed to rescan files.')
        process.exit(1)
      })
    },
  },
})

export default i18n

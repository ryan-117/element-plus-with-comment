import consola from 'consola'
import chalk from 'chalk'
import { errorAndExit, getWorkspacePackages } from '@element-plus/build-utils'
import type { Project } from '@pnpm/find-workspace-packages'

async function main() {
  const tagVersion = process.env.TAG_VERSION
  const gitHead = process.env.GIT_HEAD
  if (!tagVersion || !gitHead) {
    errorAndExit(
      new Error(
        'No tag version or git head were found, make sure that you set the environment variable $TAG_VERSION \n'
      )
    )
  }

  consola.log(chalk.cyan('Start updating version'))
  consola.log(chalk.cyan(`$TAG_VERSION: ${tagVersion}`))
  consola.log(chalk.cyan(`$GIT_HEAD: ${gitHead}`))

  consola.debug(chalk.yellow(`Updating package.json for element-plus`))

  // 获取当前monorepo中的所有包，包的路径、package.json(manifest字段) 如：
  /*
    {
      '@element-plus/utils': {
        dir: '/Users/hx/Documents/brand-project/brand-plus/packages/utils',
        manifest: {  // manifest就是package.json内容
          name: '@element-plus/utils',
          private: true,
          license: 'MIT',
          main: 'index.ts',
          peerDependencies: [Object]
        },
        writeProjectManifest: [AsyncFunction (anonymous)]
      },
      '@element-plus/play': {
        dir: '/Users/hx/Documents/brand-project/brand-plus/play',
        manifest: {
          name: '@element-plus/play',
          private: true,
          scripts: [Object],
          dependencies: [Object],
          devDependencies: [Object]
        },
        writeProjectManifest: [AsyncFunction (anonymous)]
      }
    }
  */
  const pkgs = Object.fromEntries(
    (await getWorkspacePackages()).map((pkg) => [pkg.manifest.name!, pkg])
  )
  const elementPlus = pkgs['element-plus'] || pkgs['@element-plus/nightly']
  const eslintConfig = pkgs['@element-plus/eslint-config']
  const metadata = pkgs['@element-plus/metadata']

  const writeVersion = async (project: Project) => {
    // writeProjectManifest 将内容写进包的package.json中覆盖
    await project.writeProjectManifest({
      ...project.manifest,
      version: tagVersion,
      gitHead,
    } as any)
  }

  try {
    await writeVersion(elementPlus)
    await writeVersion(eslintConfig)
    await writeVersion(metadata)
  } catch (err: any) {
    errorAndExit(err)
  }

  consola.debug(chalk.green(`$GIT_HEAD: ${gitHead}`))
  consola.success(chalk.green(`Git head updated to ${gitHead}`))
}

main()

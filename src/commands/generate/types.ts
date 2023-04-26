import Base from '../base'
import fs from 'fs'
import { Variable, fetchAllVariables } from '../../api/variables'
import { Flags } from '@oclif/core'

const reactOverrides =
`

declare module '@devcycle/devcycle-react-sdk' {
    import { DVCVariable, DVCVariableValue } from '@devcycle/devcycle-js-sdk'
    export * from '@devcycle/devcycle-react-sdk'

    export function useVariableValue<
        K extends string & keyof DVCVariableTypes,
        T extends DVCVariableValue & DVCVariableTypes[K],
    >(key: K, defaultValue: T): DVCVariable<T>['value']

    export function useVariable<
        K extends string & keyof DVCVariableTypes,
        T extends DVCVariableValue & DVCVariableTypes[K],
    >(key: K, defaultValue: T): DVCVariable<T>
}`

export default class GenerateTypes extends Base {
  static hidden = false
  static description = 'Generate Variable Types from the management API'
  static flags = {
      ...Base.flags,
      'output-dir': Flags.string({
          description: 'Directory to output the generated types to',
          default: '.'
      }),
      'react': Flags.boolean({
          description: 'Generate types for use with React',
          default: false
      }),
  }
  authRequired = true

  public async run(): Promise<void> {
      const { flags } = await this.parse(GenerateTypes)
      await this.requireProject()

      const variables = await fetchAllVariables(this.token, this.projectKey)
      const typesString = this.getTypesString(variables, flags['react'])

      try {
          if (!fs.existsSync(flags['output-dir'])){
              fs.mkdirSync(flags['output-dir'], { recursive: true })
          }
          fs.writeFileSync(`${flags['output-dir']}/dvcVariableTypes.ts`, typesString)
          this.writer.successMessage(`Generated new types to ${flags['output-dir']}/dvcVariableTypes.ts`)
      } catch (err) {
          let message
          if (err instanceof Error) message = err.message
          this.writer.failureMessage(`Unable to write to ${flags['output-dir']}/dvcVariableTypes.ts` + `: ${message}`)
      }
  }

  private getTypesString(variables: Variable[], react: boolean): string {
      let types =
          'type DVCJSON = { [key: string]: string | boolean | number }\n\n' +
          `${!react ? 'export ' : ''}type DVCVariableTypes = {\n` +
          `${variables.map((variable) => `    ${this.getVariableKeyAndtype(variable)}`).join('\n')}` +
          '\n}'
      if (react) {
          types += reactOverrides
      }
      return types
  }

  private getVariableKeyAndtype(variable: Variable): string {
      return `'${variable.key}': ${this.getVariableType(variable)}`
  }

  private getVariableType(variable: Variable): string {
      if (variable.validationSchema && variable.validationSchema.schemaType === 'enum') {
          const enumValues = variable.validationSchema.enumValues
          if (enumValues === undefined || enumValues.length === 0) {
              return variable.type.toLocaleLowerCase()
          }
          return enumValues.map((value) => `'${value}'`).join(' | ')
      }
      if (variable.type === 'JSON') {
          return 'DVCJSON'
      }
      return variable.type.toLocaleLowerCase()
  }
}

import {
  Rule,
  SchematicContext,
  SchematicsException,
  Tree,
  apply,
  branchAndMerge,
  chain,
  filter,
  mergeWith,
  move,
  template,
  url,
} from '@angular-devkit/schematics';
import * as ts from 'typescript';
import {
  stringUtils,
  buildRelativePath,
  insertImport,
  Change,
  InsertChange,
  getProjectPath,
  findModuleFromOptions,
  addImportToModule,
} from '../schematics-core';
import { Schema as StoreOptions } from './schema';

function addImportToNgModule(options: StoreOptions): Rule {
  return (host: Tree) => {
    const modulePath = options.module;

    if (!modulePath) {
      return host;
    }

    if (!host.exists(modulePath)) {
      throw new Error('Specified module does not exist');
    }

    const text = host.read(modulePath);
    if (text === null) {
      throw new SchematicsException(`File ${modulePath} does not exist.`);
    }
    const sourceText = text.toString('utf-8');

    const source = ts.createSourceFile(
      modulePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true
    );

    const statePath = `${options.path}/${options.statePath}`;
    const relativePath = buildRelativePath(modulePath, statePath);
    const environmentsPath = buildRelativePath(
      statePath,
      `/${options.path}/environments/environment`
    );

    const storeNgModuleImport = addImportToModule(
      source,
      modulePath,
      options.root
        ? `StoreModule.forRoot(reducers, { metaReducers })`
        : `StoreModule.forFeature('${stringUtils.camelize(
            options.name
          )}', from${stringUtils.classify(
            options.name
          )}.reducers, { metaReducers: from${stringUtils.classify(
            options.name
          )}.metaReducers })`,
      relativePath
    ).shift();

    let commonImports = [
      insertImport(source, modulePath, 'StoreModule', '@ngrx/store'),
      options.root
        ? insertImport(
            source,
            modulePath,
            'reducers, metaReducers',
            relativePath
          )
        : insertImport(
            source,
            modulePath,
            `* as from${stringUtils.classify(options.name)}`,
            relativePath,
            true
          ),
      storeNgModuleImport,
    ];
    let rootImports: (Change | undefined)[] = [];

    if (options.root) {
      const storeDevtoolsNgModuleImport = addImportToModule(
        source,
        modulePath,
        `!environment.production ? StoreDevtoolsModule.instrument() : []`,
        relativePath
      ).shift();

      rootImports = rootImports.concat([
        insertImport(
          source,
          modulePath,
          'StoreDevtoolsModule',
          '@ngrx/store-devtools'
        ),
        insertImport(source, modulePath, 'environment', environmentsPath),
        storeDevtoolsNgModuleImport,
      ]);
    }

    const changes = [...commonImports, ...rootImports];
    const recorder = host.beginUpdate(modulePath);
    for (const change of changes) {
      if (change instanceof InsertChange) {
        recorder.insertLeft(change.pos, change.toAdd);
      }
    }
    host.commitUpdate(recorder);

    return host;
  };
}

export default function(options: StoreOptions): Rule {
  return (host: Tree, context: SchematicContext) => {
    options.path = getProjectPath(host, options);

    const statePath = `/${options.path}/${options.statePath}/index.ts`;
    const environmentsPath = buildRelativePath(
      statePath,
      `/${options.path}/environments/environment`
    );

    if (options.module) {
      options.module = findModuleFromOptions(host, options);
    }

    if (
      options.root &&
      options.stateInterface &&
      options.stateInterface !== 'State'
    ) {
      options.stateInterface = stringUtils.classify(options.stateInterface);
    }

    const templateSource = apply(url('./files'), [
      template({
        ...stringUtils,
        ...(options as object),
        environmentsPath,
      } as any),
    ]);

    return chain([
      branchAndMerge(
        chain([
          filter(
            path =>
              path.endsWith('.module.ts') &&
              !path.endsWith('-routing.module.ts')
          ),
          addImportToNgModule(options),
          mergeWith(templateSource),
        ])
      ),
    ])(host, context);
  };
}

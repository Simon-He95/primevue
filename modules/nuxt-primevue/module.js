import { addPlugin, addPluginTemplate, addTemplate, createResolver, defineNuxtModule } from '@nuxt/kit';
import { register } from './register';

export default defineNuxtModule({
    meta: {
        name: 'nuxt-primevue',
        configKey: 'primevue',
        compatibility: {
            nuxt: '^3.0.0'
        }
    },
    defaults: {
        usePrimeVue: true,
        resolvePath: undefined,
        layerOrder: 'tailwind-base, primevue, tailwind-utilities',
        importPT: undefined,
        importTheme: undefined,
        unstyled: undefined,
        options: {},
        components: {
            prefix: '',
            name: undefined,
            include: undefined,
            exclude: undefined
        },
        directives: {
            prefix: '',
            name: undefined,
            include: undefined,
            exclude: undefined
        },
        composables: {
            prefix: '',
            name: undefined,
            include: undefined,
            exclude: undefined
        }
    },
    hooks: {},
    setup(moduleOptions, nuxt) {
        const resolver = createResolver(import.meta.url);
        const registered = register(moduleOptions);
        const { importPT, importTheme, options, unstyled } = moduleOptions;
        const hasTheme = importTheme && unstyled !== true && !options.unstyled;

        nuxt.options.runtimeConfig.public.primevue = {
            ...moduleOptions,
            ...registered
        };

        //nuxt.options.build.transpile.push('nuxt');
        nuxt.options.build.transpile.push('primevue');

        const styleContent = () => `
${registered.styles.map((style) => `import ${style.as} from '${style.from}';`).join('\n')}
${
    hasTheme
        ? `import Theme from 'primevue/themes';
import ${importTheme.as} from '${importTheme.from}';\n`
        : ''
}

const styleProps = {
    ${options?.csp?.nonce ? `nonce: ${options?.csp?.nonce}` : ''}
}
const styles = [
  ${registered.injectStylesAsString.join('')},
  ${registered.styles.map((item) => `${item.as} && ${item.as}.getStyleSheet ? ${item.as}.getStyleSheet(undefined, styleProps) : ''`).join(',')}
].join('');

${hasTheme ? `Theme.setTheme(${importTheme.as})` : ''}

const themes = [
    ${hasTheme ? `${registered.styles[0].as} && ${registered.styles[0].as}.getCommonThemeStyleSheet ? ${registered.styles[0].as}.getCommonThemeStyleSheet(undefined, styleProps) : ''` : ''},
    ${hasTheme ? registered.styles.map((item) => `${item.as} && ${item.as}.getThemeStyleSheet ? ${item.as}.getThemeStyleSheet(undefined, styleProps) : ''`).join(',') : ''}
].join('');

export { styles, themes };
`;

        nuxt.options.alias['#primevue-style'] = addTemplate({
            filename: 'primevue-style.mjs',
            getContents: styleContent
        }).dst;

        addPlugin(resolver.resolve('./runtime/plugin.client'));

        addPluginTemplate({
            filename: 'primevue-plugin.mjs',
            getContents() {
                return `
import { defineNuxtPlugin, useRuntimeConfig } from '#imports';
${registered.config.map((config) => `import ${config.as} from '${config.from}';`).join('\n')}
${registered.services.map((service) => `import ${service.as} from '${service.from}';`).join('\n')}
${registered.directives.map((directive) => `import ${directive.as} from '${directive.from}';`).join('\n')}
${importPT ? `import ${importPT.as} from '${importPT.from}';\n` : ''}
${hasTheme ? `import ${importTheme.as} from '${importTheme.from}';\n` : ''}

export default defineNuxtPlugin(({ vueApp }) => {
  const runtimeConfig = useRuntimeConfig();
  const config = runtimeConfig?.public?.primevue ?? {};
  const { usePrimeVue = true, options = {} } = config;
  const pt = ${importPT ? `{ pt: ${importPT.as} }` : `{}`};
  const theme = ${hasTheme ? `{ theme: ${importTheme.as} }` : `{}`};

  usePrimeVue && vueApp.use(${unstyled === true ? 'PrimeVueUnstyled' : unstyled === false ? 'PrimeVueStyled' : 'PrimeVue'}, { ...options, ...pt, ...theme });
  ${registered.services.map((service) => `vueApp.use(${service.as});`).join('\n')}
  ${registered.directives.map((directive) => `vueApp.directive('${directive.name}', ${directive.as});`).join('\n')}
});
        `;
            }
        });

        nuxt.hook('nitro:config', async (config) => {
            config.externals = config.externals || {};
            config.externals.inline = config.externals.inline || [];
            config.externals.inline.push(resolver.resolve('./runtime/plugin.server'));
            config.virtual = config.virtual || {};
            config.virtual['#primevue-style'] = styleContent;
            config.plugins = config.plugins || [];
            config.plugins.push(resolver.resolve('./runtime/plugin.server'));
        });
    }
});

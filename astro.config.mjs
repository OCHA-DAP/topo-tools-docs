// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Empty for a custom domain; "/<repo>" for GitHub's default project-pages
// subpath. Set by .github/workflows/deploy.yml via actions/configure-pages.
const base = process.env.BASE_PATH ?? '';

// https://astro.build/config
export default defineConfig({
	site: 'https://ocha-dap.github.io',
	base,
	integrations: [
		starlight({
			title: 'Topo Tools',
			social: [
				{ icon: 'github', label: 'topo-tools (Python)', href: 'https://github.com/OCHA-DAP/topo-tools-py' },
				{ icon: 'github', label: 'topo-tools (Browser)', href: 'https://github.com/OCHA-DAP/topo-tools-js' },
			],
			sidebar: [
				{
					label: 'topo-tools (Python)',
					items: [
						{ label: 'Tutorials', items: [{ autogenerate: { directory: 'python/tutorials' } }] },
						{ label: 'How-to', items: [{ autogenerate: { directory: 'python/how-to' } }] },
						{ label: 'Explanation', items: [{ autogenerate: { directory: 'python/explanation' } }] },
						{ label: 'Reference', items: [{ autogenerate: { directory: 'python/reference' } }] },
					],
				},
				{
					label: 'topo-tools (Browser)',
					items: [
						{ label: 'Tutorials', items: [{ autogenerate: { directory: 'js/tutorials' } }] },
						{ label: 'How-to', items: [{ autogenerate: { directory: 'js/how-to' } }] },
						{ label: 'Explanation', items: [{ autogenerate: { directory: 'js/explanation' } }] },
						{ label: 'Reference', items: [{ autogenerate: { directory: 'js/reference' } }] },
					],
				},
			],
		}),
	],
});

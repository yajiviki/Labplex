// next.config.js
module.exports = {
	output: 'standalone',
	experimental: {
		outputFileTracingIncludes: {
			// include Prisma engines
			'/**/*': ['node_modules/.prisma/client/**', 'node_modules/@prisma/client/**', 'node_modules/sharp/**/*'],
		},
	},
};
